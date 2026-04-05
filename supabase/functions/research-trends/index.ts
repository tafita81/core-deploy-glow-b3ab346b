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
            content: `Você é um analista de growth hacking e viralização de conteúdo em redes sociais.

Sua missão é fazer engenharia reversa dos vídeos e posts com MAIS ACESSOS DO MOMENTO no BRASIL e no MUNDO INTEIRO.

PESQUISE AMPLAMENTE nas 3 plataformas:
- INSTAGRAM: Explore/Reels mais vistos, contas com mais crescimento HOJE (Brasil + Mundo)
- YOUTUBE: Trending Brasil + Trending Global, Shorts mais vistos, vídeos em alta AGORA
- TIKTOK: For You Page Brasil + Global, sons trending, vídeos com mais views HOJE

Foque nos nichos: psicologia, saúde mental, autoajuda, desenvolvimento pessoal, neurociência, relacionamentos, comportamento humano.

REGRA DE TRADUÇÃO: Para o ranking MUNDIAL, TODOS os campos devem ser escritos em PORTUGUÊS BRASILEIRO. Traduza títulos, descrições e insights. Adicione o campo "insight_for_brazil" explicando como adaptar o conteúdo viral internacional para o público brasileiro.

Rankeie os TOP 10 canais/perfis com mais acessos NO MOMENTO em todo o Brasil nestes nichos, independente de quão conhecidos sejam.

Retorne EXATAMENTE um JSON com esta estrutura:
{
  "viral_patterns": {
    "top_title_hooks": ["5 exemplos de títulos que mais geraram cliques esta semana"],
    "thumbnail_patterns": ["descrição do padrão visual das thumbnails virais"],
    "avg_duration_seconds": 45,
    "best_posting_times": ["horários que mais geram engajamento"],
    "trending_hashtags": ["#tag1", "#tag2", "até 15 hashtags"],
    "cta_patterns": ["tipos de CTA que mais convertem"],
    "hook_first_3_seconds": ["exemplos de ganchos dos primeiros 3 segundos"]
  },
  "top_10_ranking_brasil": [
    {
      "rank": 1,
      "channel": "nome do canal/perfil",
      "platform": "youtube|instagram|tiktok",
      "followers": "número aproximado",
      "why_trending_now": "por que está com mais acessos AGORA",
      "top_video_title": "título do vídeo/post com mais views hoje",
      "content_format": "formato que mais funciona",
      "posting_frequency": "frequência"
    }
  ],
  "top_10_ranking_mundial": [
    {
      "rank": 1,
      "channel": "nome do canal/perfil",
      "platform": "youtube|instagram|tiktok",
      "country": "país de origem (em português)",
      "followers": "número aproximado",
      "why_trending_now": "por que está com mais acessos AGORA no mundo (TRADUZIDO para português brasileiro)",
      "top_video_title": "título do vídeo TRADUZIDO para português brasileiro",
      "content_format": "formato que mais funciona",
      "language": "idioma original",
      "insight_for_brazil": "como adaptar esse conteúdo viral para o público brasileiro"
    }
  ],
  "topics": [
    {
      "topic": "slug-sem-acento",
      "label": "Nome legível",
      "reason": "por que vai viralizar",
      "viral_title": "Título otimizado para CTR máximo com gatilho mental",
      "hook": "Gancho dos primeiros 3 segundos",
      "hashtags": ["#tag1", "#tag2"],
      "suggested_type": "reel|carrossel|story|artigo",
      "suggested_channel": "instagram|youtube|tiktok",
      "monetization_angle": "como monetizar este tema",
      "whatsapp_cta": "CTA para levar para comunidade WhatsApp"
    }
  ],
  "monetization_insights": {
    "trending_products": ["produtos/serviços que canais similares vendem"],
    "community_growth_tactics": ["táticas para crescer comunidade WhatsApp"],
    "revenue_streams": ["fontes de receita dos top canais"]
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
