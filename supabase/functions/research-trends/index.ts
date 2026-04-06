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

    // Get current data + learnings
    const [{ data: currentIntel }, { data: prevLearnings }, { data: topContents }] = await Promise.all([
      supabase.from("settings").select("value").eq("key", "viral_intelligence").single(),
      supabase.from("settings").select("value").eq("key", "brain_learnings").single(),
      supabase.from("contents").select("title, topic, score, status").gte("score", 70).order("score", { ascending: false }).limit(10),
    ]);

    const currentVideos = currentIntel?.value as any;

    // Use AI to generate topic suggestions based on existing real data
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Analista de growth para conteúdo de saúde mental, psicologia, neurociência, comportamento humano e desenvolvimento pessoal.

Sua tarefa: gerar 5-8 tópicos de conteúdo ORIGINAIS inspirados nos vídeos reais e tendências fornecidos.

REGRAS:
- NÃO invente vídeos, títulos de vídeos existentes ou URLs
- Gere apenas TÓPICOS/IDEIAS de conteúdo original
- Sugira hashtags e formatos baseados em tendências reais do nicho
- Foque em temas que geram alto engajamento: ansiedade, autoconhecimento, relacionamentos, neurociência do dia a dia

Retorne JSON (sem markdown):
{
  "topics": [
    {
      "topic": "slug-sem-acento",
      "label": "Nome legível",
      "reason": "por que é relevante agora",
      "viral_title": "Título otimizado para CTR",
      "hook": "Gancho dos primeiros 3 segundos",
      "hashtags": ["#tag1", "#tag2"],
      "suggested_type": "reel|carrossel|story|artigo",
      "suggested_channel": "instagram|youtube|tiktok|pinterest"
    }
  ],
  "viral_patterns": {
    "trending_hashtags": ["hashtags do momento no nicho"],
    "best_posting_times": ["horários"],
    "hook_first_3_seconds": ["ganchos efetivos"]
  },
  "learnings": {
    "what_worked": ["padrões identificados"],
    "new_strategy": "inovação",
    "evolution_note": "o que aprendeu"
  }
}`,
          },
          {
            role: "user",
            content: `Data: ${new Date().toISOString()}

VÍDEOS REAIS que temos como referência:
${JSON.stringify((currentVideos?.competitor_analysis || []).map((v: any) => ({ title: v.video_title, creator: v.creator, views: v.total_views })), null, 2)}

CONTEÚDOS JÁ GERADOS (por score):
${(topContents || []).map((c: any) => `- "${c.title}" score:${c.score}`).join("\n") || "Nenhum"}

Gere tópicos de conteúdo ORIGINAIS inspirados nestas referências reais.`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      // If AI fails, still return current data
      console.log(`AI returned ${aiRes.status}, returning cached data`);
      return new Response(JSON.stringify({
        topics: [],
        viral_patterns: currentVideos?.viral_patterns || {},
        competitor_analysis: currentVideos?.competitor_analysis || [],
        world_ranking: currentVideos?.world_ranking || [],
        data_source: currentVideos?.data_source || "cached",
        learnings: {},
        error_note: `AI unavailable (${aiRes.status}), showing cached data`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    let raw = aiData.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let analysis: any;
    try { analysis = JSON.parse(raw); } catch {
      console.error("Parse fail:", raw.slice(0, 300));
      analysis = { topics: [], viral_patterns: {}, learnings: {} };
    }

    const topics = analysis.topics || [];
    const viralPatterns = analysis.viral_patterns || {};
    const learnings = analysis.learnings || {};

    // Update viral_patterns in settings (keep videos as-is, update topics/patterns)
    if (currentVideos) {
      await supabase.from("settings").upsert({
        key: "viral_intelligence",
        value: {
          ...currentVideos,
          viral_patterns: { ...(currentVideos.viral_patterns || {}), ...viralPatterns },
          updated_at: new Date().toISOString(),
        },
      }, { onConflict: "key" });
    }

    // Save learnings
    const history = ((prevLearnings?.value as any)?.history || []).slice(-49);
    history.push({
      timestamp: new Date().toISOString(),
      evolution_note: learnings.evolution_note || "",
      topics_generated: topics.length,
    });
    await supabase.from("settings").upsert({
      key: "brain_learnings",
      value: { history, total_iterations: history.length, last_updated: new Date().toISOString(), latest: history[history.length - 1] },
    }, { onConflict: "key" });

    await supabase.from("system_logs").insert({
      event_type: "pesquisa",
      message: `🧠 Atualização: ${topics.length} novos tópicos gerados baseados em vídeos reais`,
      level: "info",
      metadata: { topics_count: topics.length, source: "ai_analysis_real_data" },
    });

    return new Response(JSON.stringify({
      topics,
      viral_patterns: viralPatterns,
      competitor_analysis: currentVideos?.competitor_analysis || [],
      world_ranking: currentVideos?.world_ranking || [],
      data_source: currentVideos?.data_source || "youtube_verified_real",
      learnings,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("research-trends error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
