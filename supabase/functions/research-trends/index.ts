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
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `Você é um analista de growth hacking e viralização de conteúdo em redes sociais brasileiras, especializado em psicologia, saúde mental e bem-estar.

Sua missão é fazer engenharia reversa dos vídeos e posts MAIS VIRAIS do momento neste nicho.

Analise canais como: Metaforando, Psicólogo Fernando, Ana Beatriz Barbosa, Luana Psicóloga, Morato, Marcos Lacerda (saúde mental), e outros canais de psicologia/autoajuda que estão bombando.

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
  "competitor_analysis": [
    {
      "channel": "nome do canal",
      "platform": "youtube|instagram|tiktok",
      "why_viral": "razão do sucesso",
      "content_format": "formato que mais funciona",
      "posting_frequency": "frequência de postagem"
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

Faça uma análise PROFUNDA dos vídeos e posts mais virais de psicologia/saúde mental/autoajuda NESTE EXATO MOMENTO no Brasil.

Considere:
1. Os 5 vídeos/posts com mais views/likes nas últimas 24h
2. Quais títulos geraram mais cliques (CTR)
3. Quais thumbnails convertem mais
4. Quais ganchos nos primeiros 3 segundos prendem a atenção
5. Quais hashtags estão trending
6. Como os maiores canais monetizam
7. Como eles levam seguidores para comunidades (WhatsApp, Telegram)
8. Quais tipos de conteúdo geram mais compartilhamentos

Gere 5 tópicos (não 3) que GARANTAM viralização baseado nos padrões acima.
Cada tópico deve ter título com gatilho mental (curiosidade, urgência, medo, polêmica controlada).`,
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
      analysis = { topics: [], viral_patterns: {}, competitor_analysis: [], monetization_insights: {} };
    }

    const topics = analysis.topics || [];
    const viralPatterns = analysis.viral_patterns || {};
    const competitorAnalysis = analysis.competitor_analysis || [];
    const monetizationInsights = analysis.monetization_insights || {};

    // Save viral intelligence to settings for other functions to use
    await supabase.from("settings").upsert({
      key: "viral_intelligence",
      value: {
        viral_patterns: viralPatterns,
        competitor_analysis: competitorAnalysis,
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

    return new Response(JSON.stringify({ topics, viral_patterns: viralPatterns, competitor_analysis: competitorAnalysis, monetization_insights: monetizationInsights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("research-trends error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
