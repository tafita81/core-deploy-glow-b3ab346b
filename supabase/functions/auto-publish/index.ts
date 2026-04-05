import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Optimal posting times for Brazil (UTC-3 → UTC)
// Instagram: 11h-13h, 18h-20h BR → 14-16, 21-23 UTC
// YouTube: 12h-15h, 18h-21h BR → 15-18, 21-00 UTC
// TikTok: 7h-9h, 12h-14h, 19h-22h BR → 10-12, 15-17, 22-01 UTC
// WhatsApp: 8h-10h, 17h-19h BR → 11-13, 20-22 UTC
function isOptimalTime(platform: string): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();

  switch (platform) {
    case "instagram":
      return (utcHour >= 14 && utcHour <= 16) || (utcHour >= 21 && utcHour <= 23);
    case "youtube":
      return (utcHour >= 15 && utcHour <= 18) || (utcHour >= 21 && utcHour <= 23);
    case "tiktok":
      return (utcHour >= 10 && utcHour <= 12) || (utcHour >= 15 && utcHour <= 17) || (utcHour >= 22 || utcHour <= 1);
    case "whatsapp":
      return (utcHour >= 11 && utcHour <= 13) || (utcHour >= 20 && utcHour <= 22);
    default:
      return true;
  }
}

function getNextOptimalTime(platform: string): string {
  const brHour = (new Date().getUTCHours() - 3 + 24) % 24;
  switch (platform) {
    case "instagram":
      if (brHour < 11) return "11h (BR)";
      if (brHour < 18) return "18h (BR)";
      return "11h amanhã (BR)";
    case "youtube":
      if (brHour < 12) return "12h (BR)";
      if (brHour < 18) return "18h (BR)";
      return "12h amanhã (BR)";
    case "tiktok":
      if (brHour < 7) return "7h (BR)";
      if (brHour < 12) return "12h (BR)";
      if (brHour < 19) return "19h (BR)";
      return "7h amanhã (BR)";
    case "whatsapp":
      if (brHour < 8) return "8h (BR)";
      if (brHour < 17) return "17h (BR)";
      return "8h amanhã (BR)";
    default:
      return "em breve";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const { data: thresholdSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "score_threshold")
      .single();

    const threshold = Number(thresholdSetting?.value) || 75;

    // Check which channels are connected
    const { data: channels } = await supabase
      .from("channels")
      .select("platform, is_connected")
      .eq("is_connected", true);

    const connectedPlatforms = (channels || []).map((c) => c.platform);

    if (connectedPlatforms.length === 0) {
      await supabase.from("system_logs").insert({
        event_type: "publicacao",
        message: "⏸️ Auto-publish: nenhum canal conectado — configure tokens em Configurações",
        level: "warning",
      });
      return new Response(JSON.stringify({ message: "Nenhum canal conectado", published: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check optimal timing for each connected platform
    const platformsReady = connectedPlatforms.filter((p) => isOptimalTime(p));
    const platformsWaiting = connectedPlatforms.filter((p) => !isOptimalTime(p));

    if (platformsReady.length === 0) {
      const nextTimes = platformsWaiting.map((p) => `${p}: ${getNextOptimalTime(p)}`).join(", ");
      await supabase.from("system_logs").insert({
        event_type: "agendamento",
        message: `⏰ Fora do horário ideal — próximos horários: ${nextTimes}`,
        level: "info",
        metadata: { waiting: platformsWaiting, next_times: nextTimes },
      });
      return new Response(JSON.stringify({ message: "Fora do horário ideal", next_times: nextTimes, published: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find approved content matching optimal platforms
    const { data: contents } = await supabase
      .from("contents")
      .select("*")
      .eq("status", "aprovado")
      .eq("scientific_valid", true)
      .eq("ethics_valid", true)
      .gte("score", threshold)
      .order("score", { ascending: false })
      .limit(3);

    let published = 0;
    const results: any[] = [];

    for (const content of contents || []) {
      // Only publish if the content's target channel is in optimal time
      const targetChannel = content.channel || "instagram";
      if (!isOptimalTime(targetChannel)) {
        results.push({ title: content.title, channel: targetChannel, status: "aguardando_horario", next: getNextOptimalTime(targetChannel) });
        continue;
      }

      try {
        const pubRes = await fetch(`${supabaseUrl}/functions/v1/publish-social`, {
          method: "POST",
          headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ content_id: content.id }),
        });

        if (pubRes.ok) {
          published++;
          results.push({ title: content.title, channel: targetChannel, status: "publicado" });
        } else {
          results.push({ title: content.title, channel: targetChannel, status: "erro", code: pubRes.status });
        }
      } catch (e) {
        results.push({ title: content.title, channel: targetChannel, status: "erro", error: e instanceof Error ? e.message : "erro" });
      }
    }

    const brHour = (new Date().getUTCHours() - 3 + 24) % 24;
    await supabase.from("system_logs").insert({
      event_type: "publicacao",
      message: `🚀 Auto-publish: ${published} publicados, ${platformsReady.length} canais em horário ideal (${brHour}h BR), ${platformsWaiting.length} aguardando`,
      level: published > 0 ? "info" : "warning",
      metadata: { published, results, platforms_ready: platformsReady, platforms_waiting: platformsWaiting, br_hour: brHour },
    });

    return new Response(JSON.stringify({ published, results, platforms_ready: platformsReady }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-publish error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
