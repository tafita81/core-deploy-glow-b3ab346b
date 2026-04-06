import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========================
// RATE LIMITER
// ========================
const API_LIMITS = {
  youtube: { daily_calls: 8, daily_units: 10000, units_per_call: 305 },
  reddit: { daily_calls: 3 },
  newsapi: { daily_calls: 3, daily_requests: 100 },
  serpapi: { monthly_searches: 100, daily_calls: 3 },
  google_trends: { daily_calls: 999 },
};

function shouldCallApi(apiName: string, currentHour: number): boolean {
  switch (apiName) {
    case "google_trends": return true;
    case "youtube": return currentHour % 2 === 0;
    case "reddit": return [6, 14, 22].includes(currentHour);
    case "newsapi": return [8, 16, 0].includes(currentHour);
    case "serpapi": return [10, 18].includes(currentHour);
    default: return false;
  }
}

async function checkDailyUsage(supabase: any, apiName: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const { count } = await supabase.from("system_logs").select("id", { count: "exact", head: true }).eq("event_type", `api_call_${apiName}`).gte("created_at", `${today}T00:00:00Z`);
  return count || 0;
}

async function checkMonthlyUsage(supabase: any, apiName: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count } = await supabase.from("system_logs").select("id", { count: "exact", head: true }).eq("event_type", `api_call_${apiName}`).gte("created_at", monthStart);
  return count || 0;
}

async function checkDailyUnits(supabase: any, apiName: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase.from("system_logs").select("metadata").eq("event_type", `api_call_${apiName}`).gte("created_at", `${today}T00:00:00Z`);
  let total = 0;
  for (const row of data || []) total += (row.metadata as any)?.units || 0;
  return total;
}

async function canCallApi(supabase: any, apiName: string, currentHour: number, forceSchedule = false): Promise<{ allowed: boolean; reason: string }> {
  if (!forceSchedule && !shouldCallApi(apiName, currentHour)) return { allowed: false, reason: "fora do horário programado" };
  const limits = API_LIMITS[apiName as keyof typeof API_LIMITS];
  if (!limits) return { allowed: false, reason: "API desconhecida" };
  const dailyCalls = await checkDailyUsage(supabase, apiName);
  const maxDaily = (limits as any).daily_calls || 999;
  if (dailyCalls >= maxDaily) return { allowed: false, reason: `limite diário atingido (${dailyCalls}/${maxDaily})` };
  if ((limits as any).daily_units) {
    const usedUnits = await checkDailyUnits(supabase, apiName);
    if (usedUnits + ((limits as any).units_per_call || 0) > (limits as any).daily_units) return { allowed: false, reason: `limite de unidades diárias` };
  }
  if ((limits as any).monthly_searches) {
    const monthlyUsage = await checkMonthlyUsage(supabase, apiName);
    if (monthlyUsage >= (limits as any).monthly_searches) return { allowed: false, reason: `limite MENSAL atingido` };
  }
  return { allowed: true, reason: "ok" };
}

async function logApiCall(supabase: any, apiName: string, unitsUsed: number) {
  await supabase.from("system_logs").insert({ event_type: `api_call_${apiName}`, message: `API call: ${apiName} — ${unitsUsed} units`, level: "debug", metadata: { api: apiName, units: unitsUsed, timestamp: new Date().toISOString() } });
}

// ========================
// SELF-EVOLVING LEARNING ENGINE
// ========================
// Loads historical performance data to dynamically adjust scoring weights

interface LearningWeights {
  freshness_power: number;       // How much freshness matters (default 1.0)
  engagement_power: number;      // How much engagement matters (default 1.0)
  comment_weight: number;        // Comment value vs likes (default 3)
  optimal_duration_min: number;  // Best duration in minutes (default 10)
  optimal_duration_max: number;  // Max optimal duration (default 20)
  best_posting_hours: number[];  // Best hours to post
  top_hooks: string[];           // Most effective hook patterns
  top_formats: string[];         // Most effective content formats
  top_topics: string[];          // Most effective topics
  avg_views_per_day_target: number; // Target views/day for "good" performance
  evolution_generation: number;  // How many times the algorithm has evolved
  last_evolved: string;
}

const DEFAULT_WEIGHTS: LearningWeights = {
  freshness_power: 1.0,
  engagement_power: 1.0,
  comment_weight: 3,
  optimal_duration_min: 8,
  optimal_duration_max: 20,
  best_posting_hours: [7, 12, 19],
  top_hooks: [],
  top_formats: [],
  top_topics: [],
  avg_views_per_day_target: 100000,
  evolution_generation: 0,
  last_evolved: new Date().toISOString(),
};

async function loadLearningWeights(supabase: any): Promise<LearningWeights> {
  const { data } = await supabase.from("settings").select("value").eq("key", "learning_weights").single();
  if (data?.value) return { ...DEFAULT_WEIGHTS, ...(data.value as any) };
  return DEFAULT_WEIGHTS;
}

async function evolveWeights(supabase: any): Promise<LearningWeights> {
  const weights = await loadLearningWeights(supabase);

  // Load last 30 days of performance history
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: history } = await supabase
    .from("performance_history")
    .select("*")
    .gte("created_at", thirtyDaysAgo)
    .order("views_7d", { ascending: false });

  if (!history || history.length < 3) return weights; // Need minimum data to learn

  // Split into top performers (top 25%) and bottom performers
  const sorted = [...history].sort((a: any, b: any) => (b.views_7d || 0) - (a.views_7d || 0));
  const topCount = Math.max(1, Math.floor(sorted.length * 0.25));
  const topPerformers = sorted.slice(0, topCount);
  const bottomPerformers = sorted.slice(-topCount);

  // Learn optimal duration from top performers
  const topDurations = topPerformers.filter((p: any) => p.duration_sec > 0).map((p: any) => p.duration_sec / 60);
  if (topDurations.length > 0) {
    weights.optimal_duration_min = Math.round(Math.min(...topDurations));
    weights.optimal_duration_max = Math.round(Math.max(...topDurations));
  }

  // Learn comment weight: if top performers have higher comment ratios, increase weight
  const topCommentRate = topPerformers.reduce((s: number, p: any) => s + (p.engagement_rate || 0), 0) / topPerformers.length;
  const bottomCommentRate = bottomPerformers.reduce((s: number, p: any) => s + (p.engagement_rate || 0), 0) / bottomPerformers.length;
  if (topCommentRate > bottomCommentRate * 1.5) {
    weights.comment_weight = Math.min(5, weights.comment_weight + 0.5);
    weights.engagement_power = Math.min(2.0, weights.engagement_power + 0.1);
  }

  // Learn best hooks
  const hookCounts: Record<string, { total: number; views: number }> = {};
  for (const p of history) {
    const hook = (p as any).hook_pattern || "unknown";
    if (!hookCounts[hook]) hookCounts[hook] = { total: 0, views: 0 };
    hookCounts[hook].total++;
    hookCounts[hook].views += (p as any).views_7d || 0;
  }
  weights.top_hooks = Object.entries(hookCounts)
    .map(([hook, stats]) => ({ hook, avgViews: stats.views / stats.total }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 3)
    .map(h => h.hook);

  // Learn best formats
  const formatCounts: Record<string, { total: number; views: number }> = {};
  for (const p of history) {
    const fmt = (p as any).content_format || "unknown";
    if (!formatCounts[fmt]) formatCounts[fmt] = { total: 0, views: 0 };
    formatCounts[fmt].total++;
    formatCounts[fmt].views += (p as any).views_7d || 0;
  }
  weights.top_formats = Object.entries(formatCounts)
    .map(([fmt, stats]) => ({ fmt, avgViews: stats.views / stats.total }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 3)
    .map(f => f.fmt);

  // Learn best topics
  const topicCounts: Record<string, { total: number; views: number }> = {};
  for (const p of history) {
    const topic = (p as any).topic || "general";
    if (!topicCounts[topic]) topicCounts[topic] = { total: 0, views: 0 };
    topicCounts[topic].total++;
    topicCounts[topic].views += (p as any).views_7d || 0;
  }
  weights.top_topics = Object.entries(topicCounts)
    .map(([topic, stats]) => ({ topic, avgViews: stats.views / stats.total }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 5)
    .map(t => t.topic);

  // Update target
  const avgViews = history.reduce((s: number, p: any) => s + (p.views_7d || 0), 0) / history.length;
  weights.avg_views_per_day_target = Math.round(avgViews / 7);

  weights.evolution_generation++;
  weights.last_evolved = new Date().toISOString();

  // Save evolved weights
  await supabase.from("settings").upsert({ key: "learning_weights", value: weights }, { onConflict: "key" });

  await supabase.from("system_logs").insert({
    event_type: "algorithm_evolution",
    message: `🧬 Algoritmo evoluiu para geração ${weights.evolution_generation} — Comment weight: ${weights.comment_weight}, Engagement power: ${weights.engagement_power}, Top hooks: ${weights.top_hooks.join(", ")}`,
    level: "info",
    metadata: weights,
  });

  return weights;
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
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${regionCode}&maxResults=50&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
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
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&order=viewCount&publishedAfter=${getDateDaysAgo(daysBack)}&maxResults=25&key=${apiKey}`;
    const res = await fetch(searchUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const videoIds = (data.items || []).map((item: any) => item.id?.videoId).filter(Boolean);
    if (videoIds.length === 0) return [];

    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds.join(",")}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    if (!statsRes.ok) return [];
    const statsData = await statsRes.json();
    return (statsData.items || [])
      .map((item: any) => enrichVideoData(item))
      .filter((v: any) => v.raw_views >= 100000);
  } catch (e) {
    console.error("YouTube search error:", e);
    return [];
  }
}

// ========================
// VIRAL SCORE ALGORITHM v4 — SELF-EVOLVING + EXTREME METRICS
// ========================
// Now uses dynamic weights from learning engine

let _activeWeights: LearningWeights = DEFAULT_WEIGHTS;

function parseDuration(iso8601: string | undefined): number {
  if (!iso8601) return 0;
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) + (parseInt(match[2] || "0") * 60) + parseInt(match[3] || "0");
}

function detectTopic(title: string, desc: string): string {
  const text = `${title} ${desc}`.toLowerCase();
  const topicMap: Record<string, string[]> = {
    "narcisismo": ["narcisis", "narcissist", "covert narc"],
    "dark_psychology": ["dark psychology", "psicologia sombria", "manipulation", "manipula", "gaslighting"],
    "ansiedade": ["anxiety", "ansiedade", "panic", "pânico", "overthinking"],
    "depressão": ["depression", "depressão", "sad", "tristeza"],
    "autoconhecimento": ["self improvement", "autoconhecimento", "self development", "personal growth"],
    "estoicismo": ["stoic", "estoicismo", "marcus aurelius", "epictetus"],
    "relacionamentos": ["toxic relationship", "relacionamento", "attachment", "apego", "breakup"],
    "inteligência_emocional": ["emotional intelligence", "inteligência emocional", "empathy", "empatia"],
    "trauma": ["trauma", "ptsd", "inner child", "healing", "cura"],
    "linguagem_corporal": ["body language", "linguagem corporal", "microexpress"],
    "neurociência": ["neuroscience", "neurociência", "brain", "cérebro", "dopamine"],
    "mindset": ["mindset", "motivation", "motivação", "discipline", "disciplina", "habits", "hábito"],
    "burnout": ["burnout", "exhaustion", "esgotamento"],
    "autoestima": ["self-esteem", "autoestima", "confidence", "confiança", "imposter"],
  };
  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(kw => text.includes(kw))) return topic;
  }
  return "psicologia_geral";
}

function enrichVideoData(item: any, regionCode?: string): any {
  const now = Date.now();
  const rawViews = parseInt(item.statistics?.viewCount || "0");
  const likes = parseInt(item.statistics?.likeCount || "0");
  const comments = parseInt(item.statistics?.commentCount || "0");
  const publishedAt = item.snippet?.publishedAt;
  const durationSec = parseDuration(item.contentDetails?.duration);
  const durationMin = durationSec / 60;
  const title = item.snippet?.title || "";
  const desc = item.snippet?.description || "";

  const ageMs = now - new Date(publishedAt || now).getTime();
  const ageDays = Math.max(0.5, ageMs / 86400000);
  const viewsPerDay = Math.round(rawViews / ageDays);

  // ===== FRESHNESS BONUS (dynamic power) =====
  let freshnessBonus = 0.6;
  if (ageDays <= 2) freshnessBonus = 3.0;
  else if (ageDays <= 5) freshnessBonus = 2.2;
  else if (ageDays <= 10) freshnessBonus = 1.5;
  else if (ageDays <= 21) freshnessBonus = 1.0;
  freshnessBonus = Math.pow(freshnessBonus, _activeWeights.freshness_power);

  // ===== ENGAGEMENT MULTIPLIER (evolved comment weight) =====
  const commentWeight = _activeWeights.comment_weight;
  const weightedEngagement = rawViews > 0 ? ((comments * commentWeight) + likes) / rawViews : 0;
  const engMultiplier = Math.pow(1 + Math.min(2.0, weightedEngagement * 30), _activeWeights.engagement_power);

  const commentRate = rawViews > 0 ? (comments / rawViews) * 100 : 0;
  const likeRate = rawViews > 0 ? (likes / rawViews) * 100 : 0;
  const shareEstimate = Math.round(comments * 0.3); // Shares ≈ 30% of comments

  // ===== FOLLOWER CONVERSION SCORE =====
  // High engagement + provocative content + medium channel = best conversion
  const followerConversionScore = Math.min(100, Math.round(
    (commentRate * 15) + (likeRate * 3) + (ageDays <= 7 ? 20 : 0) + (durationMin >= 5 && durationMin <= 15 ? 15 : 0)
  ));

  // ===== MONETIZATION MULTIPLIER (learned optimal duration) =====
  let monetizationMultiplier = 1.0;
  const optMin = _activeWeights.optimal_duration_min;
  const optMax = _activeWeights.optimal_duration_max;
  if (durationMin >= optMin && durationMin <= optMax) monetizationMultiplier = 1.5;
  else if (durationMin >= 3 && durationMin < optMin) monetizationMultiplier = 1.2;
  else if (durationMin > optMax && durationMin <= 40) monetizationMultiplier = 1.3;
  else if (durationMin > 0 && durationMin < 1) monetizationMultiplier = 0.8;

  // ===== COMMENTS QUALITY SCORE =====
  // High comment-to-view ratio = polarizing/engaging content = more algorithm push
  let commentsQualityBonus = 1.0;
  if (commentRate > 1.0) commentsQualityBonus = 1.8;      // Exceptional
  else if (commentRate > 0.5) commentsQualityBonus = 1.5;  // Very high
  else if (commentRate > 0.2) commentsQualityBonus = 1.2;  // Good

  // ===== SUBSCRIBER MAGNET SCORE =====
  // Content that converts viewers to subscribers
  let subscriberMagnetBonus = 1.0;
  if (likeRate > 5 && commentRate > 0.3) subscriberMagnetBonus = 1.6;  // Love + discuss = subscribe
  else if (likeRate > 4) subscriberMagnetBonus = 1.3;

  // ===== REVENUE PER MILLE ESTIMATE =====
  // Psychology niche CPM: $8-15 on YouTube
  const estimatedCPM = 11; // Average for psychology niche
  const estimatedRevenue = Math.round((rawViews / 1000) * estimatedCPM);
  const revenuePerDay = Math.round((viewsPerDay / 1000) * estimatedCPM);

  // ===== CPM TIER =====
  const cpmBonus = 1.3;

  // ===== TOPIC DETECTION =====
  const topic = detectTopic(title, desc);

  // ===== TOPIC BONUS (learned from history) =====
  let topicBonus = 1.0;
  if (_activeWeights.top_topics.includes(topic)) topicBonus = 1.3;

  // ===== FINAL VIRAL SCORE v4 =====
  const viralScore = Math.round(
    Math.pow(viewsPerDay, 1.15) * freshnessBonus * engMultiplier * monetizationMultiplier * commentsQualityBonus * subscriberMagnetBonus * cpmBonus * topicBonus
  );

  // Duration label
  let durationLabel = "";
  if (durationMin > 0) {
    if (durationMin < 1) durationLabel = `${Math.round(durationSec)}s (Short)`;
    else if (durationMin < 60) durationLabel = `${Math.round(durationMin)}min`;
    else durationLabel = `${Math.floor(durationMin / 60)}h${Math.round(durationMin % 60)}min`;
  }

  // Monetization potential
  let monetizationPotential = "💰";
  if (viralScore > 10000000) monetizationPotential = "💎💎💎💎 LENDÁRIO";
  else if (viralScore > 5000000) monetizationPotential = "💎💎💎 JACKPOT";
  else if (viralScore > 1000000) monetizationPotential = "💎💎 Altíssimo";
  else if (viralScore > 500000) monetizationPotential = "💎 Alto";
  else if (viralScore > 100000) monetizationPotential = "💰 Bom";
  else monetizationPotential = "📈 Moderado";

  // Content format
  let contentFormat = "desconhecido";
  if (durationMin > 0 && durationMin < 1) contentFormat = "🎬 Short/Reel";
  else if (durationMin >= 1 && durationMin < 5) contentFormat = "📱 Vídeo Curto";
  else if (durationMin >= 5 && durationMin < 15) contentFormat = "🎥 Vídeo Médio";
  else if (durationMin >= 15) contentFormat = "📺 Vídeo Longo";

  // Hook pattern
  const titleLow = title.toLowerCase();
  let hookPattern = "📌 Declaração";
  if (titleLow.includes("?")) hookPattern = "❓ Pergunta";
  else if (titleLow.match(/^\d+|top \d+|🔴|⚠️|nunca|sempre|pare de|stop/i)) hookPattern = "🔥 Comando/Lista";
  else if (titleLow.match(/secret|segredo|truth|verdade|ninguém|nobody|hidden/i)) hookPattern = "🤫 Segredo/Revelação";
  else if (titleLow.match(/why|por que|como|how to/i)) hookPattern = "🧠 Educativo";
  else if (titleLow.match(/fake|lie|mentir|manipulation|manipula/i)) hookPattern = "⚡ Polêmico";

  // Follower conversion label
  let followerLabel = "";
  if (followerConversionScore >= 80) followerLabel = "🧲 ÍMVEL DE SEGUIDORES";
  else if (followerConversionScore >= 60) followerLabel = "🧲 Alto potencial";
  else if (followerConversionScore >= 40) followerLabel = "👥 Médio";

  return {
    video_title: title,
    description: desc,
    channel_title: item.snippet?.channelTitle || "",
    video_url: `https://www.youtube.com/watch?v=${item.id?.videoId || item.id}`,
    creator: item.snippet?.channelTitle || "",
    creator_url: `https://www.youtube.com/channel/${item.snippet?.channelId}`,
    total_views: formatViews(item.statistics?.viewCount),
    raw_views: rawViews,
    likes,
    comments,
    shares_estimate: shareEstimate,
    platform: "youtube",
    region: regionCode || "",
    published_at: publishedAt,
    age_days: Math.round(ageDays * 10) / 10,
    views_per_day: viewsPerDay,
    engagement_rate: Math.round((likes + comments) / Math.max(1, rawViews) * 10000) / 100,
    comment_rate: Math.round(commentRate * 100) / 100,
    like_rate: Math.round(likeRate * 100) / 100,
    follower_conversion_score: followerConversionScore,
    follower_label: followerLabel,
    duration_sec: durationSec,
    duration_label: durationLabel,
    content_format: contentFormat,
    hook_pattern: hookPattern,
    topic,
    freshness_bonus: freshnessBonus,
    monetization_multiplier: monetizationMultiplier,
    comments_quality_bonus: commentsQualityBonus,
    subscriber_magnet_bonus: subscriberMagnetBonus,
    monetization_potential: monetizationPotential,
    estimated_revenue: estimatedRevenue,
    revenue_per_day: revenuePerDay,
    viral_score: viralScore,
  };
}

async function fetchRedditTrending(clientId: string, clientSecret: string): Promise<any[]> {
  try {
    const authRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!authRes.ok) return [];
    const auth = await authRes.json();
    const subreddits = ["psychology", "mentalhealth", "selfimprovement", "getdisciplined", "stoicism", "narcissisticabuse"];
    const posts: any[] = [];
    for (const sub of subreddits) {
      const res = await fetch(`https://oauth.reddit.com/r/${sub}/hot?limit=5`, { headers: { Authorization: `Bearer ${auth.access_token}`, "User-Agent": "TrendBot/1.0" } });
      if (!res.ok) continue;
      const data = await res.json();
      for (const post of (data.data?.children || [])) {
        posts.push({ title: post.data?.title, url: `https://reddit.com${post.data?.permalink}`, score: post.data?.score, comments: post.data?.num_comments, subreddit: sub });
      }
    }
    return posts.sort((a, b) => b.score - a.score).slice(0, 15);
  } catch (e) { console.error("Reddit error:", e); return []; }
}

async function fetchMentalHealthNews(apiKey: string): Promise<any[]> {
  try {
    const q = encodeURIComponent("saúde mental OR psicologia OR ansiedade OR terapia");
    const url = `https://newsapi.org/v2/everything?q=${q}&language=pt&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles || []).map((a: any) => ({ title: a.title, url: a.url, source: a.source?.name, published_at: a.publishedAt }));
  } catch (e) { console.error("NewsAPI error:", e); return []; }
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

// Psychology filter
const psychExact = [
  "psicolog", "psycholog", "mental health", "saúde mental", "terapia", "therap", "ansiedade", "anxiety", "depressão", "depression",
  "autoconhecimento", "self improvement", "self-improvement", "self development", "desenvolvimento pessoal", "personal development", "personal growth",
  "motivation", "motivação", "discipline", "disciplina", "mindset", "habit", "hábito", "procrastin", "productivity", "produtividade",
  "narcisis", "narcisist", "narcissist", "dark psychology", "psicologia sombria", "manipulation", "manipula", "gaslighting", "toxic people", "pessoa tóxica",
  "sociopath", "psychopath", "psicopata", "emotional abuse", "abuso emocional", "love bombing", "trauma bond", "covert narciss",
  "toxic relationship", "relacionamento tóxic", "attachment", "apego", "red flag", "bandeira vermelha", "boundaries", "limites",
  "people pleaser", "codependen", "breakup", "término",
  "emotional intelligence", "inteligência emocional", "emotional regulation", "regulação emocional", "emotional healing", "cura emocional",
  "overthinking", "pensamento excessivo", "rumination", "ruminação",
  "trauma", "ptsd", "inner child", "criança interior", "shadow work", "healing", "cura", "recovery", "recuperação",
  "stoicism", "estoicismo", "stoic", "marcus aurelius", "epictetus", "philosophy", "filosofia", "wisdom", "sabedoria",
  "neurociência", "neuroscience", "brain", "cérebro", "dopamine", "dopamina", "cognitive", "cognitiv", "neuroplasticity", "neuroplasticidade",
  "mindfulness", "meditação", "meditation", "calm", "peace", "paz interior",
  "body language", "linguagem corporal", "microexpress", "lie detection",
  "burnout", "transtorno", "bipolar", "adhd", "tdah", "autismo", "autism", "ocd", "toc", "panic", "pânico", "social anxiety", "ansiedade social",
  "autoestima", "self-esteem", "self esteem", "confidence", "confiança", "self worth", "autovalor", "imposter syndrome", "síndrome do impostor",
  "success", "sucesso", "millionaire mindset", "wealth", "riqueza", "financial freedom", "liberdade financeira", "entrepreneur", "empreendedor",
];

function isPsychRelated(video: any): boolean {
  const title = `${video.video_title || ""}`.toLowerCase();
  const channel = `${video.channel_title || ""}`.toLowerCase();
  const desc = `${video.description || ""}`.toLowerCase();
  const titleMatch = psychExact.some(kw => title.includes(kw) || channel.includes(kw));
  if (titleMatch) return true;
  return psychExact.filter(kw => desc.includes(kw)).length >= 2;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let forceAll = false;
    try { const body = await req.json(); forceAll = body?.force === true; } catch { /* no body */ }
    const currentHour = forceAll ? 0 : new Date().getUTCHours();

    // EVOLVE ALGORITHM — learn from past performance
    _activeWeights = await evolveWeights(supabase);

    // Load API keys
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

    const promises: Promise<any>[] = [fetchGoogleTrends()];
    const apisCalled: string[] = ["google_trends"];
    const apisSkipped: string[] = [];

    if (youtubeApiKey) {
      const check = await canCallApi(supabase, "youtube", currentHour, forceAll);
      if (check.allowed) {
        promises.push(fetchYouTubeTrending(youtubeApiKey, "BR"));
        promises.push(searchYouTubeNiche(youtubeApiKey, "psicologia narcisismo ansiedade depressão autoconhecimento trauma inteligência emocional", 14));
        promises.push(fetchYouTubeTrending(youtubeApiKey, "US"));
        promises.push(searchYouTubeNiche(youtubeApiKey, "psychology narcissist anxiety depression therapy dark psychology manipulation emotional intelligence", 14));
        promises.push(fetchYouTubeTrending(youtubeApiKey, "GB"));
        promises.push(searchYouTubeNiche(youtubeApiKey, "mental health motivation stoicism toxic people overthinking self improvement habits procrastination", 14));
        apisCalled.push("youtube");
      } else { apisSkipped.push(`youtube (${check.reason})`); }
    }

    if (redditClientId && redditSecret) {
      const check = await canCallApi(supabase, "reddit", currentHour, forceAll);
      if (check.allowed) { promises.push(fetchRedditTrending(redditClientId, redditSecret)); apisCalled.push("reddit"); }
      else { apisSkipped.push(`reddit (${check.reason})`); }
    }

    if (newsApiKey) {
      const check = await canCallApi(supabase, "newsapi", currentHour, forceAll);
      if (check.allowed) { promises.push(fetchMentalHealthNews(newsApiKey)); apisCalled.push("newsapi"); }
      else { apisSkipped.push(`newsapi (${check.reason})`); }
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
      await logApiCall(supabase, "youtube", 305);
    }
    if (apisCalled.includes("reddit")) { redditPosts = (results[idx++] as any)?.value || []; await logApiCall(supabase, "reddit", 5); }
    if (apisCalled.includes("newsapi")) { news = (results[idx++] as any)?.value || []; await logApiCall(supabase, "newsapi", 1); }

    // Load cache if needed
    if (!apisCalled.includes("youtube") || !apisCalled.includes("reddit") || !apisCalled.includes("newsapi")) {
      const { data: cached } = await supabase.from("settings").select("value").eq("key", "viral_intelligence").single();
      if (cached?.value) {
        const cv = cached.value as any;
        if (!apisCalled.includes("youtube") && cv.competitor_analysis?.length) { ytBR = cv.competitor_analysis || []; ytUS = cv.world_ranking || []; }
        if (!apisCalled.includes("reddit") && cv.reddit_trending?.length) redditPosts = cv.reddit_trending || [];
        if (!apisCalled.includes("newsapi") && cv.news_trending?.length) news = cv.news_trending || [];
      }
    }

    const MIN_VIEWS = 500000;

    function deduplicateVideos(videos: any[]): any[] {
      const seen = new Set<string>();
      return videos.filter(v => { const key = v.video_url || v.video_title; if (seen.has(key)) return false; seen.add(key); return true; });
    }

    function buildRankingEntry(v: any, i: number, region?: string) {
      const country = region || (v.region ? ({ US: "🇺🇸 EUA", GB: "🇬🇧 Reino Unido" } as any)[v.region] || "🌍 Internacional" : "🇧🇷 Brasil");
      return {
        ...v,
        rank: i + 1,
        momentum_score: v.viral_score ? Math.min(99, Math.round(50 + Math.log10(Math.max(1, v.viral_score)) * 8)) : 50,
        country,
        why_relevant: [country, v.total_views, `${formatViews(String(v.views_per_day || 0))}/dia`, `${v.age_days}d`, `💬${v.comment_rate || 0}%`, `❤️${v.like_rate || 0}%`, v.duration_label || "", `$${v.estimated_revenue || 0}`].filter(Boolean).join(" • "),
        adaptation_guide: region ? "Traduzir, adaptar gancho emocional e formato para público BR" : undefined,
      };
    }

    const brRanking = deduplicateVideos([...ytBR, ...ytNicheBR].filter(isPsychRelated).filter((v: any) => (v.raw_views || 0) >= MIN_VIEWS))
      .sort((a: any, b: any) => (b.viral_score || 0) - (a.viral_score || 0)).slice(0, 10).map((v: any, i: number) => buildRankingEntry(v, i));

    const worldRanking = deduplicateVideos([...ytUS, ...ytNicheEN, ...ytGB, ...ytNicheDE].filter((v: any) => v.region !== "BR").filter(isPsychRelated).filter((v: any) => (v.raw_views || 0) >= MIN_VIEWS))
      .sort((a: any, b: any) => (b.viral_score || 0) - (a.viral_score || 0)).slice(0, 15).map((v: any, i: number) => buildRankingEntry(v, i));

    // ===== EXTREME ANALYTICS =====
    const allRanked = [...worldRanking, ...brRanking];
    const avgViralScore = allRanked.length > 0 ? Math.round(allRanked.reduce((s, v) => s + (v.viral_score || 0), 0) / allRanked.length) : 0;
    const totalEstimatedRevenue = allRanked.reduce((s, v) => s + (v.estimated_revenue || 0), 0);
    const avgFollowerConversion = allRanked.length > 0 ? Math.round(allRanked.reduce((s, v) => s + (v.follower_conversion_score || 0), 0) / allRanked.length) : 0;
    const avgCommentRate = allRanked.length > 0 ? (allRanked.reduce((s, v) => s + (v.comment_rate || 0), 0) / allRanked.length).toFixed(2) : "0";
    const avgLikeRate = allRanked.length > 0 ? (allRanked.reduce((s, v) => s + (v.like_rate || 0), 0) / allRanked.length).toFixed(2) : "0";

    const topFormats = allRanked.reduce((acc: Record<string, number>, v) => { acc[v.content_format || "?"] = (acc[v.content_format || "?"] || 0) + 1; return acc; }, {});
    const topHooks = allRanked.reduce((acc: Record<string, number>, v) => { acc[v.hook_pattern || "?"] = (acc[v.hook_pattern || "?"] || 0) + 1; return acc; }, {});
    const topTopics = allRanked.reduce((acc: Record<string, number>, v) => { acc[v.topic || "?"] = (acc[v.topic || "?"] || 0) + 1; return acc; }, {});
    const bestFormat = Object.entries(topFormats).sort((a, b) => b[1] - a[1])[0]?.[0] || "?";
    const bestHook = Object.entries(topHooks).sort((a, b) => b[1] - a[1])[0]?.[0] || "?";
    const bestTopics = Object.entries(topTopics).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
    const avgDuration = allRanked.length > 0 ? Math.round(allRanked.reduce((s, v) => s + (v.duration_sec || 0), 0) / allRanked.length / 60) : 0;

    const monetizationInsights = {
      avg_viral_score: avgViralScore,
      total_market_revenue: totalEstimatedRevenue,
      avg_follower_conversion: avgFollowerConversion,
      avg_comment_rate: avgCommentRate,
      avg_like_rate: avgLikeRate,
      best_format: bestFormat,
      best_hook_pattern: bestHook,
      best_topics: bestTopics,
      ideal_duration: `${avgDuration} minutos`,
      top_monetization: allRanked.filter(v => v.monetization_potential?.includes("💎")).length,
      revenue_streams: [
        `AdSense (CPM $8-15 — psicologia é nicho premium)`,
        "Cursos online (converter seguidores em alunos)",
        "Afiliados Amazon (livros de psicologia/autoajuda)",
        "Mentoria 1:1 (premium, alto ticket)",
        "Comunidade WhatsApp (engajamento + indicações)",
        "Produtos digitais (e-books, templates, worksheets)",
        "Parcerias de marca (apps de meditação, bem-estar)",
      ],
      community_growth_tactics: [
        `Formato mais viral: ${bestFormat}`,
        `Hook mais eficaz: ${bestHook}`,
        `Duração ideal: ~${avgDuration}min`,
        `Tópicos mais explosivos: ${bestTopics.join(", ")}`,
        "Postar às 07:00, 12:00 e 19:00 (horários de pico BR)",
        "Responder TODOS os comentários nas primeiras 2h",
        "CTA de follow no segundo 3 e no final do vídeo",
        "Pinned comment com pergunta provocativa",
        `Taxa média de comentários dos virais: ${avgCommentRate}%`,
        `Taxa média de likes dos virais: ${avgLikeRate}%`,
      ],
      algorithm_evolution: {
        generation: _activeWeights.evolution_generation,
        comment_weight: _activeWeights.comment_weight,
        engagement_power: _activeWeights.engagement_power,
        learned_hooks: _activeWeights.top_hooks,
        learned_formats: _activeWeights.top_formats,
        learned_topics: _activeWeights.top_topics,
        last_evolved: _activeWeights.last_evolved,
      },
    };

    const viralData = {
      viral_patterns: {
        trending_hashtags: googleTrends.slice(0, 15).map((t: string) => `#${t.replace(/\s+/g, "").toLowerCase()}`),
        google_trends: googleTrends,
        best_posting_times: _activeWeights.best_posting_hours.map(h => `${h}:00`),
      },
      monetization_insights: monetizationInsights,
      competitor_analysis: brRanking,
      world_ranking: worldRanking,
      top_10_ranking_brasil: brRanking,
      reddit_trending: redditPosts.slice(0, 10),
      news_trending: news.slice(0, 10),
      data_sources: apisCalled,
      apis_skipped: apisSkipped,
      algorithm_version: "v4_self_evolving",
      ranking_criteria: {
        formula: "viral_score = (views/dia^1.15) × freshness × engagement × monetization × comments_quality × subscriber_magnet × CPM × topic_bonus",
        min_views: MIN_VIEWS,
        period: "14 dias",
        freshness_bonus: "1-2d=3.0x, 3-5d=2.2x, 6-10d=1.5x, 11-21d=1.0x",
        engagement_weight: `comments×${_activeWeights.comment_weight} + likes×1 (aprendido)`,
        monetization_factor: `${_activeWeights.optimal_duration_min}-${_activeWeights.optimal_duration_max}min=1.5x (aprendido)`,
        comments_quality: "comment_rate>1%=1.8x, >0.5%=1.5x, >0.2%=1.2x",
        subscriber_magnet: "like>5% + comment>0.3%=1.6x (máxima conversão)",
        evolution: `Geração ${_activeWeights.evolution_generation}`,
      },
      rate_limits: {
        youtube: { limit: "10.000 units/dia", calls_max: `${API_LIMITS.youtube.daily_calls}/dia` },
        reddit: { limit: "60 req/min", calls_max: `${API_LIMITS.reddit.daily_calls}/dia` },
        newsapi: { limit: "100 req/dia", calls_max: `${API_LIMITS.newsapi.daily_calls}/dia` },
        google_trends: { limit: "ilimitado (RSS)" },
      },
      data_source: apisCalled.includes("youtube") ? "youtube_data_api_real" : "cached+google_trends",
      updated_at: new Date().toISOString(),
    };

    await supabase.from("settings").upsert({ key: "viral_intelligence", value: viralData }, { onConflict: "key" });

    // Save video snapshots with extreme tracking
    if (apisCalled.includes("youtube")) {
      const allVideos = [...worldRanking, ...brRanking];
      for (const v of allVideos.slice(0, 25)) {
        if (!v.video_url) continue;
        const { data: prevSnapshot } = await supabase.from("video_snapshots").select("total_views, snapshot_hour").eq("metadata->>video_url", v.video_url).order("snapshot_hour", { ascending: false }).limit(1).single();
        const prevViews = prevSnapshot ? parseInt(prevSnapshot.total_views || "0") : 0;
        const currentViews = v.raw_views || 0;
        const viewsGrowth = prevViews > 0 ? currentViews - prevViews : 0;
        const hoursElapsed = prevSnapshot ? Math.max(1, (Date.now() - new Date(prevSnapshot.snapshot_hour).getTime()) / 3600000) : 1;
        const viewsPerHour = Math.round(viewsGrowth / hoursElapsed);

        await supabase.from("video_snapshots").insert({
          video_title: v.video_title || "", creator: v.creator || "", platform: "youtube",
          region: v.region || v.country || "BR", total_views: String(currentViews),
          views_growth_1h: viewsPerHour > 0 ? `+${formatViews(String(viewsPerHour))}/h` : "0/h",
          momentum_score: v.momentum_score || 0,
          acceleration: viewsPerHour > 50000 ? "💥 EXPLODINDO" : viewsPerHour > 10000 ? "🔥 Foguete" : viewsPerHour > 1000 ? "📈 Crescendo" : viewsPerHour > 0 ? "➡️ Estável" : "⏸️ Sem dados",
          metadata: {
            video_url: v.video_url, raw_views: currentViews, prev_views: prevViews, views_growth: viewsGrowth, views_per_hour: viewsPerHour,
            country: v.country, topic: v.topic, follower_conversion: v.follower_conversion_score,
            estimated_revenue: v.estimated_revenue, comment_rate: v.comment_rate, like_rate: v.like_rate,
            source: "api_real",
          },
        });
      }
    }

    await supabase.from("system_logs").insert({
      event_type: "pesquisa",
      message: `🧬 Algoritmo v4 (Gen ${_activeWeights.evolution_generation}) | ${apisCalled.join("+")} | BR:${brRanking.length} Mundo:${worldRanking.length} | Revenue potencial: $${totalEstimatedRevenue.toLocaleString()} | Avg Follower Conv: ${avgFollowerConversion}%`,
      level: "info",
      metadata: { called: apisCalled, skipped: apisSkipped, counts: { br: brRanking.length, world: worldRanking.length }, evolution: _activeWeights.evolution_generation },
    });

    return new Response(JSON.stringify({
      competitor_analysis: brRanking, world_ranking: worldRanking,
      viral_patterns: viralData.viral_patterns, monetization_insights: monetizationInsights,
      reddit_trending: redditPosts.slice(0, 10), news_trending: news.slice(0, 10),
      data_sources: apisCalled, algorithm_version: "v4_self_evolving",
      evolution_generation: _activeWeights.evolution_generation,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("research-trends error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
