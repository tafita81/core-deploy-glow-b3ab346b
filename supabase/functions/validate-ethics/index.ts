import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content_id } = await req.json();
    if (!content_id) {
      return new Response(JSON.stringify({ error: "content_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: content, error: fetchError } = await supabase
      .from("contents")
      .select("*")
      .eq("id", content_id)
      .single();

    if (fetchError || !content) throw new Error("Conteúdo não encontrado");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em ética de conteúdo sobre saúde mental. Analise o conteúdo verificando:

1. NÃO faz diagnósticos ou sugere diagnósticos
2. NÃO promete curas ou resultados garantidos
3. NÃO usa linguagem sensacionalista sobre transtornos mentais
4. NÃO desrespeita o sigilo profissional
5. NÃO faz prescrição de medicamentos ou tratamentos específicos
6. NÃO usa termos estigmatizantes ("louco", "doente mental", etc.)
7. NÃO menciona qualquer título profissional ou formação acadêmica
8. Incentiva busca por ajuda profissional quando apropriado
9. Respeita a autonomia do indivíduo

Retorne EXATAMENTE um JSON com:
- "valid": boolean (true se eticamente aprovado)
- "issues": string[] (violações éticas encontradas)
- "warnings": string[] (pontos de atenção, não necessariamente violações)
- "summary": string (resumo da análise ética)

Retorne APENAS o JSON, sem markdown.`,
          },
          {
            role: "user",
            content: `Título: ${content.title}\n\nConteúdo:\n${content.body}`,
          },
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

    let validation: { valid: boolean; issues: string[]; warnings: string[]; summary: string };
    try {
      validation = JSON.parse(rawContent);
    } catch {
      validation = { valid: false, issues: ["Erro ao parsear resposta"], warnings: [], summary: "Falha na validação" };
    }

    // Update content
    await supabase
      .from("contents")
      .update({ ethics_valid: validation.valid })
      .eq("id", content_id);

    // Log
    await supabase.from("system_logs").insert({
      event_type: "validacao",
      message: `Validação ética: "${content.title}" — ${validation.valid ? "Aprovado" : "Reprovado"}`,
      level: validation.valid ? "info" : "warning",
      metadata: { content_id, validation },
    });

    return new Response(JSON.stringify({ validation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-ethics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
