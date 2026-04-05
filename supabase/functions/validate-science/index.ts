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

    // Get the content
    const { data: content, error: fetchError } = await supabase
      .from("contents")
      .select("*")
      .eq("id", content_id)
      .single();

    if (fetchError || !content) throw new Error("Conteúdo não encontrado");

    // Validate with AI
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
            content: `Você é um revisor científico especializado em saúde mental. Analise o conteúdo abaixo e valide se:
1. As afirmações são baseadas em evidências científicas
2. As referências a estudos/autores são plausíveis e corretas
3. Os conceitos psicológicos estão sendo usados corretamente
4. Não há pseudociência ou informações enganosas

Retorne EXATAMENTE um JSON com:
- "valid": boolean (true se cientificamente válido)
- "score": number 0-100 (qualidade científica)
- "issues": string[] (problemas encontrados, vazio se nenhum)
- "references_found": string[] (referências identificadas no texto)
- "summary": string (resumo da validação)

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

    let validation: { valid: boolean; score: number; issues: string[]; references_found: string[]; summary: string };
    try {
      validation = JSON.parse(rawContent);
    } catch {
      validation = { valid: false, score: 0, issues: ["Erro ao parsear resposta da IA"], references_found: [], summary: "Falha na validação" };
    }

    // Update content with validation result
    const newScore = Math.round(((content.score ?? 0) + validation.score) / 2);
    await supabase
      .from("contents")
      .update({
        scientific_valid: validation.valid,
        score: newScore,
      })
      .eq("id", content_id);

    // Log
    await supabase.from("system_logs").insert({
      event_type: "validacao",
      message: `Validação científica: "${content.title}" — ${validation.valid ? "Aprovado" : "Reprovado"} (${validation.score}/100)`,
      level: validation.valid ? "info" : "warning",
      metadata: { content_id, validation },
    });

    return new Response(JSON.stringify({ validation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-science error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
