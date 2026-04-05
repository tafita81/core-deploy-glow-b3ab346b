import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Key, Brain, Shield, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const [autoPublish, setAutoPublish] = useState(false);
  const [scienceCheck, setScienceCheck] = useState(true);
  const [ethicsCheck, setEthicsCheck] = useState(true);
  const [scoreThreshold, setScoreThreshold] = useState([75]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      const getVal = (key: string) => settings.find((s) => s.key === key)?.value;
      const ap = getVal("auto_publish");
      if (ap !== undefined) setAutoPublish(ap === "true" || ap === true);
      const st = getVal("score_threshold");
      if (st !== undefined) setScoreThreshold([Number(st)]);
      const sc = getVal("science_check");
      if (sc !== undefined) setScienceCheck(sc === "true" || sc === true);
      const ec = getVal("ethics_check");
      if (ec !== undefined) setEthicsCheck(ec === "true" || ec === true);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "auto_publish", value: JSON.stringify(autoPublish) },
        { key: "score_threshold", value: JSON.stringify(scoreThreshold[0]) },
        { key: "science_check", value: JSON.stringify(scienceCheck) },
        { key: "ethics_check", value: JSON.stringify(ethicsCheck) },
      ];
      for (const u of updates) {
        const { error } = await supabase
          .from("settings")
          .update({ value: u.value })
          .eq("key", u.key);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="font-heading text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure o comportamento do sistema autônomo
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              API Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>OpenAI API Key</Label>
              <Input type="password" placeholder="sk-..." />
            </div>
            <div className="space-y-2">
              <Label>Instagram Token</Label>
              <Input type="password" placeholder="Token de acesso..." />
            </div>
            <div className="space-y-2">
              <Label>Instagram Page ID</Label>
              <Input placeholder="ID da página..." />
            </div>
            <div className="space-y-2">
              <Label>YouTube API Key</Label>
              <Input type="password" placeholder="API Key..." />
            </div>
            <p className="text-xs text-muted-foreground">
              As chaves são armazenadas de forma segura como variáveis de ambiente.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Comportamento do Cérebro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Publicação Automática</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Publicar automaticamente conteúdo aprovado
                </p>
              </div>
              <Switch checked={autoPublish} onCheckedChange={setAutoPublish} />
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Score Mínimo para Publicação</Label>
                <Badge variant="outline">{scoreThreshold[0]}</Badge>
              </div>
              <Slider
                value={scoreThreshold}
                onValueChange={setScoreThreshold}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Conteúdo com score abaixo de {scoreThreshold[0]} será enviado para revisão manual.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Validações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Validação Científica</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verificar referências em periódicos
                </p>
              </div>
              <Switch checked={scienceCheck} onCheckedChange={setScienceCheck} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Filtro Ético (CRP)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bloquear conteúdo com termos proibidos
                </p>
              </div>
              <Switch checked={ethicsCheck} onCheckedChange={setEthicsCheck} />
            </div>
          </CardContent>
        </Card>

        <Button
          className="bg-gradient-primary text-primary-foreground"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </DashboardLayout>
  );
}
