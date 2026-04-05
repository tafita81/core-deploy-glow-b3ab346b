import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Instagram, Youtube, ExternalLink, Settings, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const platformIcons: Record<string, typeof Instagram> = {
  instagram: Instagram,
  youtube: Youtube,
};

const platformColors: Record<string, string> = {
  instagram: "from-pink-500 to-orange-400",
  youtube: "from-red-500 to-red-600",
};

export default function ChannelsPage() {
  const { data: channels, isLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Canais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie suas integrações com redes sociais
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels?.map((ch) => {
              const Icon = platformIcons[ch.platform] || Instagram;
              const color = platformColors[ch.platform] || "from-gray-600 to-gray-700";
              return (
                <Card key={ch.id} className={`animate-fade-in ${ch.is_connected ? "hover:glow-primary" : "opacity-70"} transition-all`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2.5 bg-gradient-to-br ${color}`}>
                          <Icon className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                          <CardTitle className="font-heading text-base">{ch.name}</CardTitle>
                          <Badge variant={ch.is_connected ? "default" : "secondary"} className="text-[10px] mt-1">
                            {ch.is_connected ? "Conectado" : "Desconectado"}
                          </Badge>
                        </div>
                      </div>
                      <Switch checked={ch.is_connected ?? false} disabled />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {ch.is_connected ? (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-lg font-heading font-bold">
                            {(ch.followers ?? 0) >= 1000 ? `${((ch.followers ?? 0) / 1000).toFixed(1)}K` : ch.followers}
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
                    ) : (
                      <div className="text-center py-3">
                        <p className="text-sm text-muted-foreground mb-3">Conecte sua conta para ativar</p>
                        <Button size="sm" variant="outline">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Conectar API
                        </Button>
                      </div>
                    )}
                    {ch.is_connected && (
                      <Button size="sm" variant="ghost" className="w-full mt-3 text-xs">
                        <Settings className="h-3 w-3 mr-1" /> Configurar
                      </Button>
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
