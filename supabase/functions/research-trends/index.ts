import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========================
// RATE LIMITER — divide free quotas across 31 days
// ========================
// YouTube Data API: 10,000 units/day → each mostPopular=1 unit, search=100 units
//   Per call: 2 mostPopular (2 units) + 2 searches (200 units) = ~202 units
//   10,000/day ÷ 202 = ~49 calls/day safe → run hourly (24/day) is fine
//   Monthly: 24 × 31 = 744 calls, well within 310,000 monthly units
//
// NewsAPI free: 100 requests/day → 100/31 ≈ 3/day → every 8h
// Reddit free: 60 req/min, 100/day unofficial → 100/31 ≈ 3/day → every 8h
// Google Trends RSS: unlimited → every hour
//
// Strategy: check current hour, only call expensive APIs at specific hours

function getDailyBudget(monthlyLimit: number, daysInMonth = 31): number {
  return Math.floor(monthlyLimit / daysInMonth);
}

function shouldCallApi(apiName: string, currentHour: number): boolean {
  switch (apiName) {
    case "google_trends":
      // Free unlimited RSS — call every time
      return true;

    case "youtube":
      // 10k units/day, ~202 per run. Safe up to 49x/day.
      // Run every 2 hours to be conservative = 12x/day = 2,424 units/day
      return currentHour % 2 === 0;

    case "reddit":
      // ~100 req/day free → budget 3/day (every 8h)
      return [6, 14, 22].includes(currentHour);

    case "newsapi":
      // 100 req/day free → budget 3/day (every 8h)
      return [8, 16, 0].includes(currentHour);

    default:
      return false;
  }
}

async function checkDailyUsage(supabase: any, apiName: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const { count } = await supabase
    .from("system_logs")
    .select("id", { count: "exact", head: true })
    .eq("event_type", `api_call_${apiName}`)
    .gte("created_at", `${today}T00:00:00Z`);
  return count || 0;
}

const DAILY_LIMITS: Record<string, number> = {
  youtube: getDailyBudget(31 * 12, 31),    // 12 calls/day
  reddit: getDailyBudget(31 * 3, 31),      // 3 calls/day
  newsapi: getDailyBudget(31 * 3, 31),     // 3 calls/day
  google_trends: 999,                       // unlimited
};

async function logApiCall(supabase: any, apiName: string, unitsUsed: number) {
  await supabase.from("system_logs").insert({
    event_type: `api_call_${apiName}`,
    message: `API call: ${apiName} — ${unitsUsed} units used`,
    level: "debug",
    metadata: { api: apiName, units: unitsUsed, timestamp: new Date().toISOString() },
  });
}

// ========================
// DATA FETCHERS
// ========================

async function fetchGoogleTrends(): Promise<string[]> {
  try {
    const res = await fetch("https://trends.google.com/trending/rss?geo=BR");
    if (!res.ok) return [];
    const xml = await res.text();
    const titles: string[] = [];
    const matches = xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g);
    for (const m of matches) {
      if (m[1] && m[1] !== "Daily Search Trends") titles.push(m[1]);
    }
    return titles.slice(0, 20);
  } catch (e) {
    console.error("Google Trends error:", e);
    return [];
  }
}

async function fetchYouTubeTrending(apiKey: string, regionCode: string): Promise<any[]> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${regionCode}&maxResults=25&videoCategoryId=27&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`YouTube API ${res.status} for ${regionCode}`);
      return [];
    }
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      video_title: item.snippet?.title || "",
      video_url: `https://www.youtube.com/watch?v=${item.id}`,
      creator: item.snippet?.channelTitle || "",
      creator_url: `https://www.youtube.com/channel/${item.snippet?.channelId}`,
      total_views: formatViews(item.statistics?.viewCount),
      platform: "youtube",
      region: regionCode,
      category: item.snippet?.categoryId,
      published_at: item.snippet?.publishedAt,
    }));
  } catch (e) {
    console.error(`YouTube API error for ${regionCode}:`, e);
    return [];
  }
}

async function searchYouTubeNiche(apiKey: string, query: string): Promise<any[]> {
  try {
    const q = encodeURIComponent(query);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&order=viewCount&publishedAfter=${getDateDaysAgo(7)}&maxResults=10&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      video_title: item.snippet?.title || "",
      video_url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
      creator: item.snippet?.channelTitle || "",
      creator_url: `https://www.youtube.com/channel/${item.snippet?.channelId}`,
      platform: "youtube",
      published_at: item.snippet?.publishedAt,
    }));
  } catch (e) {
    console.error("YouTube search error:", e);
    return [];
  }
}

async function fetchRedditTrending(clientId: string, clientSecret: string): Promise<any[]> {
  try {
    const authRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!authRes.ok) return [];
    const auth = await authRes.json();

    const subreddits = ["psychology", "mentalhealth", "selfimprovement", "getdisciplined"];
    const posts: any[] = [];

    for (const sub of subreddits) {
      const res = await fetch(`https://oauth.reddit.com/r/${sub}/hot?limit=5`, {
        headers: { Authorization: `Bearer ${auth.access_token}`, "User-Agent": "TrendBot/1.0" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const post of (data.data?.children || [])) {
        posts.push({
          title: post.data?.title,
          url: `https://reddit.com${post.data?.permalink}`,
          score: post.data?.score,
          comments: post.data?.num_comments,
          subreddit: sub,
        });
      }
    }
    return posts.sort((a, b) => b.score - a.score).slice(0, 15);
  } catch (e) {
    console.error("Reddit error:", e);
    return [];
  }
}

async function fetchMentalHealthNews(apiKey: string): Promise<any[]> {
  try {
    const q = encodeURIComponent("saúde mental OR psicologia OR ansiedade OR terapia");
    const url = `https://newsapi.org/v2/everything?q=${q}&language=pt&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles || []).map((a: any) => ({
      title: a.title,
      url: a.url,
      source: a.source?.name,
      published_at: a.publishedAt,
    }));
  } catch (e) {
    console.error("NewsAPI error:", e);
    return [];
  }
}

function formatViews(count: string | undefined): string {
  if (!count) return "";
  const n = parseInt(count);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M views`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K views`;
  return `${n} views`;
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const currentHour = new Date().getUTCHours();

    // Load API keys from settings
    const { data: allSettings } = await supabase.from("settings").select("key, value");
    const getSetting = (key: string) => {
      const s = allSettings?.find((s: any) => s.key === key);
      if (!s) return null;
      const v = s.value;
      return typeof v === "string" ? v.replace(/^"|"$/g, "") : v;
    };

    const youtubeApiKey = getSetting("youtube_data_api_key") as string | null;
    const redditClientId = getSetting("reddit_client_id") as string | null;
    const redditSecret = getSetting("reddit_client_secret") as string | null;
    const newsApiKey = getSetting("newsapi_key") as string | null;

    // Check rate limits before calling each API
    const promises: Promise<any>[] = [fetchGoogleTrends()];
    const apisCalled: string[] = ["google_trends"];
    const apisSkipped: string[] = [];

    if (youtubeApiKey && shouldCallApi("youtube", currentHour)) {
      const ytUsage = await checkDailyUsage(supabase, "youtube");
      if (ytUsage < DAILY_LIMITS.youtube) {
        promises.push(fetchYouTubeTrending(youtubeApiKey, "BR"));
        promises.push(fetchYouTubeTrending(youtubeApiKey, "US"));
        promises.push(searchYouTubeNiche(youtubeApiKey, "psicologia saúde mental ansiedade"));
        promises.push(searchYouTubeNiche(youtubeApiKey, "psychology mental health anxiety self improvement"));
        apisCalled.push("youtube");
      } else {
        apisSkipped.push("youtube (daily limit reached)");
      }
    } else if (youtubeApiKey) {
      apisSkipped.push("youtube (rate schedule)");
    }

    if (redditClientId && redditSecret && shouldCallApi("reddit", currentHour)) {
      const redditUsage = await checkDailyUsage(supabase, "reddit");
      if (redditUsage < DAILY_LIMITS.reddit) {
        promises.push(fetchRedditTrending(redditClientId, redditSecret));
        apisCalled.push("reddit");
      } else {
        apisSkipped.push("reddit (daily limit reached)");
      }
    } else if (redditClientId) {
      apisSkipped.push("reddit (rate schedule)");
    }

    if (newsApiKey && shouldCallApi("newsapi", currentHour)) {
      const newsUsage = await checkDailyUsage(supabase, "newsapi");
      if (newsUsage < DAILY_LIMITS.newsapi) {
        promises.push(fetchMentalHealthNews(newsApiKey));
        apisCalled.push("newsapi");
      } else {
        apisSkipped.push("newsapi (daily limit reached)");
      }
    } else if (newsApiKey) {
      apisSkipped.push("newsapi (rate schedule)");
    }

    const results = await Promise.allSettled(promises);
    const googleTrends = (results[0] as any)?.value || [];

    let ytBR: any[] = [], ytUS: any[] = [], ytNicheBR: any[] = [], ytNicheEN: any[] = [];
    let redditPosts: any[] = [], news: any[] = [];
    let idx = 1;

    if (apisCalled.includes("youtube")) {
      ytBR = (results[idx++] as any)?.value || [];
      ytUS = (results[idx++] as any)?.value || [];
      ytNicheBR = (results[idx++] as any)?.value || [];
      ytNicheEN = (results[idx++] as any)?.value || [];
      await logApiCall(supabase, "youtube", 202);
    }
    if (apisCalled.includes("reddit")) {
      redditPosts = (results[idx++] as any)?.value || [];
      await logApiCall(supabase, "reddit", 1);
    }
    if (apisCalled.includes("newsapi")) {
      news = (results[idx++] as any)?.value || [];
      await logApiCall(supabase, "newsapi", 1);
    }

    // If APIs were skipped this hour, load cached data
    if (!apisCalled.includes("youtube") || !apisCalled.includes("reddit") || !apisCalled.includes("newsapi")) {
      const { data: cached } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "viral_intelligence")
        .single();

      if (cached?.value) {
        const cv = cached.value as any;
        if (!apisCalled.includes("youtube") && cv.competitor_analysis?.length) {
          ytBR = cv.competitor_analysis || [];
          ytUS = cv.world_ranking || [];
        }
        if (!apisCalled.includes("reddit") && cv.reddit_trending?.length) {
          redditPosts = cv.reddit_trending || [];
        }
        if (!apisCalled.includes("newsapi") && cv.news_trending?.length) {
          news = cv.news_trending || [];
        }
      }
    }

    const dataSources: string[] = apisCalled;

    console.log(`Data fetched — Called: ${apisCalled.join(",")} | Skipped: ${apisSkipped.join(",") || "none"} | Google: ${googleTrends.length}, YT BR: ${ytBR.length}, YT US: ${ytUS.length}, Reddit: ${redditPosts.length}, News: ${news.length}`);

    // Build rankings
    const brRanking = [...ytBR, ...ytNicheBR].slice(0, 10).map((v: any, i: number) => ({
      ...v,
      rank: i + 1,
      momentum_score: Math.max(50, 95 - i * 5),
      why_relevant: "Vídeo real do YouTube Trending/Search",
    }));

    const worldRanking = [...ytUS, ...ytNicheEN].slice(0, 10).map((v: any, i: number) => ({
      ...v,
      rank: i + 1,
      momentum_score: Math.max(50, 95 - i * 5),
      country: v.region === "US" ? "Estados Unidos" : "Internacional",
      why_relevant: "Vídeo real do YouTube Trending/Search mundial",
      adaptation_guide: "Traduzir e adaptar para o contexto brasileiro",
    }));

    // Save results
    const viralData = {
      viral_patterns: {
        trending_hashtags: googleTrends.slice(0, 15).map((t: string) => `#${t.replace(/\s+/g, "").toLowerCase()}`),
        google_trends: googleTrends,
        best_posting_times: ["07:00-09:00", "12:00-13:00", "19:00-21:00"],
      },
      competitor_analysis: brRanking,
      world_ranking: worldRanking,
      reddit_trending: redditPosts.slice(0, 10),
      news_trending: news.slice(0, 10),
      data_sources: dataSources,
      apis_skipped: apisSkipped,
      rate_limits: {
        youtube: `${DAILY_LIMITS.youtube} calls/day (every 2h)`,
        reddit: `${DAILY_LIMITS.reddit} calls/day (every 8h)`,
        newsapi: `${DAILY_LIMITS.newsapi} calls/day (every 8h)`,
        google_trends: "unlimited",
      },
      data_source: apisCalled.includes("youtube") ? "youtube_data_api_real" : "cached+google_trends",
      updated_at: new Date().toISOString(),
    };

    await supabase.from("settings").upsert({
      key: "viral_intelligence",
      value: viralData,
    }, { onConflict: "key" });

    // Save video snapshots only when YouTube was freshly called
    if (apisCalled.includes("youtube")) {
      for (const v of [...brRanking, ...worldRanking].slice(0, 15)) {
        if (v.video_url) {
          await supabase.from("video_snapshots").insert({
            video_title: v.video_title || "",
            creator: v.creator || "",
            platform: "youtube",
            region: v.region || "BR",
            total_views: v.total_views || "",
            momentum_score: v.momentum_score || 0,
            metadata: { video_url: v.video_url, source: "api_real" },
          });
        }
      }
    }

    // Log
    await supabase.from("system_logs").insert({
      event_type: "pesquisa",
      message: `📊 Rate-limited: ${apisCalled.join("+")} chamados | ${apisSkipped.join(", ") || "nenhum"} pulados — BR:${brRanking.length} Mundo:${worldRanking.length} Trends:${googleTrends.length} Reddit:${redditPosts.length} News:${news.length}`,
      level: "info",
      metadata: { called: apisCalled, skipped: apisSkipped, counts: { br: brRanking.length, world: worldRanking.length, trends: googleTrends.length, reddit: redditPosts.length, news: news.length } },
    });

    return new Response(JSON.stringify({
      competitor_analysis: brRanking,
      world_ranking: worldRanking,
      viral_patterns: viralData.viral_patterns,
      reddit_trending: redditPosts.slice(0, 10),
      news_trending: news.slice(0, 10),
      data_sources: dataSources,
      apis_skipped: apisSkipped,
      rate_limits: viralData.rate_limits,
      data_source: viralData.data_source,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("research-trends error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
