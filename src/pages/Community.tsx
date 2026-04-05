import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle, Users, Plus, Send, Sparkles, Trash2 } from "lucide-react";

const GROUP_TYPES = [
  { value: "geral", label: "🏠 Geral", desc: "Grupo principal da comunidade" },
  { value: "ansiedade", label: "🧘 Ansiedade", desc: "Autocuidado e gestão emocional" },
  { value: "relacionamentos", label: "💕 Relacionamentos", desc: "Apego e vínculos" },
  { value: "autoconhecimento", label: "🧠 Autoconhecimento", desc: "Desenvolvimento pessoal" },
  { value: "estudantes", label: "📚 Estudantes", desc: "Comunidade de estudantes de psicologia" },
];

const CONTENT_TYPES = ["conversa", "enquete", "desafio", "exclusivo", "dica_rapida", "bastidores", "recomendacao"];

const Community = () => {
  const queryClient = useQueryClient();

  const { data: groups } = useQuery({
    queryKey: ["whatsapp-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_groups").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: whatsappContent } = useQuery({
    queryKey: ["whatsapp-content"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_content").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (groupType: string) => {
      const info = GROUP_TYPES.find((g) => g.value === groupType) || GROUP_TYPES[0];
      const { error } = await supabase.from("whatsapp_groups").insert({
        name: info.label,
        description: info.desc,
        group_type: groupType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-groups"] });
      toast.success("Grupo criado!");
    },
  });

  const generateMutation = useMutation({
    mutationFn: async ({ groupType, contentType }: { groupType: string; contentType: string }) => {
      const { data, error } = await supabase.functions.invoke("generate-whatsapp-content", {
        body: { group_type: groupType, content_type: contentType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-content"] });
      toast.success("Conteúdo WhatsApp gerado!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_content").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-content"] });
      toast.success("Removido!");
    },
  });

  const totalMembers = groups?.reduce((a, b) => a + (b.members_count || 0), 0) || 0;
  const activeGroups = groups?.filter((g) => g.is_active).length || 0;
  const pendingContent = whatsappContent?.filter((c) => c.status === "rascunho").length || 0;

  const parseBody = (body: string | null) => {
    if (!body) return null;
    try { return JSON.parse(body); } catch { return { message: body }; }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">📱 Comunidade WhatsApp</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Funil: Redes Sociais → WhatsApp → Clientes 2027
            </p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {activeGroups} grupos • {totalMembers} membros
          </Badge>
        </div>

        {/* Strategy Banner */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3">
            <p className="text-xs leading-relaxed">
              <strong>🎯 Estratégia:</strong> Cada vídeo viral nas redes traz seguidores → CTA leva para comunidade WhatsApp → 
              Conteúdo exclusivo + interação cria VÍNCULO → Em 2027 (formatura), membros viram clientes de consultas online da Daniela. 
              <span className="text-primary font-medium"> Meta: 10.000+ membros engajados até 2027.</span>
            </p>
          </CardContent>
        </Card>

        {/* Groups */}
        <div>
          <h2 className="text-sm font-medium mb-3">Grupos da Comunidade</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {GROUP_TYPES.map((gt) => {
              const existing = groups?.find((g) => g.group_type === gt.value);
              return (
                <Card key={gt.value} className={`${existing ? "border-success/30" : "border-dashed opacity-60"}`}>
                  <CardContent className="p-3 text-center">
                    <p className="text-sm font-medium">{gt.label}</p>
                    <p className="text-[10px] text-muted-foreground">{gt.desc}</p>
                    {existing ? (
                      <p className="text-xs mt-1 text-success">{existing.members_count} membros</p>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-6 text-[10px]"
                        onClick={() => createGroupMutation.mutate(gt.value)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Criar
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Generate Content */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Gerar Conteúdo para WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_TYPES.map((ct) => (
                <Button
                  key={ct}
                  size="sm"
                  variant="outline"
                  className="text-[10px] h-7"
                  disabled={generateMutation.isPending}
                  onClick={() => generateMutation.mutate({ groupType: "geral", contentType: ct })}
                >
                  {ct === "conversa" && "💬"}
                  {ct === "enquete" && "📊"}
                  {ct === "desafio" && "🏆"}
                  {ct === "exclusivo" && "⭐"}
                  {ct === "dica_rapida" && "💡"}
                  {ct === "bastidores" && "🎬"}
                  {ct === "recomendacao" && "📖"}
                  {" "}{ct}
                </Button>
              ))}
            </div>
            {generateMutation.isPending && (
              <p className="text-xs text-muted-foreground mt-2 animate-pulse">Gerando conteúdo...</p>
            )}
          </CardContent>
        </Card>

        {/* Content Queue */}
        <div>
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Conteúdos WhatsApp ({whatsappContent?.length || 0})
            {pendingContent > 0 && <Badge variant="secondary" className="text-[10px]">{pendingContent} pendentes</Badge>}
          </h2>
          <div className="space-y-2">
            {whatsappContent?.slice(0, 20).map((item) => {
              const parsed = parseBody(item.body);
              return (
                <Card key={item.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge variant="outline" className="text-[9px]">{item.content_type}</Badge>
                          <Badge
                            variant={item.status === "publicado" ? "default" : "secondary"}
                            className="text-[9px]"
                          >
                            {item.status}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium">{item.title}</p>
                        {parsed?.message && (
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-3 whitespace-pre-line">
                            {parsed.message.slice(0, 200)}...
                          </p>
                        )}
                        {parsed?.engagement_hook && (
                          <p className="text-[10px] text-primary mt-1">💬 {parsed.engagement_hook}</p>
                        )}
                        {parsed?.best_time && (
                          <p className="text-[10px] text-muted-foreground">⏰ Melhor horário: {parsed.best_time}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 shrink-0 text-destructive"
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {(!whatsappContent || whatsappContent.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhum conteúdo WhatsApp ainda. Gere acima! ☝️
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Community;
