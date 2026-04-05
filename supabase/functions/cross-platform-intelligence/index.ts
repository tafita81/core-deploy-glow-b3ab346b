import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Pull ALL data sources in parallel
    const [
      { data: channels },
      { data: contents },
      { data: snapshots },
      { data: settingsRows },
    ] = await Promise.all([
      supabase.from("channels").select("*").eq("is_connected", true),
      supabase.from("contents").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("video_snapshots").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("settings").select("*"),
    ]);

    const settings: Record<string, any> = {};
    settingsRows?.forEach((s) => { settings[s.key] = s.value; });

    const viralIntel = settings.viral_intelligence || {};
    const brainLearnings = settings.brain_learnings || {};
    const visualGuide = settings.viral_visual_guide || {};
    const contentStrategy = settings.content_strategy_per_platform || {};
    const profileOptimizations = settings.profile_optimizations || {};

    // 2. Compute cross-platform metrics
    const platformStats: Record<string, any> = {};
    for (const ch of channels || []) {
      platformStats[ch.platform] = {
        followers: ch.followers || 0,
        engagement_rate: ch.engagement_rate || 0,
        posts_count: ch.posts_count || 0,
      };
    }

    const contentByChannel: Record<string, any[]> = {};
    for (const c of contents || []) {
      const ch = c.channel || "unknown";
      if (!contentByChannel[ch]) contentByChannel[ch] = [];
      contentByChannel[ch].push(c);
    }

    // Per-platform performance
    const platformPerformance: Record<string, { avg_score: number; total: number; published: number; top_types: string[] }> = {};
    for (const [ch, items] of Object.entries(contentByChannel)) {
      const scores = items.filter((i) => i.score > 0).map((i) => i.score);
      const types = items.map((i) => i.content_type);
      const typeCount: Record<string, number> = {};
      types.forEach((t) => { typeCount[t] = (typeCount[t] || 0) + 1; });
      const topTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);

      platformPerformance[ch] = {
        avg_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        total: items.length,
        published: items.filter((i) => i.status === "publicado").length,
        top_types: topTypes,
      };
    }

    // Snapshot trends by platform
    const snapshotsByPlatform: Record<string, any[]> = {};
    for (const s of snapshots || []) {
      if (!snapshotsByPlatform[s.platform]) snapshotsByPlatform[s.platform] = [];
      snapshotsByPlatform[s.platform].push(s);
    }

    // 3. AI Cross-Platform Analysis
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é o CÉREBRO QUÂNTICO de inteligência cross-platform. Sua missão é criar SINERGIA INFINITA entre TODAS as redes sociais conectadas.

PRINCÍPIO QUÂNTICO: Cada plataforma é uma dimensão. O conteúdo que funciona em UMA pode ser TRANSMUTADO para TODAS as outras com adaptações inteligentes.

VOCÊ DEVE:
1. TRANSFERIR APRENDIZADOS: O que funciona no Instagram pode ser adaptado para TikTok, YouTube, etc.
2. IDENTIFICAR PADRÕES UNIVERSAIS: Quais temas, formatos, hooks e CTAs funcionam em TODAS as plataformas
3. CRIAR FUNIL CROSS-PLATFORM: Como cada plataforma alimenta as outras (ex: TikTok → Instagram → YouTube → WhatsApp)
4. OTIMIZAR TIMING CRUZADO: Quando postar em cada rede para maximizar alcance total
5. UNIFICAR NARRATIVA: Mesma história contada de formas diferentes em cada plataforma
6. MONETIZAR EM REDE: Como a audiência de uma plataforma monetiza em outra
7. DETECTAR ARBITRAGEM: Conteúdo viral em uma plataforma que AINDA NÃO FOI para outra

REGRAS DE EVOLUÇÃO:
- Compare o desempenho ATUAL com o ANTERIOR
- Identifique o que MELHOROU e o que PIOROU
- Sugira AJUSTES IMEDIATOS baseados nos dados
- Priorize ações com MAIOR IMPACTO e MENOR ESFORÇO
- Sempre traga UMA INOVAÇÃO nunca tentada

Retorne JSON:
{
  "unified_intelligence": {
    "universal_patterns": ["padrões que funcionam em TODAS as plataformas"],
    "best_performing_platform": "plataforma com melhor desempenho",
    "worst_performing_platform": "plataforma que precisa de mais atenção",
    "content_arbitrage": [{"from": "plataforma_origem", "to": "plataforma_destino", "content_type": "tipo", "adaptation": "como adaptar", "expected_boost": "impacto esperado"}],
    "cross_pollination": [{"action": "ação específica", "platforms": ["plat1", "plat2"], "expected_impact": "impacto"}]
  },
  "platform_synergy_map": {
    "funnel_flow": ["plataforma1 → plataforma2 → plataforma3"],
    "audience_migration_tactics": ["tática para migrar audiência entre plataformas"],
    "unified_cta_strategy": "estratégia de CTA unificada"
  },
  "real_time_adjustments": [
    {"platform": "plataforma", "action": "o que fazer AGORA", "reason": "baseado em qual dado", "priority": "alta/média/baixa", "expected_result": "resultado esperado"}
  ],
  "evolution_metrics": {
    "overall_health_score": 0-100,
    "growth_trajectory": "acelerando|estável|desacelerando",
    "biggest_opportunity": "maior oportunidade identificada",
    "biggest_risk": "maior risco",
    "innovation_suggestion": "inovação nunca tentada"
  },
  "content_transmutation": [
    {"original_content": "título/tipo do conteúdo original", "original_platform": "plataforma", "target_platforms": [{"platform": "destino", "adapted_format": "formato adaptado", "adapted_title": "título adaptado", "adaptation_notes": "notas de adaptação"}]}
  ],
  "unified_learnings": {
    "what_works_everywhere": ["padrões universais de sucesso"],
    "platform_specific_secrets": {"instagram": "segredo", "youtube": "segredo", "tiktok": "segredo"},
    "anti_patterns": ["o que NÃO fazer em nenhuma plataforma"],
    "next_experiment": "próximo experimento a tentar",
    "confidence_score": 0-100
  }
}

Retorne APENAS JSON, sem markdown.`
          },
          {
            role: "user",
            content: `DATA: ${new Date().toISOString()}

📊 CANAIS CONECTADOS:
${(channels || []).map((c) => `- ${c.platform}: "${c.name}" — ${c.followers} seguidores, engagement: ${c.engagement_rate}%`).join("\n") || "Nenhum canal conectado ainda."}

📈 PERFORMANCE POR PLATAFORMA (nosso conteúdo):
${Object.entries(platformPerformance).map(([ch, p]) => `- ${ch}: Score médio: ${p.avg_score}, ${p.total} conteúdos, ${p.published} publicados, Top tipos: ${p.top_types.join(", ")}`).join("\n") || "Sem dados de performance ainda."}

🔥 VÍDEOS VIRAIS POR PLATAFORMA (mercado):
${Object.entries(snapshotsByPlatform).map(([plat, snaps]) => `- ${plat}: ${snaps.length} vídeos rastreados, Top: "${snaps[0]?.video_title}" (${snaps[0]?.total_views} views, momentum: ${snaps[0]?.momentum_score})`).join("\n") || "Sem snapshots."}

🧠 INTELIGÊNCIA VIRAL ATUAL:
- Hashtags trending: ${(viralIntel?.viral_patterns?.trending_hashtags || []).slice(0, 10).join(", ")}
- Hooks populares: ${(viralIntel?.viral_patterns?.top_title_hooks || []).slice(0, 5).join("; ")}

📋 ESTRATÉGIA ATUAL POR PLATAFORMA:
${JSON.stringify(contentStrategy).slice(0, 500)}

🎨 GUIA VISUAL:
${JSON.stringify(visualGuide).slice(0, 300)}

🧠 LIÇÕES ANTERIORES:
${JSON.stringify(brainLearnings?.latest || {}).slice(0, 400)}

🎯 OTIMIZAÇÕES DE PERFIL ATIVAS:
${JSON.stringify(profileOptimizations?.cross_platform_strategy || {}).slice(0, 300)}

ANALISE TUDO e gere INTELIGÊNCIA CRUZADA entre TODAS as plataformas. Foque em PSICOLOGIA e SAÚDE MENTAL.`
          }
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    let raw = aiData.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let intelligence: any;
    try {
      intelligence = JSON.parse(raw);
    } catch {
      intelligence = { raw_analysis: raw };
    }

    // 4. Save unified intelligence
    const prevUnified = settings.unified_intelligence || {};
    const prevHistory = (prevUnified as any)?.history || [];
    prevHistory.push({
      timestamp: new Date().toISOString(),
      health_score: intelligence.evolution_metrics?.overall_health_score || 0,
      trajectory: intelligence.evolution_metrics?.growth_trajectory || "unknown",
      platforms: Object.keys(platformStats),
      adjustments_count: (intelligence.real_time_adjustments || []).length,
    });

    await supabase.from("settings").upsert({
      key: "unified_intelligence",
      value: {
        ...intelligence,
        history: prevHistory.slice(-100),
        last_updated: new Date().toISOString(),
        iteration: prevHistory.length,
      },
    }, { onConflict: "key" });

    // 5. Auto-apply real-time adjustments to content strategy
    const adjustments = intelligence.real_time_adjustments || [];
    const highPriority = adjustments.filter((a: any) => a.priority === "alta");

    if (highPriority.length > 0) {
      // Update content strategy with high-priority adjustments
      const updatedStrategy = { ...contentStrategy };
      for (const adj of highPriority) {
        if (updatedStrategy[adj.platform]) {
          updatedStrategy[adj.platform].latest_adjustment = {
            action: adj.action,
            reason: adj.reason,
            applied_at: new Date().toISOString(),
          };
        }
      }
      await supabase.from("settings").upsert({
        key: "content_strategy_per_platform",
        value: updatedStrategy,
      }, { onConflict: "key" });
    }

    // 6. Save content transmutation queue for brain-pipeline to use
    const transmutations = intelligence.content_transmutation || [];
    if (transmutations.length > 0) {
      await supabase.from("settings").upsert({
        key: "content_transmutation_queue",
        value: {
          queue: transmutations,
          created_at: new Date().toISOString(),
          status: "pending",
        },
      }, { onConflict: "key" });
    }

    // 7. Log
    await supabase.from("system_logs").insert({
      event_type: "inteligencia_cruzada",
      message: `🧬 Inteligência Quântica: Score saúde ${intelligence.evolution_metrics?.overall_health_score || 0}/100, Trajetória: ${intelligence.evolution_metrics?.growth_trajectory || "?"}, ${adjustments.length} ajustes (${highPriority.length} alta prioridade), ${transmutations.length} transmutações de conteúdo, Iteração #${prevHistory.length}`,
      level: "info",
      metadata: {
        health_score: intelligence.evolution_metrics?.overall_health_score,
        trajectory: intelligence.evolution_metrics?.growth_trajectory,
        adjustments: adjustments.length,
        high_priority: highPriority.length,
        transmutations: transmutations.length,
        best_platform: intelligence.unified_intelligence?.best_performing_platform,
        worst_platform: intelligence.unified_intelligence?.worst_performing_platform,
        innovation: intelligence.evolution_metrics?.innovation_suggestion,
      },
    });

    return new Response(JSON.stringify(intelligence), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cross-platform-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
