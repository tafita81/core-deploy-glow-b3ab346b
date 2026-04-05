import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", tone: "warm, empathetic, calm", best_for: "anxiety, self-esteem, grief, emotional topics" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", tone: "professional, clear, reassuring", best_for: "educational content, burnout, emotional intelligence" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", tone: "gentle, nurturing, soft", best_for: "trauma, relationships, parenting, vulnerability" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", tone: "youthful, energetic, relatable", best_for: "social media tips, young audience, self-care, motivation" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", tone: "confident, articulate, inspiring", best_for: "empowerment, resilience, overcoming challenges" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", tone: "friendly, conversational, approachable", best_for: "general wellness, daily habits, mindfulness" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", tone: "deep, calm, authoritative", best_for: "scientific content, studies, serious mental health topics" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", tone: "warm, fatherly, grounded", best_for: "parenting, family dynamics, grief support" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", tone: "smooth, modern, engaging", best_for: "reels, short videos, trending topics, youth content" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", tone: "thoughtful, measured, intellectual", best_for: "deep analysis, psychology concepts, research-based content" },
];

async function selectBestVoice(content: any, apiKey: string): Promise<{ id: string; name: string }> {
  const voiceList = VOICES.map(v => `- ${v.name} (${v.tone}): best for ${v.best_for}`).join("\n");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `Escolha a voz mais adequada para narrar. Vozes:\n${voiceList}\nRetorne APENAS o nome.` },
        { role: "user", content: `Tema: ${content.topic}\nTipo: ${content.content_type}\nCanal: ${content.channel}\nTítulo: ${content.title}\n${(content.body || "").slice(0, 300)}` },
      ],
    }),
  });
  if (res.ok) {
    const data = await res.json();
    const name = (data.choices?.[0]?.message?.content || "").trim().replace(/['"]/g, "");
    const match = VOICES.find(v => v.name.toLowerCase() === name.toLowerCase());
    if (match) return match;
  }
  if (content.content_type === "reel" || content.channel === "tiktok") return { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" };
  if (content.topic === "trauma" || content.topic === "luto") return { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda" };
  return { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" };
}

function getVoiceSettings(content: any) {
  const topic = content.topic || "";
  const type = content.content_type || "";
  if (["trauma", "luto", "autoestima"].includes(topic)) return { stability: 0.75, similarity_boost: 0.8, style: 0.3, speed: 0.9 };
  if (type === "reel" || ["burnout", "inteligencia-emocional"].includes(topic)) return { stability: 0.45, similarity_boost: 0.75, style: 0.5, speed: 1.05 };
  if (type === "story") return { stability: 0.55, similarity_boost: 0.75, style: 0.4, speed: 1.0 };
  return { stability: 0.6, similarity_boost: 0.75, style: 0.4, speed: 1.0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content_id } = await req.json();
    if (!content_id) return new Response(JSON.stringify({ error: "content_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: content, error: fetchErr } = await supabase.from("contents").select("*").eq("id", content_id).single();
    if (fetchErr || !content) throw new Error("Conteúdo não encontrado");

    // Get viral metadata for this content
    const { data: viralMeta } = await supabase.from("settings").select("value").eq("key", `content_viral_meta_${content_id}`).single();
    const meta = (viralMeta?.value as any) || {};

    // Generate VIRAL thumbnail — high-contrast, emotional, click-optimized
    const thumbnailPrompt = meta.thumbnail_desc ||
      await generateViralImagePrompt(content, LOVABLE_API_KEY);

    const imageRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        prompt: thumbnailPrompt,
        n: 1,
        size: "1024x1024",
      }),
    });

    let thumbnailUrl = null;
    if (imageRes.ok) {
      const imageData = await imageRes.json();
      const imageB64 = imageData.data?.[0]?.b64_json;
      if (imageB64) {
        const fileName = `thumbnails/${content_id}_${Date.now()}.png`;
        const imageBytes = Uint8Array.from(atob(imageB64), c => c.charCodeAt(0));
        const { error: uploadErr } = await supabase.storage.from("media").upload(fileName, imageBytes, { contentType: "image/png", upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
          thumbnailUrl = urlData.publicUrl;
        }
      }
    }

    // Generate narration for ALL video content types (reel, story, carrossel)
    let audioUrl = null;
    let selectedVoice = null;

    if (["reel", "story", "carrossel"].includes(content.content_type)) {
      const narrationRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Transforme em narração VIRAL para vídeo brasileiro.
REGRAS:
- Comece com o gancho que PARA O SCROLL: ${meta.hook || "pergunta impactante"}
- Tom conversacional e envolvente
- Pausas dramáticas com "..."
- Duração: 30-60s para reel/story, 60-90s para carrossel
- Termine com CTA: "${meta.whatsapp_cta || "Segue pra mais conteúdo e entra na comunidade, link na bio"}"
- NUNCA mencione títulos profissionais
Retorne APENAS o texto da narração.`,
            },
            { role: "user", content: `${content.title}\n\n${content.body}` },
          ],
        }),
      });

      if (narrationRes.ok) {
        const narrationData = await narrationRes.json();
        const narrationText = narrationData.choices?.[0]?.message?.content || "";

        if (narrationText) {
          // Save script
          const encoder = new TextEncoder();
          await supabase.storage.from("media").upload(`scripts/${content_id}_narration.txt`, encoder.encode(narrationText), { contentType: "text/plain", upsert: true });

          // Generate audio with best voice
          const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
          if (ELEVENLABS_API_KEY) {
            selectedVoice = await selectBestVoice(content, LOVABLE_API_KEY);
            const voiceSettings = getVoiceSettings(content);

            const ttsRes = await fetch(
              `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice.id}?output_format=mp3_44100_128`,
              {
                method: "POST",
                headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ text: narrationText, model_id: "eleven_multilingual_v2", voice_settings: voiceSettings }),
              }
            );

            if (ttsRes.ok) {
              const audioBuffer = await ttsRes.arrayBuffer();
              const audioFileName = `audio/${content_id}_narration.mp3`;
              await supabase.storage.from("media").upload(audioFileName, new Uint8Array(audioBuffer), { contentType: "audio/mpeg", upsert: true });
              const { data: audioUrlData } = supabase.storage.from("media").getPublicUrl(audioFileName);
              audioUrl = audioUrlData.publicUrl;
            }
          }
        }
      }
    }

    // Update content
    const updates: Record<string, any> = {};
    if (thumbnailUrl) updates.thumbnail_url = thumbnailUrl;
    if (audioUrl) updates.audio_url = audioUrl;
    if (Object.keys(updates).length > 0) {
      await supabase.from("contents").update(updates).eq("id", content_id);
    }

    await supabase.from("system_logs").insert({
      event_type: "midia",
      message: `🎬 Mídia VIRAL gerada: "${content.title}" — Img: ${thumbnailUrl ? "✓" : "✗"}, Áudio: ${audioUrl ? `✓ (${selectedVoice?.name})` : "✗"}`,
      level: "info",
      metadata: { content_id, thumbnailUrl, audioUrl, voice: selectedVoice?.name },
    });

    return new Response(JSON.stringify({ thumbnailUrl, audioUrl, voice: selectedVoice?.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-media error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateViralImagePrompt(content: any, apiKey: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `Create a prompt for a VIRAL thumbnail image for a mental health social media post.
The thumbnail MUST:
- Be HIGH CONTRAST with bold colors (not pastel — use vibrant purples, oranges, blues)
- Have dramatic lighting and visual impact
- Feel professional like top YouTube/Instagram channels
- Include abstract emotional symbolism (broken chains, light through darkness, brain imagery)
- NO text, NO real faces
- Style: modern, cinematic, eye-catching, 4K quality
- MUST make someone want to click immediately
Return ONLY the prompt in English.`,
        },
        { role: "user", content: `Topic: ${content.topic}\nTitle: ${content.title}` },
      ],
    }),
  });
  if (res.ok) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Dramatic cinematic mental health illustration, vibrant purple and orange, abstract brain imagery, 4K professional thumbnail";
  }
  return "Dramatic cinematic mental health illustration, vibrant purple and orange, abstract brain imagery, 4K professional thumbnail";
}
