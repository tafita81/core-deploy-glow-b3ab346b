# 🧠 CérebroDani — Sistema Autônomo de Conteúdo 24/7

Sistema autônomo inteligente para criação, validação e publicação de conteúdo de psicologia nas redes sociais, operando 24 horas por dia, 7 dias por semana.

---

## 📋 Sumário

1. [Visão Geral](#visão-geral)
2. [Funcionalidades](#funcionalidades)
3. [Arquitetura do Sistema](#arquitetura-do-sistema)
4. [Páginas e Rotas](#páginas-e-rotas)
5. [Componentes Principais](#componentes-principais)
6. [Stack Tecnológica](#stack-tecnológica)
7. [Como Rodar Localmente](#como-rodar-localmente)
8. [Deploy](#deploy)
9. [Licença](#licença)

---

## 🎯 Visão Geral

O **CérebroDani** é um dashboard de gerenciamento para um sistema autônomo que:

- **Pesquisa** tendências e tópicos relevantes em psicologia
- **Gera** conteúdo original usando IA (carrosséis, reels, stories, artigos)
- **Valida** cientificamente com referências em periódicos acadêmicos
- **Filtra** eticamente seguindo o código do CRP (Conselho Regional de Psicologia)
- **Publica** automaticamente no Instagram e YouTube
- **Monitora** métricas de engajamento e performance em tempo real

---

## ✨ Funcionalidades

### Dashboard Principal (`/`)
- Métricas em tempo real (conteúdos gerados, engajamento, score médio, publicações)
- Status do agente autônomo (pesquisa, geração, validação, publicação)
- Gráfico de performance semanal
- Ranking de tópicos mais engajados
- Fila de conteúdo pendente

### Gestão de Conteúdo (`/content`)
- Visualização de todos os conteúdos gerados
- Status: rascunho, em revisão, aprovado, publicado
- Filtros e organização por tipo e status

### Canais (`/channels`)
- Gerenciamento de canais de publicação (Instagram, YouTube)
- Métricas por canal
- Status de conexão e configuração

### Logs do Sistema (`/logs`)
- Histórico completo de ações do sistema
- Filtros por tipo de evento
- Rastreabilidade de cada decisão do agente

### Configurações (`/settings`)
- API Keys (OpenAI, Instagram, YouTube)
- Comportamento do cérebro (publicação automática, score mínimo)
- Validações (científica e ética)

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────┐
│              CérebroDani UI                 │
│         (React + TypeScript + Vite)         │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Dashboard │  │ Content  │  │ Channels │  │
│  │   Page    │  │   Page   │  │   Page   │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                             │
│  ┌──────────┐  ┌──────────┐                │
│  │   Logs   │  │ Settings │                │
│  │   Page   │  │   Page   │                │
│  └──────────┘  └──────────┘                │
│                                             │
├─────────────────────────────────────────────┤
│           Componentes Compartilhados        │
│  DashboardLayout · AppSidebar · NavLink     │
│  MetricCard · AgentStatus · ContentQueue    │
│  PerformanceChart · TopicsRanking           │
├─────────────────────────────────────────────┤
│              shadcn/ui · Tailwind CSS       │
└─────────────────────────────────────────────┘
```

### Fluxo do Agente Autônomo

```
Pesquisa de Tendências
        ↓
Geração de Conteúdo (IA)
        ↓
Validação Científica (Periódicos)
        ↓
Filtro Ético (CRP)
        ↓
Score de Qualidade (0-100)
        ↓
   ┌────┴────┐
   │ ≥ 75?   │
   ├── Sim ──→ Publicação Automática
   └── Não ──→ Revisão Manual
```

---

## 📄 Páginas e Rotas

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | `Index.tsx` | Dashboard principal com métricas e visão geral |
| `/content` | `Content.tsx` | Gestão de conteúdos gerados |
| `/channels` | `Channels.tsx` | Gerenciamento de canais de publicação |
| `/logs` | `Logs.tsx` | Logs e histórico do sistema |
| `/settings` | `Settings.tsx` | Configurações do sistema |
| `*` | `NotFound.tsx` | Página 404 |

---

## 🧩 Componentes Principais

| Componente | Descrição |
|------------|-----------|
| `DashboardLayout` | Layout principal com sidebar e área de conteúdo |
| `AppSidebar` | Navegação lateral com links para todas as seções |
| `NavLink` | Link de navegação com indicador de página ativa |
| `MetricCard` | Card de métrica com ícone, valor e variação |
| `AgentStatus` | Indicador de status do agente autônomo em tempo real |
| `ContentQueue` | Fila de conteúdo pendente de revisão/publicação |
| `PerformanceChart` | Gráfico de performance semanal (Recharts) |
| `TopicsRanking` | Ranking dos tópicos mais engajados |

---

## 🛠️ Stack Tecnológica

- **Framework**: React 18 + TypeScript 5
- **Build**: Vite 5
- **Estilização**: Tailwind CSS v3
- **Componentes UI**: shadcn/ui (Radix UI)
- **Gráficos**: Recharts
- **Roteamento**: React Router DOM v6
- **State Management**: TanStack React Query
- **Ícones**: Lucide React
- **Notificações**: Sonner

---

## 🚀 Como Rodar Localmente

```bash
# Clone o repositório
git clone https://github.com/tafita81/Cerebrodani.git
cd Cerebrodani

# Instale as dependências
npm install

# Rode o servidor de desenvolvimento
npm run dev
```

O app estará disponível em `http://localhost:5173`.

---

## 🌐 Deploy

- **URL Publicada**: [https://core-deploy-glow.lovable.app](https://core-deploy-glow.lovable.app)
- **Repositório**: [https://github.com/tafita81/core-deploy-glow-b3ab346b](https://github.com/tafita81/core-deploy-glow-b3ab346b)

---

## 🔗 Acesso ao Banco de Dados (API REST)

O banco de dados pode ser acessado externamente via API REST (compatível com Manus, Replit, etc.):

- **Base URL**: `https://qfbjogofvrxdxobmecbk.supabase.co/rest/v1/`
- **Tabelas**: `contents`, `channels`, `system_logs`, `settings`

```bash
# Exemplo: listar conteúdos
curl "https://qfbjogofvrxdxobmecbk.supabase.co/rest/v1/contents" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 📝 Licença

Este projeto é privado e de uso exclusivo de Dani.
