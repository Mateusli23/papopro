# PapoPro — Briefing de Engenharia

> **Para Claude e qualquer dev (humano ou IA) que abrir esse repo.**
> Esse arquivo é a fonte rápida de orientação. Para o spec completo de produto, leia [docs/PRD.md](docs/PRD.md).

---

## 1. Visão Geral

**PapoPro** é um CRM SaaS multi-empresa para times de vendas consultivas (1–15 vendedores) em mercados de ciclo médio/longo (imobiliário, B2B, alto ticket) que usam **WhatsApp como canal principal de relacionamento**.

**Beachhead:** times de 2–10 vendedores SMB no Brasil.

**Três diferenciais que justificam a existência do produto:**

1. **Motor de cadência automática** — todo lead recebe a sequência configurada, sem depender da memória do vendedor.
2. **Alertas de lead frio por etapa do funil** — sistema avisa antes do negócio esfriar, com defaults por etapa.
3. **WhatsApp centralizado dentro do CRM** — caixa unificada do time, vinculada a leads, com camada anti-bloqueio.

A combinação transforma pipeline reativo (vendedor lembra → vendedor age) em pipeline proativo (sistema lembra → vendedor executa).

**Cronograma:** 120 dias até MVP em produção. Sprints quinzenais. Lançamento fechado para 5–10 usuários antes do trial público.

---

## 2. Stack Técnica

### Frontend

| Item                            | Versão / Plano |
| ------------------------------- | -------------- |
| TypeScript                      | 5 (strict)     |
| Next.js (App Router)            | 14             |
| React                           | 18             |
| Tailwind CSS + shadcn/ui        | latest         |
| @dnd-kit (drag-and-drop Kanban) | latest         |
| Recharts (gráficos)             | latest         |
| React Hook Form + Zod           | latest         |
| TanStack Query                  | v5             |
| date-fns                        | latest         |
| react-hot-toast                 | latest         |
| Lucide React                    | latest         |

### Backend / Data

| Item                                                                 | Versão / Plano |
| -------------------------------------------------------------------- | -------------- |
| Next.js API Routes + Server Actions                                  | 14             |
| Supabase Edge Functions                                              | Deno           |
| Supabase (Postgres + Auth + Storage + Realtime + pgvector + pg_cron) | Pro US$ 25/mês |
| Prisma ORM                                                           | latest         |
| Web Push API + VAPID + Service Worker                                | nativo         |

### IA

| Item                            | Plano       |
| ------------------------------- | ----------- |
| Anthropic Claude API (Sonnet)   | pay-per-use |
| OpenAI `text-embedding-3-small` | pay-per-use |

### Integrações

| Item                                           | Plano                     |
| ---------------------------------------------- | ------------------------- |
| WhatsApp Standard — uazapi (Whatsmeow)         | ~R$ 30/número/mês         |
| WhatsApp Enterprise — Cloud API Meta           | pay-per-conversation (V2) |
| Stripe (Checkout + Customer Portal + Webhooks) | 3,99% + R$ 0,39/transação |
| Resend (email transacional)                    | Pro US$ 20/mês            |
| Google Calendar OAuth                          | nativo                    |

### Tooling / Observabilidade

| Item                        | Plano                    |
| --------------------------- | ------------------------ |
| Vercel (deploy)             | Pro US$ 20/mês           |
| Sentry (error tracking)     | Team US$ 26/mês          |
| PostHog (product analytics) | Free 1M eventos          |
| GitHub Actions (CI/CD)      | gratuito                 |
| Cursor + Claude Code        | Anthropic Pro US$ 20/mês |

**Custo fixo operacional ~R$ 615/mês** + variável por workspace (uazapi, Claude tokens, Stripe).

---

## 3. Estrutura do Monorepo

```
app_crm/
├── apps/
│   ├── landing/              Next.js 14 — pipeflow.com.br (raiz)
│   └── web/                  Next.js 14 — app.pipeflow.com.br (produto/PWA)
├── packages/
│   ├── ui/                   shadcn/ui compartilhado + design tokens
│   ├── db/                   Prisma schema + client + migrations
│   └── config/               eslint, tsconfig, tailwind preset
├── docs/
│   └── PRD.md                Spec completo do produto (v1.0)
├── .claude/                  agents, skills, settings do Claude Code
├── .mcp.json                 Supabase, GitHub, PostgreSQL MCP
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── CLAUDE.md                 (este arquivo)
```

**Gerenciador:** pnpm + Turborepo.
**Comandos típicos:**

- `pnpm dev` — sobe `landing` e `web` em paralelo
- `pnpm build` — build de todos os apps
- `pnpm lint` / `pnpm typecheck` — checks transversais
- `pnpm db:push` / `pnpm db:migrate` / `pnpm db:studio` — Prisma

---

## 4. Estrutura Interna de `apps/web` (feature-based colocation)

```
apps/web/
├── app/                              App Router — apenas rotas
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── forgot/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                sidebar + workspace switcher
│   │   ├── leads/page.tsx
│   │   ├── kanban/page.tsx
│   │   ├── inbox/page.tsx            caixa WhatsApp unificada
│   │   ├── agents/page.tsx
│   │   ├── cadences/page.tsx
│   │   ├── tasks/page.tsx
│   │   ├── reports/page.tsx
│   │   └── settings/{workspace,team,billing,notifications,connections}
│   ├── api/
│   │   └── webhooks/
│   │       ├── stripe/route.ts
│   │       ├── whatsapp/route.ts     uazapi inbound
│   │       └── leads/[token]/route.ts inbound de Meta/Google/RD/Hotmart
│   └── layout.tsx
├── features/                         Lógica de domínio colocada por feature
│   ├── leads/
│   │   ├── components/
│   │   ├── actions.ts                Server Actions
│   │   ├── queries.ts                queries Prisma server-side
│   │   ├── schemas.ts                Zod
│   │   └── types.ts
│   ├── deals/
│   ├── kanban/
│   ├── inbox/
│   ├── agents/
│   ├── cadences/
│   ├── tasks/
│   ├── workspace/
│   ├── billing/
│   └── notifications/
├── components/ui/                    shadcn primitives (Button, Input, …)
├── components/                       componentes transversais (sidebar, topbar)
├── lib/
│   ├── supabase/{client,server,admin}.ts
│   ├── whatsapp/
│   │   ├── adapter.ts                interface única
│   │   ├── uazapi.ts                 implementação Standard
│   │   ├── cloud.ts                  implementação Enterprise (V2)
│   │   └── anti-ban.ts               rate-limit, jitter, blacklist
│   ├── ai/
│   │   ├── claude.ts                 wrapper Anthropic SDK
│   │   ├── embeddings.ts             OpenAI embeddings
│   │   └── memory.ts                 sessão + lead + empresa
│   ├── auth/
│   ├── audit/                        log de auditoria LGPD
│   ├── notifications/                push + email + in-app
│   └── utils/
├── hooks/                            hooks transversais (não-feature)
├── public/
│   ├── manifest.json                 PWA
│   └── sw.js                         Service Worker
└── middleware.ts                     subdomain routing + auth gate
```

**Princípio:** se uma feature precisa de componentes, server actions, schemas e tipos, eles ficam juntos em `features/<feature>/`. `lib/` é para integrações com serviços externos. `components/ui/` é só o design system primitivo.

---

## 5. Convenções de Código

- **TypeScript strict.** Sem `any` implícito. `// @ts-expect-error` exige comentário explicando o porquê.
- **Naming:**
  - Arquivos: `kebab-case.ts` / `kebab-case.tsx`
  - Componentes (export): `PascalCase`
  - Funções e variáveis: `camelCase`
  - Constantes: `SCREAMING_SNAKE_CASE`
  - Tabelas Postgres: `snake_case` no plural (`leads`, `deals`, `cadence_steps`)
- **Imports** absolutos via:
  - `@/...` dentro de `apps/web` ou `apps/landing`
  - `@papopro/ui`, `@papopro/db`, `@papopro/config` para packages compartilhados
  - **Ordem:** react → libs externas → `@papopro/*` → `@/` → relativos. Linha em branco entre blocos.
- **Server Components por default.** `"use client"` só quando o arquivo tem `useState`, `useEffect`, hook de browser, ou listener de evento.
- **Mutations** via Server Actions (`"use server"`). **Reads client-side** via TanStack Query. Reads server-side via queries Prisma diretas em Server Components.
- **Validação:** **Zod em 100% do input externo** (form, search params, webhook body, API route). Valide na borda, confie no tipo internamente.
- **Datas:** sempre `date-fns` com timezone `America/Sao_Paulo`. Não usar `new Date()` cru em lógica de negócio — passar por helper testável (`now()` injetável).
- **Tailwind:** usar **tokens semânticos** do `packages/config/tailwind.preset.ts` (`bg-primary`, `text-muted-foreground`, `border-destructive`). **Nada de cor hardcoded** em componentes (`#367BEC` só no preset/tokens).
- **Variantes de componentes** com `cva` (class-variance-authority). Estilos coesos vivem no componente, não em strings espalhadas.
- **Estado:** local com `useState`. Global compartilhado (workspace ativo, status WhatsApp) com **Zustand**. Server state sempre via TanStack Query, nunca em Zustand.
- **Microcopy** sempre **pt-BR direto**. CTAs em verbo no infinitivo (`Adicionar lead`, `Conectar WhatsApp`, `Criar agente`). Mensagens de erro são propositivas.

---

## 6. Decisões Arquiteturais Críticas

### Multi-tenant via Supabase RLS

- Toda tabela de domínio tem `workspace_id NOT NULL` e **políticas RLS obrigatórias** antes de migrar.
- Prisma + RLS exige `prisma.$executeRaw\`SET LOCAL app.workspace_id = ${ctx.workspaceId}\``no início de **cada request server-side** (transação ou conexão dedicada). Helper centralizado em`lib/supabase/with-workspace.ts`.
- Cliente browser usa **anon key** + sessão Supabase Auth — RLS protege automaticamente.
- Nunca prossiga com migração nova sem revisar a policy correspondente.

### WhatsApp Adapter Pattern

- `lib/whatsapp/adapter.ts` define `interface WhatsAppAdapter { sendText, sendMedia, getStatus, ... }`.
- `uazapi.ts` (Standard, plano Pro/Pro IA) e `cloud.ts` (Enterprise, V2) implementam a mesma interface. Cliente migra de Standard para Enterprise sem retrabalho.
- **Toda chamada de envio** passa por `anti-ban.ts` antes de tocar o adapter — rate-limit por workspace, jitter aleatório (30–90s), janela horária (default 9h–21h), blacklist (opt-out `PARE`/`SAIR`/`CANCELAR`), pausa a cada 50 envios, health score do número.
- **Heartbeat** a cada 60s via Edge Function + `pg_cron`. Queda → push + email + pausa de cadências em fila.

### Memória IA em 3 camadas

- **Sessão** — últimas N mensagens da conversa atual em contexto direto. **Isolada por agente** (mesmo lead pode falar com agente A e agente B com sessões separadas).
- **Lead** — resumo persistido em `leads.ai_summary`, atualizado por job após cada interação. **Compartilhado entre agentes do mesmo workspace.**
- **Empresa** — base de conhecimento ("Cérebro da Empresa") em pgvector. Recuperação semântica top-K antes do prompt. Compartilhada por todos os agentes.
- Prompt do agente define **qual parte da base é prioritária** (não substitui RAG).

### Webhooks externos via Supabase Edge Functions

- Endpoints em `apps/web/app/api/webhooks/*` (Next) **OU** Edge Function (Supabase) — preferir Edge Function quando o webhook precisa rodar mesmo com a Vercel offline.
- **Verificação de assinatura obrigatória** em Stripe e WhatsApp Cloud. Webhooks de leads ads validados por `token` único por workspace.
- **Idempotência** por `event_id` (Stripe) ou hash de payload (uazapi) salvo em `webhook_events`.

### Notificações

- **Web Push (PWA)** com VAPID keys + Service Worker.
- **Email transacional** via Resend só para eventos críticos (queda WhatsApp, trial expirando, falha de pagamento, convite).
- **In-app** via sino com badge + drawer com histórico de 30 dias.
- Matriz completa de evento × canal está em [docs/PRD.md §3.2](docs/PRD.md). Implementar exatamente como descrito — eventos administrativos não podem ser desligados.

### Background jobs

- `pg_cron` (Supabase) agenda Edge Functions:
  - Motor de cadência (a cada 5 minutos)
  - Detector de lead frio (a cada hora)
  - Heartbeat de conexões WhatsApp (a cada 60s)
  - Exportações pesadas >1.000 linhas (sob demanda, link por email com 7d de validade)
  - Cleanup de mídia órfã (diário, +30d desde delete)

---

## 7. Regras Críticas (NUNCA viole)

1. **Nunca** expor `SUPABASE_SERVICE_ROLE_KEY` no client. Anon key + RLS no browser; service role só em Server Actions, Route Handlers e Edge Functions.
2. **Toda query de domínio filtra `workspace_id` no código**, mesmo com RLS ativa. Defense in depth — proteção contra bug de policy.
3. **Nenhum envio de WhatsApp sai sem passar pelo `anti-ban.ts`** (rate-limit + janela horária + blacklist).
4. **Webhooks Stripe e WhatsApp Cloud verificam assinatura.** Sem assinatura válida → 401 imediato.
5. **LGPD:**
   - Consentimento explícito no cadastro de lead (origem + checkbox quando aplicável).
   - Opt-out (`PARE`/`SAIR`/`CANCELAR`) registrado em `blacklist` do workspace e respeitado em todos os envios.
   - Log de auditoria em **toda exportação** (quem, quando, o quê).
   - Retenção de logs: 12 meses padrão, 24 meses no Enterprise.
   - Exportação completa por solicitação do titular + exclusão sob demanda.
6. **Microcopy em pt-BR direto.** Sem traduzir literal de inglês. Erros são propositivos ("Não foi possível conectar — verifique se o WhatsApp está aberto no celular"), não genéricos ("Erro 500").
7. **Trial:** 7 dias **sem cartão**. Bloqueio progressivo após cancelamento (read-only por 30 dias antes da exclusão).
8. **Verificação de email obrigatória** antes do primeiro acesso. Sem confirmação → não entra no produto.

---

## 8. Identidade Visual

### Paleta (tokens em `packages/config/tailwind.preset.ts`)

| Token              | Hex       | Uso                                                         |
| ------------------ | --------- | ----------------------------------------------------------- |
| `primary`          | `#367BEC` | CTAs, navegação ativa, links                                |
| `accent`           | `#FFB715` | amarelo decorativo — microcaixas, BrandArcs, CTAs especiais |
| `foreground`       | `#0F1C3E` | texto principal (navy)                                      |
| `muted-foreground` | `#475569` | texto secundário                                            |
| `muted`            | `#F1F5F9` | fundos sutis                                                |
| `success`          | `#10B981` | lead quente, conexão ativa                                  |
| `warning`          | `#F59E0B` | lead morno, instável (estado semântico — ≠ `accent`)        |
| `destructive`      | `#EF4444` | lead frio, desconectado                                     |
| `info`             | `#3B82F6` | informação neutra                                           |

**Importante:** `accent` (amarelo) é decorativo; `warning` (amarelo mostarda) é estado semântico. Eles existem em paralelo justamente porque o produto precisa marcar "lead morno" sem que isso colida com a identidade da marca.

**Dark mode é tema de primeira classe**, não opção secundária. Todo componente deve ser testado nos dois temas.

### Elementos de marca (`BrandArcs`)

Componente em `@papopro/ui` que renderiza arcos decorativos em SVG (azul + amarelo + foreground). **Uso restrito a superfícies de marketing e onboarding**: landing (`apps/landing`), telas de auth (`/login`, `/signup`, `/forgot`), e estados vazios grandes ("conecte o WhatsApp", "primeiro lead"). Não usar em superfícies densas (Kanban, inbox, tabelas) — a decoração compete com a leitura de dados.

### Tipografia

- **Poppins** via `next/font/google` (auto-host, sem CDN externo).
- Pesos carregados: 400 (body), 500 (highlights/botões), 600 (títulos), 700 (ênfase).
- Títulos: 18–24px, peso 600.
- Body: 14–16px, peso 400.
- Captions: 12px, peso 500.

### Spacing & Layout

- Múltiplos de **4px** (4, 8, 12, 16, 24, 32, 48, 64).
- `border-radius`: 8–12px.
- Sombras sutis (`shadow-sm` / `shadow`), nada brutalista.
- Sidebar fixa **240px** com ícones + labels.
- Breakpoints: mobile 320–768, tablet 768–1024, desktop 1024+.

### Princípios de design (mistura calibrada)

- **Densidade alta** (HubSpot) com **elegância** (Attio).
- **Velocidade fluida** (Linear) com **flexibilidade** (Notion).
- **Voz brasileira direta** (DataCrazy) com **Kanban best-in-class** (Pipedrive).
- Estado vazio sempre orienta o próximo passo. Sem tela em branco.
- Mostrar status com cores e ícones, não só texto.
- Mobile-first nas telas que vendedor usa em campo (Kanban, detalhe do lead, caixa WhatsApp).
- Performance percebida > performance real. UI responde antes do servidor confirmar (optimistic updates).

---

## 9. Glossário de Domínio

| Termo                  | Definição                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Workspace**          | Tenant isolado (uma empresa cliente). Um usuário pode pertencer a vários. Isolamento via RLS.                                 |
| **Lead**               | Contato cru, ainda não qualificado como oportunidade.                                                                         |
| **Deal / Negócio**     | Oportunidade comercial ligada a um lead, com valor e etapa de pipeline.                                                       |
| **Pipeline / Funil**   | Sequência de etapas customizáveis por workspace (default: Novo → Contato → Proposta → Negociação → Ganho/Perdido).            |
| **Cadência**           | Sequência configurável de mensagens automáticas por etapa, com gatilhos D+0/D+1/D+3/D+7/D+14/D+30.                            |
| **Agente IA**          | Persona configurável (prompt + roteamento + base de conhecimento). Até 3 ativos por workspace no Pro IA.                      |
| **Handoff**            | Transferência de conversa: agente→agente ou agente→humano, com resumo automático do contexto.                                 |
| **Health Score**       | Saúde da conexão WhatsApp do workspace: verde / amarelo / vermelho. Vermelho pausa envios automaticamente.                    |
| **Cérebro da Empresa** | Base de conhecimento compartilhada do workspace (campos estruturados + arquivos em pgvector).                                 |
| **Anti-ban**           | Camada de proteção contra bloqueio de número (rate-limit, jitter, janela horária, blacklist, opt-out, variação de templates). |
| **RBAC**               | Owner / Admin / Manager / Vendedor / Viewer — ver [PRD §2.6](docs/PRD.md).                                                    |

---

## 10. Workflow de Desenvolvimento

**120 dias até MVP.** Sprints quinzenais, escopo bloqueado.

**Ordem dos milestones:**

1. **Auth + multi-tenant + RLS** — Supabase Auth, workspace, convite por magic link, papéis RBAC, log de auditoria.
2. **CRUD de leads + Kanban** — listagem, detalhe, drag-and-drop, etapas customizáveis, indicador de temperatura.
3. **WhatsApp adapter (uazapi) + caixa unificada** — conexão por QR Code, heartbeat, anti-ban, inbox com 3 painéis.
4. **Motor de cadência + alertas de lead frio** — cadências por etapa, templates, pg_cron, push de alerta, pausa inteligente.
5. **Agentes IA + base de conhecimento** — multi-agente, roteamento, memória 3 camadas, handoff, "Cérebro da Empresa".
6. **Billing Stripe + planos** — Checkout, Customer Portal, webhooks, trial 7d, bloqueio progressivo.
7. **Dashboard + polimento + landing** — métricas operacionais, funil, performance por vendedor, landing page.

**Validação fechada com 5–10 usuários** antes de abrir trial público.

### Estratégia de branching (gitflow strict, ativado em 10-mai-26)

A partir do fim do M6 (Bloco A UI mockada) o repo adotou **gitflow strict** com duas branches longas:

- **`main`** — apenas **releases**. Recebe PRs **somente** vindos de `dev` (`PR dev → main`). Cada merge em `main` representa um conjunto pronto pra produção (ex: "release: M7 backend foundation"). Branch protection ativa.
- **`dev`** — **integration trunk + deploy preview**. É a **default branch no GitHub**. Todo PR de feature/fix/docs sai de `dev` e mira `dev`. Quando um conjunto de PRs em `dev` fechar um milestone ou ficar pronto pra deploy, abre-se um `PR dev → main` de release.

**Regras operacionais:**

- **Branch de feature:** sempre sai de `dev`, mira `dev`. Naming sugerido: `<milestone>-<slug>` (ex: `m7-supabase-auth`, `m6-landing-3`).
- **PR único por feature inclui docs.** O update do `PLAN.md` que registra a feature entra **no mesmo PR**, não em PR separado pós-merge — `dev` é integration, não produção; o registro está sempre alinhado com o código.
- **Release (`PR dev → main`):** abrir quando um milestone (M7, M8 …) ou conjunto coeso de polimentos estiver pronto. Title sugerido: `release: <descrição curta do conjunto>`. Body lista os PRs incluídos. CI deve estar verde em `dev` antes de abrir.
- **CI** dispara em `push` e `pull_request` mirando **`main` ou `dev`** (ver [.github/workflows/ci.yml](.github/workflows/ci.yml)). Nenhum PR mergeia sem checks verdes.
- **Hotfix em `main`** (cenário raro — bug crítico em produção que não pode esperar release): cria branch `hotfix-<slug>` saindo de `main`, abre PR contra `main`, mergeia, e **imediatamente após** abre PR sincronizando `dev` com o hotfix (ou cherry-picka).

---

## 11. Pointers

- **Spec completo de produto:** [docs/PRD.md](docs/PRD.md)
- **MCP servers configurados:** [.mcp.json](.mcp.json) — Supabase (autenticado), GitHub e PostgreSQL (placeholders, ajustar antes de usar).
- **Agents e skills custom do Claude Code:** [.claude/agents/](.claude/agents/), [.claude/skills/](.claude/skills/)
- **Settings do harness:** [.claude/settings.json](.claude/settings.json), [.claude/settings.local.json](.claude/settings.local.json)
- **Plano de bootstrap deste repo:** `C:\Users\Mateus\.claude\plans\prd-papopro-optimized-sketch.md` (referência histórica)

---

## 12. Anti-personas (quem o produto NÃO atende — não construir para)

Para alinhar decisões de escopo, **explicitamente ignore** demandas vindas de:

- Empresas com **>50 vendedores** (precisam de SSO, ERP, customizações enterprise — fora do MVP)
- E-commerce **B2C de baixo ticket e alto volume** (ciclo curto, WhatsApp não é canal central)
- Operações **puramente inbound digitais sem WhatsApp** (HubSpot/RD atendem melhor)
- **Times de pré-vendas SDR puros** sem fechamento (produto cobre ciclo completo, não só qualificação)
- Empresas que exigem **on-premise / self-hosted** (cloud-only no MVP)

Quando o escopo proposto cair numa dessas categorias, sinalize antes de implementar.
