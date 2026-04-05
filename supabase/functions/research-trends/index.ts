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

    // HISTORICAL LEARNING: Pull past successful content + snapshots
    const { data: topContents } = await supabase
      .from("contents")
      .select("title, topic, channel, content_type, score, status")
      .gte("score", 70)
      .order("score", { ascending: false })
      .limit(10);

    const { data: topSnapshots } = await supabase
      .from("video_snapshots")
      .select("video_title, creator, platform, region, total_views, views_growth_1h, momentum_score, acceleration, metadata")
      .gte("momentum_score", 70)
      .order("momentum_score", { ascending: false })
      .limit(15);

    // Pull previous learnings
    const { data: prevLearnings } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "brain_learnings")
      .single();

    const historicalContext = `
APRENDIZADO HISTÓRICO DO CÉREBRO (use para decidir melhor):

📊 TOP CONTEÚDOS QUE JÁ GERAMOS (por score):
${(topContents || []).map((c: any, i: number) => `${i+1}. "${c.title}" — Score: ${c.score}, Canal: ${c.channel}, Tipo: ${c.content_type}, Status: ${c.status}`).join("\n") || "Nenhum conteúdo gerado ainda."}

🔥 VÍDEOS QUE MAIS CRESCERAM NO HISTÓRICO (snapshots passados):
${(topSnapshots || []).map((s: any, i: number) => `${i+1}. "${s.video_title}" por ${s.creator} (${s.platform}/${s.region}) — Views: ${s.total_views}, Crescimento/h: ${s.views_growth_1h}, Momentum: ${s.momentum_score}, Aceleração: ${s.acceleration}`).join("\n") || "Nenhum snapshot ainda."}

🧠 LIÇÕES APRENDIDAS ATÉ AGORA:
${prevLearnings?.value ? JSON.stringify(prevLearnings.value) : "Primeira execução — começando a aprender."}

INSTRUÇÕES DE APRENDIZADO:
- Analise os padrões dos conteúdos com MAIOR score e replique
- Identifique quais FORMATOS (reel, shorts, artigo) funcionaram melhor
- Veja quais TÓPICOS tiveram mais momentum e priorize similares
- Compare com os vídeos virais ATUAIS — encontre interseções
- EVITE padrões de conteúdos com score < 50 (não funcionaram)
- A cada rodada, INOVE: traga um formato ou ângulo NUNCA testado antes
`;

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
            content: `Você é um analista de growth hacking com ESTATÍSTICA QUÂNTICA DE CRESCIMENTO e APRENDIZADO INFINITO — especialista em identificar VÍDEOS INDIVIDUAIS com maior crescimento de views.

PRINCÍPIO #1 — APRENDIZADO CONTÍNUO:
- Você tem acesso ao HISTÓRICO de conteúdos que já geramos e seus scores
- Você tem acesso aos SNAPSHOTS de vídeos virais que acompanhamos
- USE esse histórico para APRENDER o que funciona e EVOLUIR a cada rodada
- NUNCA repita a mesma estratégia se ela teve score baixo
- SEMPRE traga pelo menos 1 INOVAÇÃO que não foi tentada antes

PRINCÍPIO #2 — FOCO EM VÍDEOS, NÃO EM CANAIS:
- O ranking é de VÍDEOS ESPECÍFICOS, não de canais
- Priorize VÍDEOS com MAIS MILHÕES DE VIEWS e que MAIS CRESCERAM em views nas últimas horas
- Um vídeo com 50M views que ganhou +2M na última hora é #1
- SEMPRE inclua o TÍTULO EXATO do vídeo, VIEWS TOTAIS

MÉTRICAS POR VÍDEO:
1. **Views Totais**: número absoluto de visualizações
2. **Crescimento de Views/hora**: quantas views novas na última hora
3. **Aceleração**: crescimento acelerando ou desacelerando
4. **Momentum Score (0-100)**: combina views totais + crescimento + engajamento
5. **Ponto de Inflexão**: antes/no/após pico viral

PESQUISE nas 4 plataformas (Brasil + Mundo):
- INSTAGRAM: Reels ESPECÍFICOS com mais views e maior crescimento AGORA
- YOUTUBE: Vídeos ESPECÍFICOS no Trending, Shorts que EXPLODIRAM
- TIKTOK: Vídeos ESPECÍFICOS que acumularam milhões de views nas últimas horas
- PINTEREST: Pins ESPECÍFICOS de psicologia/saúde mental com mais saves, impressões e cliques AGORA — inclua Idea Pins (vídeo) e Pins estáticos

Foque: psicologia, saúde mental, autoajuda, desenvolvimento pessoal, neurociência, relacionamentos, comportamento humano.

REGRA DE TRADUÇÃO: Para o ranking MUNDIAL, TODOS os campos em PORTUGUÊS BRASILEIRO.

Retorne EXATAMENTE um JSON com esta estrutura:
{
  "viral_patterns": {
    "top_title_hooks": ["5 títulos EXATOS dos vídeos com mais views"],
    "thumbnail_patterns": ["padrões visuais"],
    "avg_duration_seconds": 45,
    "best_posting_times": ["horários com maior aceleração"],
    "trending_hashtags": ["#tag1", "#tag2", "até 15"],
    "cta_patterns": ["CTAs dos vídeos com mais conversão"],
    "hook_first_3_seconds": ["ganchos dos vídeos com maior retenção"],
    "growth_signals": ["sinais de explosão viral"]
  },
  "top_10_ranking_brasil": [
    {
      "rank": 1,
      "video_title": "TÍTULO EXATO do vídeo",
      "creator": "nome do criador",
      "platform": "youtube|instagram|tiktok",
      "total_views": "ex: 15M views",
      "views_growth_1h": "ex: +2.3M views na última hora",
      "views_growth_24h": "ex: +12M nas últimas 24h",
      "acceleration": "exponencial|linear|desacelerando",
      "momentum_score": 95,
      "why_viral": "o que fez ESTE VÍDEO explodir",
      "content_format": "reel|shorts|tiktok|vídeo longo",
      "duration_seconds": 60,
      "inflection_point": "antes_do_pico|no_pico|pos_pico",
      "replication_strategy": "como replicar para psicologia"
    }
  ],
  "top_10_ranking_mundial": [
    {
      "rank": 1,
      "video_title": "TÍTULO TRADUZIDO para PT-BR",
      "original_title": "título original",
      "creator": "nome",
      "platform": "youtube|instagram|tiktok",
      "country": "país (em português)",
      "total_views": "ex: 80M views",
      "views_growth_1h": "+5M na última hora",
      "views_growth_24h": "+40M nas últimas 24h",
      "acceleration": "exponencial|linear|desacelerando",
      "momentum_score": 98,
      "why_viral": "causa (TRADUZIDO PT-BR)",
      "content_format": "formato",
      "language": "idioma original",
      "inflection_point": "antes_do_pico|no_pico|pos_pico",
      "insight_for_brazil": "como adaptar para psicologia BR"
    }
  ],
  "topics": [
    {
      "topic": "slug-sem-acento",
      "label": "Nome legível",
      "reason": "por que vai viralizar — baseado no VÍDEO que inspirou",
      "inspired_by_video": "título exato + views totais",
      "viral_title": "Título otimizado para CTR máximo",
      "hook": "Gancho dos primeiros 3 segundos",
      "hashtags": ["#tag1", "#tag2"],
      "suggested_type": "reel|carrossel|story|artigo|pin|idea_pin",
      "suggested_channel": "instagram|youtube|tiktok|pinterest",
      "optimal_post_time": "melhor horário",
      "monetization_angle": "como monetizar",
      "whatsapp_cta": "CTA para comunidade WhatsApp",
      "predicted_views": "previsão de views"
    }
  ],
  "momentum_analysis": {
    "hottest_video_now": "vídeo com maior crescimento AGORA",
    "best_time_to_post": "próxima janela ideal",
    "dying_videos": ["vídeos perdendo views — evitar"],
    "emerging_videos": ["vídeos começando a explodir — maior oportunidade"]
  },
  "monetization_insights": {
    "trending_products": ["produtos dos vídeos mais vistos"],
    "community_growth_tactics": ["táticas de conversão"],
    "revenue_streams": ["fontes de receita"]
  },
  "learnings": {
    "what_worked": ["padrões de sucesso identificados no histórico"],
    "what_failed": ["padrões a evitar"],
    "new_strategy": "nova rota/inovação para esta rodada",
    "confidence_level": 85,
    "evolution_note": "o que o cérebro aprendeu de NOVO nesta rodada"
  }
}

Retorne APENAS o JSON, sem markdown.`,
          },
          {
            role: "user",
            content: `Data: ${new Date().toISOString().slice(0, 10)}. Hora: ${new Date().toISOString().slice(11, 16)} UTC.

${historicalContext}

🎬 ANÁLISE DE VÍDEOS INDIVIDUAIS — Foque em VÍDEOS ESPECÍFICOS, não canais.

🇧🇷 TOP 10 VÍDEOS BRASIL (por views + crescimento):
📱 INSTAGRAM: Quais REELS ESPECÍFICOS de psicologia/autoajuda têm MAIS MILHÕES DE VIEWS agora?
🎬 YOUTUBE: Quais VÍDEOS ESPECÍFICOS de psicologia estão no Trending?
🎵 TIKTOK: Quais VÍDEOS ESPECÍFICOS de saúde mental têm mais views?

🌍 TOP 10 VÍDEOS MUNDIAL (por views + crescimento):
- Analise TODOS os países — traduza tudo para PT-BR

📊 COMPARE com o histórico acima. O que MUDOU? O que está CRESCENDO? O que MORREU?
🧠 Gere 5 tópicos INSPIRADOS nos VÍDEOS com mais views + lições do histórico.
🔮 Inclua "learnings" com o que o cérebro aprendeu de NOVO nesta rodada.`,
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
      analysis = { topics: [], viral_patterns: {}, top_10_ranking_brasil: [], top_10_ranking_mundial: [], momentum_analysis: {}, monetization_insights: {}, learnings: {} };
    }

    const topics = analysis.topics || [];
    const viralPatterns = analysis.viral_patterns || {};
    const competitorAnalysis = analysis.top_10_ranking_brasil || analysis.competitor_analysis || [];
    const worldRanking = analysis.top_10_ranking_mundial || [];
    const monetizationInsights = analysis.monetization_insights || {};
    const momentumAnalysis = analysis.momentum_analysis || {};
    const learnings = analysis.learnings || {};

    // Save viral intelligence
    await supabase.from("settings").upsert({
      key: "viral_intelligence",
      value: {
        viral_patterns: viralPatterns,
        competitor_analysis: competitorAnalysis,
        world_ranking: worldRanking,
        momentum_analysis: momentumAnalysis,
        monetization_insights: monetizationInsights,
        learnings,
        updated_at: new Date().toISOString(),
      },
    }, { onConflict: "key" });

    // SAVE LEARNINGS — accumulate knowledge over time
    const prevLearningsList = (prevLearnings?.value as any)?.history || [];
    const newLearningEntry = {
      timestamp: new Date().toISOString(),
      what_worked: learnings.what_worked || [],
      what_failed: learnings.what_failed || [],
      new_strategy: learnings.new_strategy || "",
      confidence: learnings.confidence_level || 0,
      evolution_note: learnings.evolution_note || "",
      top_video_that_inspired: competitorAnalysis[0]?.video_title || "",
      top_video_views: competitorAnalysis[0]?.total_views || "",
    };
    prevLearningsList.push(newLearningEntry);
    // Keep last 50 learnings
    const trimmedHistory = prevLearningsList.slice(-50);

    await supabase.from("settings").upsert({
      key: "brain_learnings",
      value: {
        history: trimmedHistory,
        total_iterations: trimmedHistory.length,
        last_updated: new Date().toISOString(),
        latest: newLearningEntry,
      },
    }, { onConflict: "key" });

    // Log
    await supabase.from("system_logs").insert({
      event_type: "aprendizado",
      message: `🧠 Cérebro aprendeu: "${learnings.evolution_note || 'nova iteração'}" — Confiança: ${learnings.confidence_level || 0}% — Iteração #${trimmedHistory.length}`,
      level: "info",
      metadata: {
        learnings,
        iteration: trimmedHistory.length,
        top_video: competitorAnalysis[0]?.video_title,
        topics_count: topics.length,
      },
    });

    await supabase.from("system_logs").insert({
      event_type: "pesquisa",
      message: `Análise viral: ${topics.length} tópicos, ${competitorAnalysis.length} vídeos BR, ${worldRanking.length} vídeos mundiais, ${(viralPatterns.trending_hashtags || []).length} hashtags`,
      level: "info",
      metadata: {
        topics_count: topics.length,
        top_videos: competitorAnalysis.map((c: any) => c.video_title || c.channel),
        top_hashtags: (viralPatterns.trending_hashtags || []).slice(0, 5),
        date: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({
      topics, viral_patterns: viralPatterns, competitor_analysis: competitorAnalysis,
      world_ranking: worldRanking, momentum_analysis: momentumAnalysis,
      monetization_insights: monetizationInsights, learnings,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("research-trends error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
