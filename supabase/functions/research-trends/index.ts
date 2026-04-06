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
    // Get 50 trending (max allowed) for broader coverage
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${regionCode}&maxResults=50&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`YouTube API ${res.status} for ${regionCode}`);
      return [];
    }
    const data = await res.json();
    return (data.items || []).map((item: any) => enrichVideoData(item, regionCode));
  } catch (e) {
    console.error(`YouTube API error for ${regionCode}:`, e);
    return [];
  }
}

async function searchYouTubeNiche(apiKey: string, query: string, daysBack = 14): Promise<any[]> {
  try {
    const q = encodeURIComponent(query);
    // order=viewCount + recent period = explosive new videos
    // maxResults=25 for broader coverage
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&order=viewCount&publishedAfter=${getDateDaysAgo(daysBack)}&maxResults=25&key=${apiKey}`;
    const res = await fetch(searchUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const videoIds = (data.items || []).map((item: any) => item.id?.videoId).filter(Boolean);
    if (videoIds.length === 0) return [];

    // contentDetails gives us video duration (for monetization scoring)
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds.join(",")}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    if (!statsRes.ok) {
      return (data.items || []).map((item: any) => ({
        video_title: item.snippet?.title || "",
        video_url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
        creator: item.snippet?.channelTitle || "",
        platform: "youtube",
        published_at: item.snippet?.publishedAt,
        raw_views: 0,
      }));
    }
    const statsData = await statsRes.json();
    return (statsData.items || [])
      .map((item: any) => enrichVideoData(item))
      .filter((v: any) => v.raw_views >= 100000); // 100K minimum pre-filter (final filter is stricter)
  } catch (e) {
    console.error("YouTube search error:", e);
    return [];
  }
}

// ========================
// VIRAL SCORE ALGORITHM v3 — MAXIMUM MONETIZATION + ENGAGEMENT
// ========================
// Formula: viral_score = (views_per_day ^ 1.15) × freshness_bonus × engagement_multiplier × monetization_multiplier
//
// FRESHNESS BONUS (newer = more opportunity to ride the wave):
//   1-3 days old  → 2.5x  (EXPLOSIVE — maximum opportunity, content is HOT right now)
//   4-7 days old  → 1.8x  (VERY HOT — still growing, proven viral)
//   8-14 days old → 1.3x  (WARM — established viral, good for adaptation)
//   15-30 days old → 1.0x (BASELINE — still relevant but wave is passing)
//   30+ days old  → 0.6x  (COLD — wave passed, only if exceptionally high views)
//
// ENGAGEMENT MULTIPLIER (higher engagement = more followers conversion):
//   Based on weighted engagement: comments × 3 + likes × 1 (comments are 3x more valuable)
//   Comments indicate deeper audience connection → more followers
//   Range: 1.0 to 2.5x
//
// MONETIZATION MULTIPLIER (content that generates more revenue):
//   Video duration 8-20 min → 1.5x (mid-roll ads possible, ideal length)
//   Video duration 3-8 min → 1.2x (good for engagement, 1 ad)
//   Shorts < 60s → 0.8x (low ad revenue but high follower growth)
//   20+ min → 1.3x (multiple mid-rolls but lower completion rate)
//
// SUBSCRIBER POTENTIAL (channels that convert viewers to subscribers):
//   High engagement + medium channel size = highest conversion
//   Very large channels (10M+) = lower conversion (audience already saturated)
//
// CPM TIER BONUS (psychology/mental health = premium advertiser niche):
//   Applied as base 1.3x for all psychology content (high-CPM niche)

function parseDuration(iso8601: string | undefined): number {
  if (!iso8601) return 0;
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) + (parseInt(match[2] || "0") * 60) + parseInt(match[3] || "0");
}

function enrichVideoData(item: any, regionCode?: string): any {
  const now = Date.now();
  const rawViews = parseInt(item.statistics?.viewCount || "0");
  const likes = parseInt(item.statistics?.likeCount || "0");
  const comments = parseInt(item.statistics?.commentCount || "0");
  const publishedAt = item.snippet?.publishedAt;
  const durationSec = parseDuration(item.contentDetails?.duration);
  const durationMin = durationSec / 60;

  // Age calculation
  const ageMs = now - new Date(publishedAt || now).getTime();
  const ageDays = Math.max(0.5, ageMs / 86400000); // minimum half a day
  const viewsPerDay = Math.round(rawViews / ageDays);

  // ===== FRESHNESS BONUS =====
  let freshnessBonus = 0.6;
  if (ageDays <= 3) freshnessBonus = 2.5;
  else if (ageDays <= 7) freshnessBonus = 1.8;
  else if (ageDays <= 14) freshnessBonus = 1.3;
  else if (ageDays <= 30) freshnessBonus = 1.0;

  // ===== ENGAGEMENT MULTIPLIER =====
  // Comments are 3x more valuable than likes (deeper connection, algorithm boost)
  const weightedEngagement = rawViews > 0 ? ((comments * 3) + likes) / rawViews : 0;
  const engMultiplier = 1 + Math.min(1.5, weightedEngagement * 25);

  // Comment-to-view ratio (key metric for follower conversion)
  const commentRate = rawViews > 0 ? (comments / rawViews) * 100 : 0;
  // Like-to-view ratio
  const likeRate = rawViews > 0 ? (likes / rawViews) * 100 : 0;

  // ===== MONETIZATION MULTIPLIER =====
  let monetizationMultiplier = 1.0;
  if (durationMin >= 8 && durationMin <= 20) monetizationMultiplier = 1.5; // Sweet spot: mid-roll ads
  else if (durationMin >= 3 && durationMin < 8) monetizationMultiplier = 1.2;
  else if (durationMin > 20) monetizationMultiplier = 1.3;
  else if (durationMin > 0 && durationMin < 1) monetizationMultiplier = 0.8; // Shorts

  // Duration label
  let durationLabel = "";
  if (durationMin > 0) {
    if (durationMin < 1) durationLabel = `${Math.round(durationSec)}s (Short)`;
    else if (durationMin < 60) durationLabel = `${Math.round(durationMin)}min`;
    else durationLabel = `${Math.floor(durationMin / 60)}h${Math.round(durationMin % 60)}min`;
  }

  // ===== CPM TIER BONUS (psychology = premium niche) =====
  const cpmBonus = 1.3;

  // ===== FINAL VIRAL SCORE =====
  const viralScore = Math.round(
    Math.pow(viewsPerDay, 1.15) * freshnessBonus * engMultiplier * monetizationMultiplier * cpmBonus
  );

  // ===== MONETIZATION POTENTIAL LABEL =====
  let monetizationPotential = "💰";
  if (viralScore > 5000000) monetizationPotential = "💎💎💎 JACKPOT";
  else if (viralScore > 1000000) monetizationPotential = "💎💎 Altíssimo";
  else if (viralScore > 500000) monetizationPotential = "💎 Alto";
  else if (viralScore > 100000) monetizationPotential = "💰 Bom";
  else monetizationPotential = "📈 Moderado";

  // ===== REPLICABILITY ANALYSIS =====
  const title = (item.snippet?.title || "").toLowerCase();
  let contentFormat = "desconhecido";
  if (durationMin > 0 && durationMin < 1) contentFormat = "🎬 Short/Reel";
  else if (durationMin >= 1 && durationMin < 5) contentFormat = "📱 Vídeo Curto";
  else if (durationMin >= 5 && durationMin < 15) contentFormat = "🎥 Vídeo Médio";
  else if (durationMin >= 15) contentFormat = "📺 Vídeo Longo";

  // Hook pattern detection
  let hookPattern = "";
  if (title.includes("?")) hookPattern = "❓ Pergunta";
  else if (title.match(/^\d+|top \d+|🔴|⚠️|nunca|sempre|pare de|stop/i)) hookPattern = "🔥 Comando/Lista";
  else if (title.match(/secret|segredo|truth|verdade|ninguém|nobody|hidden/i)) hookPattern = "🤫 Segredo/Revelação";
  else if (title.match(/why|por que|como|how to/i)) hookPattern = "🧠 Educativo";
  else if (title.match(/fake|lie|mentir|manipulation|manipula/i)) hookPattern = "⚡ Polêmico";
  else hookPattern = "📌 Declaração";

  return {
    video_title: item.snippet?.title || "",
    description: item.snippet?.description || "",
    channel_title: item.snippet?.channelTitle || "",
    video_url: `https://www.youtube.com/watch?v=${item.id?.videoId || item.id}`,
    creator: item.snippet?.channelTitle || "",
    creator_url: `https://www.youtube.com/channel/${item.snippet?.channelId}`,
    total_views: formatViews(item.statistics?.viewCount),
    raw_views: rawViews,
    likes,
    comments,
    platform: "youtube",
    region: regionCode || "",
    published_at: publishedAt,
    // Advanced metrics
    age_days: Math.round(ageDays * 10) / 10,
    views_per_day: viewsPerDay,
    engagement_rate: Math.round((likes + comments) / Math.max(1, rawViews) * 10000) / 100,
    comment_rate: Math.round(commentRate * 100) / 100,
    like_rate: Math.round(likeRate * 100) / 100,
    duration_sec: durationSec,
    duration_label: durationLabel,
    content_format: contentFormat,
    hook_pattern: hookPattern,
    freshness_bonus: freshnessBonus,
    monetization_multiplier: monetizationMultiplier,
    monetization_potential: monetizationPotential,
    viral_score: viralScore,
  };
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
        // BRASIL — trending geral + 2 buscas focadas (cobrir máximo de ângulos)
        promises.push(fetchYouTubeTrending(youtubeApiKey, "BR"));
        promises.push(searchYouTubeNiche(youtubeApiKey, "psicologia narcisismo ansiedade depressão autoconhecimento trauma inteligência emocional", 14));
        // MUNDIAL — 3 ângulos diferentes para capturar TODOS os vídeos virais
        promises.push(fetchYouTubeTrending(youtubeApiKey, "US"));
        promises.push(searchYouTubeNiche(youtubeApiKey, "psychology narcissist anxiety depression therapy dark psychology manipulation emotional intelligence", 14));
        promises.push(fetchYouTubeTrending(youtubeApiKey, "GB"));
        promises.push(searchYouTubeNiche(youtubeApiKey, "mental health motivation stoicism toxic people overthinking self improvement habits procrastination", 14));
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

    // ===== FILTRO DE PSICOLOGIA EXPANDIDO =====
    // Ampliado para capturar TODOS os ângulos que viralizam em psicologia/saúde mental
    const psychExact = [
      // Core psychology
      "psicolog", "psycholog", "mental health", "saúde mental", "terapia",
      "therap", "ansiedade", "anxiety", "depressão", "depression",
      // Self-improvement (MAIOR engajamento no YouTube)
      "autoconhecimento", "self improvement", "self-improvement", "self development",
      "desenvolvimento pessoal", "personal development", "personal growth",
      "motivation", "motivação", "discipline", "disciplina", "mindset",
      "habit", "hábito", "procrastin", "productivity", "produtividade",
      // Dark psychology & manipulation (VIRAL — milhões de views)
      "narcisis", "narcisist", "narcissist", "dark psychology", "psicologia sombria",
      "manipulation", "manipula", "gaslighting", "toxic people", "pessoa tóxica",
      "sociopath", "psychopath", "psicopata", "emotional abuse", "abuso emocional",
      "love bombing", "trauma bond", "covert narciss",
      // Relationships (alto engajamento)
      "toxic relationship", "relacionamento tóxic", "attachment", "apego",
      "red flag", "bandeira vermelha", "boundaries", "limites",
      "people pleaser", "codependen", "breakup", "término",
      // Emotional intelligence
      "emotional intelligence", "inteligência emocional", "emotional regulation",
      "regulação emocional", "emotional healing", "cura emocional",
      "overthinking", "pensamento excessivo", "rumination", "ruminação",
      // Trauma & healing
      "trauma", "ptsd", "inner child", "criança interior", "shadow work",
      "healing", "cura", "recovery", "recuperação",
      // Philosophy/Stoicism (VIRAL — milhões de views)
      "stoicism", "estoicismo", "stoic", "marcus aurelius", "epictetus",
      "philosophy", "filosofia", "wisdom", "sabedoria",
      // Neuroscience & brain
      "neurociência", "neuroscience", "brain", "cérebro", "dopamine", "dopamina",
      "cognitive", "cognitiv", "neuroplasticity", "neuroplasticidade",
      // Mindfulness
      "mindfulness", "meditação", "meditation", "calm", "peace", "paz interior",
      // Body language (VIRAL)
      "body language", "linguagem corporal", "microexpress", "lie detection",
      // Mental disorders (alto CPM)
      "burnout", "transtorno", "bipolar", "adhd", "tdah", "autismo", "autism",
      "ocd", "toc", "panic", "pânico", "social anxiety", "ansiedade social",
      // Self-esteem
      "autoestima", "self-esteem", "self esteem", "confidence", "confiança",
      "self worth", "autovalor", "imposter syndrome", "síndrome do impostor",
      // Success mindset
      "success", "sucesso", "millionaire mindset", "wealth", "riqueza",
      "financial freedom", "liberdade financeira", "entrepreneur", "empreendedor",
    ];

    function isPsychRelated(video: any): boolean {
      const title = `${video.video_title || ""}`.toLowerCase();
      const channel = `${video.channel_title || ""}`.toLowerCase();
      const desc = `${video.description || ""}`.toLowerCase();
      
      // Strong match: keyword in title or channel name
      const titleMatch = psychExact.some(kw => title.includes(kw) || channel.includes(kw));
      if (titleMatch) return true;
      
      // Weak match: keyword only in description → need at least 2 different keywords
      const descMatches = psychExact.filter(kw => desc.includes(kw));
      return descMatches.length >= 2;
    }

    // ===== RANKING STRATEGY v3: MÁXIMA VIRALIZAÇÃO + MONETIZAÇÃO + SEGUIDORES =====
    // Mínimo: 500K views (vídeos que realmente explodiram nos últimos 14 dias)
    // Ranking: viral_score (views/dia × freshness × engagement × monetização)
    // Deduplica por video_url
    
    const MIN_VIEWS = 500000;

    function deduplicateVideos(videos: any[]): any[] {
      const seen = new Set<string>();
      return videos.filter(v => {
        const key = v.video_url || v.video_title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function buildRankingEntry(v: any, i: number, region?: string) {
      const country = region || (v.region ? ({ US: "🇺🇸 EUA", GB: "🇬🇧 Reino Unido", DE: "🇩🇪 Alemanha" } as any)[v.region] || "🌍 Internacional" : "🇧🇷 Brasil");
      
      return {
        ...v,
        rank: i + 1,
        momentum_score: v.viral_score ? Math.min(99, Math.round(50 + Math.log10(Math.max(1, v.viral_score)) * 8)) : 50,
        country,
        why_relevant: [
          country,
          v.total_views,
          `${formatViews(String(v.views_per_day || 0))}/dia`,
          `${v.age_days}d`,
          `💬${v.comment_rate || 0}%`,
          `❤️${v.like_rate || 0}%`,
          v.duration_label || "",
        ].filter(Boolean).join(" • "),
        adaptation_guide: region ? "Traduzir, adaptar gancho emocional e formato para público BR" : undefined,
        risk_level: "baixo",
      };
    }

    // BRASIL — trending + psicologia
    const brRanking = deduplicateVideos(
      [...ytBR, ...ytNicheBR]
        .filter(isPsychRelated)
        .filter((v: any) => (v.raw_views || 0) >= MIN_VIEWS)
    )
      .sort((a: any, b: any) => (b.viral_score || 0) - (a.viral_score || 0))
      .slice(0, 10)
      .map((v: any, i: number) => buildRankingEntry(v, i));

    // MUNDIAL — prioridade máxima
    const worldRanking = deduplicateVideos(
      [...ytUS, ...ytNicheEN, ...ytGB, ...ytNicheDE]
        .filter((v: any) => v.region !== "BR")
        .filter(isPsychRelated)
        .filter((v: any) => (v.raw_views || 0) >= MIN_VIEWS)
    )
      .sort((a: any, b: any) => (b.viral_score || 0) - (a.viral_score || 0))
      .slice(0, 15)
      .map((v: any, i: number) => buildRankingEntry(v, i, undefined));

    // ===== MONETIZATION INTELLIGENCE =====
    const allRanked = [...worldRanking, ...brRanking];
    const avgViralScore = allRanked.length > 0 ? Math.round(allRanked.reduce((s, v) => s + (v.viral_score || 0), 0) / allRanked.length) : 0;
    const topFormats = allRanked.reduce((acc: Record<string, number>, v) => { acc[v.content_format || "?"] = (acc[v.content_format || "?"] || 0) + 1; return acc; }, {});
    const topHooks = allRanked.reduce((acc: Record<string, number>, v) => { acc[v.hook_pattern || "?"] = (acc[v.hook_pattern || "?"] || 0) + 1; return acc; }, {});
    const bestFormat = Object.entries(topFormats).sort((a, b) => b[1] - a[1])[0]?.[0] || "?";
    const bestHook = Object.entries(topHooks).sort((a, b) => b[1] - a[1])[0]?.[0] || "?";
    const avgDuration = allRanked.length > 0 ? Math.round(allRanked.reduce((s, v) => s + (v.duration_sec || 0), 0) / allRanked.length / 60) : 0;

    const monetizationInsights = {
      avg_viral_score: avgViralScore,
      best_format: bestFormat,
      best_hook_pattern: bestHook,
      ideal_duration: `${avgDuration} minutos`,
      top_monetization: allRanked.filter(v => v.monetization_potential?.includes("💎")).length,
      revenue_streams: [
        "AdSense (CPM alto: psicologia = $8-15/1000 views)",
        "Cursos online (converter seguidores em alunos)",
        "Afiliados Amazon (livros de psicologia/autoajuda)",
        "Mentoria 1:1 (premium, alto ticket)",
        "Comunidade WhatsApp (engajamento + indicações)",
      ],
      community_growth_tactics: [
        `Formato mais viral: ${bestFormat}`,
        `Hook mais eficaz: ${bestHook}`,
        `Duração ideal: ~${avgDuration}min`,
        "Postar às 07:00, 12:00 e 19:00 (horários de pico BR)",
        "Responder TODOS os comentários nas primeiras 2h",
      ],
    };

    // Save results
    const viralData = {
      viral_patterns: {
        trending_hashtags: googleTrends.slice(0, 15).map((t: string) => `#${t.replace(/\s+/g, "").toLowerCase()}`),
        google_trends: googleTrends,
        best_posting_times: ["07:00-09:00", "12:00-13:00", "19:00-21:00"],
      },
      monetization_insights: monetizationInsights,
      competitor_analysis: brRanking,
      world_ranking: worldRanking,
      reddit_trending: redditPosts.slice(0, 10),
      news_trending: news.slice(0, 10),
      data_sources: dataSources,
      apis_skipped: apisSkipped,
      algorithm_version: "v3_max_monetization",
      ranking_criteria: {
        formula: "viral_score = (views/dia^1.15) × freshness × engagement × monetization × CPM",
        min_views: MIN_VIEWS,
        period: "14 dias",
        freshness_bonus: "1-3d=2.5x, 4-7d=1.8x, 8-14d=1.3x, 15-30d=1.0x",
        engagement_weight: "comments×3 + likes×1 (comments = 3x mais valiosos)",
        monetization_factor: "8-20min=1.5x, 3-8min=1.2x, shorts=0.8x",
      },
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
