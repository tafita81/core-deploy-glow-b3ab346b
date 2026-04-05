import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Instagram, Youtube, ExternalLink, Settings, Loader2, Save, MessageCircle, Music2, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const platformIcons: Record<string, typeof Instagram> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
  whatsapp: MessageCircle,
};

const platformColors: Record<string, string> = {
  instagram: "from-pink-500 to-orange-400",
  youtube: "from-red-500 to-red-600",
  tiktok: "from-gray-900 to-gray-700",
  whatsapp: "from-green-500 to-green-600",
};

const platformGuide: Record<string, { fields: { type: string; label: string; placeholder: string; help: string }[] }> = {
  instagram: {
    fields: [
      { type: "access_token", label: "Access Token", placeholder: "EAAxxxxxxx...", help: "Meta Developer → Apps → Token de acesso da página" },
      { type: "page_id", label: "Page ID", placeholder: "123456789...", help: "ID da página do Instagram Business" },
    ],
  },
  youtube: {
    fields: [
      { type: "access_token", label: "API Key / OAuth Token", placeholder: "AIzaSy...", help: "Google Cloud Console → APIs → YouTube Data API v3" },
    ],
  },
  tiktok: {
    fields: [
      { type: "access_token", label: "Access Token", placeholder: "act.xxxxx...", help: "TikTok Developer Portal → Manage Apps → Access Token" },
    ],
  },
  whatsapp: {
    fields: [
      { type: "access_token", label: "Access Token", placeholder: "EAAxxxxxxx...", help: "Meta Developer → WhatsApp → API Setup → Token" },
      { type: "phone_id", label: "Phone Number ID", placeholder: "123456789...", help: "Meta Developer → WhatsApp → Phone Number ID" },
    ],
  },
};

function ChannelConfigDialog({ channel, onSaved }: { channel: any; onSaved: () => void }) {
  const guide = platformGuide[channel.platform] || { fields: [] };
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const field of guide.fields) {
        const val = values[field.type];
        if (!val) continue;
        await supabase.from("channel_tokens").upsert(
          { channel_id: channel.id, token_type: field.type, token_value: val },
          { onConflict: "channel_id,token_type" }
        );
      }
      // Mark channel as connected
      await supabase.from("channels").update({ is_connected: true }).eq("id", channel.id);
      toast({ title: `${channel.name} conectado com sucesso! ✅` });
      setOpen(false);
      onSaved();
    } catch (e) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={channel.is_connected ? "ghost" : "outline"} className="text-xs">
          {channel.is_connected ? (
            <><Settings className="h-3 w-3 mr-1" /> Reconfigurar</>
          ) : (
            <><ExternalLink className="h-3 w-3 mr-1" /> Conectar</>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Conectar {channel.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {guide.fields.map((field) => (
            <div key={field.type} className="space-y-1.5">
              <Label className="text-sm">{field.label}</Label>
              <Input
                type="password"
                placeholder={field.placeholder}
                value={values[field.type] || ""}
                onChange={(e) => setValues({ ...values, [field.type]: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">{field.help}</p>
            </div>
          ))}
          <Button
            className="w-full bg-gradient-primary text-primary-foreground"
            onClick={handleSave}
            disabled={saving || guide.fields.every((f) => !values[f.type])}
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar e Conectar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ChannelsPage() {
  const queryClient = useQueryClient();

  const { data: channels, isLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("*, channel_tokens(id, token_type)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (channelId: string) => {
      await supabase.from("channel_tokens").delete().eq("channel_id", channelId);
      await supabase.from("channels").update({ is_connected: false }).eq("id", channelId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["channels-status"] });
    },
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["channels"] });
    queryClient.invalidateQueries({ queryKey: ["channels-status"] });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Canais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte suas redes sociais — cole os tokens e o sistema publica automaticamente
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels?.map((ch: any) => {
              const Icon = platformIcons[ch.platform] || Instagram;
              const color = platformColors[ch.platform] || "from-gray-600 to-gray-700";
              const tokenCount = ch.channel_tokens?.length ?? 0;
              return (
                <Card key={ch.id} className={`animate-fade-in ${ch.is_connected ? "hover:glow-primary border-success/20" : "opacity-80"} transition-all`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2.5 bg-gradient-to-br ${color}`}>
                          <Icon className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                          <CardTitle className="font-heading text-base">{ch.name}</CardTitle>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant={ch.is_connected ? "default" : "secondary"} className="text-[10px]">
                              {ch.is_connected ? "✅ Conectado" : "⚠️ Desconectado"}
                            </Badge>
                            {tokenCount > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                {tokenCount} token{tokenCount > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {ch.is_connected ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center">
                            <p className="text-lg font-heading font-bold">
                              {(ch.followers ?? 0) >= 1000 ? `${((ch.followers ?? 0) / 1000).toFixed(1)}K` : ch.followers ?? 0}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Seguidores</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-heading font-bold">{ch.posts_count ?? 0}</p>
                            <p className="text-[10px] text-muted-foreground">Posts</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-heading font-bold">{ch.engagement_rate ?? 0}%</p>
                            <p className="text-[10px] text-muted-foreground">Engajamento</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <ChannelConfigDialog channel={ch} onSaved={handleSaved} />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive"
                            onClick={() => disconnectMutation.mutate(ch.id)}
                          >
                            Desconectar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-3 space-y-3">
                        <p className="text-sm text-muted-foreground">Cole seu token para ativar a publicação automática</p>
                        <ChannelConfigDialog channel={ch} onSaved={handleSaved} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}