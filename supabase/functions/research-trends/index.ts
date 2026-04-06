import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fetch Google Trends RSS (100% free, no API key)
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

// Fetch YouTube trending via Data API v3 (free: 10k units/day)
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

// Search YouTube for psychology niche videos
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

// Fetch Reddit trending from psychology subreddits (free, needs client_id)
async function fetchRedditTrending(clientId: string, clientSecret: string): Promise<any[]> {
  try {
    // Get access token
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

// Fetch news about mental health (free: 100/day)
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

    // Fetch ALL available data sources in parallel
    const promises: Promise<any>[] = [fetchGoogleTrends()];

    if (youtubeApiKey) {
      promises.push(fetchYouTubeTrending(youtubeApiKey, "BR"));
      promises.push(fetchYouTubeTrending(youtubeApiKey, "US"));
      promises.push(searchYouTubeNiche(youtubeApiKey, "psicologia saúde mental ansiedade"));
      promises.push(searchYouTubeNiche(youtubeApiKey, "psychology mental health anxiety self improvement"));
    }
    if (redditClientId && redditSecret) {
      promises.push(fetchRedditTrending(redditClientId, redditSecret));
    }
    if (newsApiKey) {
      promises.push(fetchMentalHealthNews(newsApiKey));
    }

    const results = await Promise.allSettled(promises);
    const googleTrends = (results[0] as any)?.value || [];

    let ytBR: any[] = [], ytUS: any[] = [], ytNicheBR: any[] = [], ytNicheEN: any[] = [];
    let redditPosts: any[] = [], news: any[] = [];
    let idx = 1;

    if (youtubeApiKey) {
      ytBR = (results[idx++] as any)?.value || [];
      ytUS = (results[idx++] as any)?.value || [];
      ytNicheBR = (results[idx++] as any)?.value || [];
      ytNicheEN = (results[idx++] as any)?.value || [];
    }
    if (redditClientId && redditSecret) {
      redditPosts = (results[idx++] as any)?.value || [];
    }
    if (newsApiKey) {
      news = (results[idx++] as any)?.value || [];
    }

    const dataSources: string[] = ["google_trends"];
    if (ytBR.length > 0 || ytUS.length > 0) dataSources.push("youtube_data_api");
    if (redditPosts.length > 0) dataSources.push("reddit");
    if (news.length > 0) dataSources.push("newsapi");

    console.log(`Data fetched — Google Trends: ${googleTrends.length}, YT BR: ${ytBR.length}, YT US: ${ytUS.length}, YT Niche BR: ${ytNicheBR.length}, YT Niche EN: ${ytNicheEN.length}, Reddit: ${redditPosts.length}, News: ${news.length}`);

    // Build rankings from real data
    const brRanking = [...ytBR, ...ytNicheBR].slice(0, 10).map((v, i) => ({
      ...v,
      rank: i + 1,
      momentum_score: Math.max(50, 95 - i * 5),
      why_relevant: "Vídeo real do YouTube Trending/Search",
    }));

    const worldRanking = [...ytUS, ...ytNicheEN].slice(0, 10).map((v, i) => ({
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
      data_source: dataSources.includes("youtube_data_api") ? "youtube_data_api_real" : "google_trends_real",
      updated_at: new Date().toISOString(),
    };

    await supabase.from("settings").upsert({
      key: "viral_intelligence",
      value: viralData,
    }, { onConflict: "key" });

    // Save video snapshots
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

    // Log
    await supabase.from("system_logs").insert({
      event_type: "pesquisa",
      message: `📊 Dados REAIS: ${dataSources.join(" + ")} — ${brRanking.length} BR, ${worldRanking.length} mundo, ${googleTrends.length} trends Google, ${redditPosts.length} Reddit, ${news.length} notícias`,
      level: "info",
      metadata: { sources: dataSources, counts: { br: brRanking.length, world: worldRanking.length, trends: googleTrends.length, reddit: redditPosts.length, news: news.length } },
    });

    return new Response(JSON.stringify({
      competitor_analysis: brRanking,
      world_ranking: worldRanking,
      viral_patterns: viralData.viral_patterns,
      reddit_trending: redditPosts.slice(0, 10),
      news_trending: news.slice(0, 10),
      data_sources: dataSources,
      data_source: viralData.data_source,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("research-trends error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
