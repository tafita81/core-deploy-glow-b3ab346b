import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Optimal number of posts per day per platform (industry best practice)
const DAILY_POST_LIMITS: Record<string, number> = {
  instagram: 2,    // 1-2 posts/day (feed) — mais satura o algoritmo
  youtube: 1,      // 1 vídeo/dia máximo — qualidade > quantidade
  tiktok: 3,       // 1-3 vídeos/dia — plataforma recompensa volume
  whatsapp: 3,     // 2-3 mensagens/dia — não ser spam
  pinterest: 5,    // 3-5 pins/dia — plataforma de alto volume
  facebook: 2,     // 1-2 posts/dia — alcance cai com excesso
  linkedin: 1,     // 1 post/dia — profissional, qualidade importa
  twitter: 5,      // 3-5 tweets/dia — plataforma de alto volume
};

// Check how many posts were already published today for a platform
async function getTodayPublishCount(supabase: any, platform: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const { count } = await supabase
    .from("contents")
    .select("id", { count: "exact", head: true })
    .eq("channel", platform)
    .eq("status", "publicado")
    .gte("published_at", `${today}T00:00:00Z`);
  return count || 0;
}

function getRemainingSlots(dailyLimit: number, published: number): number {
  return Math.max(0, dailyLimit - published);
}

// Optimal posting times for Brazil (UTC-3 → UTC)
function isOptimalTime(platform: string): boolean {
  const utcHour = new Date().getUTCHours();
  switch (platform) {
    case "instagram": return (utcHour >= 14 && utcHour <= 16) || (utcHour >= 21 && utcHour <= 23);
    case "youtube": return (utcHour >= 15 && utcHour <= 18) || (utcHour >= 21 && utcHour <= 23);
    case "tiktok": return (utcHour >= 10 && utcHour <= 12) || (utcHour >= 15 && utcHour <= 17) || utcHour >= 22 || utcHour <= 1;
    case "whatsapp": return (utcHour >= 11 && utcHour <= 13) || (utcHour >= 20 && utcHour <= 22);
    case "pinterest": return (utcHour >= 0 && utcHour <= 3) || (utcHour >= 15 && utcHour <= 17) || (utcHour >= 23);
    case "facebook": return (utcHour >= 12 && utcHour <= 15) || (utcHour >= 21 && utcHour <= 23);
    case "linkedin": return (utcHour >= 12 && utcHour <= 14) || (utcHour >= 17 && utcHour <= 19);
    case "twitter": return (utcHour >= 12 && utcHour <= 15) || (utcHour >= 20 && utcHour <= 23);
    default: return true;
  }
}

function getNextOptimalTime(platform: string): string {
  const brHour = (new Date().getUTCHours() - 3 + 24) % 24;
  switch (platform) {
    case "instagram": return brHour < 11 ? "11h" : brHour < 18 ? "18h" : "11h amanhã";
    case "youtube": return brHour < 12 ? "12h" : brHour < 18 ? "18h" : "12h amanhã";
    case "tiktok": return brHour < 7 ? "7h" : brHour < 12 ? "12h" : brHour < 19 ? "19h" : "7h amanhã";
    case "whatsapp": return brHour < 8 ? "8h" : brHour < 17 ? "17h" : "8h amanhã";
    case "pinterest": return brHour < 12 ? "12h" : brHour < 20 ? "20h" : brHour < 22 ? "22h" : "12h amanhã";
    case "facebook": return brHour < 9 ? "9h" : brHour < 12 ? "12h" : brHour < 18 ? "18h" : "9h amanhã";
    case "linkedin": return brHour < 9 ? "9h" : brHour < 14 ? "14h" : "9h amanhã";
    case "twitter": return brHour < 9 ? "9h" : brHour < 12 ? "12h" : brHour < 17 ? "17h" : "9h amanhã";
    default: return "em breve";
  }
}

// VIRAL CONFIDENCE GATE — AI analyzes if content will go viral before publishing
async function calculateViralConfidence(
  content: any,
  viralIntel: any,
  topSnapshots: any[],
  apiKey: string
): Promise<{ confidence: number; reasoning: string; publish_recommendation: boolean; optimizations: string[] }> {
  try {
    const trendingNow = viralIntel?.viral_patterns?.top_title_hooks || [];
    const topVideos = viralIntel?.competitor_analysis || [];
    const momentum = viralIntel?.momentum_analysis || {};
    const learnings = viralIntel?.learnings || {};

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um analista de viralização com ESTATÍSTICA BAYESIANA AVANÇADA.

Sua função: dado um conteúdo pronto para publicar e o cenário ATUAL de tendências virais, calcular a PROBABILIDADE REAL de viralização.

MÉTRICAS QUE VOCÊ ANALISA:
1. **Relevância Temporal (0-100)**: O tema está quente AGORA? Alguém postou algo similar que viralizou nas últimas horas?
2. **Qualidade do Hook (0-100)**: Os primeiros 3 segundos / título prendem atenção? Usa gatilhos mentais comprovados?
3. **Alinhamento com Tendência (0-100)**: O conteúdo surfa uma onda que está CRESCENDO ou já MORREU?
4. **Diferenciação (0-100)**: Tem algo único que ninguém fez? Ou é mais do mesmo?
5. **Potencial de Compartilhamento (0-100)**: As pessoas VÃO querer compartilhar? Gera emoção forte?
6. **Timing Score (0-100)**: O momento de publicação é ideal para o algoritmo?

FÓRMULA FINAL:
viral_confidence = (relevancia * 0.25 + hook * 0.20 + alinhamento * 0.20 + diferenciacao * 0.15 + compartilhamento * 0.15 + timing * 0.05)

REGRA ABSOLUTA:
- confidence >= 85 → PUBLICAR IMEDIATAMENTE
- confidence 70-84 → PUBLICAR mas com otimizações
- confidence 50-69 → NÃO PUBLICAR, esperar melhor momento
- confidence < 50 → REJEITAR, refazer conteúdo

Retorne APENAS JSON:
{
  "relevancia": 0-100,
  "hook": 0-100,
  "alinhamento": 0-100,
  "diferenciacao": 0-100,
  "compartilhamento": 0-100,
  "timing": 0-100,
  "confidence": 0-100,
  "reasoning": "explicação em 2 frases",
  "publish_recommendation": true/false,
  "optimizations": ["sugestão 1", "sugestão 2"],
  "risk_factors": ["risco 1"],
  "predicted_engagement_rate": "X%"
}`
          },
          {
            role: "user",
            content: `CONTEÚDO A AVALIAR:
Título: "${content.title}"
Tipo: ${content.content_type}
Canal: ${content.channel}
Score interno: ${content.score}
Corpo: ${(content.body || "").slice(0, 500)}

CENÁRIO VIRAL ATUAL:
Top vídeos trending: ${topVideos.slice(0, 5).map((v: any) => `"${v.video_title}" (${v.total_views}, momentum: ${v.momentum_score})`).join("; ")}
Hooks que funcionam agora: ${trendingNow.slice(0, 5).join("; ")}
Vídeo mais quente: ${momentum.hottest_video_now || "N/A"}
Vídeos emergentes: ${(momentum.emerging_videos || []).slice(0, 3).join("; ")}
Vídeos morrendo: ${(momentum.dying_videos || []).slice(0, 3).join("; ")}

APRENDIZADO DO CÉREBRO:
O que funcionou antes: ${(learnings.what_worked || []).join("; ") || "Sem dados ainda"}
O que falhou: ${(learnings.what_failed || []).join("; ") || "Sem dados ainda"}

SNAPSHOTS RECENTES (crescimento de views):
${topSnapshots.slice(0, 5).map((s: any) => `"${s.video_title}" — ${s.total_views} views, crescimento: ${s.views_growth_1h}, momentum: ${s.momentum_score}`).join("\n")}

Hora atual (BR): ${(new Date().getUTCHours() - 3 + 24) % 24}h

Calcule a confiança viral com a fórmula bayesiana.`
          }
        ],
      }),
    });

    if (!res.ok) {
      return { confidence: content.score || 0, reasoning: "Análise AI indisponível — usando score interno", publish_recommendation: (content.score || 0) >= 85, optimizations: [] };
    }

    const data = await res.json();
    let raw = data.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const analysis = JSON.parse(raw);
    return {
      confidence: analysis.confidence || 0,
      reasoning: analysis.reasoning || "",
      publish_recommendation: analysis.publish_recommendation ?? false,
      optimizations: analysis.optimizations || [],
    };
  } catch (e) {
    console.error("Viral confidence error:", e);
    return { confidence: content.score || 0, reasoning: "Erro na análise — usando score interno", publish_recommendation: (content.score || 0) >= 85, optimizations: [] };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: autoSetting } = await supabase.from("settings").select("value").eq("key", "auto_publish").single();
    const autoPublish = autoSetting?.value === true || autoSetting?.value === "true";

    if (!autoPublish) {
      return new Response(JSON.stringify({ message: "Auto-publish desativado", published: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: thresholdSetting } = await supabase.from("settings").select("value").eq("key", "score_threshold").single();
    const threshold = Number(thresholdSetting?.value) || 75;

    const { data: channels } = await supabase.from("channels").select("platform, is_connected").eq("is_connected", true);
    const connectedPlatforms = (channels || []).map((c) => c.platform);

    if (connectedPlatforms.length === 0) {
      await supabase.from("system_logs").insert({ event_type: "publicacao", message: "⏸️ Auto-publish: nenhum canal conectado", level: "warning" });
      return new Response(JSON.stringify({ message: "Nenhum canal conectado", published: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const platformsReady = connectedPlatforms.filter((p) => isOptimalTime(p));
    if (platformsReady.length === 0) {
      const nextTimes = connectedPlatforms.map((p) => `${p}: ${getNextOptimalTime(p)}`).join(", ");
      await supabase.from("system_logs").insert({ event_type: "agendamento", message: `⏰ Fora do horário ideal — próximos: ${nextTimes}`, level: "info" });
      return new Response(JSON.stringify({ message: "Fora do horário ideal", published: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load viral intelligence + snapshots for confidence gate
    const { data: viralIntelRow } = await supabase.from("settings").select("value").eq("key", "viral_intelligence").single();
    const viralIntel = viralIntelRow?.value as any || {};

    const { data: topSnapshots } = await supabase
      .from("video_snapshots")
      .select("video_title, total_views, views_growth_1h, momentum_score")
      .order("momentum_score", { ascending: false })
      .limit(10);

    // Find approved content
    const { data: contents } = await supabase
      .from("contents")
      .select("*")
      .eq("status", "aprovado")
      .eq("scientific_valid", true)
      .eq("ethics_valid", true)
      .gte("score", threshold)
      .order("score", { ascending: false })
      .limit(5);

    let published = 0;
    const results: any[] = [];

    // Pre-check daily limits for all platforms
    const platformPublishCounts: Record<string, number> = {};
    for (const p of connectedPlatforms) {
      platformPublishCounts[p] = await getTodayPublishCount(supabase, p);
    }

    for (const content of contents || []) {
      const targetChannel = content.channel || "instagram";
      
      // Check daily limit for this platform
      const dailyLimit = DAILY_POST_LIMITS[targetChannel] || 2;
      const todayCount = (platformPublishCounts[targetChannel] || 0);
      const remaining = getRemainingSlots(dailyLimit, todayCount);
      
      if (remaining <= 0) {
        results.push({ 
          title: content.title, channel: targetChannel, 
          status: "limite_diario_atingido", 
          daily_limit: dailyLimit, 
          published_today: todayCount,
          message: `Já publicou ${todayCount}/${dailyLimit} hoje em ${targetChannel}` 
        });
        continue;
      }

      if (!isOptimalTime(targetChannel)) {
        results.push({ title: content.title, channel: targetChannel, status: "aguardando_horario", next: getNextOptimalTime(targetChannel) });
        continue;
      }

      // VIRAL CONFIDENCE GATE
      let viralAnalysis = { confidence: content.score || 0, reasoning: "Sem API key", publish_recommendation: (content.score || 0) >= 85, optimizations: [] as string[] };

      if (LOVABLE_API_KEY) {
        viralAnalysis = await calculateViralConfidence(content, viralIntel, topSnapshots || [], LOVABLE_API_KEY);
      }

      await supabase.from("system_logs").insert({
        event_type: "analise_viral",
        message: `🔬 Análise viral: "${content.title}" — Confiança: ${viralAnalysis.confidence}% — ${viralAnalysis.publish_recommendation ? "✅ PUBLICAR" : "⏸️ SEGURAR"}`,
        level: viralAnalysis.publish_recommendation ? "info" : "warning",
        metadata: { content_id: content.id, ...viralAnalysis },
      });

      if (!viralAnalysis.publish_recommendation) {
        results.push({
          title: content.title,
          channel: targetChannel,
          status: "segurado_baixa_confianca",
          confidence: viralAnalysis.confidence,
          reasoning: viralAnalysis.reasoning,
          optimizations: viralAnalysis.optimizations,
        });
        continue;
      }

      // PUBLISH — confidence is high enough
      try {
        const pubRes = await fetch(`${supabaseUrl}/functions/v1/publish-social`, {
          method: "POST",
          headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ content_id: content.id }),
        });

        if (pubRes.ok) {
          published++;
          platformPublishCounts[targetChannel] = (platformPublishCounts[targetChannel] || 0) + 1;
          results.push({ title: content.title, channel: targetChannel, status: "publicado", confidence: viralAnalysis.confidence, daily_count: `${platformPublishCounts[targetChannel]}/${dailyLimit}` });
        } else {
          results.push({ title: content.title, channel: targetChannel, status: "erro", code: pubRes.status });
        }
      } catch (e) {
        results.push({ title: content.title, channel: targetChannel, status: "erro", error: e instanceof Error ? e.message : "erro" });
      }
    }

    const brHour = (new Date().getUTCHours() - 3 + 24) % 24;
    const held = results.filter((r) => r.status === "segurado_baixa_confianca").length;
    const limited = results.filter((r) => r.status === "limite_diario_atingido").length;
    
    // Build daily usage summary
    const dailyUsage = Object.entries(platformPublishCounts).map(([p, count]) => 
      `${p}: ${count}/${DAILY_POST_LIMITS[p] || 2}`
    ).join(", ");

    await supabase.from("system_logs").insert({
      event_type: "publicacao",
      message: `🚀 Auto-publish (${brHour}h BR): ${published} publicados, ${held} segurados, ${limited} limitados | Uso diário: ${dailyUsage}`,
      level: published > 0 ? "info" : "warning",
      metadata: { published, held, limited, results, platforms_ready: platformsReady, br_hour: brHour, daily_usage: platformPublishCounts, daily_limits: DAILY_POST_LIMITS },
    });

    return new Response(JSON.stringify({ published, held, results, platforms_ready: platformsReady }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-publish error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
