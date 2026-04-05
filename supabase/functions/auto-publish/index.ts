import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if auto_publish is enabled
    const { data: autoSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "auto_publish")
      .single();

    const autoPublish = autoSetting?.value === true || autoSetting?.value === "true";

    if (!autoPublish) {
      return new Response(JSON.stringify({ message: "Auto-publish desativado", published: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get score threshold
    const { data: thresholdSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "score_threshold")
      .single();

    const threshold = Number(thresholdSetting?.value) || 75;

    // Find approved contents with score >= threshold
    const { data: contents, error } = await supabase
      .from("contents")
      .select("*")
      .eq("status", "aprovado")
      .gte("score", threshold);

    if (error) throw error;

    let published = 0;
    for (const content of contents || []) {
      const { error: updateError } = await supabase
        .from("contents")
        .update({ status: "publicado", published_at: new Date().toISOString() })
        .eq("id", content.id);

      if (!updateError) {
        published++;
        await supabase.from("system_logs").insert({
          event_type: "publicacao",
          message: `Publicação automática: "${content.title}"`,
          level: "info",
          metadata: { content_id: content.id, channel: content.channel, score: content.score },
        });
      }
    }

    return new Response(JSON.stringify({ message: `${published} conteúdos publicados`, published }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-publish error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
