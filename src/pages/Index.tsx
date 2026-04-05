import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { ContentQueue } from "@/components/ContentQueue";
import { PerformanceChart } from "@/components/PerformanceChart";
import { AgentStatus } from "@/components/AgentStatus";
import { TopicsRanking } from "@/components/TopicsRanking";
import { PendingActions } from "@/components/PendingActions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Zap, TrendingUp, Target, Users, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { data: contents } = useQuery({
    queryKey: ["dashboard-contents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contents").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: viralIntel } = useQuery({
    queryKey: ["viral-intelligence"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "viral_intelligence")
        .single();
      return data?.value as any;
    },
  });

  const published = contents?.filter((c) => c.status === "publicado").length ?? 0;
  const pending = contents?.filter((c) => c.status !== "publicado" && c.status !== "rejeitado").length ?? 0;
  const avgScore = contents?.length
    ? Math.round(contents.reduce((a, b) => a + (b.score ?? 0), 0) / contents.length)
    : 0;
  const viralReady = contents?.filter((c) => (c.score ?? 0) >= 85).length ?? 0;

  const topVideosBrasil = viralIntel?.top_10_ranking_brasil || viralIntel?.competitor_analysis || [];
  const topVideosMundial = viralIntel?.world_ranking || [];
  const monetization = viralIntel?.monetization_insights || {};
  const patterns = viralIntel?.viral_patterns || {};
  const momentum = viralIntel?.momentum_analysis || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Dashboard Viral</h1>
            <p className="text-sm text-muted-foreground mt-1">
              🧠 Cérebro VIRAL autônomo — análise de concorrentes + monetização 24/7
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] animate-pulse-glow">
            🔥 Modo Viral Ativo
          </Badge>
        </div>

        <PendingActions />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            title="Gerados"
            value={String(contents?.length ?? 0)}
            change="Total"
            changeType="neutral"
            icon={Eye}
            iconColor="bg-primary/10 text-primary"
          />
          <MetricCard
            title="Publicados"
            value={String(published)}
            change={`${pending} pendentes`}
            changeType="positive"
            icon={Zap}
            iconColor="bg-success/10 text-success"
          />
          <MetricCard
            title="Score Médio"
            value={String(avgScore)}
            change={avgScore >= 85 ? "🔥 Viral" : avgScore >= 75 ? "✓ Bom" : "↑ Melhorar"}
            changeType={avgScore >= 75 ? "positive" : "negative"}
            icon={TrendingUp}
            iconColor="bg-warning/10 text-warning"
          />
          <MetricCard
            title="Viral-Ready"
            value={String(viralReady)}
            change="Score ≥ 85"
            changeType="positive"
            icon={Target}
            iconColor="bg-destructive/10 text-destructive"
          />
          <MetricCard
            title="Vídeos Virais"
            value={String(topVideosBrasil.length)}
            change="Rankeados"
            changeType="neutral"
            icon={Users}
            iconColor="bg-accent/50 text-accent-foreground"
          />
          <MetricCard
            title="Hashtags"
            value={String((patterns.trending_hashtags || []).length)}
            change="Trending"
            changeType="positive"
            icon={DollarSign}
            iconColor="bg-primary/10 text-primary"
          />
        </div>

        {(topVideosBrasil.length > 0 || topVideosMundial.length > 0 || (monetization.revenue_streams || []).length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {topVideosBrasil.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    🇧🇷 Top Vídeos Brasil — Mais Views AGORA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topVideosBrasil.slice(0, 10).map((v: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="font-bold text-primary min-w-[20px]">#{v.rank || i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="font-medium truncate">
                            🎬 {v.video_title || v.top_video_title || v.channel}
                          </p>
                          {v.momentum_score && (
                            <Badge variant="secondary" className="text-[9px] shrink-0">
                              ⚡{v.momentum_score}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {v.creator || v.channel} • {v.platform}
                        </p>
                        {v.total_views && (
                          <p className="text-[10px] text-success font-medium">👁 {v.total_views}</p>
                        )}
                        {(v.views_growth_1h || v.growth_velocity) && (
                          <p className="text-[10px] text-success truncate">📈 {v.views_growth_1h || v.growth_velocity} • {v.acceleration || ''}</p>
                        )}
                        <p className="text-muted-foreground truncate">{v.why_viral || v.why_growing_fast}</p>
                        {v.replication_strategy && (
                          <p className="text-[10px] text-primary/70 truncate">🔁 {v.replication_strategy}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {topVideosMundial.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    🌍 Top Vídeos Mundial — Mais Views AGORA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topVideosMundial.slice(0, 10).map((v: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="font-bold text-primary min-w-[20px]">#{v.rank || i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="font-medium truncate">
                            🎬 {v.video_title || v.top_video_title || v.channel}
                          </p>
                          {v.momentum_score && (
                            <Badge variant="secondary" className="text-[9px] shrink-0">
                              ⚡{v.momentum_score}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {v.creator || v.channel} • {v.platform} {v.country && `• ${v.country}`}
                        </p>
                        {v.total_views && (
                          <p className="text-[10px] text-success font-medium">👁 {v.total_views}</p>
                        )}
                        {(v.views_growth_1h || v.growth_velocity) && (
                          <p className="text-[10px] text-success truncate">📈 {v.views_growth_1h || v.growth_velocity} • {v.acceleration || ''}</p>
                        )}
                        <p className="text-muted-foreground truncate">{v.why_viral || v.why_growing_fast}</p>
                        {v.insight_for_brazil && (
                          <p className="text-[10px] text-success truncate">🇧🇷 {v.insight_for_brazil}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  💰 Estratégias de Monetização
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(monetization.revenue_streams || []).slice(0, 4).map((stream: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-success">💵</span>
                    <span>{stream}</span>
                  </div>
                ))}
                {(monetization.community_growth_tactics || []).slice(0, 3).map((tactic: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span>📈</span>
                    <span>{tactic}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
        {/* Momentum Analysis */}
        {(momentum.hottest_video_now || momentum.fastest_growing_topic || (momentum.emerging_trends || momentum.emerging_videos || []).length > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">⚡ Análise de Momentum em Tempo Real</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(momentum.hottest_video_now || momentum.fastest_growing_topic) && (
                <div className="text-xs">
                  <span className="font-medium text-success">🚀 Vídeo mais quente agora:</span>{" "}
                  <span>{momentum.hottest_video_now || momentum.fastest_growing_topic}</span>
                </div>
              )}
              {momentum.best_time_to_post && (
                <div className="text-xs">
                  <span className="font-medium text-primary">⏰ Melhor horário para postar:</span>{" "}
                  <span>{momentum.best_time_to_post}</span>
                </div>
              )}
              {(momentum.emerging_trends || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-success mb-1">🌱 Tendências EMERGENTES (máxima oportunidade):</p>
                  <div className="flex flex-wrap gap-1">
                    {(momentum.emerging_trends || []).map((t: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px] bg-success/10 text-success">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {(momentum.dying_trends || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-destructive mb-1">💀 Tendências MORRENDO (evitar):</p>
                  <div className="flex flex-wrap gap-1">
                    {(momentum.dying_trends || []).map((t: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px] bg-destructive/10 text-destructive">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}


        {(patterns.trending_hashtags || []).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium"># Hashtags Trending Agora</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {(patterns.trending_hashtags || []).map((tag: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PerformanceChart />
          <AgentStatus />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ContentQueue />
          <TopicsRanking />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
