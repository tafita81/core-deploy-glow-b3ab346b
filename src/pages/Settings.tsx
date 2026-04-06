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
    setupGuide: [
      "1. Acesse developers.facebook.com",
      "2. 'Meus Apps' → 'Criar App' → tipo 'Business'",
      "3. 'Adicionar Produto' → 'Instagram Graph API' → Configurar",
      "4. 'Ferramentas' → 'Graph API Explorer' → selecione seu app",
      "5. 'Gerar Token de Acesso' → login no Instagram",
      "6. Permissões: instagram_basic, instagram_content_publish, instagram_manage_insights",
      "7. Token longo (60 dias): 'Access Token Debugger' → 'Estender Token'",
      "8. Page ID: GET /me/accounts → copie o campo 'id'",
    ],
    fields: [
      { key: "access_token", label: "Access Token (Graph API)", placeholder: "Cole seu Instagram Graph API Access Token", help: "Graph API Explorer → Gerar Token" },
      { key: "page_id", label: "Page/Account ID", placeholder: "ID da conta profissional", help: "GET /me/accounts → campo 'id'" },
      { key: "business_id", label: "Business Account ID", placeholder: "ID do Business Manager", help: "Business Settings → Business Info" },
      { key: "refresh_token", label: "Long-Lived Token", placeholder: "Token de longa duração (60 dias)", help: "Access Token Debugger → Estender" },
    ],
  },
  {
    id: "youtube",
    name: "YouTube",
    emoji: "🎬",
    setupGuide: [
      "1. Acesse console.cloud.google.com",
      "2. Crie projeto → 'APIs e Serviços' → 'Biblioteca'",
      "3. Pesquise 'YouTube Data API v3' → Ativar",
      "4. 'Credenciais' → '+ Criar Credenciais' → 'Chave de API'",
      "5. Copie a chave gerada (10.000 units/dia grátis)",
      "6. Channel ID: youtube.com → seu canal → URL /channel/UCxxxxx",
      "7. Para upload: Credenciais → OAuth 2.0 → tipo 'App da Web'",
    ],
    fields: [
      { key: "api_key", label: "API Key (Data API v3)", placeholder: "Cole sua YouTube Data API Key", help: "Credenciais → Chave de API" },
      { key: "channel_id", label: "Channel ID", placeholder: "UCxxxxxxx", help: "URL do canal → /channel/UCxxxxx" },
      { key: "access_token", label: "OAuth Access Token", placeholder: "Token OAuth para upload", help: "OAuth Playground → YouTube Data API v3" },
      { key: "refresh_token", label: "OAuth Refresh Token", placeholder: "Refresh token", help: "Gerado no OAuth flow" },
      { key: "client_id", label: "OAuth Client ID", placeholder: "Client ID do Google Cloud", help: "Credenciais → OAuth 2.0 → Client ID" },
      { key: "client_secret", label: "OAuth Client Secret", placeholder: "Client Secret", help: "Credenciais → OAuth 2.0 → Secret" },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    emoji: "🎵",
    setupGuide: [
      "1. Acesse developers.tiktok.com",
      "2. Crie conta dev → 'Manage Apps' → 'Create App'",
      "3. Ative: Login Kit, Content Posting API",
      "4. Em 'Keys': copie Client Key e Client Secret",
      "5. Configure redirect URI do seu app",
      "6. Gere Access Token via OAuth flow",
    ],
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "Cole seu TikTok Access Token", help: "OAuth flow → Access Token" },
      { key: "open_id", label: "Open ID", placeholder: "Seu TikTok Open ID", help: "Retornado no OAuth flow" },
      { key: "refresh_token", label: "Refresh Token", placeholder: "Token de renovação", help: "Retornado no OAuth flow" },
      { key: "client_key", label: "Client Key", placeholder: "App Client Key", help: "Manage Apps → Client Key" },
      { key: "client_secret", label: "Client Secret", placeholder: "App Client Secret", help: "Manage Apps → Client Secret" },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    emoji: "💬",
    setupGuide: [
      "1. Acesse developers.facebook.com",
      "2. Crie App tipo 'Business' → adicione 'WhatsApp'",
      "3. 'WhatsApp' → 'Começar' → copie token temporário",
      "4. Token permanente: System User no Business Manager",
      "5. Copie Phone Number ID da configuração",
    ],
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "Cole seu WhatsApp Token", help: "WhatsApp → Getting Started → Token" },
      { key: "phone_number_id", label: "Phone Number ID", placeholder: "ID do número", help: "WhatsApp config → Phone Number ID" },
      { key: "business_account_id", label: "Business Account ID", placeholder: "ID business", help: "Business Settings → ID" },
    ],
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    emoji: "🐦",
    setupGuide: [
      "1. Acesse developer.twitter.com",
      "2. Inscreva-se para Free tier (grátis)",
      "3. Crie Projeto → App",
      "4. 'Keys and Tokens' → copie API Key + API Secret",
      "5. 'Generate' Access Token e Access Secret",
      "6. 'Generate' Bearer Token",
    ],
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Consumer Key", help: "Keys → Consumer Keys → API Key" },
      { key: "api_secret", label: "API Secret", placeholder: "Consumer Secret", help: "Keys → Consumer Keys → Secret" },
      { key: "access_token", label: "Access Token", placeholder: "Token de acesso", help: "Keys → Auth Tokens → Access Token" },
      { key: "access_secret", label: "Access Token Secret", placeholder: "Secret do token", help: "Keys → Auth Tokens → Secret" },
      { key: "bearer_token", label: "Bearer Token", placeholder: "Bearer para leitura", help: "Keys → Bearer Token → Generate" },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    emoji: "💼",
    setupGuide: [
      "1. Acesse linkedin.com/developers",
      "2. 'Create App' → preencha dados",
      "3. 'Products' → adicione 'Share on LinkedIn'",
      "4. 'Auth' → copie Client ID e Secret",
      "5. Gere Access Token via OAuth 2.0",
      "6. Person URN: GET /v2/me com o token",
    ],
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "Cole seu LinkedIn Token", help: "OAuth flow → Access Token" },
      { key: "person_id", label: "Person URN / ID", placeholder: "urn:li:person:xxxxx", help: "GET /v2/me → campo 'id'" },
      { key: "organization_id", label: "Organization ID (opcional)", placeholder: "ID da Company Page", help: "Admin URL contém o ID" },
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    emoji: "📘",
    setupGuide: [
      "1. Acesse developers.facebook.com",
      "2. Use mesmo App do Instagram (ou crie novo)",
      "3. 'Graph API Explorer' → 'Gerar Token de Página'",
      "4. Permissões: pages_manage_posts, pages_read_engagement",
      "5. Page ID: Configurações → Sobre → ID",
      "6. App ID/Secret: Painel → Configurações → Básico",
    ],
    fields: [
      { key: "access_token", label: "Page Access Token", placeholder: "Token da página", help: "Graph API Explorer → Token de Página" },
      { key: "page_id", label: "Page ID", placeholder: "ID da página", help: "Configurações → Sobre → ID" },
      { key: "app_id", label: "App ID", placeholder: "ID do app", help: "Configurações → Básico → ID" },
      { key: "app_secret", label: "App Secret", placeholder: "Secret do app", help: "Configurações → Básico → Secret" },
    ],
  },
  {
    id: "pinterest",
    name: "Pinterest",
    emoji: "📌",
    setupGuide: [
      "1. Acesse developers.pinterest.com",
      "2. 'My Apps' → 'Create App'",
      "3. Preencha dados → aguarde aprovação",
      "4. 'Generate Token' → permissões: pins:read/write, boards:read/write",
      "5. Board ID: URL do board → último segmento",
    ],
    fields: [
      { key: "access_token", label: "Access Token (API v5)", placeholder: "Cole seu Pinterest Token", help: "My Apps → Generate Token" },
      { key: "board_id", label: "Board ID principal", placeholder: "ID do board", help: "URL do board → ID" },
      { key: "refresh_token", label: "Refresh Token", placeholder: "Token de renovação", help: "Gerado com o Access Token" },
      { key: "app_id", label: "App ID", placeholder: "ID do app", help: "My Apps → App ID" },
      { key: "app_secret", label: "App Secret", placeholder: "Secret do app", help: "My Apps → App Secret" },
    ],
  },
  {
    id: "reddit",
    name: "Reddit",
    emoji: "🔴",
    setupGuide: [
      "1. Acesse reddit.com/prefs/apps",
      "2. Role até embaixo → 'create another app...'",
      "3. Nome: qualquer (ex: 'TrendBot') → Tipo: 'script'",
      "4. Redirect URI: http://localhost → 'create app'",
      "5. Client ID: texto curto abaixo do nome",
      "6. Client Secret: campo 'secret'",
    ],
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "Texto abaixo do nome do app", help: "prefs/apps → abaixo do nome" },
      { key: "client_secret", label: "Client Secret", placeholder: "Campo 'secret'", help: "prefs/apps → secret" },
    ],
  },
  {
    id: "newsapi",
    name: "NewsAPI",
    emoji: "📰",
    setupGuide: [
      "1. Acesse newsapi.org/register",
      "2. Preencha nome e email → 'Submit'",
      "3. Copie a API Key (100 req/dia grátis)",
    ],
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Cole sua NewsAPI Key", help: "newsapi.org → Account → Key" },
    ],
  },
  {
    id: "serpapi",
    name: "SerpAPI (Google Trends)",
    emoji: "🔍",
    setupGuide: [
      "1. Acesse serpapi.com → crie conta grátis",
      "2. Dashboard → copie API Key (100 buscas/mês)",
    ],
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Cole sua SerpAPI Key", help: "Dashboard → API Key" },
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
      const amazonConfig = settings.find((s) => s.key === "amazon_affiliate_tag")?.value as any;
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
      if (amazonConfig?.tag) {
        saved.amazon = true;
        vals.amazon_tag = amazonConfig.tag;
        if (amazonConfig.store_id) vals.amazon_store_id = amazonConfig.store_id;
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
                    {/* Setup Guide */}
                    {(platform as any).setupGuide && (
                      <div className="rounded-md bg-accent/50 border border-border p-3 mb-2">
                        <p className="text-[11px] font-medium text-foreground mb-1.5">📋 Passo a passo para obter:</p>
                        <ol className="space-y-0.5">
                          {(platform as any).setupGuide.map((step: string, i: number) => (
                            <li key={i} className="text-[10px] text-muted-foreground leading-relaxed">{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
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

        {/* AMAZON AFFILIATE */}
        <Card className="border-amber-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              📚 Amazon Afiliados
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Catálogo de livros recomendados automaticamente nas redes e WhatsApp — sem parecer anúncio, como recomendação genuína.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Tag de Afiliado Amazon</Label>
              <Input
                type="text"
                placeholder="ex: danielapsico-20"
                value={apiKeys.amazon_tag || ""}
                onChange={(e) => setApiKeys((prev) => ({ ...prev, amazon_tag: e.target.value }))}
                className="h-8 text-xs"
              />
              <p className="text-[9px] text-muted-foreground">
                Acesse programa de afiliados Amazon (associados.amazon.com.br) → copie seu Tag ID. O cérebro incluirá links de livros relevantes em cada conteúdo.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Store ID Amazon (opcional)</Label>
              <Input
                type="text"
                placeholder="ex: danielapsicologia"
                value={apiKeys.amazon_store_id || ""}
                onChange={(e) => setApiKeys((prev) => ({ ...prev, amazon_store_id: e.target.value }))}
                className="h-8 text-xs"
              />
              <p className="text-[9px] text-muted-foreground">
                Se tiver uma Amazon Storefront, cole o ID para links diretos à sua loja curada.
              </p>
            </div>
            <Button
              size="sm"
              className="w-full h-8 text-xs"
              onClick={async () => {
                setSavingApiKey("amazon");
                try {
                  const tag = apiKeys.amazon_tag?.trim();
                  const storeId = apiKeys.amazon_store_id?.trim();
                  if (!tag) { toast({ title: "Insira o Tag de Afiliado", variant: "destructive" }); return; }
                  await supabase.from("settings").upsert({ key: "amazon_affiliate_tag", value: { tag, store_id: storeId || null } }, { onConflict: "key" });
                  setSavedApiKeys((prev) => ({ ...prev, amazon: true }));
                  queryClient.invalidateQueries({ queryKey: ["settings"] });
                  toast({ title: "✅ Amazon Afiliados configurado!", description: "O cérebro vai incluir recomendações de livros automaticamente." });
                } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
                finally { setSavingApiKey(null); }
              }}
              disabled={savingApiKey === "amazon" || !apiKeys.amazon_tag?.trim()}
            >
              {savingApiKey === "amazon" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Salvar Amazon Afiliados
            </Button>
            {savedApiKeys.amazon && (
              <p className="text-[10px] text-green-400">✅ Catálogo ativo — livros serão recomendados em todas as plataformas</p>
            )}
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

        {/* FREE DATA & ANALYTICS TOOLS */}
        <Card className="border-cyan-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              📊 Ferramentas Gratuitas de Dados em Tempo Real
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              APIs gratuitas que trazem dados estatísticos reais para alimentar o cérebro. Configure quantas quiser.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                id: "youtube_data_api",
                name: "YouTube Data API v3",
                emoji: "🎬",
                settingsKey: "youtube_data_api_key",
                placeholder: "Cole sua YouTube Data API Key",
                help: "100% GRATUITO — 10.000 unidades/dia. console.cloud.google.com → APIs → YouTube Data API v3 → Credentials → Create API Key. Traz vídeos trending, estatísticas de canais e busca em tempo real.",
                free: true,
                units: "10.000 unidades/dia grátis",
              },
              {
                id: "reddit_client",
                name: "Reddit API",
                emoji: "🟠",
                settingsKey: "reddit_client_id",
                placeholder: "Cole seu Reddit Client ID",
                help: "100% GRATUITO — reddit.com/prefs/apps → Create App → Script. Monitora subreddits de psicologia/saúde mental para identificar temas que estão bombando na comunidade.",
                free: true,
                units: "60 requests/min grátis",
              },
              {
                id: "reddit_secret",
                name: "Reddit Secret",
                emoji: "🔐",
                settingsKey: "reddit_client_secret",
                placeholder: "Cole seu Reddit Client Secret",
                help: "Par do Client ID acima — encontre no mesmo local.",
                free: true,
                units: "",
              },
              {
                id: "newsapi",
                name: "NewsAPI",
                emoji: "📰",
                settingsKey: "newsapi_key",
                placeholder: "Cole sua NewsAPI Key",
                help: "100% GRATUITO (100 req/dia) — newsapi.org → Register. Busca notícias sobre saúde mental, psicologia e bem-estar em tempo real para criar conteúdo sobre assuntos do momento.",
                free: true,
                units: "100 requests/dia grátis",
              },
              {
                id: "serpapi",
                name: "SerpAPI (Google Trends)",
                emoji: "📈",
                settingsKey: "serpapi_key",
                placeholder: "Cole sua SerpAPI Key",
                help: "100 buscas/mês GRÁTIS — serpapi.com → Register. Acessa Google Trends em tempo real: o que as pessoas estão pesquisando sobre saúde mental, ansiedade, autoajuda AGORA.",
                free: true,
                units: "100 buscas/mês grátis",
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
                        {api.free && (
                          <Badge variant="outline" className="text-[9px] text-cyan-400 border-cyan-500/30">
                            GRÁTIS
                          </Badge>
                        )}
                        {isSaved ? (
                          <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Ativa
                          </Badge>
                        ) : null}
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
                    {api.units && (
                      <p className="text-[9px] text-cyan-400/70">🆓 {api.units}</p>
                    )}
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

            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-medium text-primary">💡 APIs gratuitas já integradas (sem chave necessária):</p>
              <div className="grid grid-cols-1 gap-1">
                <p className="text-[10px] text-muted-foreground">✅ <strong>Google Trends RSS</strong> — Tendências de busca em tempo real (automático)</p>
                <p className="text-[10px] text-muted-foreground">✅ <strong>Wikipedia API</strong> — Validação de termos científicos (automático)</p>
                <p className="text-[10px] text-muted-foreground">✅ <strong>Open Library API</strong> — Dados de livros para catálogo Amazon (automático)</p>
                <p className="text-[10px] text-muted-foreground">✅ <strong>RSS Feeds</strong> — Monitoramento de blogs de psicologia (automático)</p>
              </div>
            </div>
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
