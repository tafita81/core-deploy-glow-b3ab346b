import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ExternalLink, Key, Plug, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface PendingItem {
  id: string;
  label: string;
  description: string;
  severity: "critical" | "warning" | "info";
  action: string;
  route: string;
}

export function PendingActions() {
  const navigate = useNavigate();

  const { data: channels } = useQuery({
    queryKey: ["channels-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("*, channel_tokens(id, token_type)")
      if (error) throw error;
      return data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings-status"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) throw error;
      return data;
    },
  });

  const pending: PendingItem[] = [];

  // Check each channel
  channels?.forEach((ch: any) => {
    const tokens = ch.channel_tokens || [];
    if (!ch.is_connected || tokens.length === 0) {
      pending.push({
        id: `channel-${ch.id}`,
        label: ch.name,
        description: `Conecte sua conta ${ch.name} com token de acesso`,
        severity: "critical",
        action: "Configurar",
        route: "/channels",
      });
    } else {
      const hasAccessToken = tokens.some((t: any) => t.token_type === "access_token");
      if (!hasAccessToken) {
        pending.push({
          id: `token-${ch.id}`,
          label: `Token ${ch.name}`,
          description: `Token de acesso não encontrado para ${ch.name}`,
          severity: "warning",
          action: "Adicionar Token",
          route: "/channels",
        });
      }
    }
  });

  // Check settings
  const autoPublish = settings?.find((s) => s.key === "auto_publish");
  if (!autoPublish || autoPublish.value === "false" || autoPublish.value === false) {
    pending.push({
      id: "auto-publish",
      label: "Auto-publicação",
      description: "Ative a publicação automática nas configurações",
      severity: "warning",
      action: "Ativar",
      route: "/settings",
    });
  }

  const resolved = (channels?.length ?? 0) - pending.filter(p => p.id.startsWith("channel-") || p.id.startsWith("token-")).length;
  const total = channels?.length ?? 0;

  const severityColors = {
    critical: "text-destructive bg-destructive/10",
    warning: "text-warning bg-warning/10",
    info: "text-info bg-info/10",
  };

  if (pending.length === 0) {
    return (
      <Card className="animate-fade-in border-success/30">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="rounded-full p-2 bg-success/10">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-sm font-medium">Tudo configurado! ✅</p>
            <p className="text-xs text-muted-foreground">O sistema está 100% autônomo</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in border-warning/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Pendências ({pending.length})
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {resolved}/{total} canais OK
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`rounded-md p-1.5 shrink-0 ${severityColors[item.severity]}`}>
                {item.severity === "critical" ? (
                  <Plug className="h-3.5 w-3.5" />
                ) : (
                  <Key className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 text-xs h-7 px-2"
              onClick={() => navigate(item.route)}
            >
              {item.action}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}