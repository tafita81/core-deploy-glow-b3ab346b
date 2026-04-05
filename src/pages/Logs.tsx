import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const levelConfig = {
  info: { color: "text-info", bg: "bg-info/10", icon: Brain },
  warning: { color: "text-warning", bg: "bg-warning/10", icon: AlertTriangle },
  error: { color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
};

export default function LogsPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["system_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Logs do Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe a execução dos agentes em tempo real
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-heading text-lg">Execução Recente</CardTitle>
            <Badge variant="outline" className="text-xs">
              {logs?.length ?? 0} registros
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
                  {logs?.map((log) => {
                    const config = levelConfig[log.level as keyof typeof levelConfig] || levelConfig.info;
                    const time = new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-muted/50 animate-fade-in"
                      >
                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5 shrink-0 w-16">
                          {time}
                        </span>
                        <div className={`rounded p-1 shrink-0 ${config.bg}`}>
                          <config.icon className={`h-3 w-3 ${config.color}`} />
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
