import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Clock, Eye, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const statusConfig: Record<string, { label: string; variant: "outline" | "default" | "destructive"; icon: typeof Clock }> = {
  rascunho: { label: "Rascunho", variant: "outline", icon: Clock },
  revisao: { label: "Pendente", variant: "outline", icon: Clock },
  aprovado: { label: "Aprovado", variant: "default", icon: Check },
  publicado: { label: "Publicado", variant: "default", icon: Check },
  rejeitado: { label: "Rejeitado", variant: "destructive", icon: X },
};

export function ContentQueue() {
  const queryClient = useQueryClient();

  const { data: contents, isLoading } = useQuery({
    queryKey: ["contents-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contents")
        .select("*")
        .in("status", ["rascunho", "revisao", "aprovado"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("contents").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contents-queue"] });
      queryClient.invalidateQueries({ queryKey: ["contents"] });
    },
  });

  return (
    <Card className="animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="font-heading text-lg">Fila de Conteúdo</CardTitle>
        <Badge variant="secondary" className="text-xs">
          {contents?.filter((c) => c.status === "revisao" || c.status === "rascunho").length ?? 0} pendentes
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : contents?.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum conteúdo na fila</p>
        ) : (
          contents?.map((item) => {
            const config = statusConfig[item.status] || statusConfig.rascunho;
            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {item.channel || "—"}
                    </Badge>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {item.content_type}
                    </Badge>
                    <span className="text-sm font-medium truncate">
                      {item.topic || item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">Score:</span>
                    <span
                      className={`text-xs font-bold ${
                        (item.score ?? 0) >= 80
                          ? "text-success"
                          : (item.score ?? 0) >= 60
                          ? "text-warning"
                          : "text-destructive"
                      }`}
                    >
                      {item.score ?? 0}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.title}
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant={config.variant} className="text-[10px]">
                    <config.icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                  {(item.status === "revisao" || item.status === "rascunho") && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-success hover:text-success"
                        onClick={() => updateStatus.mutate({ id: item.id, status: "aprovado" })}
                      >
                        <Check className="h-3 w-3 mr-1" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => updateStatus.mutate({ id: item.id, status: "rejeitado" })}
                      >
                        <X className="h-3 w-3 mr-1" /> Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
