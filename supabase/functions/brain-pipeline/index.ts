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

    // Log pipeline start
    await supabase.from("system_logs").insert({
      event_type: "sistema",
      message: "Pipeline autônomo iniciado",
      level: "info",
    });

    // Get settings
    const { data: settingsRows } = await supabase.from("settings").select("*");
    const settings: Record<string, any> = {};
    settingsRows?.forEach((s) => { settings[s.key] = s.value; });

    const scienceCheck = settings.science_check !== false && settings.science_check !== "false";
    const ethicsCheck = settings.ethics_check !== false && settings.ethics_check !== "false";
    const autoPublish = settings.auto_publish === true || settings.auto_publish === "true";
    const scoreThreshold = Number(settings.score_threshold) || 75;

    const results = { researched: 0, generated: 0, validated: 0, published: 0, errors: [] as string[] };

    // STEP 1: Research trends
    let topics: Array<{ topic: string; label: string; suggested_type: string; suggested_channel: string }> = [];
    try {
      const trendRes = await fetch(`${supabaseUrl}/functions/v1/research-trends`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (trendRes.ok) {
        const trendData = await trendRes.json();
        topics = trendData.topics || [];
        results.researched = topics.length;
      }
    } catch (e) {
      results.errors.push(`Pesquisa: ${e instanceof Error ? e.message : "erro"}`);
    }

    // STEP 2: Generate content for each topic (limit to 2 per run)
    const contentIds: string[] = [];
    for (const topic of topics.slice(0, 2)) {
      try {
        const genRes = await fetch(`${supabaseUrl}/functions/v1/generate-content`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topic: topic.topic,
            channel: topic.suggested_channel || "instagram",
            content_type: topic.suggested_type || "carrossel",
          }),
        });
        if (genRes.ok) {
          const genData = await genRes.json();
          if (genData.content?.id) {
            contentIds.push(genData.content.id);
            results.generated++;
          }
        }
      } catch (e) {
        results.errors.push(`Geração ${topic.label}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }

    // STEP 3: Validate each generated content
    for (const contentId of contentIds) {
      try {
        // Science validation
        if (scienceCheck) {
          await fetch(`${supabaseUrl}/functions/v1/validate-science`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ content_id: contentId }),
          });
        }

        // Ethics validation
        if (ethicsCheck) {
          await fetch(`${supabaseUrl}/functions/v1/validate-ethics`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ content_id: contentId }),
          });
        }

        results.validated++;
      } catch (e) {
        results.errors.push(`Validação ${contentId}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }

    // STEP 4: Auto-publish if enabled
    if (autoPublish) {
      const { data: approved } = await supabase
        .from("contents")
        .select("*")
        .eq("status", "aprovado")
        .eq("scientific_valid", true)
        .eq("ethics_valid", true)
        .gte("score", scoreThreshold);

      for (const content of approved || []) {
        const { error: pubError } = await supabase
          .from("contents")
          .update({ status: "publicado", published_at: new Date().toISOString() })
          .eq("id", content.id);

        if (!pubError) {
          results.published++;
          await supabase.from("system_logs").insert({
            event_type: "publicacao",
            message: `Auto-publicado: "${content.title}"`,
            level: "info",
            metadata: { content_id: content.id, score: content.score },
          });
        }
      }
    }

    // Log pipeline completion
    await supabase.from("system_logs").insert({
      event_type: "sistema",
      message: `Pipeline concluído: ${results.researched} pesquisados, ${results.generated} gerados, ${results.validated} validados, ${results.published} publicados`,
      level: results.errors.length > 0 ? "warning" : "info",
      metadata: results,
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("brain-pipeline error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
