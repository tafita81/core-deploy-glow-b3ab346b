import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, CheckCircle2, AlertTriangle, XCircle, Loader2, TrendingUp, Dna } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const levelConfig = {
  info: { color: "text-info", bg: "bg-info/10", icon: Brain },
  warning: { color: "text-warning", bg: "bg-warning/10", icon: AlertTriangle },
  error: { color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
};

type LogFilter = "all" | "algorithm_evolution" | "api_calls" | "decisions" | "errors";

export default function LogsPage() {
  const [filter, setFilter] = useState<LogFilter>("all");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["system_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  // Algorithm evolution logs
  const { data: evolutionLogs } = useQuery({
    queryKey: ["evolution-logs-page"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_logs")
        .select("*")
        .eq("event_type", "algorithm_evolution")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  // Learning weights
  const { data: learningWeights } = useQuery({
    queryKey: ["learning-weights-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "learning_weights")
        .single();
      return data?.value as any;
    },
  });

  // API usage stats
  const apiCallLogs = logs?.filter((l) => l.event_type?.startsWith("api_call_")) || [];
  const apiStats: Record<string, number> = {};
  apiCallLogs.forEach((l) => {
    const api = l.event_type?.replace("api_call_", "") || "unknown";
    apiStats[api] = (apiStats[api] || 0) + 1;
  });

  const filteredLogs = logs?.filter((log) => {
    if (filter === "all") return true;
    if (filter === "algorithm_evolution") return log.event_type === "algorithm_evolution";
    if (filter === "api_calls") return log.event_type?.startsWith("api_call_");
    if (filter === "decisions") return ["decisao", "pesquisa", "sistema"].includes(log.event_type || "");
    if (filter === "errors") return log.level === "error" || log.level === "warning";
    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Logs do Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe a execucao dos agentes em tempo real
          </p>
        </div>

        {/* Algorithm Evolution Summary */}
        {learningWeights && (
          <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Dna className="h-4 w-4 text-purple-400" />
                Algoritmo Auto-Evolutivo — Geracao {learningWeights.evolution_generation || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <div className="bg-muted/30 rounded-md p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Comment Weight</p>
                  <p className="text-sm font-bold text-purple-400">{learningWeights.comment_weight || 3}x</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Engagement Power</p>
                  <p className="text-sm font-bold text-purple-400">{learningWeights.engagement_power || 1.0}x</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Duracao Ideal</p>
                  <p className="text-sm font-bold text-blue-400">{learningWeights.optimal_duration_min || 8}-{learningWeights.optimal_duration_max || 20}min</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Views/Dia Target</p>
                  <p className="text-sm font-bold text-green-400">{(learningWeights.avg_views_per_day_target || 0) >= 1000 ? `${Math.round((learningWeights.avg_views_per_day_target || 0) / 1000)}K` : learningWeights.avg_views_per_day_target || 0}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(learningWeights.top_hooks || []).map((h: string, i: number) => (
                  <Badge key={`h-${i}`} variant="secondary" className="text-[9px] bg-purple-500/10 text-purple-400">Hook: {h}</Badge>
                ))}
                {(learningWeights.top_topics || []).map((t: string, i: number) => (
                  <Badge key={`t-${i}`} variant="secondary" className="text-[9px] bg-green-500/10 text-green-400">{t}</Badge>
                ))}
                {(learningWeights.top_formats || []).map((f: string, i: number) => (
                  <Badge key={`f-${i}`} variant="secondary" className="text-[9px] bg-blue-500/10 text-blue-400">{f}</Badge>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground mt-2">
                Ultima evolucao: {learningWeights.last_evolved ? new Date(learningWeights.last_evolved).toLocaleString("pt-BR") : "Aguardando..."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* API Usage Summary */}
        {Object.keys(apiStats).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(apiStats).map(([api, count]) => (
              <Card key={api} className="bg-muted/20">
                <CardContent className="py-3 text-center">
                  <p className="text-xs font-bold capitalize">{api}</p>
                  <p className="text-lg font-bold text-primary">{count}</p>
                  <p className="text-[9px] text-muted-foreground">chamadas hoje</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Evolution History */}
        {evolutionLogs && evolutionLogs.length > 0 && (
          <Card className="border-purple-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-400" />
                Historico de Evolucoes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {evolutionLogs.map((log: any, i: number) => (
                  <div key={log.id || i} className="rounded-md bg-muted/30 p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium truncate flex-1">{log.message}</p>
                      <Badge variant="outline" className="text-[8px] shrink-0 ml-2">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </Badge>
                    </div>
                    {log.metadata && (
                      <div className="flex flex-wrap gap-1">
                        {log.metadata.top_hooks?.map((h: string, j: number) => (
                          <Badge key={`h-${j}`} variant="secondary" className="text-[8px] bg-purple-500/10 text-purple-400">{h}</Badge>
                        ))}
                        {log.metadata.top_topics?.slice(0, 3).map((t: string, j: number) => (
                          <Badge key={`t-${j}`} variant="secondary" className="text-[8px] bg-green-500/10 text-green-400">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter buttons */}
        <div className="flex gap-2 flex-wrap">
          {([
            { key: "all", label: "Todos" },
            { key: "algorithm_evolution", label: "Evolucao" },
            { key: "api_calls", label: "APIs" },
            { key: "decisions", label: "Decisoes" },
            { key: "errors", label: "Erros" },
          ] as { key: LogFilter; label: string }[]).map(({ key, label }) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-heading text-lg">Execucao Recente</CardTitle>
            <Badge variant="outline" className="text-xs">
              {filteredLogs?.length ?? 0} registros
            </Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-1">
                  {filteredLogs?.map((log) => {
                    const config = levelConfig[log.level as keyof typeof levelConfig] || levelConfig.info;
                    const time = new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    const isEvolution = log.event_type === "algorithm_evolution";
                    return (
                      <div
                        key={log.id}
                        className={`flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-muted/50 animate-fade-in ${isEvolution ? "border-l-2 border-purple-500/50" : ""}`}
                      >
                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5 shrink-0 w-16">
                          {time}
                        </span>
                        <div className={`rounded p-1 shrink-0 ${isEvolution ? "bg-purple-500/10" : config.bg}`}>
                          {isEvolution ? (
                            <Dna className="h-3 w-3 text-purple-400" />
                          ) : (
                            <config.icon className={`h-3 w-3 ${config.color}`} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-medium text-muted-foreground capitalize">
                            {log.event_type}
                          </span>
                          <p className="text-sm">{log.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
