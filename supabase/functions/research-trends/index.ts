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

    // Use AI to research trending psychology topics
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
            content: `Você é um pesquisador de tendências em saúde mental e bem-estar para redes sociais brasileiras.
Analise o que está em alta e retorne EXATAMENTE um JSON array com 3 tópicos trending.
Cada item deve ter: "topic" (slug em português sem acento), "label" (nome legível), "reason" (por que está em alta), "suggested_type" (carrossel|reel|story|artigo), "suggested_channel" (instagram|youtube).
Retorne APENAS o JSON, sem markdown.`,
          },
          {
            role: "user",
            content: `Data atual: ${new Date().toISOString().slice(0, 10)}. Quais são os 3 temas de psicologia mais relevantes para postar hoje nas redes sociais brasileiras? Considere tendências reais como: ansiedade pós-pandemia, burnout no trabalho remoto, saúde mental de jovens, relacionamentos digitais, inteligência emocional, trauma geracional, autoestima na era das redes sociais, parentalidade consciente, etc.`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.choices?.[0]?.message?.content || "[]";
    
    // Clean markdown fences if present
    rawContent = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let topics: Array<{
      topic: string;
      label: string;
      reason: string;
      suggested_type: string;
      suggested_channel: string;
    }>;

    try {
      topics = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      topics = [];
    }

    // Log the research
    await supabase.from("system_logs").insert({
      event_type: "pesquisa",
      message: `Pesquisa de tendências: ${topics.length} tópicos identificados`,
      level: "info",
      metadata: { topics, date: new Date().toISOString().slice(0, 10) },
    });

    return new Response(JSON.stringify({ topics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("research-trends error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
