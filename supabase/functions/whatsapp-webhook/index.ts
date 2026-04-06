import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VERIFY_TOKEN = "dani_whatsapp_verify_2024";

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ===== GET: Webhook Verification (Meta sends this to verify) =====
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verified");
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // ===== POST: Incoming Messages =====
  if (req.method === "POST") {
    try {
      const body = await req.json();

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Extract messages from Meta webhook payload
      const entries = body?.entry || [];

      for (const entry of entries) {
        const changes = entry?.changes || [];

        for (const change of changes) {
          if (change.field !== "messages") continue;

          const value = change.value;
          const contacts = value?.contacts || [];
          const messages = value?.messages || [];
          const metadata = value?.metadata || {};

          for (const msg of messages) {
            // Skip non-text messages for now
            if (msg.type !== "text") continue;

            const senderPhone = msg.from;
            const senderName = contacts.find((c: any) => c.wa_id === senderPhone)?.profile?.name || "Desconhecido";
            const messageText = msg.text?.body || "";
            const messageId = msg.id;
            const timestamp = msg.timestamp;
            const phoneNumberId = metadata.phone_number_id;

            console.log(`📩 Message from ${senderName} (${senderPhone}): ${messageText.slice(0, 100)}`);

            // Store message in system_logs for context tracking
            await supabase.from("system_logs").insert({
              event_type: "whatsapp_message",
              message: `📩 ${senderName}: ${messageText.slice(0, 300)}`,
              level: "info",
              metadata: {
                sender_phone: senderPhone,
                sender_name: senderName,
                message_text: messageText,
                message_id: messageId,
                timestamp,
                phone_number_id: phoneNumberId,
                direction: "incoming",
              },
            });

            // Call auto-reply function to decide if response is needed
            try {
              const autoReplyResp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-auto-reply`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  sender_name: senderName,
                  sender_phone: senderPhone,
                  message_text: messageText,
                  message_id: messageId,
                  phone_number_id: phoneNumberId,
                }),
              });

              const replyData = await autoReplyResp.json();
              console.log("Auto-reply decision:", JSON.stringify(replyData));
            } catch (err) {
              console.error("Auto-reply error:", err);
            }
          }
        }
      }

      // Meta requires 200 response
      return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
    } catch (e) {
      console.error("Webhook error:", e);
      return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
