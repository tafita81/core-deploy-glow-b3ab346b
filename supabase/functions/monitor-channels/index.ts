import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all connected channels with their tokens
    const { data: channels } = await supabase
      .from("channels")
      .select("*")
      .eq("is_connected", true);

    if (!channels || channels.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum canal conectado para monitorar", metrics: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metrics: any[] = [];

    for (const channel of channels) {
      // Get tokens for this channel
      const { data: tokens } = await supabase
        .from("channel_tokens")
        .select("*")
        .eq("channel_id", channel.id);

      if (!tokens || tokens.length === 0) continue;

      const tokenMap: Record<string, string> = {};
      tokens.forEach((t) => { tokenMap[t.token_type] = t.token_value; });

      let channelMetrics: any = { platform: channel.platform, channel_id: channel.id, name: channel.name };

      try {
        switch (channel.platform) {
          case "instagram": {
            const accessToken = tokenMap.access_token;
            const pageId = tokenMap.page_id;
            if (!accessToken || !pageId) break;

            // Get profile info
            const profileRes = await fetch(
              `https://graph.facebook.com/v19.0/${pageId}?fields=biography,followers_count,follows_count,media_count,profile_picture_url,username,name,website&access_token=${accessToken}`
            );
            if (profileRes.ok) {
              const profile = await profileRes.json();
              channelMetrics.profile = profile;
              channelMetrics.followers = profile.followers_count || 0;
              channelMetrics.posts_count = profile.media_count || 0;

              // Update channel stats
              await supabase.from("channels").update({
                followers: profile.followers_count || 0,
                posts_count: profile.media_count || 0,
              }).eq("id", channel.id);
            }

            // Get recent media insights
            const mediaRes = await fetch(
              `https://graph.facebook.com/v19.0/${pageId}/media?fields=id,caption,like_count,comments_count,timestamp,media_type,permalink&limit=10&access_token=${accessToken}`
            );
            if (mediaRes.ok) {
              const mediaData = await mediaRes.json();
              channelMetrics.recent_posts = mediaData.data || [];
              
              // Calculate engagement rate
              const totalEngagement = (mediaData.data || []).reduce((sum: number, post: any) => {
                return sum + (post.like_count || 0) + (post.comments_count || 0);
              }, 0);
              const postCount = (mediaData.data || []).length;
              if (postCount > 0 && channelMetrics.followers > 0) {
                channelMetrics.engagement_rate = ((totalEngagement / postCount) / channelMetrics.followers * 100).toFixed(2);
                await supabase.from("channels").update({
                  engagement_rate: parseFloat(channelMetrics.engagement_rate),
                }).eq("id", channel.id);
              }
            }
            break;
          }

          case "youtube": {
            const apiKey = tokenMap.api_key;
            const channelYtId = tokenMap.channel_id;
            if (!apiKey || !channelYtId) break;

            const ytRes = await fetch(
              `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelYtId}&key=${apiKey}`
            );
            if (ytRes.ok) {
              const ytData = await ytRes.json();
              const ch = ytData.items?.[0];
              if (ch) {
                channelMetrics.profile = {
                  title: ch.snippet?.title,
                  description: ch.snippet?.description,
                  customUrl: ch.snippet?.customUrl,
                  thumbnail: ch.snippet?.thumbnails?.default?.url,
                  country: ch.snippet?.country,
                  keywords: ch.brandingSettings?.channel?.keywords,
                };
                channelMetrics.followers = parseInt(ch.statistics?.subscriberCount || "0");
                channelMetrics.posts_count = parseInt(ch.statistics?.videoCount || "0");
                channelMetrics.total_views = parseInt(ch.statistics?.viewCount || "0");

                await supabase.from("channels").update({
                  followers: channelMetrics.followers,
                  posts_count: channelMetrics.posts_count,
                }).eq("id", channel.id);
              }
            }

            // Get recent videos performance
            const videosRes = await fetch(
              `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelYtId}&order=date&maxResults=10&type=video&key=${apiKey}`
            );
            if (videosRes.ok) {
              const videosData = await videosRes.json();
              const videoIds = (videosData.items || []).map((v: any) => v.id?.videoId).filter(Boolean).join(",");
              if (videoIds) {
                const statsRes = await fetch(
                  `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`
                );
                if (statsRes.ok) {
                  const statsData = await statsRes.json();
                  channelMetrics.recent_videos = (statsData.items || []).map((v: any) => ({
                    id: v.id,
                    views: v.statistics?.viewCount,
                    likes: v.statistics?.likeCount,
                    comments: v.statistics?.commentCount,
                  }));
                }
              }
            }
            break;
          }

          case "tiktok": {
            const accessToken = tokenMap.access_token;
            if (!accessToken) break;
            // TikTok API — user info
            const ttRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count,bio_description", {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (ttRes.ok) {
              const ttData = await ttRes.json();
              const user = ttData.data?.user;
              if (user) {
                channelMetrics.profile = user;
                channelMetrics.followers = user.follower_count || 0;
                channelMetrics.posts_count = user.video_count || 0;
                await supabase.from("channels").update({
                  followers: user.follower_count || 0,
                  posts_count: user.video_count || 0,
                }).eq("id", channel.id);
              }
            }
            break;
          }

          case "twitter": {
            const bearerToken = tokenMap.bearer_token;
            if (!bearerToken) break;
            // Twitter API v2 — user lookup
            const twRes = await fetch("https://api.twitter.com/2/users/me?user.fields=public_metrics,description,profile_image_url,name,username,location,url", {
              headers: { Authorization: `Bearer ${bearerToken}` },
            });
            if (twRes.ok) {
              const twData = await twRes.json();
              channelMetrics.profile = twData.data;
              channelMetrics.followers = twData.data?.public_metrics?.followers_count || 0;
              channelMetrics.posts_count = twData.data?.public_metrics?.tweet_count || 0;
              await supabase.from("channels").update({
                followers: channelMetrics.followers,
                posts_count: channelMetrics.posts_count,
              }).eq("id", channel.id);
            }
            break;
          }

          case "linkedin": {
            const accessToken = tokenMap.access_token;
            if (!accessToken) break;
            const liRes = await fetch("https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,profilePicture)", {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (liRes.ok) {
              channelMetrics.profile = await liRes.json();
            }
            break;
          }

          case "facebook": {
            const accessToken = tokenMap.access_token;
            const pageId = tokenMap.page_id;
            if (!accessToken || !pageId) break;
            const fbRes = await fetch(
              `https://graph.facebook.com/v19.0/${pageId}?fields=name,about,fan_count,followers_count,category,cover,picture,website,engagement&access_token=${accessToken}`
            );
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              channelMetrics.profile = fbData;
              channelMetrics.followers = fbData.followers_count || fbData.fan_count || 0;
              await supabase.from("channels").update({
                followers: channelMetrics.followers,
              }).eq("id", channel.id);
            }
            break;
          }
        }
      } catch (e) {
        channelMetrics.error = e instanceof Error ? e.message : "Erro ao monitorar";
      }

      metrics.push(channelMetrics);
    }

    // Log monitoring results
    const connectedCount = metrics.filter((m) => !m.error).length;
    await supabase.from("system_logs").insert({
      event_type: "monitoramento",
      message: `📊 Monitoramento: ${connectedCount}/${channels.length} canais verificados — Seguidores totais: ${metrics.reduce((s, m) => s + (m.followers || 0), 0)}`,
      level: "info",
      metadata: {
        channels_monitored: connectedCount,
        total_followers: metrics.reduce((s, m) => s + (m.followers || 0), 0),
        platforms: metrics.map((m) => ({ platform: m.platform, followers: m.followers, engagement: m.engagement_rate })),
      },
    });

    return new Response(JSON.stringify({ metrics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("monitor-channels error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
