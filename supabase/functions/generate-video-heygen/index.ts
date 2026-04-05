import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HEYGEN_API_BASE = "https://api.heygen.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const HEYGEN_API_KEY = Deno.env.get("HEYGEN_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { content_id, action } = await req.json();

    // Action: list avatars
    if (action === "list_avatars") {
      if (!HEYGEN_API_KEY) {
        return new Response(JSON.stringify({ error: "HEYGEN_API_KEY não configurada. Vá em Configurações para adicionar.", avatars: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(`${HEYGEN_API_BASE}/v2/avatars`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });
      const data = await res.json();
      return new Response(JSON.stringify({ avatars: data.data?.avatars || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: generate video
    if (!HEYGEN_API_KEY) {
      await supabase.from("system_logs").insert({
        event_type: "video_heygen",
        message: "⚠️ HeyGen API Key não configurada — vídeo não gerado. Adicione em Configurações.",
        level: "warning",
        metadata: { content_id },
      });
      return new Response(JSON.stringify({
        error: "HEYGEN_API_KEY não configurada",
        status: "pending_api_key",
        message: "Adicione sua HeyGen API Key em Configurações para gerar vídeos com avatar realista e lip sync.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get content
    const { data: content } = await supabase
      .from("contents")
      .select("*")
      .eq("id", content_id)
      .single();

    if (!content) throw new Error("Conteúdo não encontrado");

    // Get visual guide for production specs
    const { data: visualGuideRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "viral_visual_guide")
      .single();
    const visualGuide = (visualGuideRow?.value as any) || {};

    // Determine video dimensions based on channel
    const isVertical = ["instagram", "tiktok"].includes(content.channel || "");
    const dimension = isVertical
      ? { width: 1080, height: 1920 }
      : { width: 1920, height: 1080 };

    // Build script from content body
    const script = content.body || content.title;
    const avatarSpecs = visualGuide.avatar_specs || {};
    const lipSyncGuide = visualGuide.lip_sync_guidelines || {};

    // Create video with HeyGen API v2
    const videoPayload: any = {
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: avatarSpecs.heygen_avatar_id || "Angela-inTshirt-20220820",
            avatar_style: "normal",
          },
          voice: {
            type: "text",
            input_text: script.slice(0, 3000), // HeyGen limit
            voice_id: lipSyncGuide.heygen_voice_id || "pt-BR-FranciscaNeural",
            speed: lipSyncGuide.speaking_speed_ratio || 1.0,
          },
          background: {
            type: "color",
            value: "#ffffff",
          },
        },
      ],
      dimension,
      aspect_ratio: null,
      test: false,
    };

    const createRes = await fetch(`${HEYGEN_API_BASE}/v2/video/generate`, {
      method: "POST",
      headers: {
        "X-Api-Key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(videoPayload),
    });

    const createData = await createRes.json();

    if (!createRes.ok || createData.error) {
      throw new Error(`HeyGen error: ${JSON.stringify(createData.error || createData)}`);
    }

    const videoId = createData.data?.video_id;

    // Log the generation
    await supabase.from("system_logs").insert({
      event_type: "video_heygen",
      message: `🎬 Vídeo HeyGen solicitado: "${content.title}" — ID: ${videoId} — Avatar com lip sync perfeito`,
      level: "info",
      metadata: {
        content_id,
        video_id: videoId,
        dimension,
        avatar_used: videoPayload.video_inputs[0].character.avatar_id,
        voice_used: videoPayload.video_inputs[0].voice.voice_id,
      },
    });

    // Poll for completion (max 5 min)
    let videoUrl = null;
    let status = "processing";
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((r) => setTimeout(r, 10000)); // 10s intervals

      const statusRes = await fetch(`${HEYGEN_API_BASE}/v1/video_status.get?video_id=${videoId}`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });
      const statusData = await statusRes.json();
      status = statusData.data?.status || "processing";

      if (status === "completed") {
        videoUrl = statusData.data?.video_url;
        break;
      }
      if (status === "failed") {
        throw new Error(`HeyGen video failed: ${statusData.data?.error || "unknown"}`);
      }
    }

    if (videoUrl) {
      // Update content with video URL
      await supabase.from("contents").update({ media_url: videoUrl }).eq("id", content_id);

      await supabase.from("system_logs").insert({
        event_type: "video_heygen",
        message: `✅ Vídeo HeyGen pronto: "${content.title}" — Avatar realista com lip sync extremo`,
        level: "info",
        metadata: { content_id, video_id: videoId, video_url: videoUrl },
      });
    } else {
      await supabase.from("system_logs").insert({
        event_type: "video_heygen",
        message: `⏳ Vídeo HeyGen ainda processando: "${content.title}" — ID: ${videoId}`,
        level: "warning",
        metadata: { content_id, video_id: videoId, status },
      });
    }

    return new Response(JSON.stringify({
      video_id: videoId,
      video_url: videoUrl,
      status,
      content_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-video-heygen error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
