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
            content: `Você é um analista de growth hacking com ESTATÍSTICA QUÂNTICA DE CRESCIMENTO — especialista em identificar VELOCIDADE DE CRESCIMENTO e MOMENTUM viral, não apenas números absolutos.

PRINCÍPIO CENTRAL — VELOCIDADE DE CRESCIMENTO > VOLUME TOTAL:
- Um vídeo que saiu de 10K para 500K views em 2 horas é MAIS VALIOSO que um vídeo estável com 5M views
- Um canal que ganhou 50K seguidores na última semana é MAIS RELEVANTE que um com 10M parado
- O DELTA de crescimento (aceleração) é o indicador #1 de viralização iminente
- Conteúdo em CURVA EXPONENCIAL de crescimento = modelo ideal para replicar

MÉTRICAS QUÂNTICAS DE CRESCIMENTO (calcule para cada canal/vídeo):
1. **Velocidade de Crescimento (VG)**: taxa de novos views/seguidores por hora nas últimas 24h
2. **Aceleração Viral (AV)**: se a velocidade está AUMENTANDO (exponencial) ou diminuindo
3. **Momentum Score (MS)**: combinação de VG + AV + engajamento relativo (0-100)
4. **Ponto de Inflexão**: se o conteúdo está ANTES do pico viral (máximo valor para replicar)

PESQUISE nas 3 plataformas (Brasil + Mundo):
- INSTAGRAM: Reels com crescimento EXPLOSIVO nas últimas horas, não os mais vistos de sempre
- YOUTUBE: Vídeos que ACABARAM de entrar no Trending ou estão subindo rápido, Shorts em curva exponencial
- TIKTOK: Vídeos que saíram de poucos views para milhões HOJE, sons que estão COMEÇANDO a viralizar

Foque nos nichos: psicologia, saúde mental, autoajuda, desenvolvimento pessoal, neurociência, relacionamentos, comportamento humano.

REGRA DE TRADUÇÃO: Para o ranking MUNDIAL, TODOS os campos devem ser escritos em PORTUGUÊS BRASILEIRO.

RANKEIE por MOMENTUM SCORE (não por views totais). O canal/vídeo com MAIOR crescimento percentual na última hora fica em #1.

Retorne EXATAMENTE um JSON com esta estrutura:
{
  "viral_patterns": {
    "top_title_hooks": ["5 títulos dos vídeos com MAIOR crescimento na última hora"],
    "thumbnail_patterns": ["padrões visuais dos vídeos em curva exponencial"],
    "avg_duration_seconds": 45,
    "best_posting_times": ["horários com maior aceleração de views"],
    "trending_hashtags": ["#tag1", "#tag2", "até 15 hashtags em crescimento"],
    "cta_patterns": ["CTAs dos vídeos com maior conversão de seguidores"],
    "hook_first_3_seconds": ["ganchos dos vídeos com maior retenção"],
    "growth_signals": ["sinais de que um conteúdo está prestes a explodir"]
  },
  "top_10_ranking_brasil": [
    {
      "rank": 1,
      "channel": "nome do canal/perfil",
      "platform": "youtube|instagram|tiktok",
      "followers": "número aproximado",
      "growth_velocity": "ex: +120K views/hora, +5K seguidores/dia",
      "acceleration": "exponencial|linear|desacelerando",
      "momentum_score": 95,
      "why_growing_fast": "o que está causando o crescimento acelerado AGORA",
      "top_video_title": "título do vídeo com maior crescimento",
      "views_delta_1h": "crescimento de views na última hora",
      "content_format": "formato que está gerando o crescimento",
      "inflection_point": "antes_do_pico|no_pico|pos_pico"
    }
  ],
  "top_10_ranking_mundial": [
    {
      "rank": 1,
      "channel": "nome do canal/perfil (TRADUZIDO)",
      "platform": "youtube|instagram|tiktok",
      "country": "país (em português)",
      "followers": "número aproximado",
      "growth_velocity": "ex: +500K views/hora",
      "acceleration": "exponencial|linear|desacelerando",
      "momentum_score": 98,
      "why_growing_fast": "causa do crescimento (TRADUZIDO para PT-BR)",
      "top_video_title": "título TRADUZIDO para português brasileiro",
      "views_delta_1h": "crescimento na última hora",
      "content_format": "formato",
      "language": "idioma original",
      "inflection_point": "antes_do_pico|no_pico|pos_pico",
      "insight_for_brazil": "como adaptar este momentum para o público brasileiro"
    }
  ],
  "topics": [
    {
      "topic": "slug-sem-acento",
      "label": "Nome legível",
      "reason": "por que vai viralizar — baseado em MOMENTUM real detectado",
      "inspired_by": "canal/vídeo que inspirou (com momentum score)",
      "viral_title": "Título otimizado para CTR máximo com gatilho mental",
      "hook": "Gancho dos primeiros 3 segundos",
      "hashtags": ["#tag1", "#tag2"],
      "suggested_type": "reel|carrossel|story|artigo",
      "suggested_channel": "instagram|youtube|tiktok",
      "optimal_post_time": "melhor horário para postar baseado no momentum atual",
      "monetization_angle": "como monetizar este tema",
      "whatsapp_cta": "CTA para levar para comunidade WhatsApp",
      "predicted_momentum": "previsão de crescimento se postar agora"
    }
  ],
  "momentum_analysis": {
    "fastest_growing_topic": "tema com maior aceleração agora",
    "best_time_to_post": "próxima janela ideal baseada em padrões de crescimento",
    "dying_trends": ["temas que estão PERDENDO momentum — evitar"],
    "emerging_trends": ["temas que ACABARAM de começar a crescer — maior oportunidade"]
  },
  "monetization_insights": {
    "trending_products": ["produtos/serviços dos canais com maior crescimento"],
    "community_growth_tactics": ["táticas dos canais que mais converteram seguidores em comunidade"],
    "revenue_streams": ["fontes de receita dos canais em crescimento exponencial"]
  }
}

Retorne APENAS o JSON, sem markdown.`,
          },
          {
            role: "user",
            content: `Data: ${new Date().toISOString().slice(0, 10)}. Hora: ${new Date().toISOString().slice(11, 16)} UTC.

RANKING BRASIL — Analise o que está com MAIS ACESSOS AGORA nas 3 plataformas:

📱 INSTAGRAM:
- Quais Reels de psicologia/autoajuda estão no Explore com mais views HOJE?
- Quais perfis estão crescendo mais rápido ESTA SEMANA?

🎬 YOUTUBE:
- Quais vídeos de psicologia/comportamento estão no Trending Brasil AGORA?
- Quais Shorts estão com milhões de views HOJE?

🎵 TIKTOK:
- Quais vídeos de saúde mental estão na For You Page com mais views?
- Quais sons/trends estão sendo usados nesse nicho?

RANKEIE os TOP 10 canais/perfis com mais acessos NO MOMENTO no Brasil.

🌍 RANKING MUNDIAL — Analise TAMBÉM os TOP 10 canais/perfis de psicologia, saúde mental, autoajuda e desenvolvimento pessoal com MAIS ACESSOS NO MUNDO INTEIRO:
- Inclua criadores dos EUA, UK, Espanha, Índia, Alemanha, etc.
- Canais como Psych2Go, Einzelgänger, Therapy in a Nutshell, etc. — mas descubra quem está EXPLODINDO AGORA
- Foque em quem tem mais views HOJE, não apenas os maiores em seguidores

Gere 5 tópicos com títulos que SUPEREM os mais acessos do momento (Brasil + Mundo).
Cada título deve ser MELHOR que o #1 trending atual.`,
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
      analysis = { topics: [], viral_patterns: {}, top_10_ranking_brasil: [], top_10_ranking_mundial: [], monetization_insights: {} };
    }

    const topics = analysis.topics || [];
    const viralPatterns = analysis.viral_patterns || {};
    const competitorAnalysis = analysis.top_10_ranking_brasil || analysis.competitor_analysis || [];
    const worldRanking = analysis.top_10_ranking_mundial || [];
    const monetizationInsights = analysis.monetization_insights || {};

    // Save viral intelligence to settings for other functions to use
    await supabase.from("settings").upsert({
      key: "viral_intelligence",
      value: {
        viral_patterns: viralPatterns,
        competitor_analysis: competitorAnalysis,
        world_ranking: worldRanking,
        monetization_insights: monetizationInsights,
        updated_at: new Date().toISOString(),
      },
    }, { onConflict: "key" });

    // Log the research
    await supabase.from("system_logs").insert({
      event_type: "pesquisa",
      message: `Análise viral: ${topics.length} tópicos, ${competitorAnalysis.length} concorrentes analisados, ${(viralPatterns.trending_hashtags || []).length} hashtags trending`,
      level: "info",
      metadata: {
        topics_count: topics.length,
        competitors: competitorAnalysis.map((c: any) => c.channel),
        top_hashtags: (viralPatterns.trending_hashtags || []).slice(0, 5),
        monetization_streams: monetizationInsights.revenue_streams,
        date: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({ topics, viral_patterns: viralPatterns, competitor_analysis: competitorAnalysis, world_ranking: worldRanking, monetization_insights: monetizationInsights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("research-trends error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
