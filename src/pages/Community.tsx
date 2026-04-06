import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle, Users, Plus, Send, Sparkles, Trash2, Link, Save, Loader2 } from "lucide-react";
import { useState } from "react";

const GROUP_TYPES = [
  { value: "geral", label: "🏠 Geral", desc: "Grupo principal da comunidade" },
  { value: "ansiedade", label: "🧘 Ansiedade", desc: "Autocuidado e gestão emocional" },
  { value: "relacionamentos", label: "💕 Relacionamentos", desc: "Apego e vínculos" },
  { value: "autoconhecimento", label: "🧠 Autoconhecimento", desc: "Desenvolvimento pessoal" },
  { value: "estudantes", label: "📚 Estudantes", desc: "Comunidade de estudantes de psicologia" },
];

const CONTENT_TYPES = ["conversa", "enquete", "desafio", "exclusivo", "dica_rapida", "bastidores", "recomendacao"];

const MAX_WHATSAPP_GROUP = 1024;

const Community = () => {
  const queryClient = useQueryClient();
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [membersCount, setMembersCount] = useState("");
  const [newGroupType, setNewGroupType] = useState("");
  const [newInviteLink, setNewInviteLink] = useState("");

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
    mutationFn: async ({ groupType, link }: { groupType: string; link: string }) => {
      const info = GROUP_TYPES.find((g) => g.value === groupType) || GROUP_TYPES[0];
      const { error } = await supabase.from("whatsapp_groups").insert({
        name: info.label,
        description: info.desc,
        group_type: groupType,
        invite_link: link || null,
        members_count: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-groups"] });
      setNewInviteLink("");
      setNewGroupType("");
      toast.success("Grupo criado!");
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, invite_link, members_count }: { id: string; invite_link: string; members_count: number }) => {
      const { error } = await supabase.from("whatsapp_groups").update({
        invite_link,
        members_count,
        is_active: members_count < MAX_WHATSAPP_GROUP,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-groups"] });
      setEditingGroup(null);
      toast.success("Grupo atualizado!");
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

  // Find the active group with space (for display)
  const activeGroupWithSpace = groups?.find((g) => g.is_active && g.invite_link && (g.members_count || 0) < MAX_WHATSAPP_GROUP);

  const parseBody = (body: string | null) => {
    if (!body) return null;
    try { return JSON.parse(body); } catch { return { message: body }; }
  };

  const startEditing = (group: any) => {
    setEditingGroup(group.id);
    setInviteLink(group.invite_link || "");
    setMembersCount(String(group.members_count || 0));
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

        {/* Active Link for profiles */}
        {activeGroupWithSpace && (
          <Card className="border-success/30 bg-success/5">
            <CardContent className="py-3 flex items-center gap-2">
              <Link className="w-4 h-4 text-success shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-success">Link ativo nas bios das redes sociais:</p>
                <p className="text-[10px] text-muted-foreground truncate">{activeGroupWithSpace.invite_link}</p>
                <p className="text-[10px] text-muted-foreground">
                  {activeGroupWithSpace.members_count}/{MAX_WHATSAPP_GROUP} membros — {MAX_WHATSAPP_GROUP - (activeGroupWithSpace.members_count || 0)} vagas restantes
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Groups */}
        <div>
          <h2 className="text-sm font-medium mb-3">Grupos da Comunidade</h2>
          <div className="space-y-2">
            {GROUP_TYPES.map((gt) => {
              const existing = groups?.filter((g) => g.group_type === gt.value) || [];
              const isCreating = newGroupType === gt.value;
              return (
                <div key={gt.value}>
                  {existing.length > 0 ? existing.map((group) => (
                    <Card key={group.id} className={`mb-2 ${group.is_active ? "border-success/30" : "border-destructive/30 opacity-70"}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium">{gt.label}</p>
                            <p className="text-[10px] text-muted-foreground">{gt.desc}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant={group.is_active ? "default" : "destructive"} className="text-[9px]">
                              {group.is_active ? "✅ Ativo" : "🔴 Lotado"}
                            </Badge>
                            <Badge variant="secondary" className="text-[9px]">
                              {group.members_count || 0}/{MAX_WHATSAPP_GROUP}
                            </Badge>
                          </div>
                        </div>

                        {editingGroup === group.id ? (
                          <div className="space-y-2 mt-2">
                            <div>
                              <Label className="text-[10px]">Link de Convite</Label>
                              <Input
                                value={inviteLink}
                                onChange={(e) => setInviteLink(e.target.value)}
                                placeholder="https://chat.whatsapp.com/..."
                                className="h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">Membros Atuais</Label>
                              <Input
                                type="number"
                                value={membersCount}
                                onChange={(e) => setMembersCount(e.target.value)}
                                placeholder="0"
                                className="h-8 text-xs"
                                max={MAX_WHATSAPP_GROUP}
                              />
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                className="h-7 text-[10px]"
                                disabled={updateGroupMutation.isPending}
                                onClick={() => updateGroupMutation.mutate({
                                  id: group.id,
                                  invite_link: inviteLink,
                                  members_count: parseInt(membersCount) || 0,
                                })}
                              >
                                {updateGroupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                                Salvar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setEditingGroup(null)}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1">
                            {group.invite_link ? (
                              <p className="text-[10px] text-muted-foreground truncate">🔗 {group.invite_link}</p>
                            ) : (
                              <p className="text-[10px] text-warning">⚠️ Sem link de convite</p>
                            )}
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] mt-1" onClick={() => startEditing(group)}>
                              ✏️ Editar link / membros
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )) : (
                    <Card className="mb-2 border-dashed opacity-60">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{gt.label}</p>
                            <p className="text-[10px] text-muted-foreground">{gt.desc}</p>
                          </div>
                          {isCreating ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={newInviteLink}
                                onChange={(e) => setNewInviteLink(e.target.value)}
                                placeholder="https://chat.whatsapp.com/..."
                                className="h-7 text-[10px] w-48"
                              />
                              <Button
                                size="sm"
                                className="h-7 text-[10px]"
                                disabled={createGroupMutation.isPending}
                                onClick={() => createGroupMutation.mutate({ groupType: gt.value, link: newInviteLink })}
                              >
                                <Save className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px]"
                              onClick={() => setNewGroupType(gt.value)}
                            >
                              <Plus className="w-3 h-3 mr-1" /> Criar
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
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
