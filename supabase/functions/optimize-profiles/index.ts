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

    // Get current channel profiles from last monitoring
    const { data: channels } = await supabase
      .from("channels")
      .select("*")
      .eq("is_connected", true);

    if (!channels || channels.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum canal conectado", optimizations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get viral intelligence for context
    const { data: viralIntelRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "viral_intelligence")
      .single();
    const viralIntel = (viralIntelRow?.value as any) || {};

    // Get visual guide
    const { data: visualGuideRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "viral_visual_guide")
      .single();
    const visualGuide = (visualGuideRow?.value as any) || {};

    // Get channel tokens to know which platforms we can edit
    const { data: allTokens } = await supabase.from("channel_tokens").select("*");
    const tokensByChannel: Record<string, Record<string, string>> = {};
    allTokens?.forEach((t) => {
      if (!tokensByChannel[t.channel_id]) tokensByChannel[t.channel_id] = {};
      tokensByChannel[t.channel_id][t.token_type] = t.token_value;
    });

    // Use AI to analyze current profiles and generate optimal updates
    const channelInfos = channels.map((ch) => ({
      platform: ch.platform,
      name: ch.name,
      followers: ch.followers,
      engagement_rate: ch.engagement_rate,
      posts_count: ch.posts_count,
    }));

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um ESPECIALISTA MUNDIAL em otimização de perfis de redes sociais para MÁXIMO crescimento, engajamento e monetização.

CONTEXTO CRÍTICO — TRANSIÇÃO 2027:
- Daniela Coelho é ESTUDANTE de psicologia (formatura prevista 2027)
- AGORA (2024-2027): NUNCA mencionar "psicóloga", "consultório", "atendimento clínico". Ela é ESTUDANTE e CRIADORA DE CONTEÚDO
- Os canais devem ser construídos com NOME/MARCA que funcione ANTES e DEPOIS da formatura
- NUNCA usar foto pessoal dela nos perfis AGORA — usar identidade visual/logo/marca
- Em 2027 (pós-CRP): transição suave para incluir foto profissional + credenciais
- O nome dos canais deve ser uma MARCA (ex: "Mente em Foco", "Psico Diário") que depois pode adicionar "por Dra. Daniela" sem perder identidade
- TODA bio deve dizer "estudante de psicologia" ou "futura psicóloga" — NUNCA "psicóloga"
- Construir autoridade COMO ESTUDANTE que estuda e compartilha aprendizados

ESTRATÉGIA DE TRANSIÇÃO SEM PERDER SEGUIDORES:
1. FASE ATUAL (2024-2027): Marca forte + "estudante de psicologia que compartilha o que aprende"
2. FASE TRANSIÇÃO (2027): Adicionar credenciais gradualmente — "agora oficialmente psicóloga 🎓"
3. FASE PÓS-CRP: Nome completo + CRP + foto profissional + manter a comunidade construída
4. O nome do canal NUNCA deve ser "Psicóloga X" agora — deve ser uma marca neutra que EVOLUI

FOCO:
1. BIO/DESCRIÇÃO: texto exato otimizado (emojis, CTA, keywords SEO) — SEMPRE como estudante
2. NOME DE EXIBIÇÃO: MARCA memorável que funcione pré e pós formatura
3. CATEGORIAS/TAGS: as melhores para o nicho
4. LINKS: estratégia de link na bio (Linktree/direto)
5. PALAVRAS-CHAVE: SEO para cada plataforma
6. HORÁRIOS: melhores horários de postagem por plataforma
7. FREQUÊNCIA: quantidade ideal de posts por dia/semana
8. HASHTAGS FIXAS: hashtags que devem estar em todo post
9. ESTILO VISUAL: paleta de cores, filtros, estilo de thumbnail (SEM foto pessoal até 2027)

Retorne JSON:
{
  "optimizations": [
    {
      "platform": "instagram",
      "profile_updates": {
        "bio": "texto exato da bio otimizada (SEMPRE como estudante)",
        "display_name": "nome-marca que funciona pré e pós 2027",
        "website_url": "sugestão de link",
        "category": "categoria ideal"
      },
      "content_strategy": {
        "best_posting_times": ["horário1", "horário2"],
        "posts_per_week": número,
        "ideal_hashtags": ["#tag1", "#tag2"],
        "content_mix": {"reels": "60%", "stories": "30%", "posts": "10%"},
        "visual_style": "descrição do estilo visual (sem foto pessoal)"
      },
      "transition_2027": {
        "current_identity": "como se apresentar agora",
        "transition_plan": "como mudar suavemente em 2027",
        "post_graduation_identity": "como ficará após CRP",
        "risk_mitigation": "como não perder seguidores na transição"
      },
      "growth_tactics": ["tática 1", "tática 2"],
      "monetization_tips": ["dica 1", "dica 2"],
      "priority": "alta/média/baixa",
      "expected_impact": "descrição do impacto esperado"
    }
  ],
  "cross_platform_strategy": {
    "content_repurposing": "como reaproveitar conteúdo entre plataformas",
    "funnel_strategy": "como cada plataforma alimenta as outras",
    "audience_overlap": "como maximizar alcance cruzado"
  },
  "brand_transition_plan": {
    "current_brand": "identidade visual atual (sem foto)",
    "2027_transition": "plano detalhado de transição",
    "naming_strategy": "como o nome evolui sem perder reconhecimento"
  }
}`
          },
          {
            role: "user",
            content: `PERFIS ATUAIS:
${channelInfos.map((c) => `- ${c.platform}: "${c.name}" — ${c.followers || 0} seguidores, engagement: ${c.engagement_rate || 0}%, ${c.posts_count || 0} posts`).join("\n")}

TENDÊNCIAS VIRAIS ATUAIS:
- Hooks populares: ${(viralIntel?.viral_patterns?.top_title_hooks || []).slice(0, 5).join("; ")}
- Hashtags trending: ${(viralIntel?.viral_patterns?.trending_hashtags || []).slice(0, 10).join(", ")}
- Formatos que mais viralizam: ${(viralIntel?.viral_patterns?.top_content_formats || []).slice(0, 5).join(", ")}

PADRÕES VISUAIS DOS VIRAIS:
- Thumbnails: ${JSON.stringify(visualGuide?.thumbnail_patterns?.compositions || []).slice(0, 200)}
- Avatar specs: ${JSON.stringify(visualGuide?.avatar_specs || {}).slice(0, 200)}

REGRA ABSOLUTA: Daniela é ESTUDANTE de psicologia (2027). NUNCA "psicóloga". NUNCA foto pessoal nos perfis agora. Construir MARCA que evolui. Gere otimizações com plano de transição 2027 incluído.`
          }
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI analysis failed: ${aiRes.status} — ${errText}`);
    }

    const aiData = await aiRes.json();
    let raw = aiData.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let optimizations: any;
    try {
      optimizations = JSON.parse(raw);
    } catch {
      optimizations = { raw_analysis: raw };
    }

    // Save optimization plan to settings
    await supabase.from("settings").upsert(
      { key: "profile_optimizations", value: optimizations },
      { onConflict: "key" }
    );

    // Apply profile updates where possible (platforms with write access)
    const applied: string[] = [];

    for (const opt of optimizations.optimizations || []) {
      const channel = channels.find((c) => c.platform === opt.platform);
      if (!channel) continue;
      const tokens = tokensByChannel[channel.id] || {};

      try {
        switch (opt.platform) {
          case "instagram": {
            // Instagram Graph API: update bio
            if (tokens.access_token && tokens.page_id && opt.profile_updates?.bio) {
              const updateRes = await fetch(
                `https://graph.facebook.com/v19.0/${tokens.page_id}?biography=${encodeURIComponent(opt.profile_updates.bio)}&access_token=${tokens.access_token}`,
                { method: "POST" }
              );
              if (updateRes.ok) applied.push("instagram:bio");
            }
            break;
          }

          case "youtube": {
            // YouTube: update channel description/keywords via API
            if (tokens.access_token && opt.profile_updates) {
              const updateBody = {
                id: tokens.channel_id,
                brandingSettings: {
                  channel: {
                    description: opt.profile_updates.bio,
                    keywords: (opt.content_strategy?.ideal_hashtags || []).join(", "),
                  },
                },
              };
              const ytRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=brandingSettings", {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${tokens.access_token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(updateBody),
              });
              if (ytRes.ok) applied.push("youtube:description,keywords");
            }
            break;
          }

          case "facebook": {
            if (tokens.access_token && tokens.page_id && opt.profile_updates?.bio) {
              const fbRes = await fetch(
                `https://graph.facebook.com/v19.0/${tokens.page_id}?about=${encodeURIComponent(opt.profile_updates.bio)}&access_token=${tokens.access_token}`,
                { method: "POST" }
              );
              if (fbRes.ok) applied.push("facebook:about");
            }
            break;
          }

          case "twitter": {
            if (tokens.access_token && opt.profile_updates?.bio) {
              const twRes = await fetch("https://api.twitter.com/2/users/me", {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${tokens.access_token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ description: opt.profile_updates.bio }),
              });
              if (twRes.ok) applied.push("twitter:bio");
            }
            break;
          }
        }
      } catch (e) {
        // Log but don't fail — some platforms may not support all operations
        console.error(`Error updating ${opt.platform}:`, e);
      }
    }

    // Save content strategy to settings for the brain to use
    const contentStrategy = (optimizations.optimizations || []).reduce((acc: any, opt: any) => {
      acc[opt.platform] = {
        best_posting_times: opt.content_strategy?.best_posting_times || [],
        posts_per_week: opt.content_strategy?.posts_per_week || 7,
        ideal_hashtags: opt.content_strategy?.ideal_hashtags || [],
        content_mix: opt.content_strategy?.content_mix || {},
      };
      return acc;
    }, {});

    await supabase.from("settings").upsert(
      { key: "content_strategy_per_platform", value: contentStrategy },
      { onConflict: "key" }
    );

    await supabase.from("system_logs").insert({
      event_type: "otimizacao_perfil",
      message: `🎯 Perfis otimizados: ${(optimizations.optimizations || []).length} plataformas analisadas — ${applied.length} atualizações aplicadas automaticamente (${applied.join(", ") || "nenhuma — tokens de edição pendentes"})`,
      level: "info",
      metadata: {
        platforms_analyzed: (optimizations.optimizations || []).length,
        auto_applied: applied,
        has_cross_platform: !!optimizations.cross_platform_strategy,
      },
    });

    return new Response(JSON.stringify({ optimizations, applied }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("optimize-profiles error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
