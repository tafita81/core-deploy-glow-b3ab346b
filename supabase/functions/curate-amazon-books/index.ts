import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { topics: requestTopics, platform } = body;

    // Get Amazon affiliate tag
    const { data: affiliateRow } = await supabase
      .from("settings").select("value").eq("key", "amazon_affiliate_tag").single();
    const affiliateTag = (affiliateRow?.value as any)?.tag || "";

    if (!affiliateTag) {
      return new Response(JSON.stringify({
        message: "Amazon affiliate tag não configurado. Vá em Configurações para adicionar.",
        books: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get existing catalog to GROW it (never replace, only add)
    const { data: existingCatalogRow } = await supabase
      .from("settings").select("value").eq("key", "amazon_book_catalog").single();
    const existingCatalog = (existingCatalogRow?.value as any) || {};
    const existingBooks = existingCatalog.catalog || [];

    // Get viral intelligence
    const { data: viralRow } = await supabase
      .from("settings").select("value").eq("key", "viral_intelligence").single();
    const viralIntel = (viralRow?.value as any) || {};

    // Get brain learnings
    const { data: learningsRow } = await supabase
      .from("settings").select("value").eq("key", "brain_learnings").single();
    const learnings = (learningsRow?.value as any) || {};

    // Get recent WhatsApp conversations — ONLY follower/community topics matter
    const { data: recentWhatsapp } = await supabase
      .from("whatsapp_content").select("title, content_type, body")
      .order("created_at", { ascending: false }).limit(20);

    // Get top performing content by ENGAGEMENT (what followers actually interact with)
    const { data: topContents } = await supabase
      .from("contents").select("title, topic, score, channel")
      .gte("score", 50).order("score", { ascending: false }).limit(20);

    // Get WhatsApp groups for community milestone strategy
    const { data: whatsappGroups } = await supabase
      .from("whatsapp_groups").select("*").eq("is_active", true);

    // Get channel follower counts for milestone calculations
    const { data: channels } = await supabase
      .from("channels").select("platform, followers, name");

    const totalFollowers = (channels || []).reduce((sum: number, c: any) => sum + (c.followers || 0), 0);
    const totalWhatsappMembers = (whatsappGroups || []).reduce((sum: number, g: any) => sum + (g.members_count || 0), 0);

    // Community milestone: every 1024 followers = new community group opportunity
    const communityMilestone = Math.floor(totalFollowers / 1024);
    const currentGroups = (whatsappGroups || []).length;
    const shouldCreateNewGroup = communityMilestone > currentGroups;

    const trendingTopics = requestTopics || (viralIntel?.viral_patterns?.top_title_hooks || []).slice(0, 5);
    const followerTopics = (topContents || []).map((c: any) => c.topic).filter(Boolean);
    const whatsappConversations = (recentWhatsapp || []).map((w: any) => {
      try { const b = JSON.parse(w.body || "{}"); return b.message || w.title; } catch { return w.title; }
    }).join(" | ");

    const existingTitles = existingBooks.map((b: any) => b.title).join(", ");

    // AI curates NEW books to ADD to the growing catalog
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um CURADOR EDITORIAL que NUNCA VENDE. Você é como uma amiga apaixonada por saúde mental que compartilha leituras que REALMENTE mudaram sua vida. NUNCA mencione "psicóloga", "estudante de psicologia", "futura psicóloga", faculdade ou formação.

REGRA ABSOLUTA — NUNCA VENDER:
- NUNCA use palavras como: "compre", "adquira", "garanta o seu", "aproveite", "promoção", "desconto", "oferta"
- NUNCA pareça anúncio, propaganda ou marketing
- SEMPRE fale como amiga que leu e amou: "gente, esse livro me destruiu de tão bom", "li esse aqui chorando no ônibus", "esse mudou minha terapia"
- O link aparece NATURALMENTE como "tá aqui pra quem quiser" — nunca como CTA de venda

ESTRATÉGIA DE CATÁLOGO CRESCENTE:
- O catálogo CRESCE a cada execução — NUNCA substitua livros antigos
- Adicione 3-6 livros NOVOS que se conectam com o que os seguidores estão COMENTANDO e PEDINDO
- Cada novo livro deve responder a uma DOR ou CURIOSIDADE que apareceu nas conversas recentes
- Priorize livros que os SEGUIDORES pediram ou que se conectam com comentários reais
- Remova apenas livros que não tiveram NENHUMA interação após 30 dias

ESTRATÉGIA COMUNIDADES WhatsApp (a cada 1024 seguidores):
- A cada 1024 novos seguidores, considere criar um novo grupo temático
- Os livros do catálogo devem ser distribuídos entre os grupos por TEMA
- Grupo de ansiedade → livros de ansiedade; Grupo de relacionamentos → livros de relacionamentos
- A recomendação aparece DENTRO da conversa, como se fosse parte natural do papo

REGRAS DE CURADORIA:
1. APENAS livros REAIS best-sellers disponíveis na Amazon Brasil
2. Use ASIN real quando souber
3. Priorize edições em PORTUGUÊS
4. Mix baseado no que seguidores PEDEM (não fórmula fixa)
5. Variação de preço (barato + médio + premium)
6. Micro-resenha PESSOAL (como estudante de psicologia falaria para amigas)
7. NUNCA repita livros que já estão no catálogo existente

FORMATOS DE LINK:
- Amazon: https://www.amazon.com.br/dp/{ASIN}?tag=${affiliateTag}

Retorne JSON:
{
  "new_books": [
    {
      "title": "Título",
      "author": "Autor",
      "asin": "ASIN",
      "amazon_url": "https://www.amazon.com.br/dp/ASIN?tag=${affiliateTag}",
      "category": "ansiedade|relacionamentos|trauma|autoconhecimento|neurociência|comportamento|desenvolvimento_pessoal",
      "micro_review": "Resenha pessoal genuína de 1-2 frases",
      "whatsapp_mention": "Frase NATURAL para o grupo (como se fosse parte de uma conversa)",
      "instagram_caption": "Caption com emoji (nunca parecer anúncio)",
      "pinterest_description": "Descrição SEO",
      "youtube_mention": "Menção natural em vídeo",
      "follower_demand": "Qual comentário/pedido/dor dos seguidores motivou essa indicação",
      "target_group_type": "geral|ansiedade|relacionamentos|autoconhecimento|estudantes",
      "price_range": "barato|medio|premium",
      "relevance_score": 0-100
    }
  ],
  "books_to_remove": ["títulos de livros sem interação que devem sair"],
  "community_strategy": {
    "total_followers": 0,
    "milestone_1024": 0,
    "current_groups": 0,
    "should_create_group": false,
    "suggested_new_group": "tipo do novo grupo baseado em demanda",
    "group_book_distribution": {"grupo_tipo": ["livros recomendados para esse grupo"]}
  },
  "whatsapp_subtle_messages": {
    "geral": "Mensagem natural para grupo geral (NÃO é catálogo, é CONVERSA com menção a 1-2 livros)",
    "tematico": "Mensagem para grupo temático com livro relevante ao tema"
  },
  "weekly_theme": "Tema da semana baseado no que seguidores mais comentaram",
  "strategy_notes": "Notas sobre o que está funcionando e o que ajustar"
}

Retorne APENAS JSON, sem markdown.`
          },
          {
            role: "user",
            content: `CURADORIA INCREMENTAL — ${new Date().toISOString().slice(0, 10)}

LIVROS JÁ NO CATÁLOGO (NÃO repetir):
${existingTitles || "Nenhum ainda — primeira curadoria"}

TOTAL DE LIVROS EXISTENTES: ${existingBooks.length}

DADOS DA COMUNIDADE:
- Total seguidores: ${totalFollowers}
- Milestone 1024: ${communityMilestone} (grupos possíveis)
- Grupos WhatsApp ativos: ${currentGroups}
- Membros WhatsApp total: ${totalWhatsappMembers}
- Precisa criar novo grupo? ${shouldCreateNewGroup ? "SIM" : "NÃO"}
- Grupos: ${(whatsappGroups || []).map((g: any) => `${g.name} (${g.group_type}, ${g.members_count} membros)`).join("; ") || "nenhum"}

O QUE OS SEGUIDORES ESTÃO COMENTANDO/PEDINDO:
${followerTopics.join(", ") || "temas gerais de psicologia e saúde mental"}

CONVERSAS RECENTES NAS COMUNIDADES WhatsApp:
${whatsappConversations || "primeiras conversas"}

TÓPICOS VIRAIS NO MOMENTO:
${trendingTopics.join(", ") || "psicologia, ansiedade, relacionamentos"}

APRENDIZADO DO CÉREBRO:
${(learnings?.latest?.what_worked || []).join("; ") || "primeira curadoria"}

PLATAFORMA FOCO: ${platform || "todas"}

Adicione 3-6 livros NOVOS que respondam ao que os seguidores estão pedindo. NUNCA venda — apenas recomende como amiga.`
          }
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    let raw = aiData.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let result: any;
    try { result = JSON.parse(raw); } catch { result = { new_books: [], raw_analysis: raw }; }

    // GROW the catalog: merge existing + new, remove flagged
    const booksToRemove = new Set((result.books_to_remove || []).map((t: string) => t.toLowerCase()));
    const keptBooks = existingBooks.filter((b: any) => !booksToRemove.has(b.title?.toLowerCase()));
    const mergedCatalog = [...keptBooks, ...(result.new_books || [])];

    // Save GROWING catalog
    await supabase.from("settings").upsert({
      key: "amazon_book_catalog",
      value: {
        catalog: mergedCatalog,
        community_strategy: result.community_strategy || {},
        whatsapp_subtle_messages: result.whatsapp_subtle_messages || {},
        weekly_theme: result.weekly_theme,
        strategy_notes: result.strategy_notes,
        affiliate_tag: affiliateTag,
        last_curated: new Date().toISOString(),
        total_books: mergedCatalog.length,
        books_added_this_run: (result.new_books || []).length,
        books_removed_this_run: booksToRemove.size,
        follower_milestone: communityMilestone,
      },
    }, { onConflict: "key" });

    // If milestone suggests new group, log it
    if (shouldCreateNewGroup && result.community_strategy?.suggested_new_group) {
      await supabase.from("system_logs").insert({
        event_type: "comunidade",
        message: `🎯 Milestone ${communityMilestone * 1024} seguidores! Sugestão: criar grupo "${result.community_strategy.suggested_new_group}"`,
        level: "info",
        metadata: { milestone: communityMilestone, total_followers: totalFollowers, suggestion: result.community_strategy.suggested_new_group },
      });
    }

    await supabase.from("system_logs").insert({
      event_type: "monetizacao",
      message: `📚 Catálogo CRESCEU: +${(result.new_books || []).length} livros (total: ${mergedCatalog.length}) — Tema: "${result.weekly_theme || "variado"}" — Milestone: ${communityMilestone}x1024`,
      level: "info",
      metadata: {
        total_books: mergedCatalog.length,
        new_books: (result.new_books || []).length,
        removed: booksToRemove.size,
        milestone: communityMilestone,
        affiliate_tag: affiliateTag,
      },
    });

    return new Response(JSON.stringify({ ...result, catalog: mergedCatalog, total_books: mergedCatalog.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("curate-amazon-books error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
