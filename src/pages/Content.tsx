import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Sparkles, FlaskConical, Shield, Send, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ContentPage() {
  const [topic, setTopic] = useState("");
  const [channel, setChannel] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contents, isLoading } = useQuery({
    queryKey: ["contents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contents")
        .update({ status: "publicado", published_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contents"] });
      toast({ title: "Conteúdo publicado com sucesso!" });
    },
  });

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    rascunho: { label: "Rascunho", variant: "secondary" },
    revisao: { label: "Em Revisão", variant: "outline" },
    aprovado: { label: "Aprovado", variant: "default" },
    publicado: { label: "Publicado", variant: "default" },
    rejeitado: { label: "Rejeitado", variant: "destructive" },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Geração de Conteúdo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere, valide e aprove conteúdo automaticamente
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Gerar Novo Conteúdo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tema</label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um tema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ansiedade">Ansiedade</SelectItem>
                    <SelectItem value="relacionamentos">Relacionamentos</SelectItem>
                    <SelectItem value="trauma">Trauma & PTSD</SelectItem>
                    <SelectItem value="autoestima">Autoestima</SelectItem>
                    <SelectItem value="burnout">Burnout</SelectItem>
                    <SelectItem value="inteligencia-emocional">Inteligência Emocional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Canal</label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea placeholder="Instruções adicionais (opcional)..." className="min-h-[80px]" />
            <Button className="bg-gradient-primary text-primary-foreground">
              <Brain className="h-4 w-4 mr-2" />
              Gerar com IA
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Conteúdo Gerado</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            contents?.map((item) => {
              const status = statusMap[item.status] || statusMap.rascunho;
              return (
                <Card key={item.id} className="hover:glow-primary transition-shadow">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{item.channel || "—"}</Badge>
                      <Badge variant="outline">{item.content_type}</Badge>
                      <Badge variant="outline">{item.topic || "—"}</Badge>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Score:</span>
                        <span className={`text-sm font-bold ${(item.score ?? 0) >= 80 ? "text-success" : (item.score ?? 0) >= 60 ? "text-warning" : "text-destructive"}`}>
                          {item.score ?? 0}
                        </span>
                      </div>
                    </div>
                    {item.body && (
                      <div className="rounded-lg bg-muted/50 p-4">
                        <pre className="text-sm whitespace-pre-wrap font-sans">{item.body}</pre>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <FlaskConical className={`h-4 w-4 ${item.scientific_valid ? "text-success" : "text-destructive"}`} />
                        <span className="text-xs">Ciência {item.scientific_valid ? "✓" : "✗"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Shield className={`h-4 w-4 ${item.ethics_valid ? "text-success" : "text-destructive"}`} />
                        <span className="text-xs">Ética {item.ethics_valid ? "✓" : "✗"}</span>
                      </div>
                      {item.status !== "publicado" && (
                        <div className="ml-auto flex gap-2">
                          <Button
                            size="sm"
                            className="bg-gradient-primary text-primary-foreground"
                            onClick={() => publishMutation.mutate(item.id)}
                            disabled={publishMutation.isPending}
                          >
                            <Send className="h-3 w-3 mr-1" /> Publicar
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
