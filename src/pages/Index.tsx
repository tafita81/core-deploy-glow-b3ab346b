import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { ContentQueue } from "@/components/ContentQueue";
import { PerformanceChart } from "@/components/PerformanceChart";
import { AgentStatus } from "@/components/AgentStatus";
import { TopicsRanking } from "@/components/TopicsRanking";
import { PendingActions } from "@/components/PendingActions";
import { VideoRankingCard } from "@/components/VideoRankingCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Zap, TrendingUp, Target, Users, DollarSign, Lightbulb, Brain } from "lucide-react";
import { Link } from "react-router-dom";
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
      const { data } = await supabase.from("settings").select("value").eq("key", "viral_intelligence").single();
      return data?.value as any;
    },
    refetchInterval: 60000, // Real-time: refresh every 60s
  });

  const published = contents?.filter((c) => c.status === "publicado").length ?? 0;
  const pending = contents?.filter((c) => c.status !== "publicado" && c.status !== "rejeitado").length ?? 0;
  const avgScore = contents?.length ? Math.round(contents.reduce((a, b) => a + (b.score ?? 0), 0) / contents.length) : 0;
  const viralReady = contents?.filter((c) => (c.score ?? 0) >= 85).length ?? 0;

  const topVideosBrasil = viralIntel?.top_10_ranking_brasil || viralIntel?.competitor_analysis || [];
  const topVideosMundial = viralIntel?.world_ranking || [];
  const monetization = viralIntel?.monetization_insights || {};
  const patterns = viralIntel?.viral_patterns || {};
  const redditTrending = viralIntel?.reddit_trending || [];
  const newsTrending = viralIntel?.news_trending || [];
  const dataSources = viralIntel?.data_sources || [];
  const rankingCriteria = viralIntel?.ranking_criteria || {};
  const evolution = monetization?.algorithm_evolution || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Dashboard Viral Extremo</h1>
            <p className="text-sm text-muted-foreground mt-1">
              🧬 Algoritmo Auto-Evolutivo v4 (Gen {evolution.generation || 0}) — Máxima monetização + seguidores + engajamento
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] animate-pulse-glow">
            🧬 Auto-Evolving
          </Badge>
        </div>

        <Link to="/strategy">
          <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20 hover:border-primary/40 transition-all cursor-pointer group">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-heading text-sm font-semibold">Entenda a Estratégia do Cérebro</h3>
                <p className="text-[11px] text-muted-foreground">Veja como cada etapa funciona em tempo real — explicação simples e didática</p>
              </div>
              <TrendingUp className="h-4 w-4 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <PendingActions />

        {/* EXTREME METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard title="Gerados" value={String(contents?.length ?? 0)} change="Total" changeType="neutral" icon={Eye} iconColor="bg-primary/10 text-primary" />
          <MetricCard title="Publicados" value={String(published)} change={`${pending} pendentes`} changeType="positive" icon={Zap} iconColor="bg-success/10 text-success" />
          <MetricCard title="Score Médio" value={String(avgScore)} change={avgScore >= 85 ? "🔥 Viral" : avgScore >= 75 ? "✓ Bom" : "↑ Melhorar"} changeType={avgScore >= 75 ? "positive" : "negative"} icon={TrendingUp} iconColor="bg-warning/10 text-warning" />
          <MetricCard title="Conv. Seguidores" value={`${monetization.avg_follower_conversion || 0}%`} change="Média dos virais" changeType="positive" icon={Users} iconColor="bg-accent/50 text-accent-foreground" />
          <MetricCard title="💬 Comment Rate" value={`${monetization.avg_comment_rate || 0}%`} change="Média virais" changeType="positive" icon={Target} iconColor="bg-destructive/10 text-destructive" />
          <MetricCard title="💵 Revenue Mkt" value={monetization.total_market_revenue ? `$${(monetization.total_market_revenue / 1000).toFixed(0)}K` : "$0"} change="Estimado total" changeType="positive" icon={DollarSign} iconColor="bg-primary/10 text-primary" />
        </div>

        {/* ALGORITHM EVOLUTION CARD */}
        {evolution.generation > 0 && (
          <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-400" />
                🧬 Motor de Evolução Autônoma — Geração {evolution.generation}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground">Peso dos Comentários</p>
                  <p className="font-bold text-primary">{evolution.comment_weight}x</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground">Poder do Engajamento</p>
                  <p className="font-bold text-primary">{evolution.engagement_power}x</p>
                </div>
              </div>
              {(evolution.learned_hooks || []).length > 0 && (
                <div className="text-xs">
                  <p className="text-muted-foreground mb-1">🎯 Hooks aprendidos (mais eficazes):</p>
                  <div className="flex flex-wrap gap-1">
                    {(evolution.learned_hooks || []).map((h: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[9px] bg-purple-500/10 text-purple-400">{h}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {(evolution.learned_topics || []).length > 0 && (
                <div className="text-xs">
                  <p className="text-muted-foreground mb-1">🏆 Tópicos que mais performam:</p>
                  <div className="flex flex-wrap gap-1">
                    {(evolution.learned_topics || []).map((t: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[9px] bg-green-500/10 text-green-400">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[9px] text-muted-foreground">Última evolução: {evolution.last_evolved ? new Date(evolution.last_evolved).toLocaleString("pt-BR") : "—"}</p>
            </CardContent>
          </Card>
        )}

        {/* VIRAL RANKINGS */}
        {(topVideosMundial.length > 0 || topVideosBrasil.length > 0 || (monetization.revenue_streams || []).length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VideoRankingCard
              title="🌍 Top Vídeos Mundial — Psicologia"
              priorityBadge="⭐ Prioridade"
              videos={topVideosMundial}
              maxVideos={15}
              updatedAt={viralIntel?.updated_at}
              rankingInfo={rankingCriteria}
            />
            <VideoRankingCard
              title="🇧🇷 Top Vídeos Brasil — Psicologia"
              videos={topVideosBrasil}
              maxVideos={10}
              updatedAt={viralIntel?.updated_at}
              rankingInfo={rankingCriteria}
            />

            {/* MONETIZATION INTELLIGENCE */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  💰 Inteligência de Monetização Extrema
                  {monetization.avg_viral_score > 0 && (
                    <Badge variant="secondary" className="text-[9px]">
                      Viral Score: {monetization.avg_viral_score > 1000000 ? `${(monetization.avg_viral_score / 1000000).toFixed(1)}M` : monetization.avg_viral_score > 1000 ? `${(monetization.avg_viral_score / 1000).toFixed(0)}K` : monetization.avg_viral_score}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {monetization.best_format && (
                  <div className="flex items-center gap-2 text-xs bg-primary/5 rounded-md p-2">
                    <span>🏆</span>
                    <span className="font-medium">Formato mais viral: {monetization.best_format}</span>
                  </div>
                )}
                {monetization.best_hook_pattern && (
                  <div className="flex items-center gap-2 text-xs bg-primary/5 rounded-md p-2">
                    <span>🎯</span>
                    <span className="font-medium">Hook mais eficaz: {monetization.best_hook_pattern}</span>
                  </div>
                )}
                {monetization.ideal_duration && (
                  <div className="flex items-center gap-2 text-xs bg-primary/5 rounded-md p-2">
                    <span>⏳</span>
                    <span className="font-medium">Duração ideal: {monetization.ideal_duration}</span>
                  </div>
                )}
                {(monetization.best_topics || []).length > 0 && (
                  <div className="text-xs bg-green-500/5 rounded-md p-2">
                    <span className="font-medium">🔥 Tópicos explosivos: </span>
                    <span>{(monetization.best_topics || []).join(", ")}</span>
                  </div>
                )}
                {(monetization.revenue_streams || []).map((stream: string, i: number) => (
                  <div key={`rev-${i}`} className="flex items-center gap-2 text-xs">
                    <span className="text-success">💵</span>
                    <span>{stream}</span>
                  </div>
                ))}
                {(monetization.community_growth_tactics || []).map((tactic: string, i: number) => (
                  <div key={`tac-${i}`} className="flex items-center gap-2 text-xs">
                    <span>📈</span>
                    <span>{tactic}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* FOLLOWER GROWTH STRATEGY */}
            <Card className="border-blue-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  🧲 Estratégia Extrema de Seguidores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="bg-blue-500/5 rounded-md p-2 space-y-1">
                  <p className="font-semibold text-blue-400">📊 Métricas que Convertem em Seguidores:</p>
                  <p>• Comment Rate médio dos virais: <span className="text-primary font-bold">{monetization.avg_comment_rate || 0}%</span></p>
                  <p>• Like Rate médio: <span className="text-primary font-bold">{monetization.avg_like_rate || 0}%</span></p>
                  <p>• Score médio de conversão: <span className="text-primary font-bold">{monetization.avg_follower_conversion || 0}%</span></p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">🎯 Táticas de Conversão Extrema:</p>
                  <p>• CTA de follow no segundo 3 (antes de perder atenção)</p>
                  <p>• Pinned comment com pergunta provocativa</p>
                  <p>• "Siga para parte 2" no final (séries = retenção)</p>
                  <p>• Responder TODOS os comentários nas primeiras 2h</p>
                  <p>• Criar polêmica saudável (mais comentários = mais alcance)</p>
                  <p>• Thumbnail com expressão facial extrema + texto bold</p>
                  <p>• Títulos com números: "5 sinais de que..." converte mais</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Reddit & News */}
        {(redditTrending.length > 0 || newsTrending.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {redditTrending.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">🟠 Reddit — Trending em Psicologia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {redditTrending.slice(0, 8).map((p: any, i: number) => (
                    <div key={i} onClick={() => window.open(p.url, "_blank")} className="flex items-start gap-2 text-xs hover:bg-muted/50 rounded-md p-1.5 -mx-1.5 cursor-pointer">
                      <span className="font-bold text-primary min-w-[20px]">⬆{p.score}</span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground">r/{p.subreddit} • {p.comments} comentários</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {newsTrending.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">📰 Notícias — Saúde Mental</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {newsTrending.slice(0, 8).map((n: any, i: number) => (
                    <div key={i} onClick={() => window.open(n.url, "_blank")} className="flex items-start gap-2 text-xs hover:bg-muted/50 rounded-md p-1.5 -mx-1.5 cursor-pointer">
                      <span className="text-primary">📄</span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{n.title}</p>
                        <p className="text-[10px] text-muted-foreground">{n.source}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Hashtags + Data Sources */}
        {(patterns.trending_hashtags || []).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium"># Hashtags Trending Agora</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {(patterns.trending_hashtags || []).map((tag: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {dataSources.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Fontes ativas:</span>
            {dataSources.map((s: string) => (
              <Badge key={s} variant="outline" className="text-[9px]">✅ {s}</Badge>
            ))}
            <Badge variant="outline" className="text-[9px] border-purple-500/50 text-purple-400">🧬 Gen {evolution.generation || 0}</Badge>
          </div>
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
