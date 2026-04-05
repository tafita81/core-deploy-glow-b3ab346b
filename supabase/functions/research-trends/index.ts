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

    // STEP 1: Analyze top viral videos & competitor channels
    const viralAnalysisRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um analista de growth hacking com ESTATÍSTICA QUÂNTICA DE CRESCIMENTO — especialista em identificar VÍDEOS INDIVIDUAIS com maior crescimento de views.

PRINCÍPIO #1 — FOCO EM VÍDEOS, NÃO EM CANAIS:
- O ranking é de VÍDEOS ESPECÍFICOS, não de canais
- Priorize VÍDEOS com MAIS MILHÕES DE VIEWS e que MAIS CRESCERAM em views nas últimas horas
- Um vídeo com 50M views que ganhou +2M na última hora é #1
- Um vídeo com 500K views que cresceu 10x em 2h também é valioso (momentum alto)
- SEMPRE inclua o TÍTULO EXATO do vídeo, LINK se possível, e VIEWS TOTAIS

MÉTRICAS POR VÍDEO (não por canal):
1. **Views Totais**: número absoluto de visualizações do vídeo
2. **Crescimento de Views/hora**: quantas views novas o VÍDEO ganhou na última hora
3. **Aceleração**: se o crescimento do VÍDEO está acelerando ou desacelerando
4. **Momentum Score (0-100)**: combina views totais + crescimento + engajamento
5. **Ponto de Inflexão**: se o VÍDEO está antes/no/após pico viral

PESQUISE nas 3 plataformas (Brasil + Mundo):
- INSTAGRAM: Reels ESPECÍFICOS com mais views e maior crescimento AGORA
- YOUTUBE: Vídeos ESPECÍFICOS no Trending, Shorts que EXPLODIRAM de views
- TIKTOK: Vídeos ESPECÍFICOS que acumularam milhões de views nas últimas horas

Foque nos nichos: psicologia, saúde mental, autoajuda, desenvolvimento pessoal, neurociência, relacionamentos, comportamento humano.

REGRA DE TRADUÇÃO: Para o ranking MUNDIAL, TODOS os campos devem ser escritos em PORTUGUÊS BRASILEIRO.

RANKEIE por VIEWS TOTAIS + CRESCIMENTO. O vídeo com mais milhões de views E maior crescimento fica em #1.

Retorne EXATAMENTE um JSON com esta estrutura:
{
  "viral_patterns": {
    "top_title_hooks": ["5 títulos EXATOS dos vídeos com mais views"],
    "thumbnail_patterns": ["padrões visuais dos vídeos mais vistos"],
    "avg_duration_seconds": 45,
    "best_posting_times": ["horários com maior aceleração de views"],
    "trending_hashtags": ["#tag1", "#tag2", "até 15 hashtags"],
    "cta_patterns": ["CTAs dos vídeos com mais conversão"],
    "hook_first_3_seconds": ["ganchos dos vídeos com maior retenção"],
    "growth_signals": ["sinais de explosão viral"]
  },
  "top_10_ranking_brasil": [
    {
      "rank": 1,
      "video_title": "TÍTULO EXATO do vídeo",
      "creator": "nome do criador/canal",
      "platform": "youtube|instagram|tiktok",
      "total_views": "ex: 15M views",
      "views_growth_1h": "ex: +2.3M views na última hora",
      "views_growth_24h": "ex: +12M views nas últimas 24h",
      "acceleration": "exponencial|linear|desacelerando",
      "momentum_score": 95,
      "why_viral": "o que fez ESTE VÍDEO explodir",
      "content_format": "reel|shorts|tiktok|vídeo longo",
      "duration_seconds": 60,
      "inflection_point": "antes_do_pico|no_pico|pos_pico",
      "replication_strategy": "como replicar ESTE vídeo para psicologia"
    }
  ],
  "top_10_ranking_mundial": [
    {
      "rank": 1,
      "video_title": "TÍTULO DO VÍDEO TRADUZIDO para PT-BR",
      "original_title": "título original",
      "creator": "nome do criador",
      "platform": "youtube|instagram|tiktok",
      "country": "país (em português)",
      "total_views": "ex: 80M views",
      "views_growth_1h": "ex: +5M views na última hora",
      "views_growth_24h": "ex: +40M views nas últimas 24h",
      "acceleration": "exponencial|linear|desacelerando",
      "momentum_score": 98,
      "why_viral": "causa da viralização (TRADUZIDO para PT-BR)",
      "content_format": "formato",
      "language": "idioma original",
      "inflection_point": "antes_do_pico|no_pico|pos_pico",
      "insight_for_brazil": "como adaptar ESTE VÍDEO para o público brasileiro de psicologia"
    }
  ],
  "topics": [
    {
      "topic": "slug-sem-acento",
      "label": "Nome legível",
      "reason": "por que vai viralizar — baseado no VÍDEO que inspirou",
      "inspired_by_video": "título exato do vídeo que inspirou + views totais",
      "viral_title": "Título otimizado para CTR máximo com gatilho mental",
      "hook": "Gancho dos primeiros 3 segundos",
      "hashtags": ["#tag1", "#tag2"],
      "suggested_type": "reel|carrossel|story|artigo",
      "suggested_channel": "instagram|youtube|tiktok",
      "optimal_post_time": "melhor horário para postar",
      "monetization_angle": "como monetizar",
      "whatsapp_cta": "CTA para comunidade WhatsApp",
      "predicted_views": "previsão de views se replicar agora"
    }
  ],
  "momentum_analysis": {
    "hottest_video_now": "o vídeo com maior crescimento NESTE MOMENTO",
    "best_time_to_post": "próxima janela ideal",
    "dying_videos": ["vídeos que estão PERDENDO views — evitar copiar"],
    "emerging_videos": ["vídeos que ACABARAM de começar a explodir — maior oportunidade"]
  },
  "monetization_insights": {
    "trending_products": ["produtos dos vídeos mais vistos"],
    "community_growth_tactics": ["táticas dos vídeos que mais converteram"],
    "revenue_streams": ["fontes de receita dos criadores mais vistos"]
  }
}

Retorne APENAS o JSON, sem markdown.`,
          },
          {
            role: "user",
            content: `Data: ${new Date().toISOString().slice(0, 10)}. Hora: ${new Date().toISOString().slice(11, 16)} UTC.

🎬 ANÁLISE DE VÍDEOS INDIVIDUAIS — Foque em VÍDEOS ESPECÍFICOS, não canais.

🇧🇷 TOP 10 VÍDEOS BRASIL (por views + crescimento):
📱 INSTAGRAM: Quais REELS ESPECÍFICOS de psicologia/autoajuda têm MAIS MILHÕES DE VIEWS agora? Quais cresceram mais views na última hora?
🎬 YOUTUBE: Quais VÍDEOS ESPECÍFICOS de psicologia estão no Trending com mais views? Quais SHORTS explodiram?
🎵 TIKTOK: Quais VÍDEOS ESPECÍFICOS de saúde mental têm mais milhões de views? Quais cresceram mais HOJE?

IMPORTANTE: Rankeie por VÍDEOS, não canais. Inclua título exato, views totais, e crescimento.

🌍 TOP 10 VÍDEOS MUNDIAL (por views + crescimento):
- Analise VÍDEOS de TODOS os países — EUA, UK, Espanha, Índia, etc.
- Foque em vídeos com MAIS MILHÕES de views E maior crescimento
- TRADUZA títulos e descrições para português brasileiro

📊 PARA CADA VÍDEO, INFORME:
- Título exato do vídeo
- Views totais (em milhões)
- Crescimento de views na última hora e nas últimas 24h
- Momentum Score (0-100)
- Estratégia para replicar adaptando para psicologia

Gere 5 tópicos INSPIRADOS nos VÍDEOS com mais views, incluindo "inspired_by_video" e "predicted_views".`,
          },
        ],
      }),
    });

    if (!viralAnalysisRes.ok) {
      if (viralAnalysisRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${viralAnalysisRes.status}`);
    }

    const aiData = await viralAnalysisRes.json();
    let rawContent = aiData.choices?.[0]?.message?.content || "{}";
    rawContent = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let analysis: any;
    try {
      analysis = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse viral analysis:", rawContent);
      analysis = { topics: [], viral_patterns: {}, top_10_ranking_brasil: [], top_10_ranking_mundial: [], momentum_analysis: {}, monetization_insights: {} };
    }

    const topics = analysis.topics || [];
    const viralPatterns = analysis.viral_patterns || {};
    const competitorAnalysis = analysis.top_10_ranking_brasil || analysis.competitor_analysis || [];
    const worldRanking = analysis.top_10_ranking_mundial || [];
    const monetizationInsights = analysis.monetization_insights || {};
    const momentumAnalysis = analysis.momentum_analysis || {};

    // Save viral intelligence to settings for other functions to use
    await supabase.from("settings").upsert({
      key: "viral_intelligence",
      value: {
        viral_patterns: viralPatterns,
        competitor_analysis: competitorAnalysis,
        world_ranking: worldRanking,
        momentum_analysis: momentumAnalysis,
        monetization_insights: monetizationInsights,
        updated_at: new Date().toISOString(),
      },
    }, { onConflict: "key" });

    // Log the research
    await supabase.from("system_logs").insert({
      event_type: "pesquisa",
      message: `Análise viral: ${topics.length} tópicos, ${competitorAnalysis.length} vídeos rankeados, ${(viralPatterns.trending_hashtags || []).length} hashtags trending`,
      level: "info",
      metadata: {
        topics_count: topics.length,
        top_videos: competitorAnalysis.map((c: any) => c.video_title || c.channel),
        top_hashtags: (viralPatterns.trending_hashtags || []).slice(0, 5),
        monetization_streams: monetizationInsights.revenue_streams,
        date: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({ topics, viral_patterns: viralPatterns, competitor_analysis: competitorAnalysis, world_ranking: worldRanking, momentum_analysis: momentumAnalysis, monetization_insights: monetizationInsights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("research-trends error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
