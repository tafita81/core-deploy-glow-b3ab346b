import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import {
  TrendingUp, TrendingDown, Eye, Users, Heart, MessageCircle,
  RefreshCw, Clock, Instagram, Youtube, Twitter, Facebook, Linkedin,
  BarChart3, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";

type Period = "1h" | "6h" | "24h" | "7d" | "30d";

const PERIOD_LABELS: Record<Period, string> = {
  "1h": "Última hora",
  "6h": "Últimas 6h",
  "24h": "Últimas 24h",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
};

function getDateFromPeriod(period: Period): string {
  const now = new Date();
  switch (period) {
    case "1h": now.setHours(now.getHours() - 1); break;
    case "6h": now.setHours(now.getHours() - 6); break;
    case "24h": now.setDate(now.getDate() - 1); break;
    case "7d": now.setDate(now.getDate() - 7); break;
    case "30d": now.setDate(now.getDate() - 30); break;
  }
  return now.toISOString();
}

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
  facebook: Facebook,
  linkedin: Linkedin,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "from-pink-500 to-purple-600",
  youtube: "from-red-500 to-red-700",
  tiktok: "from-black to-gray-800",
  twitter: "from-blue-400 to-blue-600",
  facebook: "from-blue-600 to-blue-800",
  linkedin: "from-blue-700 to-blue-900",
  pinterest: "from-red-600 to-red-800",
  whatsapp: "from-green-500 to-green-700",
};

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function GrowthIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return <Badge variant="outline" className="text-xs">Novo</Badge>;
  const diff = current - previous;
  const pct = ((diff / previous) * 100).toFixed(1);
  if (diff > 0) return (
    <span className="flex items-center gap-1 text-xs text-green-400">
      <ArrowUpRight className="h-3 w-3" /> +{formatNumber(diff)} ({pct}%)
    </span>
  );
  if (diff < 0) return (
    <span className="flex items-center gap-1 text-xs text-red-400">
      <ArrowDownRight className="h-3 w-3" /> {formatNumber(diff)} ({pct}%)
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" /> Sem variação
    </span>
  );
}

const Monitoring = () => {
  const [period, setPeriod] = useState<Period>("24h");

  // Current channel data
  const { data: channels } = useQuery({
    queryKey: ["monitoring-channels"],
    queryFn: async () => {
      const { data } = await supabase.from("channels").select("*").eq("is_connected", true);
      return data || [];
    },
  });

  // Current snapshots (latest per platform)
  const { data: latestSnapshots } = useQuery({
    queryKey: ["latest-snapshots"],
    queryFn: async () => {
      const { data } = await supabase
        .from("social_metrics_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Previous period snapshots for comparison
  const { data: previousSnapshots } = useQuery({
    queryKey: ["previous-snapshots", period],
    queryFn: async () => {
      const cutoff = getDateFromPeriod(period);
      const { data } = await supabase
        .from("social_metrics_snapshots")
        .select("*")
        .lte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // All snapshots in period for timeline
  const { data: timelineSnapshots } = useQuery({
    queryKey: ["timeline-snapshots", period],
    queryFn: async () => {
      const cutoff = getDateFromPeriod(period);
      const { data } = await supabase
        .from("social_metrics_snapshots")
        .select("*")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  // Viral intelligence for trends
  const { data: viralIntel } = useQuery({
    queryKey: ["viral-intel-monitoring"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "viral_intelligence")
        .single();
      return data?.value as any;
    },
  });

  // Video snapshots for YouTube trending
  const { data: videoSnapshots } = useQuery({
    queryKey: ["video-snapshots-monitoring", period],
    queryFn: async () => {
      const cutoff = getDateFromPeriod(period);
      const { data } = await supabase
        .from("video_snapshots")
        .select("*")
        .gte("created_at", cutoff)
        .order("momentum_score", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  // Group latest snapshots by platform (take most recent per platform)
  const latestByPlatform = (latestSnapshots || []).reduce((acc: Record<string, any>, s: any) => {
    if (!acc[s.platform] || new Date(s.created_at) > new Date(acc[s.platform].created_at)) {
      acc[s.platform] = s;
    }
    return acc;
  }, {});

  const previousByPlatform = (previousSnapshots || []).reduce((acc: Record<string, any>, s: any) => {
    if (!acc[s.platform] || new Date(s.created_at) > new Date(acc[s.platform].created_at)) {
      acc[s.platform] = s;
    }
    return acc;
  }, {});

  // Group timeline by platform for mini charts
  const timelineByPlatform = (timelineSnapshots || []).reduce((acc: Record<string, any[]>, s: any) => {
    if (!acc[s.platform]) acc[s.platform] = [];
    acc[s.platform].push(s);
    return acc;
  }, {});

  const allPlatforms = [...new Set([
    ...Object.keys(latestByPlatform),
    ...(channels || []).map(c => c.platform),
  ])];

  // Total metrics
  const totalFollowers = Object.values(latestByPlatform).reduce((s: number, p: any) => s + (p.followers || 0), 0);
  const totalViews = Object.values(latestByPlatform).reduce((s: number, p: any) => s + Number(p.total_views || 0), 0);
  const prevTotalFollowers = Object.values(previousByPlatform).reduce((s: number, p: any) => s + (p.followers || 0), 0);

  const googleTrends = viralIntel?.viral_patterns?.google_trends || [];
  const redditTrending = viralIntel?.reddit_trending || [];
  const newsTrending = viralIntel?.news_trending || [];
  const dataSources = viralIntel?.data_sources || [];
  const updatedAt = viralIntel?.updated_at;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Monitoramento em Tempo Real
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Métricas de todas as redes sociais com análise por período
            </p>
          </div>
          {updatedAt && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Atualizado: {new Date(updatedAt).toLocaleString("pt-BR")}
            </Badge>
          )}
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>

        {/* Total Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Users className="h-3 w-3" /> Seguidores Totais
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalFollowers)}</div>
              <GrowthIndicator current={totalFollowers} previous={prevTotalFollowers} />
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Eye className="h-3 w-3" /> Views Totais
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalViews)}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingUp className="h-3 w-3" /> Redes Ativas
              </div>
              <div className="text-2xl font-bold">{allPlatforms.length}</div>
              <span className="text-xs text-muted-foreground">{allPlatforms.join(", ")}</span>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <RefreshCw className="h-3 w-3" /> Fontes de Dados
              </div>
              <div className="text-2xl font-bold">{dataSources.length}</div>
              <span className="text-xs text-muted-foreground">{dataSources.join(", ") || "Nenhuma"}</span>
            </CardContent>
          </Card>
        </div>

        {/* Per-Platform Detailed Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allPlatforms.map((platform) => {
            const current = latestByPlatform[platform];
            const previous = previousByPlatform[platform];
            const timeline = timelineByPlatform[platform] || [];
            const Icon = PLATFORM_ICONS[platform] || BarChart3;
            const gradient = PLATFORM_COLORS[platform] || "from-gray-500 to-gray-700";
            const channel = channels?.find(c => c.platform === platform);

            return (
              <Card key={platform} className="overflow-hidden">
                <div className={`h-1 bg-gradient-to-r ${gradient}`} />
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      <span className="capitalize">{platform}</span>
                    </div>
                    {channel?.is_connected ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-400 text-xs">Conectado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Aguardando conexão</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {current ? (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Seguidores</div>
                          <div className="text-lg font-bold">{formatNumber(current.followers || 0)}</div>
                          <GrowthIndicator current={current.followers || 0} previous={previous?.followers || 0} />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Views</div>
                          <div className="text-lg font-bold">{formatNumber(Number(current.total_views) || 0)}</div>
                          <GrowthIndicator current={Number(current.total_views) || 0} previous={Number(previous?.total_views) || 0} />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Engajamento</div>
                          <div className="text-lg font-bold">{current.engagement_rate || 0}%</div>
                          <GrowthIndicator current={Number(current.engagement_rate) || 0} previous={Number(previous?.engagement_rate) || 0} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1"><Heart className="h-3 w-3" /> Likes</div>
                          <div className="font-medium">{formatNumber(current.likes || 0)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Comentários</div>
                          <div className="font-medium">{formatNumber(current.comments || 0)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Posts</div>
                          <div className="font-medium">{formatNumber(current.posts_count || 0)}</div>
                        </div>
                      </div>

                      {/* Mini timeline bar */}
                      {timeline.length > 1 && (
                        <div className="mt-2">
                          <div className="text-xs text-muted-foreground mb-1">Evolução de seguidores ({PERIOD_LABELS[period]})</div>
                          <div className="flex items-end gap-[2px] h-8">
                            {timeline.map((s: any, i: number) => {
                              const max = Math.max(...timeline.map((t: any) => t.followers || 0));
                              const min = Math.min(...timeline.map((t: any) => t.followers || 0));
                              const range = max - min || 1;
                              const height = ((s.followers - min) / range) * 100;
                              return (
                                <div
                                  key={i}
                                  className={`flex-1 rounded-t bg-gradient-to-t ${gradient} opacity-70 min-h-[2px]`}
                                  style={{ height: `${Math.max(5, height)}%` }}
                                  title={`${s.followers} seguidores — ${new Date(s.created_at).toLocaleString("pt-BR")}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      {channel?.is_connected
                        ? "Aguardando primeira coleta de dados..."
                        : "Conecte sua conta para monitorar métricas"}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Trending sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Google Trends */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                Google Trends Brasil
              </CardTitle>
            </CardHeader>
            <CardContent>
              {googleTrends.length > 0 ? (
                <div className="space-y-1">
                  {googleTrends.slice(0, 10).map((t: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                      <span className="truncate">{t}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              )}
            </CardContent>
          </Card>

          {/* Reddit */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-orange-400" />
                Reddit Trending
              </CardTitle>
            </CardHeader>
            <CardContent>
              {redditTrending.length > 0 ? (
                <div className="space-y-2">
                  {redditTrending.slice(0, 8).map((p: any, i: number) => (
                    <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="block hover:bg-accent/50 rounded p-1 -mx-1">
                      <div className="text-xs truncate">{p.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        r/{p.subreddit} • ⬆️ {p.score} • 💬 {p.comments}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              )}
            </CardContent>
          </Card>

          {/* News */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4 text-green-400" />
                Notícias Saúde Mental
              </CardTitle>
            </CardHeader>
            <CardContent>
              {newsTrending.length > 0 ? (
                <div className="space-y-2">
                  {newsTrending.slice(0, 8).map((n: any, i: number) => (
                    <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="block hover:bg-accent/50 rounded p-1 -mx-1">
                      <div className="text-xs truncate">{n.title}</div>
                      <div className="text-[10px] text-muted-foreground">{n.source}</div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Video Snapshots / Trending Videos */}
        {videoSnapshots && videoSnapshots.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-500" />
                Vídeos em Alta ({PERIOD_LABELS[period]})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {videoSnapshots.slice(0, 10).map((v: any, i: number) => (
                  <a
                    key={v.id}
                    href={(v.metadata as any)?.video_url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 hover:bg-accent/50 rounded p-2 -mx-2"
                  >
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{v.video_title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {v.creator} • {v.total_views} • 🔥 {v.momentum_score}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {v.region === "BR" ? "🇧🇷" : "🌍"} {v.platform}
                    </Badge>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No data state */}
        {allPlatforms.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="font-heading text-lg font-medium mb-2">Nenhuma rede conectada</h3>
              <p className="text-sm text-muted-foreground">
                Conecte suas redes sociais na página de <strong>Canais</strong> para começar o monitoramento em tempo real.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Monitoring;
