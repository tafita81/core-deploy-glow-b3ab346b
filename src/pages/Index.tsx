import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { ContentQueue } from "@/components/ContentQueue";
import { PerformanceChart } from "@/components/PerformanceChart";
import { AgentStatus } from "@/components/AgentStatus";
import { TopicsRanking } from "@/components/TopicsRanking";
import { PendingActions } from "@/components/PendingActions";
import { Badge } from "@/components/ui/badge";
import { Eye, Zap, TrendingUp } from "lucide-react";
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

  const published = contents?.filter((c) => c.status === "publicado").length ?? 0;
  const pending = contents?.filter((c) => c.status !== "publicado" && c.status !== "rejeitado").length ?? 0;
  const avgScore = contents?.length
    ? Math.round(contents.reduce((a, b) => a + (b.score ?? 0), 0) / contents.length)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sistema 100% autônomo — pipeline roda a cada 6h
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] animate-pulse-glow">
            🟢 Automático 24/7
          </Badge>
        </div>

        {/* Pending actions - what user needs to configure */}
        <PendingActions />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            title="Conteúdos Gerados"
            value={String(contents?.length ?? 0)}
            change="Total no sistema"
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
            change={avgScore >= 75 ? "Acima do mínimo" : "Abaixo do mínimo"}
            changeType={avgScore >= 75 ? "positive" : "negative"}
            icon={TrendingUp}
            iconColor="bg-warning/10 text-warning"
          />
        </div>

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