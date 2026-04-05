import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { source_content_id, group_type, content_type } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get source content if provided (from social media posts)
    let sourceContent = null;
    if (source_content_id) {
      const { data } = await supabase.from("contents").select("*").eq("id", source_content_id).single();
      sourceContent = data;
    }

    // Get viral intelligence
    const { data: viralSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "viral_intelligence")
      .single();
    const viralIntel = (viralSetting?.value as any) || {};
    const momentumAnalysis = viralIntel.momentum_analysis || {};

    // Get existing groups
    const { data: groups } = await supabase.from("whatsapp_groups").select("*").eq("is_active", true);

    const tipo = content_type || "conversa";
    const targetGroup = group_type || "geral";

    const systemPrompt = `Você é especialista em gestão de comunidades WhatsApp para criadores de conteúdo de psicologia/saúde mental no Brasil.

CONTEXTO: Daniela Coelho é ESTUDANTE de psicologia (formatura 2027). Ela constrói uma comunidade engajada AGORA para que em 2027, quando se formar, os membros se tornem clientes de consultas online.

ESTRATÉGIA DE FUNIL (2024-2027):
1. REDES SOCIAIS → Conteúdo viral atrai seguidores
2. SEGUIDORES → CTA leva para comunidade WhatsApp gratuita
3. COMUNIDADE → Conteúdo exclusivo + interação cria VÍNCULO
4. VÍNCULO → Membros se tornam "pré-clientes" leais
5. FORMATURA 2027 → Lista de espera para consultas online → MONETIZAÇÃO

TIPOS DE CONTEÚDO WhatsApp:
- "conversa": Mensagem que gera discussão no grupo (pergunta aberta, reflexão, "o que vocês acham?")
- "enquete": Enquete interativa (2-4 opções) sobre temas de psicologia
- "desafio": Desafio semanal (ex: "7 dias sem reclamar", "diário de gratidão")
- "exclusivo": Conteúdo mais aprofundado que NÃO foi publicado nas redes (valor exclusivo)
- "dica_rapida": Dica prática de 2-3 linhas para aplicar no dia a dia
- "bastidores": Compartilha rotina de estudos, vida de estudante de psicologia
- "recomendacao": Indica livros, filmes, podcasts sobre o tema do momento

REGRAS:
- Linguagem INFORMAL e acolhedora (como amiga próxima)
- Use emojis moderadamente
- NUNCA use termos profissionais que impliquem que é formada
- Sempre gere INTERAÇÃO (perguntas, "me conta nos comentários")
- Referencie conteúdo das redes sociais para manter o loop
- Inclua "compartilha com alguém que precisa" quando relevante

${momentumAnalysis.fastest_growing_topic ? `TEMA EM ALTA AGORA: ${momentumAnalysis.fastest_growing_topic}` : ""}
${(momentumAnalysis.emerging_trends || []).length > 0 ? `TENDÊNCIAS EMERGENTES: ${JSON.stringify(momentumAnalysis.emerging_trends)}` : ""}

TIPO DE GRUPO: ${targetGroup}
- "geral": Grupo principal, conteúdo variado
- "ansiedade": Grupo focado em ansiedade e autocuidado
- "relacionamentos": Grupo focado em relacionamentos e apego
- "autoconhecimento": Grupo focado em desenvolvimento pessoal
- "estudantes": Grupo para outros estudantes de psicologia

Retorne EXATAMENTE este JSON:
{
  "title": "título curto do conteúdo",
  "body": "mensagem completa formatada para WhatsApp (com emojis, quebras de linha)",
  "engagement_hook": "pergunta/ação que gera resposta dos membros",
  "best_time": "melhor horário para enviar (ex: 20:00)",
  "follow_up": "mensagem de follow-up para enviar 2h depois",
  "cross_promote": "como mencionar este conteúdo nas redes sociais para trazer mais membros"
}

Retorne APENAS o JSON.`;

    const userPrompt = source_content_id && sourceContent
      ? `Crie conteúdo "${tipo}" para o grupo "${targetGroup}" baseado neste post que foi publicado nas redes sociais:

TÍTULO: ${sourceContent.title}
CONTEÚDO: ${(sourceContent.body || "").slice(0, 500)}

Adapte para WhatsApp: mais profundo, mais pessoal, como se estivesse conversando com amigos próximos. Adicione insights EXCLUSIVOS que não estavam no post.`
      : `Crie conteúdo "${tipo}" para o grupo "${targetGroup}".
${momentumAnalysis.fastest_growing_topic ? `Tema em alta: ${momentumAnalysis.fastest_growing_topic}` : "Use um tema relevante de psicologia/saúde mental para o momento atual."}
Data: ${new Date().toISOString().slice(0, 10)}. Dia da semana: ${["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][new Date().getDay()]}.`;

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
        return new Response(JSON.stringify({ error: "Rate limit" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.choices?.[0]?.message?.content || "{}";
    rawContent = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = { title: "Conteúdo WhatsApp", body: rawContent, engagement_hook: "", best_time: "20:00" };
    }

    // Find target group
    const targetGroupRecord = groups?.find((g) => g.group_type === targetGroup) || groups?.[0];

    const { data: whatsappContent, error } = await supabase
      .from("whatsapp_content")
      .insert({
        group_id: targetGroupRecord?.id || null,
        content_type: tipo,
        title: parsed.title || "Conteúdo WhatsApp",
        body: JSON.stringify({
          message: parsed.body,
          engagement_hook: parsed.engagement_hook,
          follow_up: parsed.follow_up,
          cross_promote: parsed.cross_promote,
          best_time: parsed.best_time,
        }),
        status: "rascunho",
        source_content_id: source_content_id || null,
        engagement_score: 0,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase.from("system_logs").insert({
      event_type: "whatsapp",
      message: `📱 Conteúdo WhatsApp gerado: "${parsed.title}" — Tipo: ${tipo} — Grupo: ${targetGroup}`,
      level: "info",
      metadata: { content_id: whatsappContent.id, type: tipo, group: targetGroup, source: source_content_id },
    });

    return new Response(JSON.stringify({ content: whatsappContent, parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-whatsapp-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
