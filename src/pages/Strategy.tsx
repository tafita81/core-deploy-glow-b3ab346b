import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Brain, TrendingUp, Target, Zap, Users, MessageCircle, Eye, ArrowRight, Sparkles, Clock } from "lucide-react";

const Strategy = () => {
  const { data: viralIntel } = useQuery({
    queryKey: ["viral-intelligence-strategy"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "viral_intelligence")
        .single();
      return data?.value as any;
    },
  });

  const { data: recentLogs } = useQuery({
    queryKey: ["strategy-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_logs")
        .select("*")
        .in("event_type", ["decisao", "pesquisa", "sistema", "snapshot"])
        .order("created_at", { ascending: false })
        .limit(10);
      return data;
    },
  });

  const { data: snapshots } = useQuery({
    queryKey: ["recent-snapshots"],
    queryFn: async () => {
      const { data } = await supabase
        .from("video_snapshots")
        .select("*")
        .order("snapshot_hour", { ascending: false })
        .limit(10);
      return data;
    },
  });

  const { data: contentStats } = useQuery({
    queryKey: ["content-stats-strategy"],
    queryFn: async () => {
      const { data } = await supabase.from("contents").select("status, score, channel");
      return data;
    },
  });

  const momentum = viralIntel?.momentum_analysis || {};
  const patterns = viralIntel?.viral_patterns || {};
  const monetization = viralIntel?.monetization_insights || {};
  const topBrasil = viralIntel?.top_10_ranking_brasil || viralIntel?.competitor_analysis || [];
  const topMundial = viralIntel?.world_ranking || [];

  const totalContents = contentStats?.length || 0;
  const published = contentStats?.filter((c: any) => c.status === "publicado").length || 0;
  const avgScore = totalContents
    ? Math.round(contentStats!.reduce((a: number, b: any) => a + (b.score || 0), 0) / totalContents)
    : 0;

  const steps = [
    {
      icon: Eye,
      title: "1. Pesquisa de Vídeos Virais",
      subtitle: "A cada hora, automaticamente",
      description: "O cérebro analisa os vídeos com MAIS MILHÕES de views no Instagram, YouTube e TikTok — tanto no Brasil quanto no mundo. Não olha apenas views totais: compara com a hora anterior para identificar quais vídeos estão CRESCENDO mais rápido.",
      detail: momentum.hottest_video_now || momentum.fastest_growing_topic || "Aguardando primeira análise...",
      detailLabel: "🔥 Vídeo mais quente agora",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: TrendingUp,
      title: "2. Ranking por Crescimento",
      subtitle: "Prioriza explosão de views",
      description: "Os vídeos são rankeados por crescimento real: um vídeo que ganhou +2M views na última hora vale mais que um com 10M parado. O sistema salva snapshots a cada hora para comparar e detectar o momento exato de explosão.",
      detail: topBrasil[0] ? `#1 Brasil: "${topBrasil[0].video_title || topBrasil[0].top_video_title || topBrasil[0].channel}" — ${topBrasil[0].total_views || topBrasil[0].growth_velocity || 'analisando'}` : "Aguardando ranking...",
      detailLabel: "📊 Top do ranking agora",
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      icon: Sparkles,
      title: "3. Geração de Conteúdo Inspirado",
      subtitle: "Replica padrões virais",
      description: "Com base nos vídeos que mais cresceram, o cérebro gera conteúdo adaptado para psicologia/saúde mental. Usa os mesmos ganchos, formatos e estratégias dos vídeos virais, mas com conteúdo científico e ético.",
      detail: `${totalContents} conteúdos gerados • Score médio: ${avgScore} • ${published} publicados`,
      detailLabel: "📝 Produção atual",
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: Target,
      title: "4. Publicação Multi-Plataforma",
      subtitle: "Instagram, YouTube, TikTok",
      description: "O conteúdo é publicado automaticamente nas 3 plataformas com CTAs específicos para cada uma. Inclui hashtags trending, horários otimizados e ganchos nos primeiros 3 segundos para maximizar retenção.",
      detail: patterns.best_posting_times?.[0] || "Horários sendo calculados...",
      detailLabel: "⏰ Melhor horário para postar",
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
    },
    {
      icon: Users,
      title: "5. Funil → Comunidade WhatsApp",
      subtitle: "Seguidores viram membros",
      description: "Todo conteúdo inclui CTAs para levar seguidores ao WhatsApp. Os vídeos terminam com convites para grupos temáticos (ansiedade, relacionamentos, autoconhecimento). O objetivo é criar uma comunidade engajada.",
      detail: monetization.community_growth_tactics?.[0] || "Estratégia de comunidade ativa",
      detailLabel: "💬 Tática de conversão",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      icon: MessageCircle,
      title: "6. Engajamento no WhatsApp",
      subtitle: "Conteúdo exclusivo nos grupos",
      description: "Nos grupos, o cérebro gera conversas, enquetes, desafios e dicas exclusivas baseadas nos temas virais do momento. Mantém os membros ativos e engajados, preparando-os para se tornarem clientes futuros.",
      detail: "Conversas, enquetes, dicas rápidas e desafios semanais",
      detailLabel: "🎯 Tipos de conteúdo WhatsApp",
      color: "text-teal-400",
      bgColor: "bg-teal-500/10",
    },
    {
      icon: Zap,
      title: "7. Monetização & Conversão 2027",
      subtitle: "Membros viram clientes",
      description: "A estratégia de longo prazo: até 2027, quando Daniela se formar, a comunidade já terá milhares de membros que a conhecem, confiam e querem consultas. A monetização começa com conteúdo premium e evolui para consultas online.",
      detail: monetization.revenue_streams?.[0] || "Consultoria online, conteúdo premium, workshops",
      detailLabel: "💰 Fontes de receita",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Como o Cérebro Funciona</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Entenda cada etapa da estratégia autônoma que está sendo executada agora em tempo real
          </p>
          <Badge variant="outline" className="animate-pulse-glow text-[10px]">
            🧠 Executando 24/7 automaticamente
          </Badge>
        </div>

        {/* Pipeline Steps */}
        <div className="space-y-4">
          {steps.map((step, i) => (
            <Card key={i} className="overflow-hidden border-l-4" style={{ borderLeftColor: `var(--${step.color.replace('text-', '')})` }}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg ${step.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                    <step.icon className={`h-5 w-5 ${step.color}`} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <h3 className="font-heading font-semibold text-sm">{step.title}</h3>
                      <p className="text-[11px] text-muted-foreground">{step.subtitle}</p>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      {step.description}
                    </p>
                    <div className="rounded-md bg-muted/50 p-2.5 space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground">{step.detailLabel}</p>
                      <p className="text-xs font-medium">{step.detail}</p>
                    </div>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex justify-center mt-3">
                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 rotate-90" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Live Activity */}
        {recentLogs && recentLogs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Atividade Recente do Cérebro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentLogs.slice(0, 6).map((log: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground text-[10px] min-w-[50px] shrink-0">
                    {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="truncate">{log.message}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Snapshots */}
        {snapshots && snapshots.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                📸 Últimos Snapshots de Vídeos Rastreados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {snapshots.slice(0, 5).map((s: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge variant="outline" className="text-[9px] shrink-0">
                    {s.region === "brasil" ? "🇧🇷" : "🌍"} {s.platform}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{s.video_title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      👁 {s.total_views} • 📈 {s.views_growth_1h} • ⚡{s.momentum_score}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(s.snapshot_hour).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Trending Hashtags */}
        {(patterns.trending_hashtags || []).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium"># Hashtags em Uso Agora</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {(patterns.trending_hashtags || []).slice(0, 15).map((tag: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Strategy;
