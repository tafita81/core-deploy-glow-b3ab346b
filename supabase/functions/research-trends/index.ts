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

// ========================
// HARD LIMITS — never exceed these
// ========================
// YouTube Data API v3: 10,000 units/day
//   mostPopular = 1 unit, search = 100 units
//   Per run: 2 mostPopular (2 units) + 2 searches (200 units) = 202 units
//   Safe max: floor(10000 / 202) = 49 calls/day → use 10/day for safety margin
//
// Reddit API: 60 req/min, effectively unlimited daily but be respectful → 3/day
//
// NewsAPI: 100 req/day → 3/day to stay safe
//
// SerpAPI: 100 searches/MONTH → floor(100/31) = 3/day, track monthly too
//
// Google Trends RSS: unlimited, no key needed

const API_LIMITS = {
  youtube: { daily_calls: 8, daily_units: 10000, units_per_call: 305 },
  reddit: { daily_calls: 3 },
  newsapi: { daily_calls: 3, daily_requests: 100 },
  serpapi: { monthly_searches: 100, daily_calls: 3 },
  google_trends: { daily_calls: 999 }, // unlimited RSS
};

function shouldCallApi(apiName: string, currentHour: number): boolean {
  switch (apiName) {
    case "google_trends":
      return true;
    case "youtube":
      // Spread 10 calls across 24h → every ~2.4h, use even hours
      return currentHour % 2 === 0;
    case "reddit":
      return [6, 14, 22].includes(currentHour);
    case "newsapi":
      return [8, 16, 0].includes(currentHour);
    case "serpapi":
      return [10, 18].includes(currentHour); // 2x/day max
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

async function checkMonthlyUsage(supabase: any, apiName: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count } = await supabase
    .from("system_logs")
    .select("id", { count: "exact", head: true })
    .eq("event_type", `api_call_${apiName}`)
    .gte("created_at", monthStart);
  return count || 0;
}

async function checkDailyUnits(supabase: any, apiName: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("system_logs")
    .select("metadata")
    .eq("event_type", `api_call_${apiName}`)
    .gte("created_at", `${today}T00:00:00Z`);
  let total = 0;
  for (const row of data || []) {
    total += (row.metadata as any)?.units || 0;
  }
  return total;
}

// Returns { allowed: boolean, reason: string }
async function canCallApi(supabase: any, apiName: string, currentHour: number, forceSchedule = false): Promise<{ allowed: boolean; reason: string }> {
  // 1. Schedule check (skip if forced)
  if (!forceSchedule && !shouldCallApi(apiName, currentHour)) {
    return { allowed: false, reason: "fora do horário programado" };
  }

  const limits = API_LIMITS[apiName as keyof typeof API_LIMITS];
  if (!limits) return { allowed: false, reason: "API desconhecida" };

  // 2. Daily call count check
  const dailyCalls = await checkDailyUsage(supabase, apiName);
  const maxDaily = (limits as any).daily_calls || 999;
  if (dailyCalls >= maxDaily) {
    return { allowed: false, reason: `limite diário atingido (${dailyCalls}/${maxDaily} chamadas)` };
  }

  // 3. Daily units check (YouTube)
  if ((limits as any).daily_units) {
    const usedUnits = await checkDailyUnits(supabase, apiName);
    const maxUnits = (limits as any).daily_units;
    const nextCallUnits = (limits as any).units_per_call || 0;
    if (usedUnits + nextCallUnits > maxUnits) {
      return { allowed: false, reason: `limite de unidades diárias atingido (${usedUnits}/${maxUnits} units)` };
    }
  }

  // 4. Monthly check (SerpAPI)
  if ((limits as any).monthly_searches) {
    const monthlyUsage = await checkMonthlyUsage(supabase, apiName);
    const maxMonthly = (limits as any).monthly_searches;
    if (monthlyUsage >= maxMonthly) {
      return { allowed: false, reason: `limite MENSAL atingido (${monthlyUsage}/${maxMonthly}) — aguardando próximo mês` };
    }
  }

  return { allowed: true, reason: "ok" };
}

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
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${regionCode}&maxResults=25&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`YouTube API ${res.status} for ${regionCode}`);
      return [];
    }
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      video_title: item.snippet?.title || "",
      description: item.snippet?.description || "",
      channel_title: item.snippet?.channelTitle || "",
      video_url: `https://www.youtube.com/watch?v=${item.id}`,
      creator: item.snippet?.channelTitle || "",
      creator_url: `https://www.youtube.com/channel/${item.snippet?.channelId}`,
      total_views: formatViews(item.statistics?.viewCount),
      raw_views: parseInt(item.statistics?.viewCount || "0"),
      likes: parseInt(item.statistics?.likeCount || "0"),
      comments: parseInt(item.statistics?.commentCount || "0"),
      platform: "youtube",
      region: regionCode,
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
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&order=viewCount&publishedAfter=${getDateDaysAgo(7)}&maxResults=10&key=${apiKey}`;
    const res = await fetch(searchUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const videoIds = (data.items || []).map((item: any) => item.id?.videoId).filter(Boolean);
    if (videoIds.length === 0) return [];

    // Fetch actual view counts for each video
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(",")}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    if (!statsRes.ok) {
      // Fallback without stats
      return (data.items || []).map((item: any) => ({
        video_title: item.snippet?.title || "",
        video_url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
        creator: item.snippet?.channelTitle || "",
        platform: "youtube",
        published_at: item.snippet?.publishedAt,
      }));
    }
    const statsData = await statsRes.json();
    return (statsData.items || []).map((item: any) => ({
      video_title: item.snippet?.title || "",
      description: item.snippet?.description || "",
      channel_title: item.snippet?.channelTitle || "",
      video_url: `https://www.youtube.com/watch?v=${item.id}`,
      creator: item.snippet?.channelTitle || "",
      creator_url: `https://www.youtube.com/channel/${item.snippet?.channelId}`,
      total_views: formatViews(item.statistics?.viewCount),
      raw_views: parseInt(item.statistics?.viewCount || "0"),
      likes: parseInt(item.statistics?.likeCount || "0"),
      comments: parseInt(item.statistics?.commentCount || "0"),
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

    // Parse body for force flag
    let forceAll = false;
    try {
      const body = await req.json();
      forceAll = body?.force === true;
    } catch { /* no body */ }

    const currentHour = forceAll ? 0 : new Date().getUTCHours(); // hour 0 matches youtube (even), newsapi, etc.

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

    // Check rate limits before calling each API (daily + monthly + units)
    const promises: Promise<any>[] = [fetchGoogleTrends()];
    const apisCalled: string[] = ["google_trends"];
    const apisSkipped: string[] = [];

    if (youtubeApiKey) {
      const check = await canCallApi(supabase, "youtube", currentHour, forceAll);
      if (check.allowed) {
        // BRASIL — trending geral + busca focada em psicologia
        promises.push(fetchYouTubeTrending(youtubeApiKey, "BR"));
        promises.push(searchYouTubeNiche(youtubeApiKey, "psicologia saúde mental terapia ansiedade depressão"));
        // MUNDIAL (EUA + Europa) — prioridade, menos riscos
        promises.push(fetchYouTubeTrending(youtubeApiKey, "US"));
        promises.push(searchYouTubeNiche(youtubeApiKey, "psychology therapy mental health anxiety depression self improvement"));
        promises.push(fetchYouTubeTrending(youtubeApiKey, "GB")); // Reino Unido
        promises.push(searchYouTubeNiche(youtubeApiKey, "psychologie therapie mentale gesundheit angst")); // Alemanha
        apisCalled.push("youtube");
      } else {
        apisSkipped.push(`youtube (${check.reason})`);
      }
    }

    if (redditClientId && redditSecret) {
      const check = await canCallApi(supabase, "reddit", currentHour, forceAll);
      if (check.allowed) {
        promises.push(fetchRedditTrending(redditClientId, redditSecret));
        apisCalled.push("reddit");
      } else {
        apisSkipped.push(`reddit (${check.reason})`);
      }
    }

    if (newsApiKey) {
      const check = await canCallApi(supabase, "newsapi", currentHour, forceAll);
      if (check.allowed) {
        promises.push(fetchMentalHealthNews(newsApiKey));
        apisCalled.push("newsapi");
      } else {
        apisSkipped.push(`newsapi (${check.reason})`);
      }
    }

    // SerpAPI monthly limit check
    const serpApiKey = getSetting("serpapi_key") as string | null;
    if (serpApiKey) {
      const check = await canCallApi(supabase, "serpapi", currentHour, forceAll);
      if (check.allowed) {
        apisCalled.push("serpapi");
        await logApiCall(supabase, "serpapi", 1);
      } else {
        apisSkipped.push(`serpapi (${check.reason})`);
      }
    }

    const results = await Promise.allSettled(promises);
    const googleTrends = (results[0] as any)?.value || [];

    let ytBR: any[] = [], ytNicheBR: any[] = [];
    let ytUS: any[] = [], ytNicheEN: any[] = [], ytGB: any[] = [], ytNicheDE: any[] = [];
    let redditPosts: any[] = [], news: any[] = [];
    let idx = 1;

    if (apisCalled.includes("youtube")) {
      ytBR = (results[idx++] as any)?.value || [];
      ytNicheBR = (results[idx++] as any)?.value || [];
      ytUS = (results[idx++] as any)?.value || [];
      ytNicheEN = (results[idx++] as any)?.value || [];
      ytGB = (results[idx++] as any)?.value || [];
      ytNicheDE = (results[idx++] as any)?.value || [];
      // 2 trending (1 unit each) + 3 searches (100 units each) + 3 stats calls (~1 each) ≈ 305 units
      await logApiCall(supabase, "youtube", 305);
    }
    if (apisCalled.includes("reddit")) {
      redditPosts = (results[idx++] as any)?.value || [];
      await logApiCall(supabase, "reddit", 5); // 1 auth + 4 subreddit calls
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

    // ===== FILTRO DE PSICOLOGIA (restritivo) =====
    // Termos específicos — evita falsos positivos como "mind-blowing", "brainrot"
    const psychExact = [
      "psicolog", "psycholog", "mental health", "saúde mental", "terapia cognitiv",
      "therap", "ansiedade", "anxiety disorder", "depressão", "depression",
      "autoconhecimento", "self improvement", "self-improvement",
      "narcisis", "narcisist", "trauma psic", "ptsd", "mindfulness",
      "meditação", "meditation practice", "burnout", "transtorno",
      "bipolar", "adhd", "tdah", "autismo", "autism spectrum",
      "toxic relationship", "relacionamento tóxic", "attachment style", "apego",
      "neurociência", "neuroscience", "cognitive behavior", "comportament",
      "resiliência", "resilience", "autocuidado", "self-care", "self care",
      "bem-estar mental", "mental wellbeing", "mental wellness",
      "psychotherap", "psicotera", "aconselhamento", "counseling",
      "panic attack", "pânico", "obsessive compulsive", "ocd", "toc",
      "autoestima", "self-esteem", "self esteem", "emotional intelligence",
      "inteligência emocional", "emotional regulation", "regulação emocional",
      "inner child", "criança interior", "shadow work", "sombra",
      "psychology tips", "dicas de psicologia", "mental health awareness",
      "saúde emocional", "emotional health", "psychology explained",
      "psicólogo", "psychologist", "psychiatr", "psiquiatr",
      "anxiety tips", "overcome depression", "superar depressão",
      "self development", "desenvolvimento pessoal", "personal development",
      "stoicism", "estoicismo", "emotional healing", "cura emocional",
    ];

    function isPsychRelated(video: any): boolean {
      const title = `${video.video_title || ""}`.toLowerCase();
      const channel = `${video.channel_title || ""}`.toLowerCase();
      const desc = `${video.description || ""}`.toLowerCase();
      
      // Strong match: keyword in title or channel name → definitely relevant
      const titleMatch = psychExact.some(kw => title.includes(kw) || channel.includes(kw));
      if (titleMatch) return true;
      
      // Weak match: keyword only in description → need at least 3 different keywords
      const descMatches = psychExact.filter(kw => desc.includes(kw));
      return descMatches.length >= 3;
    }

    // Build rankings — sorted by VIDEO views, ONLY psychology/mental health
    // BRASIL — trending + psicologia (filtrado)
    const brRanking = [...ytBR, ...ytNicheBR]
      .filter(isPsychRelated)
      .sort((a: any, b: any) => (b.raw_views || 0) - (a.raw_views || 0))
      .slice(0, 10)
      .map((v: any, i: number) => ({
        ...v,
        rank: i + 1,
        momentum_score: Math.max(50, 95 - i * 5),
        why_relevant: `🇧🇷 ${v.total_views || "N/A"} views`,
      }));

    // MUNDIAL (EUA + Europa) — prioridade máxima, FILTRADO psicologia
    const worldRanking = [...ytUS, ...ytNicheEN, ...ytGB, ...ytNicheDE]
      .filter((v: any) => v.region !== "BR")
      .filter(isPsychRelated)
      .sort((a: any, b: any) => (b.raw_views || 0) - (a.raw_views || 0))
      .slice(0, 15)
      .map((v: any, i: number) => {
        const regionMap: Record<string, string> = { US: "🇺🇸 EUA", GB: "🇬🇧 Reino Unido", DE: "🇩🇪 Alemanha" };
        const country = regionMap[v.region] || "🌍 Internacional";
        return {
          ...v,
          rank: i + 1,
          momentum_score: Math.max(50, 98 - i * 3),
          country,
          why_relevant: `${country} — ${v.total_views || "N/A"} views`,
          adaptation_guide: "Traduzir, adaptar culturalmente e focar no gancho emocional para público BR",
          risk_level: "baixo",
        };
      });

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
        youtube: { limit: "10.000 units/dia", calls_max: `${API_LIMITS.youtube.daily_calls}/dia`, units_per_call: API_LIMITS.youtube.units_per_call },
        reddit: { limit: "60 req/min", calls_max: `${API_LIMITS.reddit.daily_calls}/dia` },
        newsapi: { limit: "100 req/dia", calls_max: `${API_LIMITS.newsapi.daily_calls}/dia` },
        serpapi: { limit: "100 buscas/mês", calls_max: `${API_LIMITS.serpapi.daily_calls}/dia` },
        google_trends: { limit: "ilimitado (RSS)" },
      },
      data_source: apisCalled.includes("youtube") ? "youtube_data_api_real" : "cached+google_trends",
      updated_at: new Date().toISOString(),
    };

    await supabase.from("settings").upsert({
      key: "viral_intelligence",
      value: viralData,
    }, { onConflict: "key" });

    // Save video snapshots with view growth tracking
    if (apisCalled.includes("youtube")) {
      // Prioritize world ranking (more snapshots saved)
      const allVideos = [...worldRanking, ...brRanking];
      for (const v of allVideos.slice(0, 20)) {
        if (!v.video_url) continue;

        // Check previous snapshot for this video to calculate growth
        const { data: prevSnapshot } = await supabase
          .from("video_snapshots")
          .select("total_views, snapshot_hour")
          .eq("metadata->>video_url", v.video_url)
          .order("snapshot_hour", { ascending: false })
          .limit(1)
          .single();

        const prevViews = prevSnapshot ? parseInt(prevSnapshot.total_views || "0") : 0;
        const currentViews = v.raw_views || 0;
        const viewsGrowth = prevViews > 0 ? currentViews - prevViews : 0;
        const hoursElapsed = prevSnapshot
          ? Math.max(1, (Date.now() - new Date(prevSnapshot.snapshot_hour).getTime()) / 3600000)
          : 1;
        const viewsPerHour = Math.round(viewsGrowth / hoursElapsed);

        await supabase.from("video_snapshots").insert({
          video_title: v.video_title || "",
          creator: v.creator || "",
          platform: "youtube",
          region: v.region || v.country || "BR",
          total_views: String(currentViews),
          views_growth_1h: viewsPerHour > 0 ? `+${formatViews(String(viewsPerHour))}/h` : "0/h",
          momentum_score: v.momentum_score || 0,
          acceleration: viewsPerHour > 10000 ? "🔥 explodindo" : viewsPerHour > 1000 ? "📈 crescendo" : viewsPerHour > 0 ? "➡️ estável" : "⏸️ sem dados",
          metadata: {
            video_url: v.video_url,
            raw_views: currentViews,
            prev_views: prevViews,
            views_growth: viewsGrowth,
            views_per_hour: viewsPerHour,
            country: v.country || v.region,
            risk_level: v.risk_level || "normal",
            source: "api_real",
          },
        });
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
