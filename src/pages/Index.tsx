import { useState } from "react";
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

  // ================= IA =================
  const [inputIA, setInputIA] = useState("");
  const [respostaIA, setRespostaIA] = useState("");
  const [loadingIA, setLoadingIA] = useState(false);

  async function enviarMensagem() {
    if (!inputIA) return;

    setLoadingIA(true);

    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: inputIA
        })
      });

      const data = await res.json();
      setRespostaIA(data.output);
    } catch (err) {
      setRespostaIA("Erro ao processar IA");
    }

    setLoadingIA(false);
  }

  // ================= DADOS =================

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
    refetchInterval: 60000,
  });

  const published = contents?.filter((c) => c.status === "publicado").length ?? 0;
  const pending = contents?.filter((c) => c.status !== "publicado" && c.status !== "rejeitado").length ?? 0;
  const avgScore = contents?.length ? Math.round(contents.reduce((a, b) => a + (b.score ?? 0), 0) / contents.length) : 0;

  const monetization = viralIntel?.monetization_insights || {};
  const evolution = monetization?.algorithm_evolution || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ================= IA ================= */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              🧠 Assistente Psicológico IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            
            <input
              value={inputIA}
              onChange={(e) => setInputIA(e.target.value)}
              placeholder="Digite algo como: estou ansioso..."
              className="w-full p-2 rounded bg-background border text-sm"
            />

            <button
              onClick={enviarMensagem}
              className="w-full p-2 bg-primary text-white rounded text-sm"
            >
              {loadingIA ? "Pensando..." : "Analisar"}
            </button>

            {respostaIA && (
              <div className="text-xs bg-muted/30 p-2 rounded">
                {respostaIA}
              </div>
            )}

          </CardContent>
        </Card>

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Dashboard Viral Extremo</h1>
            <p className="text-sm text-muted-foreground mt-1">
              🧬 Gen {evolution.generation || 0}
            </p>
          </div>
          <Badge variant="outline">🧬 Auto-Evolving</Badge>
        </div>

        <PendingActions />

        {/* MÉTRICAS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard title="Gerados" value={String(contents?.length ?? 0)} icon={Eye} />
          <MetricCard title="Publicados" value={String(published)} icon={Zap} />
          <MetricCard title="Score Médio" value={String(avgScore)} icon={TrendingUp} />
          <MetricCard title="Seguidores" value={`${monetization.avg_follower_conversion || 0}%`} icon={Users} />
          <MetricCard title="Comentários" value={`${monetization.avg_comment_rate || 0}%`} icon={Target} />
          <MetricCard title="Revenue" value="$0" icon={DollarSign} />
        </div>

        {/* GRÁFICOS */}
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