import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Brain, Shield, Save, Loader2, Clock, Link, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = [
  {
    id: "instagram",
    name: "Instagram",
    emoji: "📸",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "Cole seu Instagram Graph API Access Token", help: "Obtenha em developers.facebook.com → Instagram Graph API" },
      { key: "page_id", label: "Page/Account ID", placeholder: "ID da conta do Instagram", help: "O ID numérico da sua conta profissional" },
    ],
  },
  {
    id: "youtube",
    name: "YouTube",
    emoji: "🎬",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Cole sua YouTube Data API Key", help: "Obtenha em console.cloud.google.com → APIs → YouTube Data API v3" },
      { key: "channel_id", label: "Channel ID", placeholder: "ID do canal (ex: UCxxxxxxx)", help: "Encontre em youtube.com/account_advanced" },
      { key: "access_token", label: "OAuth Access Token", placeholder: "Token para publicar vídeos", help: "Necessário para upload — gere via OAuth 2.0 playground" },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    emoji: "🎵",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "Cole seu TikTok API Access Token", help: "Obtenha em developers.tiktok.com → Content Posting API" },
      { key: "open_id", label: "Open ID", placeholder: "Seu TikTok Open ID", help: "Identificador da conta na API" },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    emoji: "💬",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "Cole seu WhatsApp Business API Token", help: "Obtenha em developers.facebook.com → WhatsApp Business API" },
      { key: "phone_number_id", label: "Phone Number ID", placeholder: "ID do número de telefone", help: "ID do número cadastrado no WhatsApp Business" },
    ],
  },
];

export default function SettingsPage() {
  const [autoPublish, setAutoPublish] = useState(false);
  const [scienceCheck, setScienceCheck] = useState(true);
  const [ethicsCheck, setEthicsCheck] = useState(true);
  const [scoreThreshold, setScoreThreshold] = useState([75]);
  const [tokenValues, setTokenValues] = useState<Record<string, Record<string, string>>>({});
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [savingTokens, setSavingTokens] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savedApiKeys, setSavedApiKeys] = useState<Record<string, boolean>>({});
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [savingApiKey, setSavingApiKey] = useState<string | null>(null);
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

  const { data: channels } = useQuery({
    queryKey: ["channels-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("channels").select("*");
      return data;
    },
  });

  const { data: existingTokens } = useQuery({
    queryKey: ["channel-tokens"],
    queryFn: async () => {
      const { data } = await supabase.from("channel_tokens").select("*");
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

  // Load existing tokens into state
  useEffect(() => {
    if (existingTokens && channels) {
      const vals: Record<string, Record<string, string>> = {};
      for (const token of existingTokens) {
        const channel = channels.find((c) => c.id === token.channel_id);
        if (channel) {
          if (!vals[channel.platform]) vals[channel.platform] = {};
          vals[channel.platform][token.token_type] = token.token_value;
        }
      }
      setTokenValues((prev) => {
        // Only set if not already edited by user
        const merged = { ...prev };
        for (const [platform, fields] of Object.entries(vals)) {
          if (!merged[platform]) merged[platform] = {};
          for (const [key, val] of Object.entries(fields)) {
            if (!merged[platform][key]) merged[platform][key] = val;
          }
        }
        return merged;
      });
    }
  }, [existingTokens, channels]);

  // Load existing API keys from settings
  useEffect(() => {
    if (settings) {
      const heygenKey = settings.find((s) => s.key === "heygen_api_key")?.value;
      const elevenKey = settings.find((s) => s.key === "elevenlabs_api_key")?.value;
      const saved: Record<string, boolean> = {};
      const vals: Record<string, string> = {};
      if (heygenKey && typeof heygenKey === "string" && heygenKey.length > 0) {
        saved.heygen = true;
        vals.heygen = heygenKey;
      }
      if (elevenKey && typeof elevenKey === "string" && elevenKey.length > 0) {
        saved.elevenlabs = true;
        vals.elevenlabs = elevenKey;
      }
      setSavedApiKeys(saved);
      setApiKeys((prev) => ({ ...vals, ...prev }));
    }
  }, [settings]);

  const saveApiKey = async (apiId: string, settingsKey: string) => {
    setSavingApiKey(apiId);
    try {
      const value = apiKeys[apiId]?.trim();
      if (!value) return;
      await supabase.from("settings").upsert({ key: settingsKey, value: JSON.stringify(value) }, { onConflict: "key" });
      setSavedApiKeys((prev) => ({ ...prev, [apiId]: true }));
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "✅ API Key salva!", description: "Será usada automaticamente na próxima geração." });
    } catch {
      toast({ title: "Erro ao salvar API Key", variant: "destructive" });
    } finally {
      setSavingApiKey(null);
    }
  };

  const hasTokensForPlatform = (platformId: string) => {
    const platformFields = PLATFORMS.find((p) => p.id === platformId)?.fields || [];
    const vals = tokenValues[platformId] || {};
    return platformFields.every((f) => vals[f.key]?.trim());
  };

  const saveTokensForPlatform = async (platformId: string) => {
    setSavingTokens(platformId);
    try {
      const channel = channels?.find((c) => c.platform === platformId);
      if (!channel) throw new Error("Canal não encontrado");

      const platformConfig = PLATFORMS.find((p) => p.id === platformId)!;
      const vals = tokenValues[platformId] || {};

      for (const field of platformConfig.fields) {
        const value = vals[field.key]?.trim();
        if (!value) continue;

        // Upsert token
        const existing = existingTokens?.find(
          (t) => t.channel_id === channel.id && t.token_type === field.key
        );

        if (existing) {
          await supabase
            .from("channel_tokens")
            .update({ token_value: value })
            .eq("id", existing.id);
        } else {
          await supabase.from("channel_tokens").insert({
            channel_id: channel.id,
            token_type: field.key,
            token_value: value,
          });
        }
      }

      // Mark channel as connected if all tokens are filled
      const allFilled = platformConfig.fields.every((f) => vals[f.key]?.trim());
      if (allFilled) {
        await supabase
          .from("channels")
          .update({ is_connected: true })
          .eq("id", channel.id);
      }

      queryClient.invalidateQueries({ queryKey: ["channel-tokens"] });
      queryClient.invalidateQueries({ queryKey: ["channels-settings"] });
      queryClient.invalidateQueries({ queryKey: ["channels-real"] });
      toast({ title: `✅ ${platformConfig.name} configurado!`, description: allFilled ? "Canal conectado — o cérebro vai usar na próxima execução." : "Tokens salvos parcialmente." });
    } catch (e) {
      toast({ title: "Erro ao salvar tokens", variant: "destructive" });
    } finally {
      setSavingTokens(null);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "auto_publish", value: autoPublish },
        { key: "score_threshold", value: scoreThreshold[0] },
        { key: "science_check", value: scienceCheck },
        { key: "ethics_check", value: ethicsCheck },
      ];
      for (const u of updates) {
        await supabase
          .from("settings")
          .upsert({ key: u.key, value: JSON.stringify(u.value) }, { onConflict: "key" });
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
            Configure o comportamento do sistema e conecte suas redes sociais
          </p>
        </div>

        {/* CONNECT PLATFORMS */}
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Link className="h-5 w-5 text-primary" />
              Conectar Redes Sociais
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Cole os tokens/chaves de cada plataforma. O cérebro só publica em canais conectados.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {PLATFORMS.map((platform) => {
              const channel = channels?.find((c) => c.platform === platform.id);
              const isConnected = channel?.is_connected && hasTokensForPlatform(platform.id);
              const platformVals = tokenValues[platform.id] || {};
              const isVisible = showTokens[platform.id];

              return (
                <Card key={platform.id} className={isConnected ? "border-green-500/30" : "border-muted"}>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{platform.emoji}</span>
                        <span className="font-heading font-medium text-sm">{platform.name}</span>
                        {isConnected ? (
                          <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            <XCircle className="h-3 w-3 mr-1" /> Não conectado
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setShowTokens((prev) => ({ ...prev, [platform.id]: !prev[platform.id] }))}
                      >
                        {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-2.5">
                    {platform.fields.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-[11px]">{field.label}</Label>
                        <Input
                          type={isVisible ? "text" : "password"}
                          placeholder={field.placeholder}
                          value={platformVals[field.key] || ""}
                          onChange={(e) =>
                            setTokenValues((prev) => ({
                              ...prev,
                              [platform.id]: { ...(prev[platform.id] || {}), [field.key]: e.target.value },
                            }))
                          }
                          className="h-8 text-xs"
                        />
                        <p className="text-[9px] text-muted-foreground">{field.help}</p>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs mt-1"
                      onClick={() => saveTokensForPlatform(platform.id)}
                      disabled={savingTokens === platform.id}
                    >
                      {savingTokens === platform.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      Salvar {platform.name}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>

        {/* EXTERNAL APIs */}
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              🔑 APIs Externas (Vídeo & Áudio)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Chaves para geração de vídeos com avatares realistas e áudio de alta qualidade.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                id: "heygen",
                name: "HeyGen",
                emoji: "🎬",
                settingsKey: "heygen_api_key",
                placeholder: "Cole sua HeyGen API Key",
                help: "Obtenha em app.heygen.com → Settings → API Keys. Gera avatares hiper-realistas com lip sync.",
              },
              {
                id: "elevenlabs",
                name: "ElevenLabs",
                emoji: "🎙️",
                settingsKey: "elevenlabs_api_key",
                placeholder: "Cole sua ElevenLabs API Key",
                help: "Obtenha em elevenlabs.io → Profile → API Keys. Gera vozes ultra-realistas.",
              },
            ].map((api) => {
              const currentVal = apiKeys[api.id] || "";
              const isSaved = !!savedApiKeys[api.id];
              const isApiVisible = showApiKeys[api.id];

              return (
                <Card key={api.id} className={isSaved ? "border-green-500/30" : "border-muted"}>
                  <CardContent className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{api.emoji}</span>
                        <span className="font-heading font-medium text-sm">{api.name}</span>
                        {isSaved ? (
                          <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Configurada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            <XCircle className="h-3 w-3 mr-1" /> Não configurada
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setShowApiKeys((prev) => ({ ...prev, [api.id]: !prev[api.id] }))}
                      >
                        {isApiVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <Input
                      type={isApiVisible ? "text" : "password"}
                      placeholder={api.placeholder}
                      value={currentVal}
                      onChange={(e) => setApiKeys((prev) => ({ ...prev, [api.id]: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    <p className="text-[9px] text-muted-foreground">{api.help}</p>
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={() => saveApiKey(api.id, api.settingsKey)}
                      disabled={savingApiKey === api.id || !currentVal.trim()}
                    >
                      {savingApiKey === api.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      Salvar {api.name}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>

        {/* Pipeline config */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Pipeline Automático
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              O pipeline roda automaticamente a cada hora, pesquisando tendências, gerando conteúdo, validando e publicando apenas nos canais conectados.
            </p>
            <Badge variant="outline" className="text-xs">🟢 Cron ativo — a cada hora</Badge>
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
                  Publicar automaticamente conteúdo aprovado nos canais conectados
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
              <Slider value={scoreThreshold} onValueChange={setScoreThreshold} min={0} max={100} step={5} />
              <p className="text-xs text-muted-foreground">
                Conteúdo com score abaixo de {scoreThreshold[0]} será enviado para revisão.
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
                <p className="text-xs text-muted-foreground mt-0.5">Verificar referências científicas</p>
              </div>
              <Switch checked={scienceCheck} onCheckedChange={setScienceCheck} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Filtro Ético</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Bloquear conteúdo com termos proibidos</p>
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
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </DashboardLayout>
  );
}
