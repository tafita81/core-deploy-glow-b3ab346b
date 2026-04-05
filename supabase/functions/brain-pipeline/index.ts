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

    await supabase.from("system_logs").insert({
      event_type: "sistema",
      message: "🧠 Pipeline VIRAL autônomo iniciado — Modo: Máxima Viralização",
      level: "info",
    });

    // Get settings
    const { data: settingsRows } = await supabase.from("settings").select("*");
    const settings: Record<string, any> = {};
    settingsRows?.forEach((s) => { settings[s.key] = s.value; });

    const scienceCheck = settings.science_check !== false && settings.science_check !== "false";
    const ethicsCheck = settings.ethics_check !== false && settings.ethics_check !== "false";
    const autoPublish = settings.auto_publish === true || settings.auto_publish === "true";
    const scoreThreshold = Number(settings.score_threshold) || 75;

    const results = {
      researched: 0, generated: 0, media: 0, validated: 0, published: 0,
      whatsapp_generated: 0,
      viral_score_avg: 0, competitors_analyzed: 0, hashtags_found: 0,
      errors: [] as string[],
    };

    // STEP 1: VIRAL RESEARCH — Analyze competitors, trending videos, viral patterns
    let topics: any[] = [];
    let viralPatterns: any = {};
    let monetizationInsights: any = {};

    try {
      const trendRes = await fetch(`${supabaseUrl}/functions/v1/research-trends`, {
        method: "POST",
        headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (trendRes.ok) {
        const trendData = await trendRes.json();
        topics = trendData.topics || [];
        viralPatterns = trendData.viral_patterns || {};
        monetizationInsights = trendData.monetization_insights || {};
        results.researched = topics.length;
        const brRanking = trendData.top_10_ranking_brasil || trendData.competitor_analysis || [];
        const worldRanking = trendData.world_ranking || [];
        results.competitors_analyzed = brRanking.length + worldRanking.length;
        results.hashtags_found = (viralPatterns.trending_hashtags || []).length;

        // SAVE HOURLY SNAPSHOTS — track views over time
        const now = new Date().toISOString();
        const snapshots: any[] = [];
        
        for (const v of brRanking) {
          snapshots.push({
            video_title: v.video_title || v.top_video_title || v.channel || 'Sem título',
            creator: v.creator || v.channel,
            platform: v.platform || 'unknown',
            region: 'brasil',
            total_views: v.total_views || v.followers || '0',
            views_growth_1h: v.views_growth_1h || v.growth_velocity || '0',
            momentum_score: v.momentum_score || 0,
            acceleration: v.acceleration || 'linear',
            snapshot_hour: now,
            metadata: { rank: v.rank, why_viral: v.why_viral || v.why_growing_fast, format: v.content_format },
          });
        }
        for (const v of worldRanking) {
          snapshots.push({
            video_title: v.video_title || v.top_video_title || v.channel || 'Sem título',
            creator: v.creator || v.channel,
            platform: v.platform || 'unknown',
            region: 'mundial',
            total_views: v.total_views || '0',
            views_growth_1h: v.views_growth_1h || v.growth_velocity || '0',
            momentum_score: v.momentum_score || 0,
            acceleration: v.acceleration || 'linear',
            snapshot_hour: now,
            metadata: { rank: v.rank, country: v.country, insight_br: v.insight_for_brazil, format: v.content_format },
          });
        }

        if (snapshots.length > 0) {
          await supabase.from("video_snapshots").insert(snapshots);
          await supabase.from("system_logs").insert({
            event_type: "snapshot",
            message: `📸 ${snapshots.length} snapshots salvos — comparação horária ativa`,
            level: "info",
            metadata: { count: snapshots.length, hour: now },
          });
        }

        // COMPARE WITH PREVIOUS HOUR — find videos that grew the most
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: prevSnapshots } = await supabase
          .from("video_snapshots")
          .select("video_title, total_views, momentum_score, region")
          .lt("snapshot_hour", now)
          .gte("snapshot_hour", oneHourAgo);

        if (prevSnapshots && prevSnapshots.length > 0) {
          // Find videos that appeared in both hours and grew the most
          const prevMap = new Map(prevSnapshots.map((s: any) => [s.video_title, s]));
          const growthWinners = snapshots
            .filter(s => prevMap.has(s.video_title))
            .map(s => {
              const prev = prevMap.get(s.video_title)!;
              return { ...s, momentum_delta: (s.momentum_score || 0) - (prev.momentum_score || 0) };
            })
            .sort((a, b) => b.momentum_delta - a.momentum_delta);

          if (growthWinners.length > 0) {
            await supabase.from("system_logs").insert({
              event_type: "decisao",
              message: `🎯 Vídeo com MAIOR crescimento no período: "${growthWinners[0].video_title}" (Δ momentum: +${growthWinners[0].momentum_delta})`,
              level: "info",
              metadata: { top_growers: growthWinners.slice(0, 5).map((g: any) => ({ title: g.video_title, delta: g.momentum_delta })) },
            });

            // PRIORITIZE topics inspired by the fastest growing videos
            const topGrower = growthWinners[0];
            topics = topics.sort((a: any, b: any) => {
              const aMatch = (a.inspired_by_video || '').includes(topGrower.video_title) ? 1 : 0;
              const bMatch = (b.inspired_by_video || '').includes(topGrower.video_title) ? 1 : 0;
              return bMatch - aMatch;
            });
          }
        }

        if (worldRanking.length > 0) {
          const worldInsights = worldRanking
            .filter((w: any) => w.insight_for_brazil)
            .map((w: any) => w.insight_for_brazil);
          if (worldInsights.length > 0) {
            await supabase.from("system_logs").insert({
              event_type: "pesquisa",
              message: `🌍 ${worldRanking.length} vídeos mundiais rastreados — insights para Brasil`,
              level: "info",
              metadata: { top_videos: worldRanking.slice(0, 3).map((w: any) => w.video_title), insights: worldInsights.slice(0, 5) },
            });
          }
        }
      }
    } catch (e) {
      results.errors.push(`Pesquisa viral: ${e instanceof Error ? e.message : "erro"}`);
    }

    // STEP 2: GENERATE VIRAL CONTENT — Create 3 pieces per run (multi-platform)
    const contentIds: string[] = [];
    const platformRotation = ["instagram", "tiktok", "youtube"];

    for (let i = 0; i < Math.min(3, topics.length); i++) {
      const topic = topics[i];
      const targetChannel = topic.suggested_channel || platformRotation[i % platformRotation.length];
      const targetType = targetChannel === "youtube" ? "artigo" : (topic.suggested_type || "reel");

      try {
        const genRes = await fetch(`${supabaseUrl}/functions/v1/generate-content`, {
          method: "POST",
          headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: topic.topic,
            channel: targetChannel,
            content_type: targetType,
            viral_title: topic.viral_title,
            hook: topic.hook,
            hashtags: topic.hashtags,
            whatsapp_cta: topic.whatsapp_cta,
            monetization_angle: topic.monetization_angle,
          }),
        });
        if (genRes.ok) {
          const genData = await genRes.json();
          if (genData.content?.id) {
            contentIds.push(genData.content.id);
            results.generated++;
          }
        }
      } catch (e) {
        results.errors.push(`Geração ${topic.label}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }

    // STEP 2.5: ANALYZE VIRAL VISUALS — Extract thumbnail/video patterns from top videos
    try {
      const visualRes = await fetch(`${supabaseUrl}/functions/v1/analyze-viral-visuals`, {
        method: "POST",
        headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (visualRes.ok) {
        await supabase.from("system_logs").insert({
          event_type: "analise_visual",
          message: "🎨 Análise visual de thumbnails/vídeos virais integrada ao pipeline",
          level: "info",
        });
      }
    } catch (e) {
      results.errors.push(`Análise visual: ${e instanceof Error ? e.message : "erro"}`);
    }

    // STEP 3: GENERATE VIRAL MEDIA — Thumbnails + narration optimized for clicks
    for (const contentId of contentIds) {
      try {
        const mediaRes = await fetch(`${supabaseUrl}/functions/v1/generate-media`, {
          method: "POST",
          headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ content_id: contentId }),
        });
        if (mediaRes.ok) {
          results.media++;
          // Also try to generate HeyGen video with lip sync
          try {
            await fetch(`${supabaseUrl}/functions/v1/generate-video-heygen`, {
              method: "POST",
              headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ content_id: contentId }),
            });
          } catch (_) { /* HeyGen is optional — continues if API key not set */ }
        }
      } catch (e) {
        results.errors.push(`Mídia ${contentId}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }

    // STEP 4: VALIDATE — Science + Ethics
    for (const contentId of contentIds) {
      try {
        if (scienceCheck) {
          await fetch(`${supabaseUrl}/functions/v1/validate-science`, {
            method: "POST",
            headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ content_id: contentId }),
          });
        }
        if (ethicsCheck) {
          await fetch(`${supabaseUrl}/functions/v1/validate-ethics`, {
            method: "POST",
            headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ content_id: contentId }),
          });
        }
        results.validated++;
      } catch (e) {
        results.errors.push(`Validação ${contentId}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }

    // STEP 5: AUTO-APPROVE + AUTO-PUBLISH to ALL connected channels
    if (autoPublish) {
      // Approve high-score validated content
      const { data: toApprove } = await supabase
        .from("contents")
        .select("*")
        .in("status", ["revisao", "rascunho"])
        .eq("scientific_valid", true)
        .eq("ethics_valid", true)
        .gte("score", scoreThreshold);

      for (const content of toApprove || []) {
        await supabase.from("contents").update({ status: "aprovado" }).eq("id", content.id);
      }

      // Publish the BEST content first (highest score)
      const { data: approved } = await supabase
        .from("contents")
        .select("*")
        .eq("status", "aprovado")
        .eq("scientific_valid", true)
        .eq("ethics_valid", true)
        .gte("score", scoreThreshold)
        .order("score", { ascending: false })
        .limit(5);

      for (const content of approved || []) {
        try {
          const pubRes = await fetch(`${supabaseUrl}/functions/v1/publish-social`, {
            method: "POST",
            headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ content_id: content.id }),
          });
          if (pubRes.ok) {
            results.published++;
            await supabase.from("system_logs").insert({
              event_type: "publicacao",
              message: `🚀 VIRAL publicado: "${content.title}" — Score: ${content.score}`,
              level: "info",
              metadata: { content_id: content.id, score: content.score },
            });
          }
        } catch (e) {
          results.errors.push(`Publicação ${content.title}: ${e instanceof Error ? e.message : "erro"}`);
        }
      }
    }

    // STEP 6: GENERATE WHATSAPP COMMUNITY CONTENT
    const whatsappTypes = ["conversa", "dica_rapida", "enquete"];
    for (let i = 0; i < Math.min(2, whatsappTypes.length); i++) {
      try {
        const whatsappRes = await fetch(`${supabaseUrl}/functions/v1/generate-whatsapp-content`, {
          method: "POST",
          headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            group_type: "geral",
            content_type: whatsappTypes[i],
            source_content_id: contentIds[0] || null,
          }),
        });
        if (whatsappRes.ok) results.whatsapp_generated++;
      } catch (e) {
        results.errors.push(`WhatsApp ${whatsappTypes[i]}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }

    // STEP 7: MONITOR ALL CHANNELS — Real-time metrics & profile data
    try {
      const monitorRes = await fetch(`${supabaseUrl}/functions/v1/monitor-channels`, {
        method: "POST",
        headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (monitorRes.ok) {
        const monitorData = await monitorRes.json();
        (results as any).channels_monitored = (monitorData.metrics || []).length;
        (results as any).total_followers = (monitorData.metrics || []).reduce((s: number, m: any) => s + (m.followers || 0), 0);
      }
    } catch (e) {
      results.errors.push(`Monitoramento: ${e instanceof Error ? e.message : "erro"}`);
    }

    // STEP 8: OPTIMIZE PROFILES — AI analyzes and auto-updates bios, descriptions, keywords
    try {
      const optRes = await fetch(`${supabaseUrl}/functions/v1/optimize-profiles`, {
        method: "POST",
        headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (optRes.ok) {
        const optData = await optRes.json();
        (results as any).profiles_optimized = (optData.applied || []).length;
      }
    } catch (e) {
      results.errors.push(`Otimização perfis: ${e instanceof Error ? e.message : "erro"}`);
    }

    // Calculate avg viral score
    if (contentIds.length > 0) {
      const { data: scored } = await supabase
        .from("contents")
        .select("score")
        .in("id", contentIds);
      if (scored?.length) {
        results.viral_score_avg = Math.round(scored.reduce((a, b) => a + (b.score || 0), 0) / scored.length);
      }
    }

    await supabase.from("system_logs").insert({
      event_type: "sistema",
      message: `🧠 Pipeline VIRAL concluído: ${results.researched} pesquisados, ${results.generated} gerados (score médio: ${results.viral_score_avg}), ${results.media} mídias, ${results.validated} validados, ${results.published} publicados, ${results.whatsapp_generated} WhatsApp, ${results.competitors_analyzed} vídeos rastreados, ${(results as any).channels_monitored || 0} canais monitorados, ${(results as any).profiles_optimized || 0} perfis otimizados`,
      level: results.errors.length > 0 ? "warning" : "info",
      metadata: results,
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("brain-pipeline error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
