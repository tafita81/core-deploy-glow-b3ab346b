import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Sparkles, FlaskConical, Shield, Loader2, Image, Volume2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ContentPage() {
  const [topic, setTopic] = useState("");
  const [channel, setChannel] = useState("");
  const [contentType, setContentType] = useState("carrossel");
  const [instructions, setInstructions] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: { topic, channel, content_type: contentType, instructions },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const content = data.content;

      if (content?.id) {
        toast({ title: "🎨 Gerando mídia..." });
        await supabase.functions.invoke("generate-media", { body: { content_id: content.id } });
        toast({ title: "🔬 Validando cientificamente..." });
        await supabase.functions.invoke("validate-science", { body: { content_id: content.id } });
        toast({ title: "⚖️ Validando eticamente..." });
        await supabase.functions.invoke("validate-ethics", { body: { content_id: content.id } });
      }

      return content;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contents"] });
      queryClient.invalidateQueries({ queryKey: ["contents-queue"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-contents"] });
      toast({ title: "✨ Conteúdo gerado com mídia e validado!" });
      setTopic("");
      setChannel("");
      setInstructions("");
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao gerar conteúdo", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-contents"] });
      toast({ title: "🗑️ Conteúdo excluído" });
    },
  });

  const deleteAllPublishedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contents").delete().eq("status", "publicado");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-contents"] });
      toast({ title: "🗑️ Todos os conteúdos publicados foram excluídos" });
    },
  });

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

  const publishedCount = contents?.filter((c) => c.status === "publicado").length ?? 0;

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Geração de Conteúdo</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gere conteúdo viral com imagem, narração e validação automática
            </p>
          </div>
          {publishedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteAllPublishedMutation.mutate()}
              disabled={deleteAllPublishedMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {deleteAllPublishedMutation.isPending
                ? "Excluindo..."
                : `Excluir ${publishedCount} publicados`}
            </Button>
          )}
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
                  <SelectTrigger><SelectValue placeholder="Selecione um tema" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ansiedade">Ansiedade</SelectItem>
                    <SelectItem value="relacionamentos">Relacionamentos</SelectItem>
                    <SelectItem value="trauma">Trauma & PTSD</SelectItem>
                    <SelectItem value="autoestima">Autoestima</SelectItem>
                    <SelectItem value="burnout">Burnout</SelectItem>
                    <SelectItem value="inteligencia-emocional">Inteligência Emocional</SelectItem>
                    <SelectItem value="parentalidade">Parentalidade Consciente</SelectItem>
                    <SelectItem value="luto">Luto e Perdas</SelectItem>
                    <SelectItem value="narcisismo">Narcisismo</SelectItem>
                    <SelectItem value="apego">Apego e Relacionamentos</SelectItem>
                    <SelectItem value="dopamina">Dopamina e Foco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Canal</label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger><SelectValue placeholder="Tipo de conteúdo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carrossel">Carrossel</SelectItem>
                    <SelectItem value="reel">Reel / Vídeo Curto</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="artigo">Artigo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea
              placeholder="Instruções adicionais (opcional)..."
              className="min-h-[80px]"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
            <Button
              className="bg-gradient-primary text-primary-foreground"
              onClick={() => generateMutation.mutate()}
              disabled={!topic || !channel || generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              {generateMutation.isPending ? "Gerando conteúdo viral..." : "Gerar Viral com IA"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">
            Conteúdo Gerado ({contents?.length ?? 0})
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            contents?.map((item) => {
              const status = statusMap[item.status] || statusMap.rascunho;
              const thumbUrl = (item as any).thumbnail_url;
              const audioUrl = (item as any).audio_url;
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <h3 className="font-medium text-sm">{item.title}</h3>

                    {thumbUrl && (
                      <div className="rounded-lg overflow-hidden border">
                        <img src={thumbUrl} alt={item.title} className="w-full h-48 object-cover" />
                      </div>
                    )}

                    {item.body && (
                      <details className="group">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Ver conteúdo completo
                        </summary>
                        <div className="rounded-lg bg-muted/50 p-4 mt-2">
                          <pre className="text-sm whitespace-pre-wrap font-sans">{item.body}</pre>
                        </div>
                      </details>
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
                      {thumbUrl && (
                        <div className="flex items-center gap-1.5">
                          <Image className="h-4 w-4 text-success" />
                          <span className="text-xs">Imagem ✓</span>
                        </div>
                      )}
                      {audioUrl && (
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="h-4 w-4 text-success" />
                          <span className="text-xs">Narração ✓</span>
                        </div>
                      )}
                      {item.status === "publicado" ? (
                        <Badge variant="default" className="ml-auto text-[10px]">
                          ✅ Publicado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          ⏳ Pipeline automático
                        </Badge>
                      )}
                    </div>

                    {audioUrl && (
                      <audio controls className="w-full h-8" src={audioUrl}>
                        Seu navegador não suporta áudio.
                      </audio>
                    )}
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
