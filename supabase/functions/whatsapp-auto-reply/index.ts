import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sender_name, sender_phone, message_text, message_id, phone_number_id } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get last 30 messages for conversation context
    const { data: recentMessages } = await supabase
      .from("system_logs")
      .select("message, metadata, created_at")
      .eq("event_type", "whatsapp_message")
      .order("created_at", { ascending: false })
      .limit(30);

    const conversationContext = (recentMessages || [])
      .reverse()
      .map((m) => {
        const meta = m.metadata as any;
        const direction = meta?.direction === "outgoing" ? "Dani" : (meta?.sender_name || "Membro");
        return `${direction}: ${meta?.message_text || m.message}`;
      })
      .join("\n");

    // Get last reply timestamp to avoid spamming
    const { data: lastReply } = await supabase
      .from("system_logs")
      .select("created_at")
      .eq("event_type", "whatsapp_message")
      .eq("metadata->>direction", "outgoing")
      .order("created_at", { ascending: false })
      .limit(1);

    const lastReplyTime = lastReply?.[0]?.created_at;
    const minutesSinceLastReply = lastReplyTime
      ? (Date.now() - new Date(lastReplyTime).getTime()) / 60000
      : 999;

    // Step 1: AI decides if should respond
    const decisionPrompt = `Você é a Dani, uma criadora de conteúdo sobre saúde mental em um grupo de WhatsApp. Analise a conversa e a última mensagem para decidir se DEVE responder.

REGRAS CRÍTICAS:
1. PRIORIZE o silêncio. Deixe as pessoas conversarem entre si
2. SÓ responda se:
   - Alguém fez uma PERGUNTA DIRETA para você ("Dani", "@dani", "o que vc acha")
   - Alguém está em CRISE emocional clara (menções a se machucar, desespero real)
   - A conversa PAROU há muito tempo e precisa de um empurrão (só se faz >2h sem mensagem)
   - Uma informação ERRADA sobre psicologia/saúde mental está sendo compartilhada
3. NÃO responda se:
   - As pessoas estão conversando normalmente entre si
   - É apenas uma opinião ou desabafo (deixe o grupo acolher)
   - Já respondeu recentemente (últimos ${Math.round(minutesSinceLastReply)} min)
   - A mensagem é meme, sticker, áudio ou algo casual

CONTEXTO DA CONVERSA (últimas mensagens):
${conversationContext.slice(-2000)}

ÚLTIMA MENSAGEM:
${sender_name}: ${message_text}

Minutos desde última resposta da Dani: ${Math.round(minutesSinceLastReply)}

Responda EXATAMENTE com JSON:
{
  "should_reply": true/false,
  "reason": "motivo curto",
  "urgency": "low/medium/high"
}`;

    const decisionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: decisionPrompt }],
      }),
    });

    if (!decisionResp.ok) {
      if (decisionResp.status === 429) {
        return new Response(JSON.stringify({ decided: false, reason: "rate_limit" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI decision error: ${decisionResp.status}`);
    }

    const decisionData = await decisionResp.json();
    let rawDecision = decisionData.choices?.[0]?.message?.content || "{}";
    rawDecision = rawDecision.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let decision: any;
    try {
      decision = JSON.parse(rawDecision);
    } catch {
      decision = { should_reply: false, reason: "parse_error" };
    }

    console.log(`🤔 Decision for "${message_text.slice(0, 50)}": ${decision.should_reply ? "REPLY" : "SKIP"} — ${decision.reason}`);

    if (!decision.should_reply) {
      return new Response(JSON.stringify({ decided: false, reason: decision.reason }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Generate human-like response
    const replyPrompt = `Você é Dani, criadora de conteúdo sobre saúde mental, NO WHATSAPP. Responda essa mensagem do grupo.

PERSONALIDADE:
- Fala como gente REAL no WhatsApp: abreviações, sem pontuação perfeita, emojis naturais
- POUCAS PALAVRAS. Máximo 2-3 frases curtas. Às vezes só 1 frase
- Nunca parece IA. Nunca usa linguagem formal. Nunca faz listas
- Tom: amiga que entende, não especialista
- NUNCA diga "psicóloga", "terapeuta" ou use termos técnicos
- Use: "mn" (mano), "vdd" (verdade), "mt" (muito), "tb" (também), "ngm" (ninguém), "cmg" (comigo)
- Às vezes começa com "ai", "cara", "gente", "mds"
- Pode usar kkkk quando natural

EXEMPLOS DE RESPOSTAS BOAS:
- "ai cara isso é tão real 😔 passa msm"
- "siiim mn eu tb sinto isso direto"  
- "gente vcs sabiam que isso tem a ver com como a gnt aprendeu a lidar com frustração na infância? tipo mt louco"
- "vc tá bem? me manda msg se precisar conversar ❤️"

CONTEXTO:
${conversationContext.slice(-1500)}

RESPONDA A:
${sender_name}: ${message_text}

Urgência: ${decision.urgency}
Motivo: ${decision.reason}

Responda APENAS com a mensagem. Sem JSON, sem aspas, sem explicação.`;

    const replyResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: replyPrompt }],
      }),
    });

    if (!replyResp.ok) throw new Error(`AI reply error: ${replyResp.status}`);

    const replyData = await replyResp.json();
    const replyText = (replyData.choices?.[0]?.message?.content || "").trim();

    if (!replyText) {
      return new Response(JSON.stringify({ decided: true, sent: false, reason: "empty_reply" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`💬 Reply: "${replyText}"`);

    // Step 3: Send via WhatsApp Business API
    let sent = false;
    if (WHATSAPP_TOKEN && phone_number_id) {
      // Add human-like delay (1-4 seconds per word, min 3s, max 15s)
      const wordCount = replyText.split(" ").length;
      const typingDelay = Math.min(Math.max(wordCount * 1500, 3000), 15000);
      await new Promise((r) => setTimeout(r, typingDelay));

      try {
        const waResp = await fetch(
          `https://graph.facebook.com/v19.0/${phone_number_id}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WHATSAPP_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: sender_phone,
              type: "text",
              text: { body: replyText },
            }),
          }
        );

        if (waResp.ok) {
          sent = true;
          console.log("✅ Message sent via WhatsApp API");
        } else {
          const errText = await waResp.text();
          console.error("WhatsApp API error:", errText);
        }
      } catch (sendErr) {
        console.error("Send error:", sendErr);
      }
    } else {
      console.log("⚠️ WHATSAPP_ACCESS_TOKEN not set — reply generated but not sent");
    }

    // Log outgoing message
    await supabase.from("system_logs").insert({
      event_type: "whatsapp_message",
      message: `💬 Dani (auto): ${replyText}`,
      level: "info",
      metadata: {
        sender_name: "Dani (auto)",
        sender_phone: "self",
        message_text: replyText,
        message_id: `reply_${message_id}`,
        phone_number_id,
        direction: "outgoing",
        triggered_by: message_text.slice(0, 100),
        decision_reason: decision.reason,
        urgency: decision.urgency,
        sent,
      },
    });

    return new Response(
      JSON.stringify({ decided: true, sent, reply: replyText, reason: decision.reason }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("auto-reply error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
