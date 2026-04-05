# 🧠 CérebroDani — Sistema Autônomo de Conteúdo 24/7

Sistema autônomo inteligente para criação, validação e publicação de conteúdo psicoeducativo sobre saúde mental nas redes sociais, operando 24 horas por dia, 7 dias por semana. **Criado por Daniela, estudante de psicologia (formatura prevista: 2027).**

---

## 📋 Sumário

1. [Visão Geral](#visão-geral)
2. [Funcionalidades](#funcionalidades)
3. [Arquitetura do Sistema](#arquitetura-do-sistema)
4. [Edge Functions (Backend)](#edge-functions-backend)
5. [Banco de Dados](#banco-de-dados)
6. [Páginas e Rotas](#páginas-e-rotas)
7. [Componentes Principais](#componentes-principais)
8. [Stack Tecnológica](#stack-tecnológica)
9. [Acesso ao Banco de Dados (API REST)](#acesso-ao-banco-de-dados-api-rest)
10. [Como Rodar Localmente](#como-rodar-localmente)
11. [Deploy](#deploy)
12. [Cron Job 24/7](#cron-job-247)
13. [Licença](#licença)

---

## 🎯 Visão Geral

O **CérebroDani** é um sistema autônomo completo que:

- **Pesquisa** tendências e tópicos relevantes em psicologia usando IA
- **Gera** conteúdo original usando IA (carrosséis, reels, stories, artigos)
- **Valida cientificamente** com IA verificando referências e conceitos
- **Filtra eticamente** seguindo o código do CRP (Conselho Regional de Psicologia)
- **Publica automaticamente** conteúdo aprovado com score ≥ 75
- **Monitora** métricas de engajamento e performance em tempo real
- **Opera 24/7** via cron job a cada 6 horas

---

## ✨ Funcionalidades

### Dashboard Principal (`/`)
- Métricas em tempo real do banco de dados (conteúdos gerados, publicados, score médio)
- Status dos agentes autônomos (Brain, Content, Science, Ethics, Instagram, YouTube)
- Gráfico de performance semanal com dados reais
- Ranking de tópicos mais engajados com dados reais
- Fila de conteúdo pendente com aprovação/rejeição
- **Botão "Rodar Pipeline"** para execução manual do ciclo completo

### Geração de Conteúdo (`/content`)
- Seleção de tema (ansiedade, relacionamentos, trauma, autoestima, burnout, inteligência emocional)
- Seleção de canal (Instagram, YouTube)
- Seleção de tipo (carrossel, reel, story, artigo)
- **Geração real com IA** (Lovable AI / Gemini)
- **Validação científica automática** após geração
- **Validação ética automática** após geração
- Score de qualidade calculado automaticamente

### Canais (`/channels`)
- Gerenciamento de canais (Instagram, YouTube)
- Métricas por canal (seguidores, posts, engajamento)
- Status de conexão

### Logs do Sistema (`/logs`)
- Histórico completo de todas as ações do sistema
- Filtros por tipo (pesquisa, geração, validação, publicação, erro, sistema)
- Dados reais do banco

### Configurações (`/settings`)
- Publicação automática (on/off)
- Score mínimo para publicação (slider 0-100)
- Validação científica (on/off)
- Filtro ético CRP (on/off)
- Configurações persistidas no banco de dados

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────┐
│              CérebroDani UI                     │
│         (React + TypeScript + Vite)             │
├─────────────────────────────────────────────────┤
│  Dashboard │ Content │ Channels │ Logs │ Settings│
├─────────────────────────────────────────────────┤
│         Supabase Client (REST API)              │
├─────────────────────────────────────────────────┤
│              Edge Functions                      │
│  research-trends · generate-content             │
│  validate-science · validate-ethics             │
│  auto-publish · brain-pipeline                  │
├─────────────────────────────────────────────────┤
│            Lovable AI Gateway                   │
│         (Gemini / GPT via API)                  │
├─────────────────────────────────────────────────┤
│         Supabase (PostgreSQL + RLS)             │
│  contents · channels · system_logs · settings   │
├─────────────────────────────────────────────────┤
│         pg_cron (Cron Job a cada 6h)            │
└─────────────────────────────────────────────────┘
```

### Fluxo do Pipeline Autônomo (brain-pipeline)

```
1. Pesquisa de Tendências (research-trends)
         ↓ IA identifica 3 tópicos trending
2. Geração de Conteúdo (generate-content) × 2
         ↓ IA cria conteúdo com prompt especializado
3. Validação Científica (validate-science)
         ↓ IA verifica referências e conceitos
4. Filtro Ético (validate-ethics)
         ↓ IA verifica conformidade com CRP
5. Score de Qualidade (0-100)
         ↓
    ┌────┴────┐
    │ ≥ 75?   │
    ├── Sim ──→ Publicação Automática (se habilitada)
    └── Não ──→ Revisão Manual no dashboard
```

---

## ⚡ Edge Functions (Backend)

| Função | Descrição | Endpoint |
|--------|-----------|----------|
| `research-trends` | Pesquisa tendências de psicologia com IA | `POST /functions/v1/research-trends` |
| `generate-content` | Gera conteúdo (carrossel, reel, story, artigo) com IA | `POST /functions/v1/generate-content` |
| `validate-science` | Validação científica de conteúdo com IA | `POST /functions/v1/validate-science` |
| `validate-ethics` | Validação ética (CRP) de conteúdo com IA | `POST /functions/v1/validate-ethics` |
| `auto-publish` | Publica automaticamente conteúdo aprovado | `POST /functions/v1/auto-publish` |
| `brain-pipeline` | Orquestra todo o fluxo (pesquisa → geração → validação → publicação) | `POST /functions/v1/brain-pipeline` |

### Exemplos de chamada:

```bash
# Gerar conteúdo
curl -X POST "https://qfbjogofvrxdxobmecbk.supabase.co/functions/v1/generate-content" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"topic":"ansiedade","channel":"instagram","content_type":"carrossel"}'

# Rodar pipeline completo
curl -X POST "https://qfbjogofvrxdxobmecbk.supabase.co/functions/v1/brain-pipeline" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Validar conteúdo
curl -X POST "https://qfbjogofvrxdxobmecbk.supabase.co/functions/v1/validate-science" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content_id":"UUID_DO_CONTEUDO"}'
```

---

## 🗄️ Banco de Dados

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `contents` | Conteúdos gerados (título, corpo, tipo, status, score, validações) |
| `channels` | Canais de publicação (Instagram, YouTube, métricas) |
| `system_logs` | Logs do sistema (pesquisa, geração, validação, publicação, erros) |
| `settings` | Configurações key-value (auto_publish, score_threshold, etc.) |

### Schema: `contents`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `title` | TEXT | Título do conteúdo |
| `body` | TEXT | Corpo/texto do conteúdo |
| `content_type` | TEXT | carrossel, reel, story, artigo |
| `status` | TEXT | rascunho, revisao, aprovado, publicado, rejeitado |
| `score` | INTEGER | Score de qualidade 0-100 |
| `channel` | TEXT | instagram, youtube |
| `topic` | TEXT | Tema do conteúdo |
| `scientific_valid` | BOOLEAN | Passou na validação científica |
| `ethics_valid` | BOOLEAN | Passou na validação ética |
| `published_at` | TIMESTAMP | Data de publicação |

### Schema: `channels`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `name` | TEXT | Nome do canal |
| `platform` | TEXT | instagram, youtube |
| `is_connected` | BOOLEAN | Se está conectado |
| `followers` | INTEGER | Número de seguidores |
| `posts_count` | INTEGER | Número de posts |
| `engagement_rate` | NUMERIC | Taxa de engajamento (%) |

### Schema: `system_logs`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `event_type` | TEXT | pesquisa, geracao, validacao, publicacao, erro, sistema |
| `message` | TEXT | Mensagem do log |
| `level` | TEXT | info, warning, error |
| `metadata` | JSONB | Dados adicionais |

### Schema: `settings`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `key` | TEXT | Chave da configuração (unique) |
| `value` | JSONB | Valor da configuração |

---

## 📄 Páginas e Rotas

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | `Index.tsx` | Dashboard principal com métricas e botão pipeline |
| `/content` | `Content.tsx` | Geração e gestão de conteúdos com IA |
| `/channels` | `Channels.tsx` | Gerenciamento de canais |
| `/logs` | `Logs.tsx` | Logs e histórico do sistema |
| `/settings` | `Settings.tsx` | Configurações do sistema |
| `*` | `NotFound.tsx` | Página 404 |

---

## 🧩 Componentes Principais

| Componente | Descrição |
|------------|-----------|
| `DashboardLayout` | Layout principal com sidebar responsiva |
| `AppSidebar` | Navegação lateral |
| `MetricCard` | Card de métrica com ícone e variação |
| `AgentStatus` | Status dos agentes com dados reais dos logs |
| `ContentQueue` | Fila de conteúdo com aprovação/rejeição |
| `PerformanceChart` | Gráfico de performance com dados reais |
| `TopicsRanking` | Ranking de temas com dados reais |

---

## 🛠️ Stack Tecnológica

### Frontend
- **Framework**: React 18 + TypeScript 5
- **Build**: Vite 5
- **Estilização**: Tailwind CSS v3
- **Componentes UI**: shadcn/ui (Radix UI)
- **Roteamento**: React Router DOM v6
- **State Management**: TanStack React Query
- **Ícones**: Lucide React
- **Notificações**: Sonner

### Backend
- **Database**: PostgreSQL (Supabase)
- **Edge Functions**: Deno (Supabase Edge Functions)
- **IA**: Lovable AI Gateway (Gemini / GPT)
- **Cron**: pg_cron + pg_net
- **API**: REST (Supabase Auto-generated)

---

## 🔗 Acesso ao Banco de Dados (API REST)

O banco de dados pode ser acessado externamente via API REST (compatível com Manus, Replit, etc.):

- **Base URL**: `https://qfbjogofvrxdxobmecbk.supabase.co/rest/v1/`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmYmpvZ29mdnJ4ZHhvYm1lY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTU4NjAsImV4cCI6MjA5MDk5MTg2MH0.RiXb0xW3O4z-H2Ui4hSTy87K1MQcxsyIjLTMyaJdYLw`
- **Tabelas**: `contents`, `channels`, `system_logs`, `settings`

```bash
# Listar conteúdos
curl "https://qfbjogofvrxdxobmecbk.supabase.co/rest/v1/contents?order=created_at.desc" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Listar logs
curl "https://qfbjogofvrxdxobmecbk.supabase.co/rest/v1/system_logs?order=created_at.desc&limit=20" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Rodar pipeline
curl -X POST "https://qfbjogofvrxdxobmecbk.supabase.co/functions/v1/brain-pipeline" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" -d '{}'
```

### JavaScript/TypeScript (Supabase SDK)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://qfbjogofvrxdxobmecbk.supabase.co',
  'YOUR_ANON_KEY'
)

// Listar conteúdos
const { data } = await supabase.from('contents').select('*').order('created_at', { ascending: false })

// Gerar conteúdo
const { data: result } = await supabase.functions.invoke('generate-content', {
  body: { topic: 'ansiedade', channel: 'instagram', content_type: 'carrossel' }
})

// Rodar pipeline completo
const { data: pipeline } = await supabase.functions.invoke('brain-pipeline')
```

---

## 🚀 Como Rodar Localmente

```bash
# Clone o repositório
git clone https://github.com/tafita81/core-deploy-glow-b3ab346b.git
cd core-deploy-glow-b3ab346b

# Instale as dependências
npm install

# Configure as variáveis de ambiente
# Crie um arquivo .env com:
# VITE_SUPABASE_URL=https://qfbjogofvrxdxobmecbk.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY
# VITE_SUPABASE_PROJECT_ID=qfbjogofvrxdxobmecbk

# Rode o servidor de desenvolvimento
npm run dev
```

O app estará disponível em `http://localhost:5173`.

---

## 🌐 Deploy

- **URL Publicada**: [https://core-deploy-glow.lovable.app](https://core-deploy-glow.lovable.app)
- **Repositório**: [https://github.com/tafita81/core-deploy-glow-b3ab346b](https://github.com/tafita81/core-deploy-glow-b3ab346b)
- **Lovable Project ID**: `182e6719-55bc-493f-bbc1-53d9ebef177f`

---

## ⏰ Cron Job 24/7

O sistema possui um cron job configurado com `pg_cron` que executa o pipeline completo (`brain-pipeline`) **a cada 6 horas**:

```
0 */6 * * *  →  brain-pipeline
```

**Fluxo automático a cada 6h:**
1. Pesquisa 3 tópicos trending de psicologia
2. Gera 2 conteúdos com IA
3. Valida cientificamente cada conteúdo
4. Valida eticamente (CRP) cada conteúdo
5. Publica automaticamente se score ≥ threshold e auto_publish ativado

---

## 📝 Licença

Este projeto é privado e de uso exclusivo de Dani.
