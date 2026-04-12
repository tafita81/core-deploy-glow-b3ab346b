import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Eye, MessageCircle, Heart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function PerformanceChart() {
  const { data: contents, isLoading: contentsLoading } = useQuery({
    queryKey: ["performance-chart"],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data, error } = await supabase
        .from("contents")
        .select("created_at, score, status")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: perfHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["performance-history-insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_history")
        .select("views_7d, comments_count, likes_count, engagement_rate, content_format, hook_pattern, topic, revenue_estimated, duration_sec, posted_at, created_at")
        .order("views_7d", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 120000,
  });

  const isLoading = contentsLoading || historyLoading;

  // Group by day of week
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayKey = d.toISOString().slice(0, 10);
    const dayContents = contents?.filter(
      (c) => c.created_at.slice(0, 10) === dayKey
    ) ?? [];
    return {
      day: dayNames[d.getDay()],
      count: dayContents.length,
      avgScore: dayContents.length
        ? Math.round(dayContents.reduce((a, b) => a + (b.score ?? 0), 0) / dayContents.length)
        : 0,
      published: dayContents.filter((c) => c.status === "publicado").length,
    };
  });

  const maxCount = Math.max(...weekData.map((d) => d.count), 1);
  const totalGenerated = weekData.reduce((a, b) => a + b.count, 0);
  const totalPublished = weekData.reduce((a, b) => a + b.published, 0);
  const avgScore = totalGenerated
    ? Math.round(weekData.reduce((a, b) => a + b.avgScore * b.count, 0) / totalGenerated)
    : 0;

  // Performance history insights
  const hasHistory = perfHistory && perfHistory.length > 0;
  const totalViews7d = hasHistory ? perfHistory.reduce((s, p) => s + (p.views_7d ?? 0), 0) : 0;
  const avgEngagement = hasHistory ? (perfHistory.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / perfHistory.length).toFixed(2) : "0";
  const totalRevenue = hasHistory ? perfHistory.reduce((s, p) => s + (p.revenue_estimated ?? 0), 0) : 0;
  const avgComments = hasHistory ? Math.round(perfHistory.reduce((s, p) => s + (p.comments_count ?? 0), 0) / perfHistory.length) : 0;
  const avgLikes = hasHistory ? Math.round(perfHistory.reduce((s, p) => s + (p.likes_count ?? 0), 0) / perfHistory.length) : 0;

  // Top performing topic
  const topicCounts: Record<string, { count: number; views: number }> = {};
  perfHistory?.forEach((p) => {
    const t = p.topic || "geral";
    if (!topicCounts[t]) topicCounts[t] = { count: 0, views: 0 };
    topicCounts[t].count++;
    topicCounts[t].views += p.views_7d ?? 0;
  });
  const topTopic = Object.entries(topicCounts)
    .sort((a, b) => b[1].views - a[1].views)[0];

  // Top format
  const formatCounts: Record<string, number> = {};
  perfHistory?.forEach((p) => {
    const f = p.content_format || "?";
    formatCounts[f] = (formatCounts[f] || 0) + 1;
  });
  const topFormat = Object.entries(formatCounts)
    .sort((a, b) => b[1] - a[1])[0];

  if (isLoading) {
    return (
      <Card className="animate-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">Performance Semanal</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="font-heading text-lg">Performance Semanal</CardTitle>
        <Badge variant="secondary" className="text-xs">Últimos 7 dias</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-40">
          {weekData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground font-medium">
                {d.count}
              </span>
              <div
                className="w-full rounded-t-md bg-gradient-primary transition-all duration-500 hover:opacity-80"
                style={{
                  height: `${Math.max((d.count / maxCount) * 100, 4)}%`,
                }}
              />
              <span className="text-[10px] text-muted-foreground">{d.day}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-lg font-heading font-bold">{totalGenerated}</p>
            <p className="text-[10px] text-muted-foreground">Gerados</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-heading font-bold">{totalPublished}</p>
            <p className="text-[10px] text-muted-foreground">Publicados</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-heading font-bold">{avgScore}</p>
            <p className="text-[10px] text-muted-foreground">Score Médio</p>
          </div>
        </div>

        {/* Performance History Insights */}
        {hasHistory && (
          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" />
              Insights do Histórico de Performance
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/30 rounded-md p-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Eye className="h-3 w-3 text-primary" />
                  <p className="text-xs font-bold text-primary">
                    {totalViews7d >= 1000000 ? `${(totalViews7d / 1000000).toFixed(1)}M` : totalViews7d >= 1000 ? `${(totalViews7d / 1000).toFixed(0)}K` : totalViews7d}
                  </p>
                </div>
                <p className="text-[9px] text-muted-foreground">Views 7d</p>
              </div>
              <div className="bg-muted/30 rounded-md p-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <MessageCircle className="h-3 w-3 text-orange-400" />
                  <p className="text-xs font-bold text-orange-400">{avgComments}</p>
                </div>
                <p className="text-[9px] text-muted-foreground">Avg Comments</p>
              </div>
              <div className="bg-muted/30 rounded-md p-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Heart className="h-3 w-3 text-pink-400" />
                  <p className="text-xs font-bold text-pink-400">
                    {avgLikes >= 1000 ? `${(avgLikes / 1000).toFixed(1)}K` : avgLikes}
                  </p>
                </div>
                <p className="text-[9px] text-muted-foreground">Avg Likes</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-green-500/5 rounded-md p-2">
                <p className="text-[10px] text-muted-foreground">Engajamento Médio</p>
                <p className="font-bold text-green-400">{avgEngagement}%</p>
              </div>
              <div className="bg-primary/5 rounded-md p-2">
                <p className="text-[10px] text-muted-foreground">Revenue Estimado</p>
                <p className="font-bold text-primary">${totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(0)}K` : totalRevenue}</p>
              </div>
            </div>
            {(topTopic || topFormat) && (
              <div className="flex flex-wrap gap-1.5">
                {topTopic && (
                  <Badge variant="secondary" className="text-[9px]">
                    Top: {topTopic[0].replace(/_/g, " ")}
                  </Badge>
                )}
                {topFormat && (
                  <Badge variant="outline" className="text-[9px]">
                    {topFormat[0]}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[9px] border-primary/30">
                  {perfHistory.length} vídeos rastreados
                </Badge>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
