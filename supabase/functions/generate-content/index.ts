import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, channel, content_type, instructions } = await req.json();

    if (!topic || !channel) {
      return new Response(JSON.stringify({ error: "Tema e canal são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const topicLabels: Record<string, string> = {
      ansiedade: "Ansiedade",
      relacionamentos: "Relacionamentos",
      trauma: "Trauma & PTSD",
      autoestima: "Autoestima",
      burnout: "Burnout",
      "inteligencia-emocional": "Inteligência Emocional",
    };

    const formatInstructions: Record<string, string> = {
      carrossel: "Crie um carrossel de 7 slides. Cada slide deve ter um título curto e um texto de 2-3 linhas. Formate como:\n\nSlide 1: [título]\n[texto]\n\nSlide 2: ...",
      reel: "Crie um roteiro para um Reel de 60 segundos com narração, incluindo gancho inicial, desenvolvimento e chamada para ação.",
      story: "Crie uma sequência de 5 stories com texto curto e impactante para cada um.",
      artigo: "Crie um artigo de blog com título, introdução, 3 seções com subtítulos, e conclusão.",
    };

    const tipo = content_type || "carrossel";
    const topicLabel = topicLabels[topic] || topic;

    const systemPrompt = `Você cria conteúdo psicoeducativo de alta qualidade para redes sociais. Suas publicações são baseadas em evidências científicas (cite estudos quando possível) e seguem boas práticas éticas.

Regras:
- NUNCA mencione qualquer título profissional ou formação
- Nunca faça diagnósticos
- Nunca prometa curas
- Use linguagem acolhedora e acessível
- Cite referências científicas quando possível
- Inclua chamada para ação no final
- O conteúdo deve ser informativo e psicoeducativo
- Sempre incentive a busca por um profissional qualificado`;

    const userPrompt = `Crie um conteúdo do tipo "${tipo}" para ${channel === "instagram" ? "Instagram" : "YouTube"} sobre o tema: ${topicLabel}.

${formatInstructions[tipo] || ""}

${instructions ? `Instruções adicionais: ${instructions}` : ""}`;

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
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("Erro ao gerar conteúdo com IA");
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices?.[0]?.message?.content || "";

    if (!generatedText) throw new Error("IA não retornou conteúdo");

    // Score based on content quality heuristics
    const hasReferences = /estud|pesquis|segundo|de acordo|referên/i.test(generatedText);
    const hasEthics = !/diagnóstic|cur[ae]|garanti/i.test(generatedText);
    const hasLength = generatedText.length > 200;
    const score = Math.min(100, 50 + (hasReferences ? 20 : 0) + (hasEthics ? 15 : 0) + (hasLength ? 15 : 0));

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const title = `${topicLabel} — ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} ${channel}`;

    const { data: content, error: dbError } = await supabase
      .from("contents")
      .insert({
        title,
        body: generatedText,
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

    // Log the generation
    await supabase.from("system_logs").insert({
      event_type: "geracao",
      message: `Conteúdo gerado: "${title}" — Score: ${score}`,
      level: "info",
      metadata: { content_id: content.id, topic, channel, score },
    });

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
