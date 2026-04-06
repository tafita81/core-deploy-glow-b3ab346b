import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, channel, content_type, instructions, viral_title, hook, hashtags, whatsapp_cta, monetization_angle } = await req.json();

    // REGRA ABSOLUTA: NUNCA mencionar formação, título ou status acadêmico
    const IDENTITY_GUARD = `
REGRA INVIOLÁVEL DE IDENTIDADE:
- NUNCA diga "psicóloga", "dra.", "consultório", "atendimento clínico"
- NUNCA diga "estudante de psicologia", "futura psicóloga", "graduanda", "formanda"
- NUNCA mencione faculdade, universidade, curso ou qualquer referência acadêmica
- A marca é uma CRIADORA DE CONTEÚDO sobre saúde mental e autoconhecimento — sem credenciais
- NUNCA inclua foto pessoal em thumbnails/posts — use identidade visual da marca
- Fale como alguém que estuda e se interessa pelo tema: "pesquisando sobre isso, descobri...", "li um estudo que mostrou..."
- A autoridade vem do CONTEÚDO, não de títulos
`;

    if (!topic || !channel) {
      return new Response(JSON.stringify({ error: "Tema e canal são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch viral intelligence from research
    const { data: viralSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "viral_intelligence")
      .single();

    const viralIntel = viralSetting?.value as any || {};
    const patterns = viralIntel.viral_patterns || {};

    const tipo = content_type || "reel";

    const formatInstructions: Record<string, string> = {
      carrossel: `Crie um carrossel de 7-10 slides VIRAL.
Slide 1: CAPA com título bombástico que gere curiosidade extrema
Slide 2-8: Conteúdo com revelações progressivas (cada slide deve fazer a pessoa querer ver o próximo)
Slide 9: Resumo impactante
Slide 10: CTA poderoso para seguir + entrar na comunidade WhatsApp

Formate como:
Slide 1: [título]
[texto impactante]`,
      reel: `Crie um roteiro para Reel/TikTok de 30-60 segundos VIRAL.

ESTRUTURA OBRIGATÓRIA:
🎬 GANCHO (0-3s): Frase que PARA o scroll imediatamente. Use padrão: pergunta chocante, dado surpreendente, ou "Você sabia que..."
📖 DESENVOLVIMENTO (3-45s): Revelações progressivas que mantém tensão
💥 CLÍMAX (45-55s): A grande revelação ou insight
📱 CTA (55-60s): "Segue pra mais" + "Link na bio pra comunidade"

O gancho deve ser: ${hook || "uma pergunta que cause curiosidade extrema"}`,
      story: `Crie sequência de 5-7 stories VIRAIS.
Story 1: Enquete ou pergunta polêmica que gere engajamento
Story 2-5: Revelações progressivas com "arrasta pra cima" implícito
Story 6: Conclusão surpreendente
Story 7: CTA para comunidade WhatsApp + "manda pra alguém que precisa ver isso"`,
      artigo: `Crie um artigo SEO-otimizado para blog/YouTube com:
- Título H1 com palavra-chave + gatilho emocional
- Introdução com gancho nos primeiros 2 parágrafos
- 5 seções com subtítulos H2 (cada um com palavra-chave)
- Dados científicos e estatísticas
- Conclusão com CTA para comunidade
- Meta description de 160 caracteres`,
    };

    const systemPrompt = `Você é um MESTRE em viralização de conteúdo psicoeducativo no Brasil. Seu conteúdo DEVE viralizar.

${IDENTITY_GUARD}

PROTEÇÃO ANTI-PLÁGIO E SEGURANÇA DO CANAL (REGRAS ABSOLUTAS):
- NUNCA copie roteiros, textos, scripts ou estruturas de outros criadores — use vídeos virais APENAS como INSPIRAÇÃO de formato e tema
- Todo conteúdo deve ser 100% ORIGINAL — reescrito do zero com voz, exemplos e ângulo únicos
- NUNCA use trechos de áudio, imagens ou vídeos de terceiros sem licença
- Para cada conteúdo, aplique no mínimo 5 TRANSFORMAÇÕES de originalidade:
  1. ÂNGULO DIFERENTE: mesmo tema, perspectiva completamente nova
  2. EXEMPLOS PRÓPRIOS: invente cenários, metáforas e analogias originais
  3. ESTRUTURA ALTERADA: mude a ordem, formato e ritmo do conteúdo
  4. VOZ ÚNICA: tom, vocabulário e estilo de comunicação distintos
  5. DADOS DIFERENTES: use outras pesquisas, estatísticas e referências científicas
- PRIORIZE vídeos virais INTERNACIONAIS (inglês, espanhol, etc.) como inspiração — conteúdo traduzido e adaptado tem MUITO menor risco de detecção e maior novidade para o público BR
- NUNCA replique títulos — crie títulos 100% originais inspirados no PADRÃO (não no texto)
- Inclua SEMPRE referências científicas reais (estudos, universidades, pesquisadores) para dar autoridade e originalidade
- O conteúdo deve passar por QUALQUER detector de plágio (Copyscape, Turnitin, Content at Scale)
- NUNCA use música, efeitos sonoros ou elementos visuais protegidos por copyright
- Use apenas músicas royalty-free ou de biblioteca livre
- VARIE o formato entre execuções — nunca faça 2 vídeos seguidos com a mesma estrutura

PROTEÇÃO DE MONETIZAÇÃO E CANAL:
- Conteúdo deve seguir 100% as diretrizes de TODAS as plataformas (YouTube, Instagram, TikTok, Pinterest)
- NUNCA inclua conteúdo que possa gerar strike, demonetização ou restrição
- EVITE: desinformação, claims médicos sem base, conteúdo sensível sem aviso, linguagem ofensiva
- SEMPRE inclua disclaimer sutil: "procure um profissional" quando falar de saúde mental
- NUNCA faça face swap, deepfake ou use imagem de pessoas reais sem autorização

O objetivo é construir comunidade de forma segura e sustentável.

REGRAS DE VIRALIZAÇÃO:
1. TÍTULO: Use gatilhos mentais (curiosidade, urgência, medo de perder, polêmica controlada)
   - Exemplos de padrões que funcionam: "O que ninguém te conta sobre...", "3 sinais de que você...", "Pare de fazer isso se você..."
   ${patterns.top_title_hooks ? `- Títulos virais do momento: ${JSON.stringify(patterns.top_title_hooks)}` : ""}
2. GANCHO: Os primeiros 3 segundos decidem tudo. Comece com impacto máximo
   ${patterns.hook_first_3_seconds ? `- Ganchos que estão funcionando: ${JSON.stringify(patterns.hook_first_3_seconds)}` : ""}
3. HASHTAGS: Use as que estão trending AGORA
   ${patterns.trending_hashtags ? `- Hashtags trending: ${JSON.stringify(patterns.trending_hashtags)}` : ""}
4. CTA TRIPLO conforme plataforma:
   ${channel === "instagram" ? `- INSTAGRAM: "Segue @daniela pra mais conteúdo 💜" + "Link na bio pra comunidade exclusiva no WhatsApp 📱" + "Salva esse post e manda pra alguém"` : ""}
   ${channel === "tiktok" ? `- TIKTOK: "Segue pra parte 2 🔥" + "Comunidade gratuita no link da bio 📱" + "Dueta com sua opinião"` : ""}
   ${channel === "youtube" ? `- YOUTUBE: "Se inscreve e ativa o sininho 🔔" + "Entre na comunidade WhatsApp — link na descrição" + "Comenta sua experiência"` : ""}
5. COMPARTILHAMENTO: Inclua frase "Manda pra alguém que precisa ver isso"
6. EMOÇÃO: Cada conteúdo deve provocar pelo menos 1 emoção forte (identificação, surpresa, alívio)

FUNIL SOCIAL → WHATSAPP:
- Todo conteúdo DEVE ter CTA para a comunidade WhatsApp
- Mencione que lá tem "conteúdo exclusivo que não publico aqui"
- Use: "Tem muito mais no nosso grupo gratuito — link na bio 💬"

REGRAS ÉTICAS (INVIOLÁVEIS):
- NUNCA mencione "psicóloga", "dra.", "consultório", "atendimento", "estudante de psicologia", "futura psicóloga"
- NUNCA mencione formação acadêmica, faculdade ou universidade
- Nunca prometa curas
- Use linguagem acolhedora e acessível
- Cite referências científicas quando possível
- Sempre incentive a busca por um profissional qualificado
- SEM foto pessoal em thumbnails — use identidade visual da marca

MONETIZAÇÃO:
${monetization_angle ? `- Ângulo de monetização: ${monetization_angle}` : "- Mencione sutilmente que há conteúdo exclusivo na comunidade WhatsApp"}
- Inclua CTA para comunidade no final
${whatsapp_cta ? `- CTA WhatsApp: ${whatsapp_cta}` : "- Use: 'Entre na comunidade gratuita no link da bio 💬'"}

FORMATO DE SAÍDA:
Retorne o conteúdo em formato pronto para publicação.
No final, adicione uma seção separada:
---METADATA---
TITULO_VIRAL: [o título mais clicável possível]
HASHTAGS: [hashtags separadas por espaço]
HOOK: [gancho dos primeiros 3 segundos]
CTA: [chamada para ação principal]
THUMBNAIL_DESC: [descrição da thumbnail ideal em inglês para geração de imagem]`;

    const userPrompt = `Crie conteúdo VIRAL do tipo "${tipo}" para ${channel === "instagram" ? "Instagram" : channel === "tiktok" ? "TikTok" : channel === "youtube" ? "YouTube" : channel} sobre: ${topic}

${viral_title ? `Título sugerido pela pesquisa viral: "${viral_title}"` : ""}
${hook ? `Gancho sugerido: "${hook}"` : ""}

${formatInstructions[tipo] || formatInstructions.reel}

${instructions ? `Instruções adicionais: ${instructions}` : ""}

LEMBRE: Este conteúdo precisa ser O MAIS CLICADO e O MAIS COMPARTILHADO do dia.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro ao gerar conteúdo com IA");
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices?.[0]?.message?.content || "";
    if (!generatedText) throw new Error("IA não retornou conteúdo");

    // Extract metadata section
    const metadataSplit = generatedText.split("---METADATA---");
    const bodyText = metadataSplit[0].trim();
    const metadataText = metadataSplit[1] || "";

    let viralTitle = viral_title || topic;
    let extractedHashtags = hashtags || [];
    let extractedHook = hook || "";
    let thumbnailDesc = "";

    if (metadataText) {
      const titleMatch = metadataText.match(/TITULO_VIRAL:\s*(.+)/);
      if (titleMatch) viralTitle = titleMatch[1].trim();

      const hashtagMatch = metadataText.match(/HASHTAGS:\s*(.+)/);
      if (hashtagMatch) extractedHashtags = hashtagMatch[1].trim().split(/\s+/);

      const hookMatch = metadataText.match(/HOOK:\s*(.+)/);
      if (hookMatch) extractedHook = hookMatch[1].trim();

      const thumbMatch = metadataText.match(/THUMBNAIL_DESC:\s*(.+)/);
      if (thumbMatch) thumbnailDesc = thumbMatch[1].trim();
    }

    // Enhanced scoring
    const hasReferences = /estud|pesquis|segundo|de acordo|referên|universidade|harvard|dados/i.test(generatedText);
    const hasEthics = !/diagnóstic|cur[ae]|garanti|psicólog[ao]/i.test(generatedText);
    const hasLength = generatedText.length > 300;
    const hasHook = /\?|você sabia|pare de|nunca|segredo|ninguém|chocante|surpreendente/i.test(generatedText.slice(0, 200));
    const hasCTA = /segue|siga|comunidade|whatsapp|link|bio|manda pra/i.test(generatedText);
    const hasHashtags = extractedHashtags.length >= 5;
    const hasEmotionalTrigger = /medo|ansiedade|sozinho|ninguém|todo mundo|você não|descobri|revelação/i.test(generatedText);

    const score = Math.min(100,
      40 +
      (hasReferences ? 15 : 0) +
      (hasEthics ? 10 : 0) +
      (hasLength ? 5 : 0) +
      (hasHook ? 10 : 0) +
      (hasCTA ? 8 : 0) +
      (hasHashtags ? 5 : 0) +
      (hasEmotionalTrigger ? 7 : 0)
    );

    const title = viralTitle || `${topic} — ${tipo} ${channel}`;

    const { data: content, error: dbError } = await supabase
      .from("contents")
      .insert({
        title,
        body: bodyText + (extractedHashtags.length ? `\n\n${extractedHashtags.join(" ")}` : ""),
        content_type: tipo,
        status: score >= 75 ? "aprovado" : "revisao",
        score,
        channel,
        topic,
        scientific_valid: hasReferences,
        ethics_valid: hasEthics,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // Save viral metadata for media generation
    await supabase.from("settings").upsert({
      key: `content_viral_meta_${content.id}`,
      value: {
        viral_title: viralTitle,
        hook: extractedHook,
        hashtags: extractedHashtags,
        thumbnail_desc: thumbnailDesc,
        monetization_angle: monetization_angle || "",
        whatsapp_cta: whatsapp_cta || "Entre na comunidade gratuita no link da bio 💬",
      },
    }, { onConflict: "key" });

    await supabase.from("system_logs").insert({
      event_type: "geracao",
      message: `Conteúdo VIRAL gerado: "${title}" — Score: ${score} — Hook: ${extractedHook.slice(0, 50)}`,
      level: "info",
      metadata: { content_id: content.id, topic, channel, score, hashtags: extractedHashtags.length, has_hook: hasHook, has_cta: hasCTA },
    });

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
