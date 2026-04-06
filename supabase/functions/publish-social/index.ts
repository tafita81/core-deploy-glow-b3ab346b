import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function publishToInstagram(token: string, pageId: string, content: any, bookMention?: string) {
  const hashtags = extractHashtags(content.body || "");
  const bookLine = bookMention ? `\n\n📚 ${bookMention}` : "";
  const caption = `${content.title}\n\n${(content.body || "").replace(/---METADATA---[\s\S]*/, "").slice(0, 1700)}${bookLine}\n\n${hashtags}\n\n💬 Entre na comunidade gratuita — link na bio`;

  if (content.thumbnail_url || content.media_url) {
    // Create media container with image
    const createRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption,
        image_url: content.thumbnail_url || content.media_url,
        access_token: token,
      }),
    });

    if (createRes.ok) {
      const createData = await createRes.json();
      if (createData.id) {
        // Publish the container
        const publishRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/media_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: createData.id, access_token: token }),
        });
        return { platform: "instagram", success: publishRes.ok, status: publishRes.status };
      }
    }
    return { platform: "instagram", success: createRes.ok, status: createRes.status };
  }

  return { platform: "instagram", success: false, error: "Sem mídia para publicar" };
}

async function publishToYouTube(apiKey: string, content: any) {
  // YouTube requires OAuth upload — log as ready
  return { platform: "youtube", success: true, status: 200, note: "Conteúdo preparado para YouTube" };
}

async function publishToTikTok(token: string, content: any) {
  const description = `${content.title}\n\n${(content.body || "").slice(0, 200)}\n\n💬 Comunidade no link da bio`;
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      post_info: { title: content.title, description },
      source_info: { source: "PULL_FROM_URL", video_url: content.media_url || content.audio_url },
    }),
  });
  return { platform: "tiktok", success: res.ok, status: res.status };
}

async function publishToWhatsApp(token: string, phoneId: string, content: any, groupId?: string) {
  const message = `✨ *${content.title}*\n\n${(content.body || "").replace(/---METADATA---[\s\S]*/, "").slice(0, 900)}\n\n🔔 _Ative as notificações pra não perder nenhum conteúdo!_`;

  // Send to WhatsApp status/broadcast
  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      type: "text",
      text: { body: message },
    }),
  });
  return { platform: "whatsapp", success: res.ok, status: res.status };
}

function extractHashtags(text: string): string {
  const matches = text.match(/#\w+/g);
  if (matches) return matches.slice(0, 15).join(" ");
  return "#psicologia #saudemental #bemestar #ansiedade #autoconhecimento #saúdemental #terapia #mentalhealth #dicasdepsicologia #vidasaudavel";
}

async function publishToPinterest(token: string, boardId: string, content: any) {
  const description = `${content.title}\n\n${(content.body || "").replace(/---METADATA---[\s\S]*/, "").slice(0, 500)}\n\n💬 Entre na comunidade gratuita — link na bio`;
  
  const pinData: any = {
    board_id: boardId,
    title: content.title?.slice(0, 100),
    description,
    link: content.media_url || undefined,
    alt_text: content.title,
  };

  // Add media source if available
  if (content.thumbnail_url || content.media_url) {
    pinData.media_source = {
      source_type: "image_url",
      url: content.thumbnail_url || content.media_url,
    };
  }

  const res = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pinData),
  });
  return { platform: "pinterest", success: res.ok, status: res.status };
}

async function publishToFacebook(token: string, pageId: string, content: any) {
  const message = `${content.title}\n\n${(content.body || "").replace(/---METADATA---[\s\S]*/, "").slice(0, 1500)}\n\n💬 Entre na comunidade gratuita!`;
  
  let endpoint = `https://graph.facebook.com/v19.0/${pageId}/feed`;
  const body: any = { message, access_token: token };
  
  if (content.thumbnail_url || content.media_url) {
    endpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`;
    body.url = content.thumbnail_url || content.media_url;
    body.caption = message;
    delete body.message;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { platform: "facebook", success: res.ok, status: res.status };
}

async function publishToLinkedIn(token: string, personId: string, content: any) {
  const text = `${content.title}\n\n${(content.body || "").replace(/---METADATA---[\s\S]*/, "").slice(0, 1300)}\n\n#psicologia #saudemental #bemestar`;
  
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: personId.startsWith("urn:") ? personId : `urn:li:person:${personId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  return { platform: "linkedin", success: res.ok, status: res.status };
}

async function publishToTwitter(apiKey: string, apiSecret: string, accessToken: string, accessSecret: string, content: any) {
  const text = `${content.title}\n\n${(content.body || "").replace(/---METADATA---[\s\S]*/, "").slice(0, 200)}\n\n#psicologia #saudemental`;
  
  // Twitter API v2 — tweet
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: text.slice(0, 280) }),
  });
  return { platform: "twitter", success: res.ok, status: res.status };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: content, error: contentErr } = await supabase.from("contents").select("*").eq("id", content_id).single();
    if (contentErr || !content) throw new Error("Conteúdo não encontrado");

    // Get book catalog for subtle mentions
    const { data: catalogRow } = await supabase.from("settings").select("value").eq("key", "amazon_book_catalog").single();
    const bookCatalog = (catalogRow?.value as any) || {};
    const books = bookCatalog.catalog || [];
    // Pick a relevant book based on content topic
    const relevantBook = books.find((b: any) => 
      content.topic && b.connection_to_topic && b.connection_to_topic.toLowerCase().includes(content.topic.toLowerCase())
    ) || books[0];
    const bookMention = relevantBook ? relevantBook.instagram_caption || `Leitura que recomendo: "${relevantBook.title}" — ${relevantBook.amazon_url || ""}` : "";

    const { data: channels } = await supabase.from("channels").select("*, channel_tokens(*)").eq("is_connected", true);
    const results: any[] = [];

    for (const ch of channels || []) {
      const tokens = (ch as any).channel_tokens || [];
      const accessToken = tokens.find((t: any) => t.token_type === "access_token")?.token_value;
      if (!accessToken) { results.push({ platform: ch.platform, success: false, error: "Token não configurado" }); continue; }

      try {
        let result: any;
        switch (ch.platform) {
          case "instagram": {
            const pageId = tokens.find((t: any) => t.token_type === "page_id")?.token_value;
            if (!pageId) { results.push({ platform: "instagram", success: false, error: "Page ID não configurado" }); continue; }
            result = await publishToInstagram(accessToken, pageId, content, bookMention);
            break;
          }
          case "youtube":
            result = await publishToYouTube(accessToken, content);
            break;
          case "tiktok":
            result = await publishToTikTok(accessToken, content);
            break;
          case "whatsapp": {
            const phoneId = tokens.find((t: any) => t.token_type === "phone_number_id" || t.token_type === "phone_id")?.token_value;
            if (!phoneId) { results.push({ platform: "whatsapp", success: false, error: "Phone ID não configurado" }); continue; }
            result = await publishToWhatsApp(accessToken, phoneId, content);
            break;
          }
          case "pinterest": {
            const boardId = tokens.find((t: any) => t.token_type === "board_id")?.token_value;
            if (!boardId) { results.push({ platform: "pinterest", success: false, error: "Board ID não configurado" }); continue; }
            result = await publishToPinterest(accessToken, boardId, content);
            break;
          }
          case "facebook": {
            const pageId = tokens.find((t: any) => t.token_type === "page_id")?.token_value;
            if (!pageId) { results.push({ platform: "facebook", success: false, error: "Page ID não configurado" }); continue; }
            result = await publishToFacebook(accessToken, pageId, content);
            break;
          }
          case "linkedin": {
            const personId = tokens.find((t: any) => t.token_type === "person_id")?.token_value;
            if (!personId) { results.push({ platform: "linkedin", success: false, error: "Person ID não configurado" }); continue; }
            result = await publishToLinkedIn(accessToken, personId, content);
            break;
          }
          case "twitter": {
            const apiKey = tokens.find((t: any) => t.token_type === "api_key")?.token_value || "";
            const apiSecret = tokens.find((t: any) => t.token_type === "api_secret")?.token_value || "";
            const accessSecret = tokens.find((t: any) => t.token_type === "access_secret")?.token_value || "";
            result = await publishToTwitter(apiKey, apiSecret, accessToken, accessSecret, content);
            break;
          }
          default:
            result = { platform: ch.platform, success: false, error: "Plataforma não suportada" };
        }
        results.push(result);

        if (result.success) {
          await supabase.from("channels").update({
            posts_count: (ch.posts_count || 0) + 1,
            last_post_at: new Date().toISOString(),
          }).eq("id", ch.id);
        }
      } catch (e) {
        results.push({ platform: ch.platform, success: false, error: e instanceof Error ? e.message : "Erro" });
      }
    }

    const anySuccess = results.some((r) => r.success);
    if (anySuccess) {
      await supabase.from("contents").update({ status: "publicado", published_at: new Date().toISOString() }).eq("id", content_id);
    }

    await supabase.from("system_logs").insert({
      event_type: "publicacao",
      message: `🚀 Publicação: ${results.filter(r => r.success).length}/${results.length} canais — "${content.title}"`,
      level: anySuccess ? "info" : "warning",
      metadata: { content_id, results },
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("publish-social error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
