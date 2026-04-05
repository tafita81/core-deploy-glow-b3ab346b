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

    // Get recent viral video data to analyze visual patterns
    const { data: topSnapshots } = await supabase
      .from("video_snapshots")
      .select("*")
      .order("momentum_score", { ascending: false })
      .limit(20);

    const { data: viralIntelRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "viral_intelligence")
      .single();
    const viralIntel = (viralIntelRow?.value as any) || {};

    const topVideos = viralIntel?.competitor_analysis || viralIntel?.top_10_ranking_brasil || [];
    const worldVideos = viralIntel?.world_ranking || [];

    // Use Gemini Pro (multimodal) to analyze visual patterns from viral video data
    const analysisRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um DIRETOR DE ARTE VISUAL especializado em vídeos virais.

Sua função: analisar os padrões visuais dos vídeos que mais viralizam e criar um MANUAL VISUAL completo para replicar esses padrões.

ANALISE PROFUNDAMENTE:

1. **THUMBNAILS que CONVERTEM** (analisar títulos e formatos dos top vídeos):
   - Expressões faciais dominantes (surpresa, choque, empolgação)
   - Paleta de cores predominante (contraste alto, cores quentes vs frias)
   - Tipografia (tamanho, cor, posição do texto)
   - Composição (close-up rosto, split-screen, antes/depois)
   - Elementos gráficos (setas, círculos, emojis, bordas)

2. **PADRÕES DE VÍDEO que RETÊM**:
   - Primeiros 3 segundos: o que aparece visualmente
   - Cortes por minuto (ritmo de edição)
   - Uso de texto na tela (legendas, bullet points)
   - Transições visuais mais usadas
   - Iluminação e cenário

3. **AVATARES E APRESENTADORES**:
   - Tipo de apresentador que mais engaja (homem/mulher, idade, estilo)
   - Enquadramento (busto, meio corpo, corpo inteiro)
   - Gestos e movimentos que prendem atenção
   - Background/cenário mais eficaz
   - Vestimenta e estilo visual

4. **ELEMENTOS DE PRODUÇÃO**:
   - Qualidade de áudio esperada
   - Música de fundo (tipo, BPM)
   - Sound effects nos cortes
   - Legendas automáticas (estilo, cor, posição)

Retorne JSON:
{
  "thumbnail_patterns": {
    "face_expressions": ["lista"],
    "color_palettes": [{"name": "nome", "colors": ["#hex"], "usage": "quando usar"}],
    "text_styles": [{"size": "grande/médio", "color": "#hex", "position": "topo/centro", "effect": "sombra/contorno"}],
    "compositions": ["close-up com texto", "split-screen", etc],
    "elements": ["setas vermelhas", "círculos amarelos", etc]
  },
  "video_patterns": {
    "first_3_seconds": "descrição exata do que fazer",
    "cuts_per_minute": número,
    "text_on_screen": {"style": "...", "frequency": "..."},
    "transitions": ["lista das top 5"],
    "lighting": "descrição"
  },
  "avatar_specs": {
    "gender": "mais eficaz",
    "age_range": "faixa etária",
    "framing": "enquadramento",
    "gestures": ["lista de gestos"],
    "background": "tipo de cenário",
    "clothing": "estilo de roupa",
    "energy_level": "alto/médio",
    "eye_contact": true/false
  },
  "production_specs": {
    "audio_quality": "descrição",
    "background_music": {"genre": "...", "bpm": número},
    "sound_effects": ["lista"],
    "captions": {"style": "...", "color": "#hex", "position": "..."}
  },
  "realism_techniques": [
    "técnica 1 para máximo realismo",
    "técnica 2",
    "técnica 3"
  ],
  "lip_sync_guidelines": {
    "voice_tone": "tom ideal",
    "speaking_speed": "palavras por minuto",
    "emotion_mapping": {"empolgação": "quando usar", "seriedade": "quando usar"},
    "pause_patterns": "como usar pausas"
  },
  "innovation_ideas": [
    "algo que ninguém está fazendo ainda"
  ]
}`
          },
          {
            role: "user",
            content: `VÍDEOS VIRAIS DO BRASIL (top momentum):
${topVideos.slice(0, 10).map((v: any, i: number) => `${i+1}. "${v.video_title || v.top_video_title}" — ${v.total_views} views, momentum: ${v.momentum_score}, formato: ${v.content_format || 'N/A'}, por que viralizou: ${v.why_viral || 'N/A'}`).join("\n")}

VÍDEOS VIRAIS MUNDIAIS:
${worldVideos.slice(0, 10).map((v: any, i: number) => `${i+1}. "${v.video_title}" — ${v.total_views} views, país: ${v.country || 'N/A'}, momentum: ${v.momentum_score}`).join("\n")}

SNAPSHOTS RECENTES (crescimento):
${(topSnapshots || []).slice(0, 10).map((s: any) => `"${s.video_title}" — ${s.total_views} views, crescimento/h: ${s.views_growth_1h}, momentum: ${s.momentum_score}`).join("\n")}

PADRÕES ANTERIORES:
Hooks: ${(viralIntel?.viral_patterns?.top_title_hooks || []).slice(0, 5).join("; ")}
Hashtags: ${(viralIntel?.viral_patterns?.trending_hashtags || []).slice(0, 5).join(", ")}

Analise TODOS esses dados e gere o manual visual completo para máximo realismo e viralização.`
          }
        ],
      }),
    });

    if (!analysisRes.ok) {
      const errText = await analysisRes.text();
      throw new Error(`AI analysis failed: ${analysisRes.status} — ${errText}`);
    }

    const analysisData = await analysisRes.json();
    let raw = analysisData.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let visualGuide: any;
    try {
      visualGuide = JSON.parse(raw);
    } catch {
      visualGuide = { raw_analysis: raw };
    }

    // Save visual guide to settings
    await supabase.from("settings").upsert(
      { key: "viral_visual_guide", value: visualGuide },
      { onConflict: "key" }
    );

    await supabase.from("system_logs").insert({
      event_type: "analise_visual",
      message: `🎨 Análise visual de ${(topSnapshots?.length || 0) + topVideos.length + worldVideos.length} vídeos virais concluída — Manual visual atualizado`,
      level: "info",
      metadata: {
        videos_analyzed: (topSnapshots?.length || 0) + topVideos.length + worldVideos.length,
        has_thumbnail_patterns: !!visualGuide.thumbnail_patterns,
        has_avatar_specs: !!visualGuide.avatar_specs,
        has_lip_sync: !!visualGuide.lip_sync_guidelines,
      },
    });

    return new Response(JSON.stringify({ visual_guide: visualGuide }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-viral-visuals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
