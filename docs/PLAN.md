# PapoPro — Plano de Execução

> Plano de construção do MVP em **120 dias** dividido em **13 marcos**.
> Stack, decisões arquiteturais e regras críticas estão em [../CLAUDE.md](../CLAUDE.md).
> Spec completo do produto em [PRD.md](PRD.md).

---

## Abordagem

**Interface primeiro, backend depois — em dois blocos sequenciais.**

1. **Bloco A (M1–M6, ~50 dias):** scaffolding, design system e **toda a UI do produto e da landing com fixtures/mocks**. Ao final do bloco, o produto navega ponta-a-ponta como uma demo clicável; nada persiste.
2. **Bloco B (M7–M13, ~70 dias):** substitui os mocks por backend real (Supabase, RLS, integrações), entrega as features de motor (cadência, IA, billing) e termina em produção com PWA + push.

**Por quê inverter?** Validamos UX, microcopy, fluxos e densidade visual cedo, com risco baixo. Os shapes de dados que emergem da UI viram contrato para o schema Prisma — backend nasce já alinhado ao que o usuário vê. Evita o anti-padrão "schema desenhado isolado → UI sofre pra encaixar".

**Cronograma alvo (sprints quinzenais):**

| Sprint   | Dias    | Marcos cobertos | Status                                                                                                                        |
| -------- | ------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Sprint 1 | 1–15    | M1, M2          | ✅ concluído                                                                                                                  |
| Sprint 2 | 16–30   | M3              | ✅ concluído                                                                                                                  |
| Sprint 3 | 31–45   | M4              | ✅ concluído                                                                                                                  |
| Sprint 4 | 46–60   | M5              | ✅ concluído — 6 / 6 sub-PRs + 2 polimentos (M5p#1, M5p#2)                                                                    |
| Sprint 5 | 61–75   | M6, M7          | ✅ concluída — M6 (3/3) + M7 (6/6 — 2 releases: M7#1-#5 em 12-mai-26 parcial, M7#6 fecha milestone)                           |
| Sprint 6 | 76–90   | M8              | ✅ concluído — 7 / 7 sub-PRs (+ hotfix Docker local M8#6 fix em #70)                                                          |
| Sprint 7 | 91–105  | M9, M10         | 🚧 em andamento — M9 (5/5 ✅) + M10 (4/5 — falta M10#5 reports + smoke E2E). Release parcial M10#1-#4 em main 17-mai-26 (#74) |
| Sprint 8 | 106–120 | M11, M12, M13   | ⏳ pendente                                                                                                                   |

**Posição atual (10-mai-26):** **Bloco A (UI mockada) 100% completo.** M1–M6 entregues. O produto navega ponta-a-ponta como demo clicável — `apps/web` (`/`, `/leads`, `/kanban`, `/inbox`, `/agents`, `/cadences`, `/tasks`, `/reports`, `/settings`) com fixtures, e `apps/landing` com 8 seções, calculadora de ROI reativa, formulário de trial RHF + Zod redirecionando pra `app.pipeflow.com.br/signup`, SEO completo (JSON-LD `SoftwareApplication` + `FAQPage`, OG image dinâmica via `next/og`, sitemap, robots, favicon), analytics PostHog/GA4/Meta Pixel condicionadas a env, Lighthouse-ready. **Gitflow strict ativado** (ver CLAUDE.md §10): `dev` é a nova default branch e integration trunk; `main` recebe só releases (`PR dev → main`). Próximo: **M7 (Backend Foundation — Supabase + Auth + Multi-tenant + RLS)** inicia o Bloco B.

**Marco de validação:** ao final de M9 (WhatsApp ponta-a-ponta), abrir beta fechado para 5–10 usuários. Continuar M10–M13 com feedback rodando em paralelo.

---

## Pré-requisitos (antes de M1)

Tarefas externas, sem código, mas bloqueantes para o resto do plano.

- [ ] Registrar domínio `.com.br` no Registro.br (ex: `pipeflow.com.br`)
- [ ] Criar repositório privado no GitHub
- [ ] Criar conta Vercel (Pro) — habilitar dois projetos (landing e web)
- [ ] Criar projeto Supabase (Pro, região São Paulo) e capturar `URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`
- [ ] Criar conta Anthropic e gerar API key (Claude Sonnet)
- [ ] Criar conta OpenAI e gerar API key (apenas para embeddings)
- [ ] Criar conta Stripe em modo test e capturar chaves (`pk_test`, `sk_test`, `whsec_test`)
- [ ] Criar conta Resend e configurar domínio + SPF/DKIM
- [ ] Assinar uazapi e capturar API key + URL base
- [ ] Criar conta Sentry e gerar DSN para `landing` e `web`
- [ ] Criar conta PostHog e gerar project key
- [ ] Gerar par VAPID (Web Push) e guardar pública/privada
- [ ] Criar conta Meta for Developers (Pixel) e GA4 (Property ID)
- [ ] Instalar localmente: Node 20 LTS, pnpm, Git, Cursor + extensão Claude Code, TablePlus/DBeaver

---

## Convenções do plano

- **Branch naming:** `m<N>-<slug>` (ex: `m1-setup`, `m9-whatsapp`). Branch parte sempre de `main` atualizada.
- **Commits durante o marco:** conventional commits (`feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`). Mensagem em pt-BR no corpo, scope em inglês.
- **Marco fecha quando:** todas as caixas marcadas + lint + typecheck + testes passando + PR aprovado + commit final mergeado em `main`.
- **Commit final:** mensagem normalizada que resume o marco (listada em cada seção). Pode ser uma squash merge do PR.
- **Tag opcional ao mergear:** `v0.<N>.0` para marco a marco, `v1.0.0` no fim de M13.

---

## M1 — Setup do Monorepo ✅

**Branch:** `m1-setup` · **Mergeada em:** `main` · **Tag:** `v0.1.0`

**Objetivo:** Esqueleto do monorepo Turborepo com pnpm workspaces, tooling padronizado, CI bloqueando PR com lint/typecheck quebrado. Sem código de produto ainda.

**Entregas:**

- [x] `pnpm-workspace.yaml` + `turbo.json` configurados (pipelines `dev`, `build`, `lint`, `typecheck`, `test`)
- [x] `apps/landing` e `apps/web` criados via `create-next-app` (Next 14, App Router, TS, Tailwind, src dir desabilitado)
- [x] Esqueletos: `packages/ui`, `packages/db`, `packages/config`
- [x] `packages/config` com `tsconfig.base.json`, `eslint.config.mjs`, `prettier.config.mjs`, `tailwind.preset.ts` (placeholder)
- [x] Aliases `@papopro/ui`, `@papopro/db`, `@papopro/config` resolvendo via `tsconfig` paths e `transpilePackages` no Next
- [x] `.env.example` na raiz com **todas** as variáveis previstas (Supabase, uazapi, Anthropic, OpenAI, Stripe, Resend, VAPID, Sentry, PostHog, GA4, Meta Pixel)
- [x] `.gitignore`, `.editorconfig`, `.nvmrc` (Node 20)
- [x] Scripts raiz: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm format`
- [x] Husky + lint-staged: rodam `eslint --fix` + `prettier` nos arquivos staged
- [x] GitHub Actions: workflow `ci.yml` rodando `pnpm install` + `pnpm lint` + `pnpm typecheck` em todo PR
- [x] `README.md` na raiz: 1 parágrafo + links para CLAUDE.md, PRD.md, PLAN.md
- [x] Branch protection no `main`: PR obrigatório, CI verde, 1 review

**Bônus entregue (não estava no plano):**

- [x] `docs/SETUP.md` — guia priorizado de tooling local + contas externas (mapeado por marco)
- [x] `scripts/generate-vapid.mjs` — gerador VAPID sem dependência externa
- [x] `apps/{web,landing}/.env.local.example` — templates específicos por app
- [x] VAPID keypair + `AUTH_SECRET` gerados localmente (em `apps/web/.env.local`, gitignored)
- [x] Husky `commit-msg` validando Conventional Commits
- [x] `.github/PULL_REQUEST_TEMPLATE.md`

**Commit final:** `chore(repo): scaffold turborepo monorepo with apps and packages`

---

## M2 — Design System & UI Primitives ✅

**Branches:** `m2-design-system` (entregue em 28-out-25 via PR #2) + `m2-ds-completion` (3 sub-PRs subsequentes preencheram os primitivos faltantes).

**Objetivo:** `packages/ui` consumível com tokens, dark mode de primeira classe, primitivos shadcn customizados via `cva` e componentes de domínio reutilizáveis. Pronto para alimentar todas as telas.

**Entregas:**

- [x] Tokens completos em `packages/config/tailwind.preset.ts` (paleta CLAUDE.md §8 — primary, accent, success/warning/destructive/info, foreground, muted) _(M2 original)_
- [x] CSS vars light/dark em `packages/ui/styles/tokens.css` _(M2 original)_
- [x] Provider `next-themes` configurado em `apps/web/app/layout.tsx`; toggle de tema no topbar _(M2 original)_
- [x] Tipografia: `next/font` com Poppins (substituído de Inter por casar com a marca, CLAUDE.md §8), aplicado em `landing` e `web` via `@fontsource/poppins` _(M2 original — escolha de `@fontsource` em vez de `next/font/google` documentada em `apps/web/app/layout.tsx` por TLS strict bloquear `fonts.googleapis.com`)_
- [x] Re-export central de Lucide icons em `packages/ui/icons.ts` _(M2 original)_
- [x] Primitivos shadcn instalados e expostos via `@papopro/ui`: Button, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Label, Form, Dialog, Sheet, Drawer, Popover, Tooltip, Toast (via `react-hot-toast`), Toaster, Card, Badge, Avatar, Separator, Skeleton, Tabs, DropdownMenu, ContextMenu, ScrollArea, Command (Cmd+K placeholder) _(M2 original entregou ~1/3; m2-ds-completion fechou o resto em 3 sub-PRs)_
- [x] Variantes via `cva` em todos os componentes com mais de 1 estilo
- [x] Componentes de domínio: `StatusDot` (online/idle/offline/neutral), `TemperatureBadge` (hot/warm/cold), `PageHeader`, `EmptyState`, `LoadingState`, `ErrorState`, `KbdShortcut`
- [x] Toaster (`react-hot-toast`) montado em `apps/web/app/layout.tsx` via `apps/web/components/toaster.tsx` (wrapper com tokens semânticos do DS — mantemos `react-hot-toast` fora do package `@papopro/ui` para a landing não arrastar a lib)
- [x] Rota interna `/dev/components` em `apps/web` com showcase de todos os componentes em ambos os temas (originalmente planejada como `/_dev/`, renomeada para `/dev/` porque Next 14 ignora pastas com prefixo `_` como private folders e não expõe como rota)
- [x] Snapshot de acessibilidade básico (axe) na rota `/dev/components` via `@axe-core/react` carregado dinamicamente, ativo só em `NODE_ENV=development`

**Sub-PRs de `m2-ds-completion`:**

- **Sub-PR A — Form & Feedback core**
  - `Checkbox` (Radix), `Textarea`, `RadioGroup` + `RadioGroupItem` (Radix), `Switch` (Radix), `Skeleton`, `Dialog` (Radix)
  - `LoadingState` + `ErrorState` (domínio)
  - `Toaster` em `apps/web/components/toaster.tsx` + montagem no `app/layout.tsx`; `react-hot-toast` em `apps/web/package.json`
  - Refator: [signup-form.tsx](apps/web/features/auth/components/signup-form.tsx) trocou `<input type="checkbox">` cru pelo novo `Checkbox` via `Controller` (RHF)
  - Commit: `feat(ui): form primitives, dialog, toast and loading/error states`

- **Sub-PR B — Selects, Tabs e Form wrapper**
  - `Popover` (Radix), `Select` (Radix), `Tabs` (Radix), `ContextMenu` (Radix), `Command` (cmdk), `Combobox` (Popover + Command)
  - `Form` wrapper RHF-aware estilo shadcn: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField`
  - `react-hook-form` virou `peerDependency` opcional do `@papopro/ui`
  - Commit: `feat(ui): selects, tabs, popover, context-menu, command and rhf form wrapper`

- **Sub-PR C — Drawer, showcase e axe**
  - `Drawer` (vaul) — painel deslizando da borda inferior, ideal pra mobile
  - `/dev/layout.tsx` — header dev com `LogoMark` + `ThemeToggle`, retorna 404 em `VERCEL_ENV=production`, `robots: noindex`
  - `/dev/axe.tsx` — `AxeDevtools` carrega `@axe-core/react` dinamicamente em dev e reporta violações no console (debounce 1000ms)
  - `/dev/components/page.tsx` + `showcase.tsx` — 9 seções (Tipografia/Marca, Cores semânticas, Buttons, Form primitives, Status & Dados, Cards & Layout, Loading/Empty/Error, Tabs, Overlays, Toasts) com instâncias funcionais de todos os primitivos
  - Commit: `feat(ui): drawer + /dev/components showcase com axe-core em dev`

**Commit final do M2 original:** `feat(m2): design system, app shell e tema PapoPro` (PR #2)
**Commit final do M2-completion:** `feat(ui): drawer + /dev/components showcase com axe-core em dev` (PR pendente).

---

## M3 — App Shell + Auth UI + Onboarding (mockado) ✅

**Branches:** `m3-app-shell` (PRs #3 e #4 — auth + onboarding mínimo + forgot/verify-email + stubs legais) + `m3-wizard` (PR pendente — wizard, middleware, AuthMockProvider, Cmd+K).

**Objetivo:** Telas de autenticação, layout do produto (sidebar + topbar + workspace switcher) e wizard de onboarding navegáveis com mocks. Produto "parece" funcionar sem backend.

**Entregas:**

- [x] `(auth)/login/page.tsx` e `(auth)/signup/page.tsx` — formulários com validação Zod + RHF, loading nos botões, erros inline (`role="alert"`, `aria-invalid`, `aria-describedby`) e slot pronto pra erro de submit; navegação fake (login → `/dashboard`, signup → `/onboarding`)
- [x] `(auth)/forgot/page.tsx` — pede email + estado pós-envio com mensagem genérica (anti-enumeração) e instruções "não chegou?"
- [x] `(auth)/verify-email/page.tsx` — espera confirmação com botão "Reenviar" + countdown de 60s, aceita `?email=` opcional
- [x] `(dashboard)/layout.tsx` — sidebar fixa 240px + topbar _(coberto pelo M2)_
- [x] Sidebar com itens: Dashboard, Leads, Kanban, Inbox, Agentes, Cadências, Tarefas, Relatórios, Configurações _(coberto pelo M2)_
- [x] Workspace switcher no topo da sidebar — agora ligado ao `AuthMockProvider` (cookie compartilhado com middleware)
- [x] Topbar: busca placeholder, sino com badge, avatar com menu (perfil, alternar tema, sair) — "Sair" chama `signOut` real do AuthMock
- [x] Drawer de notificações com 30 dias de mocks _(coberto pelo M2)_
- [x] `(dashboard)/page.tsx` — variante pré-onboarding com cards orientando próximo passo (4 cards: WhatsApp, Agente IA, Importar CSV, Adicionar lead) + variante pós-onboarding com KPIs (a do M2)
- [x] Tela "Criar workspace" — destravada via `/onboarding` mínimo + step 1 do wizard (workspace name) que confirma/edita
- [x] Welcome modal + Wizard de 4 passos (workspace, conectar WhatsApp com QR mock, criar agente IA, importar CSV) com botão "Pular este passo" — auto-abre na primeira visita ao dashboard, fecha por X/Esc/Concluir, marca `papopro_auth_mock_wizard_completed=1` no cookie pra não reabrir
- [x] `middleware.ts` — gate de auth que lê o cookie `papopro_auth_mock_user`. Regras: `/` → /dashboard ou /login; rotas (auth) redirecionam pro dashboard se já logado; rotas (dashboard)/onboarding redirecionam pra /login com `?next=`; /legal, /dev, /api, /\_next bypass.
- [x] Provider `AuthMockProvider` com `signIn`, `signOut`, `setActiveWorkspace`, `markWizardCompleted`. Persiste tudo via cookies (compartilhado com middleware). Em M7 substituído por sessão Supabase real — API do hook foi desenhada pra casar.
- [x] Atalho `g + n` para abrir Cmd+K placeholder + `Ctrl/⌘ + K` — `useGlobalShortcuts` ignora foco em `<input>`/`<textarea>`/`[contenteditable]` ou containers com `data-shortcut-ignore`. Palette mostra navegação atual (todos itens hoje vão pra /dashboard) com nota "Versão completa em M5".
- [x] Responsividade: shell colapsa pra menu drawer em <1024px _(M2)_ + auth screens responsivas em ≤md + wizard 2 colunas em md+, 1 coluna em mobile

**Adicional entregue (não estava no plano original do M3):**

- [x] Primitivo `Label` em `@papopro/ui` (gap remanescente do M2)
- [x] `/onboarding` minimalista de 1 passo (nome do workspace) — destrava o fluxo fim-a-fim antes do wizard de 4 passos chegar
- [x] `FormField` composto (Label + Input + erro/hint acessível) em `features/auth/components/`
- [x] Schemas Zod compartilhados de login/signup/onboarding/forgot em `features/auth/schemas.ts`
- [x] Schemas Zod do wizard em `features/onboarding/schemas.ts` (`wizardWorkspaceSchema`, `wizardWhatsappSchema`, `wizardAgentSchema` + `AGENT_TEMPLATES` fixture) — preparados para virar input de Server Actions em M7+
- [x] `react-hook-form ^7.75`, `zod ^4.4` e `@hookform/resolvers ^5.2` adicionados em `apps/web`
- [x] Stubs `/legal/terms` e `/legal/privacy` com layout próprio + EmptyState (texto definitivo entra no M13 com revisão jurídica)
- [x] Ícones `ShieldCheck`, `FileText` e `Smartphone` adicionados ao re-export central em `@papopro/ui/icons`
- [x] Helpers `lib/auth/cookies.ts` (read/write cookie no client + nomes centralizados em `AUTH_MOCK_COOKIES`)

**Sub-PRs do `m3-wizard`:**

- **`m3-wizard` — Welcome wizard, middleware mock e Cmd+K**
  - `lib/auth/cookies.ts` + `lib/auth/auth-mock-provider.tsx` (client provider via cookies)
  - `middleware.ts` Edge runtime com matcher excluindo /api, /\_next, /legal, /dev, estáticos
  - `features/onboarding/components/welcome-wizard.tsx` (Dialog + ProgressBar + 4 steps)
  - 4 steps independentes em `features/onboarding/components/steps/`: workspace, whatsapp (QR SVG mock + status pulse), agent (cards-radio com 4 templates), csv (input file + preview hardcoded)
  - `features/onboarding/components/welcome-wizard-controller.tsx` — auto-abre quando `firstAccess && !wizardCompleted`
  - `apps/web/app/(dashboard)/dashboard/dashboard-content.tsx` — variantes pré e pós-onboarding com `Skeleton` enquanto cookie hidrata
  - `hooks/use-global-shortcuts.ts` + `components/app-shell/cmdk-palette.tsx` (Dialog + cmdk com lista de rotas)
  - `UserMenu` agora chama `signOut`; `WorkspaceSwitcher` lê do AuthMock e persiste via cookie
  - Commit: `feat(web): welcome wizard, auth-mock provider, middleware and cmdk placeholder`

**Commit final do M3:** `feat(web): welcome wizard, auth-mock provider, middleware and cmdk placeholder` (PR `m3-wizard` pendente).

---

## M4 — Leads, Pipeline e Kanban (UI completa, mockada) ✅

**Branch:** `m4-leads-kanban-ui` · entregue em 3 sub-PRs (commits squashed em main).

**Objetivo:** Listagem de leads, página de detalhe e Kanban com drag-and-drop totalmente navegáveis com fixtures realistas. Mostra densidade visual, filtros, atalhos.

**Entregas:**

- [x] Fixtures: 50 leads coerentes em [apps/web/lib/fixtures/leads.ts](apps/web/lib/fixtures/leads.ts) (com timeline em [activities.ts](apps/web/lib/fixtures/activities.ts) — 6 leads "ricos" artesanais + default pra resto — e tasks derivadas em [tasks.ts](apps/web/lib/fixtures/tasks.ts))
- [x] `/leads/page.tsx` — tabela densa estilo Attio: nome, telefone, etapa, vendedor, temperatura, valor, última interação, próxima ação, tags
- [x] Filtros combináveis em chips (etapa, vendedor, origem, tag, temperatura) — funcionais client-side sobre fixtures _(filtro de "período de cadastro" deslizou pra M5 junto com filtro avançado da inbox; resto entregue)_
- [x] Busca por nome/telefone/email/empresa (filtro client-side)
- [x] Modal "Adicionar lead" com formulário Zod
- [x] Modal "Importar CSV" com upload + mapeamento visual de colunas + preview
- [x] `/leads/[id]/page.tsx` — 3 colunas: ficha (esquerda), timeline cronológica (centro), próximas ações (direita)
- [x] Timeline com tipos visuais distintos: mensagem WhatsApp, ligação, email, reunião, nota interna (fundo amarelo), tarefa, mudança de etapa, anexo
- [x] Editor inline de campos da ficha (clique → edita → salva no fixture) — todos os campos da ficha (nome/telefone/email/empresa/cargo/etapa/vendedor/origem/valor/tags/observação) são edit-on-click
- [x] `/kanban/page.tsx` com colunas customizáveis e cards densos
- [x] Drag-and-drop com `@dnd-kit` (entre etapas) — _reordenar dentro da coluna ficou pra M8 quando o `order` virar coluna persistida; sem persistência, reorder é decorativo_
- [x] Indicador de temperatura no canto superior do card
- [x] Indicador de "deal rotting" no canto do card (vermelho atrasado / amarelo próximo / verde do dia / cinza sem) — paleta Pipedrive
- [x] Top bar com switch de visualização (Kanban / Lista) — botão "Ver no Kanban"/"Ver em lista" no header de cada rota
- [x] Atalhos: `n` adiciona lead, `/` foca busca + `g+l` (Leads), `g+k` (Kanban). `Esc` fecha modal/detalhe é nativo do Radix Dialog/Sheet.
- [x] Empty states tratados (sem leads, sem resultados de filtro, sem etapas)
- [x] Mobile: Kanban com **6 colunas horizontais lado a lado** (mesmo layout do desktop), swipe nativo pra navegar entre etapas e **long-press de 250ms** ativa drag — `TouchSensor` + `touch-action` por camada. Detalhe vira tabs.

**Bônus entregue (não estava no plano):**

- [x] Endpoint `/api/smoke-test/leads` — **62 asserts** contra funções puras (filtro, Zod, deal rotting, transformações de deal, agregações, criação). Pode ser invocado em CI; entrega visibilidade antes de Vitest entrar em M7+.
- [x] Fixtures de pipeline ([pipelines.ts](apps/web/lib/fixtures/pipelines.ts)) e vendedores ([sales-reps.ts](apps/web/lib/fixtures/sales-reps.ts)) separadas — ficam reaproveitáveis pelo Inbox/Cadências (M5).
- [x] Helpers de formatação pt-BR ([lib/utils/format.ts](apps/web/lib/utils/format.ts)) — BRL, datas relativas, telefone, iniciais.
- [x] Stores in-memory client-side ([features/leads/store.ts](apps/web/features/leads/store.ts) e [features/deals/store.ts](apps/web/features/deals/store.ts)) com mesma assinatura que vai virar Server Action em M8.
- [x] `useGlobalShortcuts` ampliado pra suportar múltiplos hooks coexistindo sem conflito de evento.

**Refinamento pós-merge: Pipeline Deals (PR #8)**

A primeira versão do `/kanban` tratava `Lead` como proxy de `Deal` — confusão herdada de não respeitar o glossário (CLAUDE.md §9). PR #8 fechou essa lacuna:

- [x] Entidade `Deal` separada ([features/deals/types.ts](apps/web/features/deals/types.ts)) — `{ title, leadId, stageId, valueCents, ownerId, dueAt, status, probability, ... }`. Um lead pode ter 0..N deals.
- [x] [features/deals/transforms.ts](apps/web/features/deals/transforms.ts) — funções puras (`applyMoveDeal`, `applyCreateDeal`, `aggregateByStage`, `sumOpenPipelineCents`, `statusForStage`, `defaultProbabilityFor`) usadas tanto pelo store quanto pelo smoke test. Preparam o terreno pras Server Actions de M8.
- [x] [features/deals/stage-style.ts](apps/web/features/deals/stage-style.ts) — mapa central de estilos por etapa (stripe/headerBg/cardStripe/columnTint).
- [x] 56 deals fixture ([deals.ts](apps/web/lib/fixtures/deals.ts)) — derivados dos 50 leads + 6 "ricos" (clientes recorrentes), com seed determinístico (LCG por leadId — sem hydration mismatch).
- [x] `/kanban` agora mostra **6 colunas** (incluindo Ganho/Perdido), header com nome + count + soma R$, scroll horizontal com `snap-x`.
- [x] `DealCard` redesenhado: stripe lateral (3px) na cor da etapa, título 14px/600, lead vinculado com ícone, valor 16px tabular-nums, footer com `RepAvatar` + `DueDatePill`. Trophy/X discreto pra won/lost. Hover lift + drag rotate 1deg + scale 1.02 + ring primary.
- [x] `DueDatePill` ([due-date-pill.tsx](apps/web/features/deals/components/due-date-pill.tsx)) — 4 estados (overdue destructive+pulse, today warning, ≤3d info, futuro muted, sem prazo "—").
- [x] `PipelineStats` ([pipeline-stats.tsx](apps/web/features/deals/components/pipeline-stats.tsx)) — 4 KPIs reativos no topo (Pipeline ativo info, Em negociação warning, Ganho 30d success, Atrasados destructive). Atualizam em tempo real conforme você arrasta deals.
- [x] `DealCreateDialog` — RHF + Zod, `Combobox` para vincular a lead existente, defaults inteligentes (etapa do "+" da coluna, dueAt +30d).
- [x] `moveDealToStage` aplica side-effects corretos: terminal → status `won`/`lost` + `closedAt`; ativa → status `open` + clear de `closedAt`. Toast contextual por destino (🏆 Ganho / ✖️ Perdido / "movido para X").
- [x] Limpeza: `features/kanban/` removido (era a versão lead-based); `features/kanban/rotting.ts` movido pra `features/leads/rotting.ts` (rotting é semântica de Lead).

**Commits finais:**

- `feat(leads): list, filters and CSV import (mocked)` (Sub-PR A)
- `feat(leads): detail page with timeline and inline edit (mocked)` (Sub-PR B)
- `feat(kanban): drag-and-drop board, deal rotting and global shortcuts` (Sub-PR C)
- `chore(leads): smoke test endpoint for filters, zod and rotting` (revisão de M4)
- `feat(deals): pipeline kanban with deal entity, 6 columns and KPIs` (PR #8 — refinamento pós-merge)
- `chore(deals): pure transforms + extended smoke for drag-drop, totals and create-deal` (revisão do Pipeline)

---

## M5 — Inbox, Agentes, Cadências, Tarefas e Configurações (UI mockada) ✅

**Branch:** `m5-features-ui` (sub-PRs entregues independentemente; ver lista abaixo)

**Objetivo:** UI das demais features de domínio. Maior marco de UI do plano — finaliza o produto navegável de ponta a ponta com fixtures.

**📊 Status (10-mai-26):** 6 / 6 sub-PRs entregues — Bloco A fechado. Próximo: M6 (Landing).

| Sub-PR | Escopo                                                        | Status      | PR                                                   |
| ------ | ------------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| M5#1   | Relatórios `/reports`                                         | ✅ entregue | [#12](https://github.com/Mateusli23/papopro/pull/12) |
| M5#2   | Tarefas `/tasks`                                              | ✅ entregue | [#14](https://github.com/Mateusli23/papopro/pull/14) |
| M5#3   | Cadências `/cadences`                                         | ✅ entregue | [#15](https://github.com/Mateusli23/papopro/pull/15) |
| M5#4a  | Inbox `/inbox` — layout 3 painéis + fixtures + store readonly | ✅ entregue | [#17](https://github.com/Mateusli23/papopro/pull/17) |
| M5#4b  | Inbox composer (texto/emoji/anexo/áudio mock/notas/atalhos)   | ✅ entregue | [#18](https://github.com/Mateusli23/papopro/pull/18) |
| M5#4c  | Inbox filtros + ↑↓ nav + mobile drawer + sidebar badge live   | ✅ entregue | [#20](https://github.com/Mateusli23/papopro/pull/20) |
| M5#5   | Agentes IA `/agents` + Cérebro da Empresa                     | ✅ entregue | [#21](https://github.com/Mateusli23/papopro/pull/21) |
| M5#6   | Configurações `/settings` (6 abas)                            | ✅ entregue | [#23](https://github.com/Mateusli23/papopro/pull/23) |

**Próximo na fila:** M6 (Landing) — fecha o Bloco A inteiro. M5#6 entregou as 6 abas de Configurações com sub-nav lateral, Workspace + Time + Cobrança + Notificações + Conexões + Integrações, todas mockadas; QR Code procedural, health score visual, matriz exata de eventos × canais (PRD §3.2), Stripe Customer Portal mock, webhook de leads inbound com URL única e regenerar token. Atalho global `g + s` + smoke test com ≥ 60 asserts.

**Entregas — Inbox WhatsApp (parte 4a — entregue):**

- [x] `/inbox/page.tsx` em 3 painéis: lista de conversas (esquerda), thread (centro), ficha do lead (direita)
- [x] Bolhas com timestamps BRT, check de leitura (3 estados), indicador "digitando..." mock
- [x] Notas internas com fundo amarelo + ícone de cadeado (renderização)
- [x] Mídia inbound: image/audio/document com componentes dedicados

**Entregas — Inbox WhatsApp (parte 4b — entregue):**

- [x] Composer real: texto + emoji picker (48 emojis curados, zero deps) + anexar imagem/áudio/documento + gravação de áudio (mock animado, sem MediaRecorder real)
- [x] Tabs `Mensagem ↔ Nota interna` no topo do composer (decisão UX: toggle inline ao invés de botão separado)
- [x] Botões de respostas rápidas com placeholders `{nome}`/`{empresa}` resolvidos contra o lead da conversa
- [x] Atalhos: `Enter` envia, `Shift+Enter` quebra linha, `Esc` esvazia draft, **IME-safe** (não envia durante composição de acentos pt-BR)
- [x] Auto-mark-read ao enviar mensagem (paridade com WhatsApp Web)
- [x] Atalho global `g + i` navega para `/inbox` (registrado em `use-global-shortcuts.ts` + footer Cmd+K)
- [x] Inbox sai do `soon` no Cmd+K palette
- [x] Smoke test endpoint `/api/smoke-test/inbox` — **56 asserts** em 8 grupos (fixtures, transforms-read, placeholders, mutations-send-message, mutations-internal-note, mutations-attach-media, edge-cases, schema)
- [x] AutoResizeTextarea custom (1–6 linhas, depois scrolla) — local em `features/inbox/`, promovido pra `@papopro/ui` quando outro feature precisar

**Entregas — Inbox WhatsApp (parte 4c — entregue):**

- [x] Filtros: vendedor (Select), status (chips aguardando/respondido/arquivado), etapa (Select), sem resposta há 1d/3d/7d/14d (chips). Popover com badge contador, default oculta arquivadas (paridade com WhatsApp Web).
- [x] Atalhos `↑↓` para navegar conversas na lista — `<ul role="listbox">` com `aria-activedescendant`, wrap-around, scroll-into-view, `Home`/`End`/`Enter`/`Space` também suportados. Hook escopado `useConversationListKeyboardNav` reusa o guard `isEditableTarget` extraído de `use-global-shortcuts.ts`.
- [x] Mobile single-pane com Drawer (vaul) pra ficha do lead — botão "Ver lead" no header da thread em `lg:hidden`, fecha por gesto/overlay/Esc.
- [x] Sidebar badge ao vivo via `useUnreadCount()` — `<SidebarNav>` mescla o counter no item `/inbox`. Cai pra 0 (some) quando todas conversas estão lidas. MobileNav herda automaticamente.
- [x] Quick actions na ficha do lead: **Mover etapa** (toca `moveLeadToStage`, mesmo path do Kanban) · **Atribuir vendedor** (toca só `conversation.vendorId`, deixa `lead.assignedRepId` intacto) · **Arquivar/Desarquivar** (botão único). Toast com botão "Desfazer" 5s pra reverter.
- [x] Smoke test endpoint atualizado — **97 asserts** em 12 grupos (8 originais + 4 novos: `filters` 14, `mutations-archive` 9, `mutations-reassign` 6, `keyboard-nav-helpers` 6).

**Entregas — Agentes IA (parte M5#5 — entregue):**

- [x] `/agents/page.tsx` — lista de agentes em grid responsivo + KPIs (ativos/3 do limite Pro IA, em teste, pausados, conversas) + busca por nome/persona. Aba "Agentes" + aba "Cérebro da Empresa" via `<Tabs>`.
- [x] `/agents/[id]` — editor 2-col (prompt + persona + roteamento + handoff + simulação | métricas + status) com botões "Salvar versão", "Histórico" e dropdown duplicar/excluir.
- [x] 4 templates pré-configurados promovidos pra `lib/fixtures/agent-templates.ts` (Qualificação SDR, Atendimento, Recuperação, Em branco) com prompts realistas pt-BR + scripts de simulação canned + handoff triggers default por template. `onboarding/schemas.ts` re-exporta pra evitar duplicação.
- [x] Roteamento: 4 critérios combináveis (etapa do funil / tag / número WhatsApp / palavra-chave) com semântica "primeiro hit decide" documentada e testada em smoke. UI inline ("+ Adicionar regra" sem dialog).
- [x] 6 gatilhos de handoff configuráveis (manual, palavra-chave, intenção comercial, etapa Negociação, fora do horário, agente↔agente) com Switch + input condicional de palavras-chave.
- [x] Chat de simulação dentro do editor — script canned por template (3-4 turnos), typing indicator 800ms, IME-safe, Limpar reseta, exhausted mostra microcopy explicando.
- [x] Aba "Cérebro da Empresa" com 5 seções editáveis (Sobre · Produtos · FAQ · Scripts · Política), âncoras laterais sticky em `lg+`, contador de chars por seção. Upload drag-drop **mock leve** (lê só `name`/`size`/`type`, processing 1.5s, status `processed`). Lista de arquivos com remover + Desfazer.
- [x] Versionamento mock leve: histórico via `<Sheet>` lateral com timeline `v3 (atual) · v2 · v1`, "Restaurar" substitui draft + toast com Desfazer 5s. Botão explícito "Salvar versão" cria snapshot do trio (prompt + persona + tom). Restore não cria versão nova (evita explosão).
- [x] **Limite de 3 ativos no Pro IA** enforce no transform (`applyToggleStatus`) — toast vermelho com CTA quando atingido. Smoke cobre o caso.
- [x] Sidebar `Agentes` deixa de ser `soon: true`. Atalho global `g + a` + entry "Agentes IA" no Cmd+K palette. AutoResizeTextarea **promovido pra `@papopro/ui`** (segundo consumer = simulation chat). `showUndoableToast` extraído pra `lib/utils/show-undoable-toast.tsx`. 6 ícones novos em `@papopro/ui/icons`: `Bot`, `Brain`, `Eye`, `EyeOff`, `History`, `RotateCcw`, `Save`.
- [x] Smoke endpoint `/api/smoke-test/agents` com **71 asserts** em 8 grupos (fixtures, templates, filters, aggregations, mutations-agent, mutations-routing-handoff, mutations-knowledge, schema, edge-cases).

**Entregas — Cadências** ✅ _(entregue separadamente, ver "Sub-PR M5#3" abaixo)_:

- [x] `/cadences/page.tsx` — lista de cadências agrupada por etapa do funil (4 etapas ativas; terminais excluídas)
- [x] Editor visual em página dedicada `/cadences/[id]` — timeline vertical com passos D+0/D+1/D+3/D+7/D+14/D+30, canal WhatsApp/email e corpo com placeholders `{nome}`/`{empresa}`/`{produto}`
- [x] Templates pré-configurados (Imobiliário, B2B Consultivo, Alto Ticket) com texto realista pt-BR + opção "Em branco"

**Entregas — Tarefas e Calendário** ✅ _(entregue separadamente, ver "Sub-PR M5#2" abaixo)_:

- [x] `/tasks/page.tsx` com abas "Minhas tarefas", "Time" e "Calendário" _(decisão: "Atribuídas a mim" virou "Minhas" — todo task atribuída ao usuário logado já satisfaz o caso de uso)_
- [x] Calendário views mês/semana/dia (grid customizado com helpers do `date-fns`; `react-day-picker` instalado mas não usado nas views — tratamos task-rich days melhor com grid próprio)
- [x] Modal de criação com tipo, status (auto-pending), prazo e atribuição. _Lembrete e recorrência ficaram pra iteração futura — adiciam complexidade sem valor pra demo mockada._

**Sub-PR M5#2 — Tarefas + Calendário `/tasks`** (entregue antes do resto do M5):

- 3 abas Tabs Radix: **Minhas** (filtro por usuário logado) · **Time** (todas) · **Calendário** (Mês/Semana/Dia toggle)
- Lista usa `<TaskRow>` (checkbox + ícone tipo + título + lead linkado + DueDatePill + RepAvatar). Pendentes em cima, concluídas embaixo com line-through + opacity.
- Calendário com 3 vistas em [features/tasks/components/](apps/web/features/tasks/components/):
  - **Mês**: grid 7×6 com chips coloridos (max 3 visíveis + "+N mais"), click → vista Dia
  - **Semana**: 7 colunas verticais com TaskRow por dia, click no header → vista Dia
  - **Dia**: lista vertical pra um dia específico, com EmptyState orientador
- Toggle Mês/Semana/Dia no header + navegação ←→ + botão "Hoje"
- Modal `TaskCreateDialog` (RHF + Zod) com Combobox de leads, Select de tipo/vendedor, input date pra prazo. `dueAt` default "amanhã 09:00". Pode ser disparado com `defaultDueDate` (quando criar a partir de uma célula do calendário).
- 6 tipos de task com cores semânticas: `call` (info) · `whatsapp` (success) · `email` (warning) · `meeting` (destructive) · `follow_up`/`other` (muted). Mapa central em `task-kind-icon.tsx`.
- Store [features/tasks/store.ts](apps/web/features/tasks/store.ts) com `useSyncExternalStore` (mesmo padrão de leads/deals). Mutações: `createTask`, `updateTask`, `toggleTaskDone`.
- Transforms puras [features/tasks/transforms.ts](apps/web/features/tasks/transforms.ts): `filterTasks`, `getOverdueTasks`, `getTasksOnDay`, `getTasksInRange`, `groupTasksByDay`, `getNextWeekTasks`, `countTasks`. Reusam fixtures de leads + sales-reps.
- Smoke endpoint [/api/smoke-test/tasks](apps/web/app/api/smoke-test/tasks/route.ts) com **34 asserts** em 7 grupos (fixtures, filters, aggregations, calendar, overdue, mutations, schema)
- `react-day-picker` adicionado como dependência (planejado pra usar em formulários de seleção de data futuros, mas o calendário usa grid próprio)
- Sidebar [nav-config.ts](apps/web/components/app-shell/nav-config.ts) — removido `soon: true` de Tarefas
- Commit: `feat(tasks): list, calendar 3-view (mês/semana/dia) and creation modal (mocked)`

**Entregas — Configurações (parte M5#6 — entregue):**

- [x] `/settings/workspace`, `/settings/team`, `/settings/billing`, `/settings/notifications`, `/settings/connections`, `/settings/integrations` — 6 rotas reais com sub-nav lateral 220px (`<Select>` em mobile)
- [x] Tela "Conexões" com QR Code mockado (SVG procedural por seed), status (`disconnected → connecting → connected` em 2s), health score visual segmentado (verde/amarelo/vermelho) e histórico de desconexões (5 linhas cobrindo 4 motivos)
- [x] Preferências de notificação por evento × canal — matriz exata PRD §3.2 (10 eventos × 3 canais), eventos administrativos (Convite + Pagamento) com switch desabilitado + tooltip; bloco de testar push lê `Notification.permission` real
- [x] Convite de membros — tabela com 5 papéis RBAC + filtros (busca + Select de papel) + Dialog de convite com descrições por papel + ações por linha (Mudar papel · Reenviar · Remover)
- [x] Workspace: form RHF+Zod com nome/segmento/fuso/idioma + zona de perigo (Transferir propriedade · Excluir workspace com confirmação dupla)
- [x] Cobrança (Owner-only via banner): plano atual com selo de trial dinâmico, barras de uso (semáforo verde/amarelo/vermelho), método de pagamento, 4 faturas + Dialog "Mudar plano" (3 cards Pro/Pro IA/Enterprise) e cancelamento progressivo
- [x] Integrações: webhook de leads com URL única + Copiar + Regenerar (32 chars hex), Google Calendar conectado mock, Meta/Google Ads/RD/Hotmart como "Em breve"
- [x] Atalho global `g + s` registrado em `use-global-shortcuts.ts` + footer Cmd+K + item `Configurações` removido do `soon: true` (palette + sidebar)
- [x] Smoke endpoint `/api/smoke-test/settings` com ~70 asserts em 6 grupos (fixtures, schemas, transforms-workspace, transforms-members, transforms-notifications, transforms-connections, transforms-integrations)
- [x] 2 ícones novos em `@papopro/ui/icons`: `CreditCard`, `Plug`

**Entregas — Relatórios** ✅ _(entregue separadamente, ver "Sub-PR M5#1" abaixo)_:

- [x] `/reports/page.tsx` com cards: total de leads, pipeline aberto, conversão por etapa, tempo médio por etapa, leads esfriando, performance por vendedor
- [x] Gráfico de funil (Recharts) com volume e valor por etapa

**Sub-PR M5#1 — Relatórios `/reports`** (entregue antes do resto do M5):

- 5 famílias de visualização: 4 KPIs (Total leads · Pipeline aberto · Conversão 30d · Ciclo médio) + ConversionFunnel BarChart Recharts (6 etapas com taxas de avanço) + RepPerformanceTable (5 reps ordenados por valor ganho) + StageTimeCard (4 mini-cards com semáforo) + CoolingLeadsCard (top 6 leads em risco)
- Funções puras em [features/reports/transforms.ts](apps/web/features/reports/transforms.ts) reusam `aggregateByStage`, `sumOpenPipelineCents` (deals), `calcRotState` (leads/rotting) — fontes canônicas
- Funil acumulado (cumulative) diferente do FunnelChart trapezoidal do dashboard (que mostra só abertos por etapa) — Reports é analytics, não snapshot
- Smoke endpoint [/api/smoke-test/reports](apps/web/app/api/smoke-test/reports/route.ts) com 36 asserts cobrindo as 5 famílias + edge cases (workspaces vazios não geram NaN)
- Sidebar [nav-config.ts](apps/web/components/app-shell/nav-config.ts) — removido `soon: true` do item Relatórios
- Filtros (período, vendedor) ficaram fora desta versão pra manter escopo curto — entram em iteração futura ou direto em M8 quando virar Server Action
- Commit: `feat(reports): KPIs, funil de conversão, performance e leads esfriando (mocked)`

**Sub-PR M5#3 — Cadências `/cadences`** (entregue 09-mai-26 via PR #15):

- Lista agrupada por etapa do funil (Novo · Em contato · Proposta · Negociação) — etapas terminais (`ganho`/`perdido`) propositadamente excluídas em [features/cadences/transforms.ts](apps/web/features/cadences/transforms.ts) e rejeitadas pelo `cadenceCreateSchema` via `refine`. Cada grupo tem CTA "+ Criar para esta etapa".
- `CadenceCard` com badge de template (Imobiliário/B2B/Alto Ticket/Personalizada), contagem de passos, canais (WhatsApp/Email), enrollments ativos, taxa de resposta inline + Switch otimista Ativa/Pausada (usa `onCheckedChange` do Radix pra suportar Space/Enter no teclado).
- Modal `CadenceCreateDialog` em 2 passos: TemplatePicker (4 cards com `aria-pressed`) → nome + descrição + etapa (default sugerido pelo template). Submit cria via store e navega pra `/cadences/[id]`.
- 3 templates pré-configurados com texto realista pt-BR em [lib/fixtures/cadence-templates.ts](apps/web/lib/fixtures/cadence-templates.ts) — Imobiliário (6 passos), B2B Consultivo (5 passos), Alto Ticket (6 passos). Copywriting consultivo usando placeholders `{nome}`/`{empresa}`/`{produto}`. Pronto pra ser seedado em M10 sem retrabalho.
- Editor `/cadences/[id]` em 2 colunas (lg+): timeline vertical (col 2/3) + painel de métricas (col 1/3). Header com badge de status, switch, dropdown (duplicar / pausar-ativar / excluir).
- `StepCard` com bullet `D+N` colorido por intensidade (D+0/D+1 primary, D+3/D+7 info, D+14 warning, D+30 muted), badge de canal, preview de 4 linhas com placeholders destacados, dropdown editar/remover (responde a `focus-visible` pra a11y de teclado).
- `StepEditDialog` (RHF + Zod) com Select de `dayOffset` (apenas 0/1/3/7/14/30 — fechado por design conforme PRD §2.2), Select de canal, Textarea + chips clicáveis `{nome}` `{empresa}` `{produto}` que inserem token na posição do cursor.
- `CadenceMetricsPanel` mostra 4 KPIs (leads ativos, total disparado, taxa resposta, avanço de etapa) em fixture — mesma shape que vai virar VIEW Postgres em M10. Timestamps relativos calculados em `useEffect` pós-hydration pra evitar mismatch SSR/client.
- Store [features/cadences/store.ts](apps/web/features/cadences/store.ts) com `useSyncExternalStore` (mesmo padrão de leads/deals/tasks). Mutações: `createCadence`, `updateCadence`, `toggleCadenceStatus`, `duplicateCadence`, `deleteCadence`, `addStep`, `updateStep`, `deleteStep`.
- Transforms puras [features/cadences/transforms.ts](apps/web/features/cadences/transforms.ts) — `apply*` cobrindo todas as mutações, `filterCadences`, `groupCadencesByStage`, `countCadences`, `sumActiveEnrollments`. Steps ordenados por `(dayOffset asc, order asc)` em toda mutação. `applyUpdateStep` recalcula `order` ao trocar `dayOffset` pra evitar colisão silenciosa entre buckets.
- Schemas Zod [features/cadences/schemas.ts](apps/web/features/cadences/schemas.ts) — `cadenceCreateSchema` (rejeita stages terminais via `refine`), `stepCreateSchema` (mín 10 chars no body, dayOffset restrito ao enum). Mensagens em pt-BR direto, validadas no smoke contra vazamento de `Required`/`String must`.
- Smoke endpoint [/api/smoke-test/cadences](apps/web/app/api/smoke-test/cadences/route.ts) com **71 asserts** em 7 grupos (fixtures, templates, filters, aggregations, mutations, schema, edge-cases). Inclui regression tests pros bugs encontrados no review (move de dayOffset recalcula order, duplicate zera métricas, add múltiplo no mesmo dia incrementa order).
- Sidebar [nav-config.ts](apps/web/components/app-shell/nav-config.ts) — removido `soon: true` de Cadências.
- Atalho global novo: `g + c` navega para `/cadences`. Incluído também na palette Cmd+K via [cmdk-palette.tsx](apps/web/components/app-shell/cmdk-palette.tsx).
- Ícones adicionados ao re-export central [packages/ui/src/icons.ts](packages/ui/src/icons.ts): `Briefcase`, `Gem`, `SquarePen`, `Pause`, `Play`.
- Code review do `code-reviewer` agent antes do PR pegou 5 críticos (todos consertados antes do merge): hydration mismatch nos timestamps relativos, foco invisível ao teclado no menu do step, bug em `applyUpdateStep` quando trocava dayOffset sem recalcular order, dois `StepEditDialog` montados simultaneamente, Switch com `onClick` em vez de `onCheckedChange`.
- Commit: `feat(cadences): list grouped by stage, step editor and 3 templates (mocked)`

**Commit final:** `feat(web): inbox, agents, cadences, tasks, reports and settings UI (mocked)`

---

## Polimentos pós-M5 (entre M5 e M6)

Sub-PRs autônomos de polimento que entram entre marcos quando há valor incremental sem precisar esperar o próximo bloco grande. Não são "marcos" formais — só refinos que melhoram o produto navegável.

| Sub-PR | Escopo                                                                      | Status      | PR                                                   |
| ------ | --------------------------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| M5p#1  | Dashboard refresh — filtro de período, trends, donut Origem, banner quentes | ✅ entregue | [#25](https://github.com/Mateusli23/papopro/pull/25) |
| M5p#2  | Fixes do review pós-merge — deep-links funcionais + 6 polimentos            | ✅ entregue | [#27](https://github.com/Mateusli23/papopro/pull/27) |

**Entregas — M5p#1 Dashboard refresh:**

- [x] Header reescrito: saudação `"Olá, {firstName}!"` + segunda linha com data por extenso (`"Domingo, 10 de maio"`) + filtro de período em pills à direita (Hoje · Esta semana · Este mês · Máximo · Personalizado)
- [x] Hook `useDashboardRange()` persiste `?range=` na URL (router.replace, sem poluir history); calcula bounds atual + período anterior igual pra trend
- [x] `<DashboardRangePills>` com Popover usando `react-day-picker` (dep instalada em M5#2 e finalmente usada) pra range custom
- [x] 5 KPIs no topo (era 4): **Leads novos** (com trend) · **Tarefas pendentes** · **Pipeline R$** · **Taxa de conversão** (com trend) · **Propostas R$** (com trend). Trend indicator (↑/↓ %) compara período atual com janela anterior igual
- [x] `<KpiCard>` extraído como primitivo reutilizável em `features/dashboard/components/kpi-card.tsx` — futuro reuso em `/reports`
- [x] `<FunnelHorizontalChart>` substitui `<DashboardFunnelChart>` (Recharts trapezoidal). Barras horizontais HTML+Tailwind, 6 etapas em ordem natural (4 ativas + Ganho + Perdido), click navega `/kanban?stage=X`
- [x] `<OriginDonut>` novo (Recharts PieChart, innerRadius=50). Agrupa as 9 origens em 5 buckets visuais (Patrocinado=meta+google ads · WhatsApp · Indicação · Site · Outro). Legenda lateral, click navega `/leads?origin=X`
- [x] `<HotLeadsAlert>` full-width no rodapé com `bg-warning/10` + ícone Flame + CTA "clique para ver detalhes" → `/leads?temperature=hot`. Esconde quando 0 leads quentes
- [x] `<DashboardTrendChart>` (LineChart 30d) rebaixado pro rodapé (continua 30d fixos, complementar ao filtro)
- [x] `<RecentActivityCard>` polido — avatares maiores (size-9 com ring) + cor por tipo (azul=created, verde=won, vermelho=lost)
- [x] Smoke test `/api/smoke-test/dashboard` ampliado: novos grupos `transforms-range` (9 asserts), `transforms-trend` (7), `transforms-kpis` (10), `transforms-origin` (7), `transforms-funnel-h` (7), `transforms-hot-leads` (5). Total ~60 asserts em 8 grupos
- [x] Helpers: `capitalize()` em `lib/utils/format.ts`, `computeRangeBounds()` + `formatHeaderDate()` + `parseDashboardRange()` em `features/dashboard/range.ts`
- [x] Ícones novos em `@papopro/ui/icons`: `ArrowUp`, `ArrowDown`
- [x] Removidos: `funnel-chart.tsx` (Recharts trapezoidal), `buildFunnelData()`, `FunnelDatum` type, `STAGE_FILL` constante (eram 100% legados)
- [x] Mobile-first: pills viram scroll horizontal com `snap-x`; KPIs em 2 cols mobile / 5 cols md+; funil + donut empilham; banner mantém-se largo
- [x] Dark mode preservado em todos os blocos (tokens semânticos, sem hex)

**Commit:** `feat(dashboard): refresh com filtro de período, trends e donut origem`

**Entregas — M5p#2 Fixes do review pós-merge:**

- [x] **CRÍTICO #1**: removido `proposalsTrend` (sempre `flat 0` por construção — comparava snapshot consigo mesmo; vendedor lia "Propostas R$ 1,2M → 0%" e concluía erroneamente que nada havia mudado). Volta em M8+ quando `deal.stageHistory[]` permitir comparação real entre janelas
- [x] **CRÍTICO #2**: deep-links funcionais — `/leads` consome `?origin=X` e `?temperature=Y` via `useSearchParams` na inicialização (whitelist + state local); `/kanban` consome `?stage=X` via `scrollIntoView` na coluna correspondente. `<LeadsPage>` e `<KanbanPage>` envolvidos em `<Suspense>` (exigência Next 14 pra prerender com `useSearchParams`)
- [x] **HIGH**: `<DayPicker>` usa `DASHBOARD_NOW` (não `new Date()`) — alinhamento com fixtures M5
- [x] **HIGH**: `?range=custom` sem `from`/`to` válidos é limpo pra default na próxima paint via `useEffect` (URL out-of-sync corrigido)
- [x] **HIGH**: classe `scrollbar-thin` morta removida
- [x] **HIGH**: funil horizontal não pinta barra fantasma quando `count === 0` (só renderiza `<div>` da barra quando `row.count > 0`)
- [x] **MEDIUM**: `<DashboardRangePills>` ganhou `role="group"` + `aria-label` + `aria-pressed` no botão Personalizado
- [x] **MEDIUM**: `<KpiGrid>` mudou pra `md:grid-cols-3 lg:grid-cols-5` (em tablets os 5 cards ficavam apertados; agora 3+2 com cards respirando)
- [x] Smoke test ampliado pra **70/70 asserts** (era 67): boundary `(102, 100) → up 2`, `parseDashboardRange` aceita os 5 válidos e cai em "week" no resto, `buildOriginData` com origem desconhecida cai em "other"

**Commit:** `fix(dashboard): corrigir críticos do review pós-merge de M5p#1`

---

## M6 — Landing Page ✅

**Branch:** `m6-landing` (sub-PRs empilhados; ver tabela abaixo).

**Objetivo:** Landing page completa em `apps/landing` com 8 seções, otimizada para Lighthouse 90+, calculadora de ROI funcional e formulário de trial linkando para `app.`.

**📊 Status (10-mai-26):** 3 / 3 sub-PRs entregues — **Bloco A fechado**. Próximo: M7 (Backend Foundation).

**Decisões registradas:**

- **ROI claim:** 15% conservador → `receitaRecuperada = leadsMes × ticketMedio × 0.15`. Defensável com qualquer baseline SMB; copy: _"Recupere ~15% dos leads que hoje esfriam sem follow-up."_
- **Estratégia PR:** 3 sub-PRs incrementais empilhados sobre `m6-landing` (espelha M5).

| Sub-PR | Escopo                                                                         | Status      | PR                                                   |
| ------ | ------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------- |
| M6#1   | Base (Poppins + ThemeProvider + Accordion) + Hero + Problema + Funcionalidades | ✅ entregue | [#29](https://github.com/Mateusli23/papopro/pull/29) |
| M6#2   | Demo + ROI + Planos + FAQ + CTA final + WhatsApp FAB + Footer                  | ✅ entregue | [#31](https://github.com/Mateusli23/papopro/pull/31) |
| M6#3   | SEO + OG + sitemap + robots + JSON-LD + analytics condicionadas                | ✅ entregue | [#33](https://github.com/Mateusli23/papopro/pull/33) |

**Entregas — M6#1 Base + Hero + Problema + Funcionalidades:**

- [x] Setup base do `apps/landing`: Poppins via `@fontsource`, tokens do design system, `--font-sans` em `:root`, `scroll-behavior: smooth` e `scroll-margin-top` compensando header fixo
- [x] `ThemeProvider` no layout + `themeColor` light/dark casando com `--background`
- [x] Novo primitivo `Accordion` em `@papopro/ui` (Radix wrapper, padrão shadcn) — usa as keyframes `accordion-down/up` já pré-configuradas no preset Tailwind. Pronto pra FAQ em M6#2.
- [x] Header fixo (`'use client'`) com blur, logo + 4 links âncora, CTAs Entrar/Começar grátis, `ThemeToggle` e drawer mobile via `Sheet`
- [x] Hero com `BrandArcs variant="landing-hero"`, badge "Novo · IA", H1 com highlight em `text-primary`, 2 CTAs, 3 trust signals e mockup Kanban sintético à direita (3 colunas + peek WhatsApp)
- [x] Problema com 4 stats (48% / 80% / 92% / 79%) em cards tonificados por status semântico + fontes citadas (InsideSales, Marketing Donut, Opinion Box, MarketingSherpa)
- [x] Funcionalidades em zigue-zague (Kanban / WhatsApp / IA / Cadência) com badge, headline, descrição, 4 bullets e mockup sintético próprio em cada bloco (KanbanMockup, InboxMockup com bolhas de chat, AgentMockup com card de memória recuperada, CadenceMockup com timeline de gatilhos)
- [x] Zero hex hardcoded; 100% tokens semânticos; dark mode preservado em cada bloco; mobile-first 360/768/1280
- [x] `pnpm typecheck` + `pnpm lint` verdes; `pnpm --filter @papopro/landing build` gera 4/4 static pages com 166 kB First Load JS; smoke test `pnpm dev` retorna 200 OK sem warnings

**Commit:** `feat(landing): base setup + hero, problema e funcionalidades`

**Entregas — M6#2 Demo + ROI + Planos + FAQ + CTA + FAB + Footer:**

- [x] Seção de demo em vídeo com poster sintético (gradient + chips das 4 frentes + botão Play centralizado) → click abre `Dialog` "Vídeo em produção" com 2 CTAs (Voltar / Começar grátis); alinhado com "estado vazio sempre orienta o próximo passo" (CLAUDE.md §8)
- [x] Calculadora de ROI reativa em `'use client'` com 2 inputs (leads/mês × ticket médio) e output em Card primário (receita/mês + equivalente/ano); helper isolado em `lib/roi.ts` com `RECOVERY_RATE = 0.15` constante; helper `lib/format.ts` com `formatBRL` (Intl.NumberFormat pt-BR, 2 decimais)
- [x] Tabela de planos: Pro R$ 197 / Pro IA R$ 497 (com badge "Mais popular" + `ring-primary` + `scale-[1.02]` em lg+) / Enterprise sob consulta; CTA do Enterprise resolve em build time pra `wa.me` quando `NEXT_PUBLIC_WHATSAPP_NUMBER` está setado e cai pra `mailto:comercial@pipeflow.com.br` quando não (fallback seguro)
- [x] FAQ acordeão (6 perguntas: trial, LGPD, troca de plano, cancelamento, segurança, suporte) usando o `Accordion` entregue em M6#1; texto numa constante `FAQS` exportada — vai alimentar `FAQPage` JSON-LD em M6#3 sem duplicação
- [x] Seção CTA final + formulário em `'use client'` com React Hook Form + Zod (nome min 2, email, senha min 8, empresa min 2; mesmo schema usado client e server) → POST a `/api/trial-signup` → toast de sucesso → redirect pra `${NEXT_PUBLIC_APP_URL}/signup?nome=…&email=…&empresa=…&source=landing` (senha **nunca** viaja em URL nem em sessionStorage — M7 coleta de novo)
- [x] Route handler `/api/trial-signup` (POST) com Zod compartilhado: retorna `{ ok: true }` em 200 ou `{ ok: false, error, details }` em 422; sem persistência (M7 troca por `createPendingSignup`); GET → 405 automático do Next
- [x] Botão WhatsApp flutuante (Server Component) `fixed bottom-6 right-6 z-30` com link `wa.me` parametrizado por env; quando env vazia o componente retorna `null` (fail-safe — preferimos esconder a mostrar botão quebrado)
- [x] Footer com `LogoFull`, 2 colunas de links (Produto / Empresa), CNPJ placeholder e linha "Dados hospedados no Brasil · LGPD compliant"
- [x] `Toaster` wrapper em `apps/landing/components/toaster.tsx` espelhando o do `apps/web` (mesmas cores via tokens, posição `bottom-right`); montado uma vez no root layout dentro do `ThemeProvider`
- [x] `Calculator` icon adicionado ao `@papopro/ui/icons` (lucide-react); `.env.local.example` ganhou `NEXT_PUBLIC_WHATSAPP_NUMBER` documentado
- [x] Deps novas em `apps/landing/package.json` alinhadas com `apps/web`: `@hookform/resolvers@^5.2.2`, `react-hook-form@^7.75.0`, `react-hot-toast@^2.4.1`, `zod@^4.4.3`
- [x] `pnpm typecheck` + `pnpm lint` verdes em todo monorepo; `pnpm --filter @papopro/landing build` gera 5/5 pages com 201 kB First Load JS (era 166 kB em M6#1; +35 kB de RHF + zod + hot-toast, esperado); smoke test cobriu 4 cenários da API (`POST` ok, `POST` inválido com 422 + mensagens pt-BR, `GET` → 405) e renderização de 8/8 sections

**Commit:** `feat(landing): demo, ROI, planos, FAQ, CTA final e WhatsApp flutuante`

**Entregas — M6#3 SEO + OG + sitemap + JSON-LD + analytics condicionadas:**

- [x] Convenção Next 14 (metadata files) — zero wiring em `next.config`: `app/sitemap.ts` → `/sitemap.xml`; `app/robots.ts` → `/robots.txt` (Allow `/`, Disallow `/api/`, Host, Sitemap); `app/icon.tsx` → favicon 32×32 dinâmico via `next/og`; `app/apple-icon.tsx` → 180×180 pro iOS Safari e PWA; `app/opengraph-image.tsx` → 1200×630 com gradient da paleta + headline + chips das 4 frentes
- [x] Structured data (JSON-LD) em [`components/json-ld.tsx`](apps/landing/components/json-ld.tsx) com 2 schemas: `SoftwareApplication` (nome, descrição, `applicationCategory: BusinessApplication`/`CRM`, ofertas Pro R$ 197 e Pro IA R$ 497 com `priceCurrency: BRL`, publisher) e `FAQPage` populado pela **mesma constante `FAQS`** exportada por `faq-section.tsx` — single source of truth: editar uma pergunta lá atualiza JSON-LD e visual simultaneamente; Google pode renderizar perguntas direto na SERP
- [x] [`lib/analytics.ts`](apps/landing/lib/analytics.ts) — wrapper `trackEvent(name, props?)` com 3 destinos (PostHog, GA4, Meta Pixel) condicionados a env: server-safe (testa `typeof window`), no-op silencioso quando env vazia, falha individual não cascateia, eventos catalogados em type `LandingEvent`
- [x] [`global.d.ts`](apps/landing/global.d.ts) — tipagem dos 5 globals (`posthog`, `gtag`, `dataLayer`, `fbq`, `_fbq`) todos opcionais
- [x] [`components/analytics-scripts.tsx`](apps/landing/components/analytics-scripts.tsx) — Server Component com 3 blocos de `<Script>` (PostHog, GA4 gtag.js, Meta Pixel) condicionados a env, todos `strategy="afterInteractive"` (carregam após primeiro paint, sem bloquear LCP); em dev sem chaves **nada é renderizado** (zero penalidade no Lighthouse de third-party scripts)
- [x] [`components/page-view-tracker.tsx`](apps/landing/components/page-view-tracker.tsx) — client minúsculo (`return null`) com `useRef` guard contra strict mode dispara `landing_view` uma vez no mount; [`cta-section.tsx`](apps/landing/components/cta-section.tsx) dispara `signup_submitted` após sucesso do POST (sem PII nos properties)
- [x] Metadata expandido em [`layout.tsx`](apps/landing/app/layout.tsx): `metadataBase`, 10 keywords pt-BR, `openGraph` (type=website, locale=pt_BR, url, siteName, title, description), `twitter` (summary_large_image), `robots` com `googleBot.max-image-preview=large`, `alternates.canonical: '/'`, `verification` placeholders pra preencher em M13
- [x] Smoke: build gera 7 rotas (`/`, `/api/trial-signup`, `/apple-icon`, `/icon`, `/opengraph-image`, `/robots.txt`, `/sitemap.xml`); `/` mantém 201 kB First Load JS (JSON-LD é HTML inline, zero impacto no JS); HTML inicial inclui 1× SoftwareApplication, 1× FAQPage, 6× Question, 2× Offer; meta tags `og:*`, `twitter:*`, `description`, `keywords` presentes no `<head>`
- [x] Lighthouse ≥ 90 ainda pendente de execução manual (não rodável no harness automatizado): `npx lighthouse http://localhost:3001 --preset=desktop --view` + `--form-factor=mobile`. Otimizações já no lugar: Poppins via `@fontsource` com `font-display: swap` (zero CLS), mockups 100% sintéticos (sem imagens pesadas), Server Components por default, Tailwind purgado, third-party scripts afterInteractive, headings hierárquicos, `aria-hidden` nos decorativos.

**Commit:** `feat(landing): SEO, OG image, sitemap, robots, JSON-LD e analytics condicionadas`

---

**🎉 M6 fechado — Bloco A (UI mockada) 100% completo.** Produto navega ponta-a-ponta como demo clicável (apps/web + apps/landing) com fixtures e sem persistência. Próximo bloco: **M7 — Backend Foundation** substitui mocks por Supabase real.

---

## M7 — Backend Foundation: Supabase + Auth + Multi-tenant + RLS

**Branches:** múltiplos sub-PRs empilhados sobre `dev` (gitflow strict, CLAUDE.md §10), partindo de `feat/supabase-core`.

**Objetivo:** Substituir os mocks de auth/workspace por Supabase real. Schema mínimo, RLS aplicada, helper de contexto de workspace, convites por email funcionando.

**Estratégia de sub-PRs.** M7 é o marco mais crítico do produto (CLAUDE.md §10 — "bug no helper de RLS = vazamento de dados entre clientes"). Por isso quebramos em 6 PRs pequenos em vez de um único monolítico, pra que cada review foque numa coisa por vez:

| Sub-PR | Escopo                                                                                                                                                              | Branch                  | Status                                                                        | PR                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| M7#1   | Setup Supabase & Chaves: SDK + `lib/supabase/{client,server,admin,with-workspace}.ts` + Prisma client lazy + smoke endpoint                                         | `feat/supabase-core`    | ✅ entregue                                                                   | [#39](https://github.com/Mateusli23/papopro/pull/39) |
| M7#2   | Schema inicial + RLS (`workspaces`, `users`, `workspace_members`, `invitations`, `audit_logs`, `notification_preferences`, `webhook_events`)                        | `m7-schema-rls`         | ✅ entregue                                                                   | [#39](https://github.com/Mateusli23/papopro/pull/39) |
| M7#3   | Supabase Auth real: signup/login/forgot/verify + remove `AuthMockProvider` + middleware com `getUser()`                                                             | `m7-schema-rls`         | ✅ entregue                                                                   | [#39](https://github.com/Mateusli23/papopro/pull/39) |
| M7#4   | Convite por email (Resend) + aceite via magic link + wizard cria workspace real + switcher                                                                          | `m7-invites-workspaces` | ✅ entregue (3 ondas + fix review, 5 commits)                                 | [#39](https://github.com/Mateusli23/papopro/pull/39) |
| M7#5   | RBAC `requireRole(ctx, …)` + log de auditoria + tela `/settings/team` real                                                                                          | `m7-rbac-audit-team`    | ✅ entregue (13 commits — onda 1: 7 + onda 2: 4 + docs + ci) + ✅ em produção | [#40](https://github.com/Mateusli23/papopro/pull/40) |
| M7#6   | Playwright E2E (3 specs cobrindo signup→verify→login→onboarding, invite→accept, team mgmt) + Sentry server-side cirúrgico (11 reportNonFatal swaps + scrubber LGPD) | `m7-e2e-sentry`         | ✅ entregue (11 commits — 7 frente A + 2 frente B + 2 docs)                   | _aberto após merge local_                            |

**Entregas (consolidadas, marcadas conforme sub-PRs entregam):**

- [x] Projeto Supabase provisionado (sa-east-1, São Paulo) _(M7#1 — projeto `iffmjydjeukozopxxitb` "papo pro", criado em 2026-05-11 via MCP `create_project`; substituiu refs anteriores `ulmswswmriweyxkwelim` e `celuvzodbmobkigdoetm` que ficaram órfãos)_
- [x] `packages/db` com Prisma: schema inicial (`users`, `workspaces`, `workspace_members`, `invitations`, `audit_logs`, `notification_preferences`, `webhook_events`) _(M7#2)_
- [x] Migration inicial aplicada _(M7#2)_
- [x] Policies RLS em todas as tabelas (leitura/escrita filtra por `workspace_id` + papel RBAC) _(M7#2)_
- [x] `lib/supabase/with-workspace.ts` — helper que abre transação, faz `set_config('app.workspace_id', …, true)` parametrizado e roda callback _(M7#1 — usa `set_config(...)` em vez de `SET LOCAL` literal porque Prisma `$executeRaw` só parametriza valores, não nomes de GUC)_
- [x] `lib/supabase/{client,server,admin}.ts` configurados (anon vs service role) _(M7#1 — `admin.ts` com `import 'server-only'`)_
- [x] Supabase Auth integrado: signup com confirmação de email, login, recuperar senha _(M7#3 — "logout em todos os dispositivos" fica pra M7#5 junto com audit log)_
- [x] Server Actions de auth substituem mocks de M3 _(M7#3)_
- [x] Convite por email via Resend + aceite via magic link _(M7#4 — Onda 2: `inviteMemberAction` (RBAC Owner/Admin inline + idempotência por workspace×email), `acceptInvitationAction` (transação member + audit + cookie), `revokeInvitationAction`; página pública `/invite/accept` com 4 variantes; cliente Resend via `fetch` nativo pra contornar TLS strict no registry; `next` propagado por signup/login pra retomar fluxo de convite depois da confirmação)_
- [x] Switcher de workspace lê `workspace_members` real _(M7#4 — Onda 3: Sidebar + MobileNav viraram Server Components fetchando `getCurrentUserContext`; `WorkspaceSwitcher` recebe `workspaces[]` + `activeWorkspaceId` via prop, `setActiveWorkspaceAction` valida membership antes de setar cookie, `router.refresh()` re-roda middleware + Server Components com tenant novo)_
- [x] Wizard de onboarding (M3) cria workspace de verdade _(M7#4 — Onda 1: `/onboarding` chama `createWorkspaceAction` que insere Workspace + WorkspaceMember(Owner) + NotificationPreference + AuditLog em transação; cookie httpOnly `papopro_workspace_id` setado pela action e lido pelo middleware)_
- [x] Middleware com gate de auth + redirect inteligente _(M7#3 entregou gate por sessão + email confirmado; M7#4 Onda 1 fechou o lookup de memberships — cookie httpOnly `papopro_workspace_id` é fast path, `getMembershipCountForUser` via admin client é fallback Edge-safe; /onboarding bloqueia quem já tem workspace, demais rotas bloqueiam quem não tem)_
- [x] RBAC enforce nas Server Actions: helper `requireRole(ctx, ['Owner', 'Admin'])` _(M7#5 — `apps/web/lib/auth/require-role.ts` retorna `{ ok, ctx | error, code }` sem throw; refactor inline em `inviteMemberAction` e `revokeInvitationAction` (4 blocos cada → 1 chamada). `setActiveWorkspaceAction` ficou de fora: workspaceId vem do argumento, não do cookie ativo — RBAC inline mínimo justificado)_
- [x] Log de auditoria em eventos críticos (login, criação de workspace, convite, mudança de papel) _(M7#5 — `user_logged_in` em `loginAction` (resolve workspaceId via cookie OU primeiro membership), `user_logged_out` em `logoutAction` (cookie ativo lido ANTES de clearWorkspaceCookie), `member_role_changed` em `changeRoleAction`, `member_removed` em `removeMemberAction`. `ipAddress` + `userAgent` via helper `lib/audit/context.ts` lendo `x-forwarded-for` / `x-real-ip` / `user-agent`)_
- [x] Tela `/settings/team` lista membros, status de convite, permite mudar papel (Owner/Admin) _(M7#5 — `page.tsx` Server Component carrega dados reais via `getTeamMembersAndInvitations` (admin client com filtro explícito por workspaceId); `team-view.tsx` Client recebe props + chama Server Actions; bloco "Convites pendentes" acima da lista de membros com Reenviar/Cancelar; UI esconde ações pra non-Owner/Admin)_
- [ ] Testes E2E (Playwright): signup → verificação email → login → criar workspace → convidar → aceitar _(M7#6)_
- [ ] Sentry capturando erros de Server Actions e API routes _(M7#6)_

**Entregas — M7#1 Setup Supabase & Chaves:**

- [x] Projeto Supabase `iffmjydjeukozopxxitb` ("papo pro", sa-east-1, criado em 2026-05-11 via MCP) — `.env.local` populado com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy JWT), `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (Supavisor pooler :6543, transaction mode) e `DIRECT_URL` (Supavisor pooler :5432, session mode — `db.<ref>.supabase.co:5432` é IPv6-only desde 2024). Extensões `pgcrypto`, `pg_trgm`, `citext` criadas pelo próprio SQL de M7#2 (`docs/m7-2-migration.sql`, idempotente). `vector` (pgvector) e `pg_cron` ficam pra M9/M11.
- [x] SDKs instalados em `apps/web`: `@supabase/ssr@^0.10.3` (wrapper oficial Next.js 14 com cookies httpOnly) + `@supabase/supabase-js@^2.105.4` + `@prisma/client@^6.1.0` direto pra Next bundlear o engine no `.next/standalone`.
- [x] `@types/node` adicionado a `packages/db/devDependencies` (eslint reclamava de `process.env` sem tipo).
- [x] [`apps/web/lib/supabase/client.ts`](apps/web/lib/supabase/client.ts) — `createSupabaseBrowserClient()` via `@supabase/ssr/client` com anon key. Browser-safe, confia em RLS.
- [x] [`apps/web/lib/supabase/server.ts`](apps/web/lib/supabase/server.ts) — `createSupabaseServerClient()` com `cookies()` de `next/headers`. `set`/`remove` envolvidos em try/catch porque Server Components não podem mutar cookies no Next 14 (padrão recomendado em `supabase.com/docs/guides/auth/server-side/nextjs`). `import 'server-only'` no topo.
- [x] [`apps/web/lib/supabase/admin.ts`](apps/web/lib/supabase/admin.ts) — `createSupabaseAdminClient()` com service role + `auth.persistSession: false`. `import 'server-only'` no topo (CLAUDE.md §7.1).
- [x] [`apps/web/lib/supabase/with-workspace.ts`](apps/web/lib/supabase/with-workspace.ts) — `withWorkspace(workspaceId, fn)` abre `prisma.$transaction`, valida workspaceId com regex `/^[\w-]{1,64}$/`, executa `SELECT set_config('app.workspace_id', ${workspaceId}, true)` (parametrizado via prepared statement) e roda o callback recebendo `tx: Prisma.TransactionClient`. **Não substitui defense-in-depth**: callback continua obrigado a filtrar `where: { workspaceId }` no código (CLAUDE.md §7.2).
- [x] [`packages/db/src/index.ts`](packages/db/src/index.ts) — Prisma client agora exportado como **Proxy lazy singleton**: `new Proxy({}, { get: ... })` materializa o `PrismaClient` só no primeiro acesso a propriedade, evitando "Failed to collect page data" do Next 14 (que importa rotas em build-time). Cache em `globalThis.__papoproPrisma` em dev/test pra não vazar pool no HMR. Re-exporta o namespace `Prisma`.
- [x] [`apps/web/app/api/smoke-test/supabase/route.ts`](apps/web/app/api/smoke-test/supabase/route.ts) — endpoint interno seguindo padrão do `/api/smoke-test/leads` (M4). Valida 4 checks: (1) `createSupabaseServerClient()` instancia sem crashar; (2) dentro de `withWorkspace`, `current_setting('app.workspace_id', true)` retorna o id aplicado; (3) fora do helper, o setting voltou a vazio (isolamento por transação); (4) erro dentro do callback faz rollback e limpa o setting. Retorna `{ ok, checks }` com status 200/500.
- [x] **`AuthMockProvider` e `middleware.ts` intactos.** Produto navega exatamente como antes — nada da UI atual depende de Supabase ainda. M7#3 faz a troca.
- [x] **Schema Prisma continua placeholder** (sem `model` declarado). M7#2 popula com `workspaces`/`users`/etc.
- [x] **Decisão de tooling:** `prisma generate` não pôde rodar localmente neste ambiente (TLS strict bloqueia `binaries.prisma.sh`). Build local passa porque o lazy Proxy não instancia Prisma em build-time. CI no GitHub Actions (sem proxy corporativo) baixa o engine normalmente. Smoke endpoint runtime exige `prisma generate` ter rodado uma vez — operador roda `pnpm --filter @papopro/db db:generate` localmente em rede sem TLS strict antes do `pnpm dev`.
- [x] Verificação local: `pnpm lint` 5/5 ✓, `pnpm typecheck` 5/5 ✓, `pnpm -w run format:check` ✓ (arquivos do PR), `pnpm build` 2/2 ✓ (web + landing).

**Commit:** `feat(backend): supabase sdk, prisma client singleton e helper with-workspace`

**Entregas — M7#2 Schema inicial + RLS:**

- [x] [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) — 7 models declarados (`Workspace`, `User`, `WorkspaceMember`, `Invitation`, `AuditLog`, `NotificationPreference`, `WebhookEvent`) + 3 enums (`Role`, `InvitationStatus`, `AuditAction`) com FKs, índices (incluindo composto `[workspaceId, createdAt(sort: Desc)]` em `audit_logs` pra suportar timeline), `@unique` em `(workspace_id, user_id)`, `(workspace_id, email)` e `(source, external_id)`. `User.email` em `citext` (case-insensitive). `Workspace.settings` JSONB wide. `previewFeatures = ["postgresqlExtensions"]` ativo com `extensions = [pgcrypto, pg_trgm, vector, citext]` (vector reservado pra M11).
- [x] [`docs/m7-2-migration.sql`](docs/m7-2-migration.sql) — SQL idempotente versionado (`CREATE … IF NOT EXISTS`, `DO $$ EXCEPTION WHEN duplicate_object THEN NULL $$`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`). Source of truth pra reproduzir o schema em outro projeto Supabase (preview, prod). Aplicado via MCP `apply_migration` (server-side, dispensa Prisma CLI local).
- [x] **Funções SQL:** `public.current_workspace_id()` (lê `app.workspace_id` setado por `withWorkspace()`, cast UUID seguro, retorna NULL fora de transação), `public.touch_updated_at()` (trigger genérico em 4 tabelas com `updated_at`), `public.handle_new_auth_user()` SECURITY DEFINER (espelha `auth.users` → `public.users` no signup, `ON CONFLICT DO NOTHING`), `public.handle_auth_user_email_confirmed()` SECURITY DEFINER (sincroniza `email_verified_at` quando user confirma email). Todas com `SET search_path` fixo (hardening).
- [x] **Triggers:** `on_auth_user_created` (AFTER INSERT em `auth.users`) e `on_auth_user_email_confirmed` (AFTER UPDATE OF `email_confirmed_at`) — padrão Supabase oficial.
- [x] **RLS habilitada nas 7 tabelas + 19 policies.** Padrão de filtro: `workspace_id = public.current_workspace_id()` em tabelas de domínio, `id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())` em `workspaces`, e `id = auth.uid()` + acesso a membros do mesmo workspace em `users`. `audit_logs` e `webhook_events` são append-only (sem policies UPDATE/DELETE — escrita administrativa via service role). Service role bypassa RLS por padrão (CLAUDE.md §7.1).
- [x] **Hardening (advisors Supabase = 0 lints):** extensions `pg_trgm`, `citext`, `pgcrypto` em schema `extensions` (não `public`), `SET search_path = pg_catalog, public` em `current_workspace_id` e `touch_updated_at` (já tinha em handle\_\*), `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` nas duas SECURITY DEFINER pra fechar `/rest/v1/rpc/…`. supabase_auth_admin continua funcionando porque SECURITY DEFINER executa como o owner (postgres), não como o role chamador.
- [x] [`apps/web/app/api/smoke-test/supabase/route.ts`](apps/web/app/api/smoke-test/supabase/route.ts) — endpoint expandido pra M7#2: além dos 4 checks de M7#1 (`with-workspace` plumbing), adicionou 2 checks de RLS — seed via `createSupabaseAdminClient` em 2 workspaces (WS_A, WS_B), verifica que SELECT com `SET LOCAL ROLE authenticated` dentro de `withWorkspace(WS_A_ID)` vê só `audit_logs` de WS_A, e que INSERT cross-tenant é rejeitado por policy `WITH CHECK`. Cleanup garantido em `finally`. Removido em M7#6 quando Playwright E2E entrar.
- [x] **Projeto Supabase trocado.** Refs antigas `celuvzodbmobkigdoetm` e `ulmswswmriweyxkwelim` (deletadas/órfãs) substituídas por `iffmjydjeukozopxxitb` ("papo pro", sa-east-1, criado em 2026-05-11 via MCP). Atualizado em `apps/web/.env.local`, `.env.local`, [`.mcp.json`](.mcp.json), [`docs/mcp.json`](docs/mcp.json). `DIRECT_URL` aponta pra Supavisor session mode em `:5432` (não `db.<ref>.supabase.co` que é IPv6-only desde 2024).
- [x] **Validação pós-migration:** advisors security = `lints: []`, `count(tables WHERE schema='public') = 7`, `count(pg_policies WHERE schemaname='public') = 19`, `count(user_triggers) = 6`, `current_workspace_id()` retorna NULL fora de tx (não crasha), `citext` continua resolvendo após mover de schema.

**Commit:** `feat(backend): aplicar M7#2 schema + RLS + hardening`

**Entregas — M7#3 Supabase Auth real (em 3 ondas, 3 commits):**

- [x] [`apps/web/features/auth/actions.ts`](apps/web/features/auth/actions.ts) — Server Actions: `signupAction`, `loginAction`, `forgotAction`, `logoutAction`, `resendVerificationAction`, `updatePasswordAction`. Retornam `AuthActionResult` (`{ok, redirectTo|error|message}`) em vez de `redirect()` direto — `NEXT_REDIRECT` throws atrapalham o handler de erro no RHF. Mensagens Supabase mapeadas pra pt-BR direto (CLAUDE.md §7.6). `forgotAction` sempre retorna `ok=true` (anti-enumeração de emails, LGPD).
- [x] [`apps/web/app/auth/callback/route.ts`](apps/web/app/auth/callback/route.ts) — handler PKCE oficial `@supabase/ssr`. Troca `?code=` por sessão httpOnly e redireciona pro `?next=` validado (open-redirect guard — só paths relativos, sem `//`).
- [x] [`apps/web/lib/auth/get-user.ts`](apps/web/lib/auth/get-user.ts) — `getCurrentUser` (React `cache()` + `auth.getUser()` que valida JWT contra forgery de cookie) + `getCurrentUserContext` (user + memberships via admin client pra contornar chicken-and-egg da policy `workspace_members_select`).
- [x] [`apps/web/lib/auth/use-user.ts`](apps/web/lib/auth/use-user.ts) — hook client com `getUser` + `onAuthStateChange`. Shape `{ loading, user, displayName }` compatível com o antigo `useAuthMock` pra minimizar refactor nos consumidores.
- [x] [`apps/web/lib/supabase/middleware.ts`](apps/web/lib/supabase/middleware.ts) — `createServerClient` pro Edge runtime, propaga cookies renovados pra req + response (refresh silencioso do JWT a cada hora).
- [x] [`apps/web/middleware.ts`](apps/web/middleware.ts) — gate Supabase: `/auth/callback` público; raiz redireciona conforme estado; rotas auth mandam logado pra dashboard ou `/verify-email`; `/verify-email` exige logado mas redireciona se já confirmado; demais exigem logado + `email_confirmed_at != null` (CLAUDE.md §7.8). Sem cookie mock.
- [x] **Forms reais:** [`login-form`](apps/web/features/auth/components/login-form.tsx), [`signup-form`](apps/web/features/auth/components/signup-form.tsx), [`forgot-form`](apps/web/features/auth/components/forgot-form.tsx), [`verify-email-card`](apps/web/features/auth/components/verify-email-card.tsx) chamam as Server Actions correspondentes. `router.refresh() + router.push(redirectTo)` pra middleware re-rodar com sessão recém-criada.
- [x] [`apps/web/components/app-shell/user-menu.tsx`](apps/web/components/app-shell/user-menu.tsx) — `useUser()` + `logoutAction` (server `redirect()` direto, sem `router.push`).
- [x] **WorkspaceMockProvider temporário** ([`apps/web/features/workspace/workspace-mock-provider.tsx`](apps/web/features/workspace/workspace-mock-provider.tsx)) — extrai do antigo `AuthMockProvider` só `activeWorkspace`/`wizardCompleted`. Cookies próprios `papopro_workspace_mock_*` (separados pra não bagunçar com resíduo do mock antigo). **Sai inteiro em M7#4** quando workspaces reais entrarem.
- [x] **`/settings/security`** ([`apps/web/app/(dashboard)/settings/security/`](<apps/web/app/(dashboard)/settings/security/>)) — page + view com form de troca de senha consumindo `updatePasswordAction`. Aterriza aqui via reset por email (`forgotAction → /auth/callback?next=/settings/security`) ou troca proativa pelo sub-nav. Item "Segurança" adicionado em [`settings-nav-config.ts`](apps/web/features/settings/components/settings-nav-config.ts).
- [x] **DELETADOS:** `apps/web/lib/auth/auth-mock-provider.tsx` + `apps/web/lib/auth/cookies.ts` (substituídos por Supabase + `useUser` + WorkspaceMock).

**Configuração Supabase pendente (Dashboard — operador faz uma vez):**

- [ ] Authentication → URL Configuration → Site URL: `http://localhost:3000` (dev) e `https://app.pipeflow.com.br` (prod, quando deployarmos)
- [ ] Authentication → URL Configuration → Redirect URLs allowlist: `http://localhost:3000/auth/callback` e `https://app.pipeflow.com.br/auth/callback`
- [ ] Authentication → Email Templates: customizar em pt-BR (Confirm signup, Reset password) — opcional, default já vem em inglês

**Validação local pendente:** signup → email → callback → /onboarding → login → /dashboard. Local bloqueado pelo postinstall do Prisma (TLS strict no `binaries.prisma.sh`). Validar via Vercel preview ou ambiente com rede limpa.

**Commits:**

- `feat(auth): server actions, callback PKCE e helper getCurrentUser (M7#3 onda 1)`
- `feat(auth): middleware Supabase + UI consome sessao real (M7#3 onda 2)`
- `feat(auth): tela /settings/security + updatePasswordAction (M7#3 onda 3)`

**Entregas — M7#4 Onda 1 — Workspace real + middleware multi-tenant gate:**

Primeira de 3 ondas do M7#4. Sai do fluxo mockado (`AuthMockProvider` legacy via `WorkspaceMockProvider`) pro caminho real de criação de workspace + gate de tenant no Edge.

- [x] [`apps/web/lib/workspace/slugify.ts`](apps/web/lib/workspace/slugify.ts) — função pura `slugify(name)` (normaliza NFKD, remove combining marks, força `[a-z0-9-]`, trunca em 64) + `ensureUniqueSlug(base, isTaken)` com retry de sufixo numérico (até 50 tentativas; explode barulhento depois). `isTaken` injetável pra teste sem DB.
- [x] [`apps/web/features/workspace/schemas.ts`](apps/web/features/workspace/schemas.ts) — `workspaceCreateSchema` (Zod) com `name` (2–60 chars, control-chars bloqueados via charCodeAt-loop em vez de regex hex pra não depender de escapes que sobrevivem mal a copy/paste entre LLM e disco), `segment?` opcional. Casa com `Workspace.name VARCHAR(60)` do schema.prisma.
- [x] [`apps/web/lib/auth/workspace-cookie.ts`](apps/web/lib/auth/workspace-cookie.ts) — helpers httpOnly server-only pro cookie `papopro_workspace_id`. Quatro entry points: `setWorkspaceCookie` / `readWorkspaceCookie` (via `next/headers` — Server Actions/Components) e `setWorkspaceCookieOnResponse` / `readWorkspaceCookieFromRequest` (via `req`/`response` — Edge middleware). `secure: process.env.NODE_ENV === 'production'` evita o sintoma "cookie silenciosamente ignorado pelo browser" em dev HTTP.
- [x] [`apps/web/features/workspace/actions.ts`](apps/web/features/workspace/actions.ts) — `'use server'` com `createWorkspaceAction(input)`:
  1. Valida Zod;
  2. `getCurrentUser` exige sessão + email confirmado (defense-in-depth — middleware já guarda);
  3. **Idempotência**: se já tem WorkspaceMember, reaproveita (cobre dupliclick e refresh em `/onboarding`);
  4. `ensureUniqueSlug` com fallback `'workspace'` quando o nome só tem caracteres não-ASCII;
  5. `prisma.$transaction` insere Workspace + WorkspaceMember(Owner, joinedAt=now) + NotificationPreference(`prefs: {}` — matriz PRD §3.2 fica pra M7#5) + AuditLog(`workspace_created`, changes={name, slug}). Upsert defensivo em `public.users` antes da FK do member (cobre raro caso de trigger `on_auth_user_created` não ter rodado);
  6. `setWorkspaceCookie` _fora_ da transação (cookies não são transacionais com Postgres).
- [x] [`apps/web/features/workspace/queries.ts`](apps/web/features/workspace/queries.ts) — `getMembershipCountForUser(userId)` retornando `{count, firstWorkspaceId}`. **Não fica em `actions.ts`** porque `'use server'` transforma todo export em Server Action callable do client — vetor de probing de existência de user. Single query Supabase admin com `count: 'exact'` + `limit(1)` (traz contagem e primeira row no mesmo round-trip).
- [x] [`apps/web/middleware.ts`](apps/web/middleware.ts) — adiciona o gate multi-tenant ao gate de auth de M7#3. `resolveHasWorkspace(req, response, userId)` faz **fast path por cookie** (`readWorkspaceCookieFromRequest`) e **slow path por query** (`getMembershipCountForUser` quando cookie ausente; popula cookie na response). Regras novas: `/onboarding` redireciona pra `/dashboard` se já tem workspace; demais rotas protegidas redirecionam pra `/onboarding` se não tem. Edge runtime continua < 100 kB (82.7 kB no build).
- [x] [`apps/web/features/auth/components/onboarding-form.tsx`](apps/web/features/auth/components/onboarding-form.tsx) — rewire pro `createWorkspaceAction` real. `router.refresh()` antes do `router.push` força middleware a re-rodar com cookie recém-setado, evitando race condition que mandaria de volta pra `/onboarding`. Schema migrado pra `workspaceCreateSchema` (mesmo shape, owner conceitual movido pro feature workspace).
- [x] [`apps/web/app/(dashboard)/layout.tsx`](<apps/web/app/(dashboard)/layout.tsx>) — virou **async Server Component**, fetches `getCurrentUserContext` (cached por request via `cache()`) e passa `hasWorkspace` pro `<WelcomeWizardController>`. Defense-in-depth: mesmo com middleware protegendo, controller só abre wizard se `hasWorkspace=true`.
- [x] [`apps/web/features/onboarding/components/welcome-wizard-controller.tsx`](apps/web/features/onboarding/components/welcome-wizard-controller.tsx) — aceita prop `hasWorkspace: boolean`. `useWorkspaceMock` ainda usado pra `wizardCompleted` (cookie legacy) — sai inteiro em Onda 3.
- [x] [`apps/web/lib/auth/get-user.ts`](apps/web/lib/auth/get-user.ts) — fix de typecheck: Supabase tipa relação FK aninhada como array quando schema generation não rodou contra a DB. `Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces` normaliza; em runtime a relação 1:1 (workspace_members → workspaces) sempre devolve objeto único.

**Decisões registradas:**

- **Cookie httpOnly em vez de localStorage:** o middleware precisa ler antes do JS rodar, e XSS roubando o workspace ativo seria pivot pra outro tenant.
- **`getMembershipCountForUser` em `queries.ts`, não `actions.ts`:** `'use server'` expõe RPC. Probing seria barato (1 chamada por uid candidato).
- **Slow path Edge-safe:** admin client Supabase é fetch-based; query roda no Edge sem precisar de driver Postgres. 1 round-trip por sessão (cookie cacheia o resultado).
- **`Prisma.TransactionClient` tipado, runtime errors duck-typed:** `prisma generate` não roda local (TLS strict bloqueia `binaries.prisma.sh` — herdado de M7#1). Tipos do client são `any` placeholder; classes de erro não exportadas. Solução: `isPrismaErrorCode(err, 'P2002')` em vez de `instanceof PrismaClientKnownRequestError`. Códigos `Pxxxx` são contrato público estável do Prisma.
- **Wizard step 1 cosmético até Onda 3:** o WorkspaceStep do `welcome-wizard.tsx` ainda aceita input mas não persiste — o middleware redireciona pra `/onboarding` antes do dashboard montar, então usuários reais nunca chegam ao step 1. Cleanup em Onda 3 quando o `WorkspaceMockProvider` sair inteiro.
- **`WorkspaceMockProvider` continua montado:** ainda alimenta o `WorkspaceSwitcher` na sidebar (lista fixtures) e a flag `wizardCompleted`. Onda 3 substitui ambos por dados reais e remove o provider.

**Validação local:**

- `pnpm -w run typecheck` 5/5 ✓ (consertado de passagem o erro pré-existente no `getCurrentUserContext` causado por inferência de array do Supabase)
- `pnpm -w run lint` 5/5 ✓
- `pnpm -w run format:check` ✓
- `pnpm --filter @papopro/web build` ✓ — 35/35 rotas, middleware Edge 82.7 kB
- E2E manual via Vercel preview ou ambiente sem TLS strict pendente (Prisma engine roda nesses contextos)

**Commit:** `feat(workspace): server action real + middleware multi-tenant gate (M7#4 onda 1)`

**Entregas — M7#4 Onda 2 — Convite por email via Resend + aceite via magic link:**

Segunda das 3 ondas do M7#4. Owner/Admin convida por email; convidado recebe link, aceita e cai no workspace como member.

- [x] [`apps/web/lib/email/resend.ts`](apps/web/lib/email/resend.ts) — cliente Resend via `fetch` nativo (sem o SDK oficial `resend`, evitando dep adicional). **Decisão de fundo:** `pnpm add resend` falhou aqui por `UNABLE_TO_VERIFY_LEAF_SIGNATURE` no `registry.npmjs.org` — mesma classe de TLS strict que bloqueia `binaries.prisma.sh` em M7#1. Como o endpoint do Resend é um único `POST /emails`, 30 linhas de wrapper resolvem com timeout (AbortSignal 10s), retry único com backoff 500ms só em 5xx, parsing de erro com mensagem do servidor. Lazy-read das env vars dentro da função (em vez de top-level) pra não derrubar o bundle inteiro de Server Actions se `RESEND_API_KEY` faltar.
- [x] [`apps/web/lib/email/templates/invite.ts`](apps/web/lib/email/templates/invite.ts) — `renderInviteEmail` retorna `{subject, html, text}`. HTML em string-template (não `@react-email/components`) — 1 template não justifica a dep. Padrão de email tradicional: tabelas + CSS inline, sem `<style>`/`<link>`/JS, fontes com fallback web-safe, largura 600px. Sem dark mode (Outlook não respeita prefers-color-scheme). Versão `text` separada melhora deliverability (anti-spam). Escape HTML mínimo (4 chars) defense-in-depth contra nome de workspace com caractere RTL/exótico.
- [x] [`apps/web/features/invitations/schemas.ts`](apps/web/features/invitations/schemas.ts) — `invitationCreateSchema` (email + role com `INVITABLE_ROLES = ['Admin','Manager','Vendedor','Viewer']` — Owner propositalmente excluído; transferência de propriedade é fluxo separado em M7#5), `invitationAcceptSchema` (token UUID), `invitationRevokeSchema` (invitationId UUID).
- [x] [`apps/web/features/invitations/actions.ts`](apps/web/features/invitations/actions.ts) — 3 Server Actions com idempotência e RBAC inline:
  - `inviteMemberAction`: valida sessão + workspace ativo (cookie) + RBAC (Owner/Admin) + bloqueio de auto-convite + bloqueio se já é membro. **Upsert por `(workspaceId, email)`** reaproveita convite pending existente (atualiza `role`/`expiresAt`/reseta para `pending` se estava `revoked`/`expired`) — UX "convidei e o email não chegou, mando de novo" funciona sem duplicar. Email via Resend; se falha, **NÃO** deleta a row (convite existe, dá pra reenviar pelo /settings/team em M7#5). AuditLog `member_invited` fora da upsert (best-effort).
  - `acceptInvitationAction`: valida sessão + email confirmado + token + status `pending` + não expirado + email do caller bate com o do convite (case-insensitive). Idempotência: se já é membro, marca convite como aceito e retorna sucesso silente. Senão, transação Member + invitation.status='accepted' + NotificationPreference + AuditLog. Seta cookie de workspace ativo no sucesso.
  - `revokeInvitationAction`: RBAC Owner/Admin + filtro defense-in-depth no `updateMany` (id + workspaceId + status pending) — se nada bater, mensagem "convite não encontrado ou já processado".
- [x] [`apps/web/features/invitations/queries.ts`](apps/web/features/invitations/queries.ts) — `getInvitationByToken` **server-only** (não em `actions.ts` pra não virar RPC callable do client — vetor de probing de tokens existentes). Validação regex UUID antes de bater no banco (curto-circuita ataques com strings malformadas). Admin client bypassa RLS — o token É a autorização (UUID single-use, 2^122 entropia).
- [x] [`apps/web/app/invite/accept/page.tsx`](apps/web/app/invite/accept/page.tsx) — landing pública (semi-pública) com **4 variantes** decididas server-side via `getInvitationByToken` + `getCurrentUser`:
  - **Inválido/expirado/revogado/já aceito** → mensagem específica + CTA voltar/login (não genérico "deu errado").
  - **Token válido + não logado** → CTA pra `/signup?next=/invite/accept?token=…&email=<convidado>` ou `/login?next=…`. Link inclui email pré-preenchido pro signup.
  - **Token válido + logado com email diferente** → "Saia e troque de conta" com botão sair.
  - **Token válido + logado + email bate** → `<AcceptInvitationForm>` client component com botão de aceite.
- [x] [`apps/web/app/invite/accept/accept-form.tsx`](apps/web/app/invite/accept/accept-form.tsx) — client component que chama `acceptInvitationAction(token)`; toast no sucesso + `router.refresh() + router.push('/dashboard')`. Erro inline com `role="alert"`.
- [x] [`apps/web/middleware.ts`](apps/web/middleware.ts) — `/invite/accept` virou rota **semi-pública** (regra 1b nova, antes da regra raiz). Passa sem checagem se não logado; se logado mas email não confirmado, força `/verify-email`. Open-redirect guard `safeNextParam` extraído pra honrar `?next=` em redirects de auth routes pra users já logados — quem clica em "Já tenho conta" no invite landing volta certo após bater em `/login`.
- [x] [`apps/web/features/auth/actions.ts`](apps/web/features/auth/actions.ts) — `signupAction(input, options?: {next?})` aceita segundo argumento opcional. `safeNext` é validado (path relativo, sem `//`) e injetado no `emailRedirectTo` (`/auth/callback?next=<safe>`) — convidado novo confirma email e cai direto em `/invite/accept?token=…` em vez do `/onboarding` default.
- [x] [`apps/web/features/auth/components/signup-form.tsx`](apps/web/features/auth/components/signup-form.tsx) — aceita props `next` + `prefilledEmail`. Email pré-preenchido fica `readOnly` (não `disabled` — `disabled` exclui do form data; queremos só não editável) + hint "Email do convite". Defense-in-depth: server-side check que `data.email === prefilledEmail` (DevTools pode alterar readonly). Link "Já tem conta?" propaga o `next`.
- [x] [`apps/web/features/auth/components/login-form.tsx`](apps/web/features/auth/components/login-form.tsx) — aceita prop `next` e usa como destino após login bem-sucedido (override do `result.redirectTo`). Open-redirect guard local. Link "Criar conta grátis" propaga o `next`.
- [x] [`apps/web/app/(auth)/signup/page.tsx`](<apps/web/app/(auth)/signup/page.tsx>) + [`apps/web/app/(auth)/login/page.tsx`](<apps/web/app/(auth)/login/page.tsx>) — Server Components leem `searchParams.next` (e `email` no signup) e passam pros forms.

**Fluxo end-to-end de convite (novo user):**

1. Owner em `/settings/team` (M7#5) → chama `inviteMemberAction` → row em `invitations` + email enviado.
2. Convidado clica no link do email → `/invite/accept?token=…`.
3. Não logado → variante "Crie sua conta" → `/signup?next=/invite/accept?token=…&email=convidado@x.com`.
4. Cria conta (email travado) → recebe email de confirmação com `emailRedirectTo=/auth/callback?next=/invite/accept?token=…`.
5. Confirma email → callback PKCE → redireciona pra `/invite/accept?token=…`.
6. Logado + email confirmado + bate com convite → variante "Pronto pra entrar" → clica aceitar.
7. `acceptInvitationAction` cria `workspace_members` + marca convite + seta cookie → `/dashboard` real do workspace.

**Decisões registradas:**

- **Resend via fetch nativo:** TLS strict no `registry.npmjs.org` impede `pnpm add resend` aqui (mesma raiz do bloqueio do Prisma engine). Wrapper com 30 linhas é simples; promovemos pro SDK oficial se passarmos de 5+ templates (M9 + M12 vão exigir).
- **Email HTML string-template:** mesma lógica — `@react-email/components` é overkill pra 1 template e adiciona ~3 MB. Migração trivial quando crescer.
- **Owner não convidável:** propriedade do workspace é singular. Transferência é fluxo dedicado (M7#5 ou Onda 3). `INVITABLE_ROLES` no schema bloqueia na fonte.
- **Upsert idempotente por `(workspace, email)`:** dois usuários convidando o mesmo email simultaneamente é raro mas possível; reaproveitar a row é mais limpo que tratar erro de unique. Reativação de `revoked`/`expired` pelo upsert também é desejável (Owner pode "ressuscitar" convite cancelado sem código adicional).
- **Email failure não rollback do convite:** se Resend cair, a row de convite continua válida. UX em M7#5: tela `/settings/team` mostra pending invites com "Reenviar email". Aqui na Onda 2 não temos UI de reenvio ainda — Owner pode reconvidar pelo mesmo email (upsert reaproveita).
- **`next` propagação:** signup/login forms recebem `next` via props (page Server Components lêem search params). Middleware honra `next` em redirects de auth-route pra logged users. `signupAction` honra `next` em `emailRedirectTo`. Open-redirect guard repetido em 4 lugares (signupAction, loginForm, middleware, /auth/callback) — extrair pra util compartilhado se ficar 5+.
- **`/settings/team` real fica pra M7#5:** UI de "convidar membro" + "lista de convites pending" + "remover member" usa `inviteMemberAction` e `revokeInvitationAction` já entregues. Onda 2 entrega só o fluxo de aceite porque ele é independente — invite pode ser disparado via smoke endpoint ou direto no banco até /settings/team chegar.

**Validação local:**

- `pnpm -w run typecheck` 5/5 ✓
- `pnpm -w run lint` 5/5 ✓
- `pnpm -w run format:check` ✓
- `pnpm --filter @papopro/web build` ✓ — 36 rotas (`/invite/accept` nova), middleware Edge 82.8 kB (+0.1 da Onda 1, regra `/invite/accept` + `safeNextParam`)
- E2E manual pendente (mesmo motivo da Onda 1 — Prisma engine + Resend env). Cadeia signup→email→callback→accept testável em Vercel preview.

**Pendente de configuração (operador faz uma vez):**

- `RESEND_API_KEY` e `RESEND_FROM_EMAIL` em `apps/web/.env.local` (templates já estão em `.env.example`).
- Domínio verificado no Resend dashboard com SPF/DKIM (passo dos pré-requisitos M0; bloqueante pra emails saírem em produção).

**Commit:** `feat(invitations): convite por email via resend + accept por magic link (M7#4 onda 2)`

**Entregas — M7#4 Onda 3 — Switcher real + cleanup do mock + smoke endpoint:**

Terceira e última onda do M7#4. Removemos o `WorkspaceMockProvider` legado (criado em M3 como ponte até backend real), trocamos o switcher por dados reais com Server Action validando RBAC, e adicionamos smoke endpoint cobrindo os helpers puros do feature.

- [x] [`apps/web/features/workspace/actions.ts`](apps/web/features/workspace/actions.ts) ampliado com 3 actions novas:
  - `setActiveWorkspaceAction(workspaceId)` — valida formato UUID + sessão + **membership** (defense-in-depth — devtools alterando cookie não pivota tenant, action retorna 403 antes do middleware liberar). Seta cookie `papopro_workspace_id`.
  - `clearActiveWorkspaceAction()` — limpa cookie. Usado pelo `logoutAction` (M7#3 não limpava, gerava ricochete confuso quando user trocava de conta no mesmo browser).
  - `markWizardCompletedAction()` — seta cookie `papopro_wizard_completed=1` (httpOnly, 1 ano). Substitui o `markWizardCompleted` do mock provider. Decisão: cookie em vez de coluna `users.first_run_completed_at` porque flag é "primeira visita neste dispositivo" — semântica local, sem necessidade de sync entre devices.
- [x] [`apps/web/features/auth/actions.ts`](apps/web/features/auth/actions.ts) — `logoutAction` agora chama `clearWorkspaceCookie()` antes do `redirect('/login')`. Sem isso, user logava com conta B no mesmo navegador e o middleware lia cookie de tenant A — `resolveHasWorkspace` retornava true por cookie stale, queries filtravam por workspaceId errado, RLS bloqueava, UX confusa.
- [x] [`apps/web/lib/auth/workspace-cookie.ts`](apps/web/lib/auth/workspace-cookie.ts) — ganhou `WIZARD_COMPLETED_COOKIE_NAME`, `setWizardCookie()`, `readWizardCookie()`. Mesmo padrão httpOnly/SameSite Lax/secure-prod do cookie de workspace ativo.
- [x] [`apps/web/components/app-shell/workspace-switcher.tsx`](apps/web/components/app-shell/workspace-switcher.tsx) — refatorado para receber `workspaces: WorkspaceSwitcherItem[]` + `activeWorkspaceId: string | null` via prop. Chama `setActiveWorkspaceAction(id)` + `router.refresh()` na seleção. **Otimismo controlado:** `pendingId` em state durante a transição mostra Check visualmente no item escolhido enquanto a action roda (rollback + toast em caso de falha). Item "Criar workspace" continua placeholder ("Em breve") — fluxo de criar 2º+ workspace pelo switcher fica pra Onda 4+ (precisa modal + reuso de `createWorkspaceAction` permitindo múltiplos por user).
- [x] [`apps/web/features/workspace/presentation.ts`](apps/web/features/workspace/presentation.ts) (novo, server-only) — `workspaceInitials(name)` e `toSwitcherItem(membership, index)`. Centraliza derivações cosméticas (iniciais 2-letras pro avatar, `accent` determinístico por índice em `[primary, success, info, warning]`). Substitui o mapa hardcoded de fixtures.
- [x] [`apps/web/components/app-shell/sidebar.tsx`](apps/web/components/app-shell/sidebar.tsx) — virou **async Server Component**. `loadSwitcherData()` exportado (helper compartilhado com Topbar) fetcha `getCurrentUserContext` (cached por request) + lê cookie e devolve `{workspaces, activeWorkspaceId}`. Cookie stale (workspace removida) cai pra primeiro item da lista.
- [x] [`apps/web/components/app-shell/topbar.tsx`](apps/web/components/app-shell/topbar.tsx) + [`apps/web/components/app-shell/mobile-nav.tsx`](apps/web/components/app-shell/mobile-nav.tsx) — Topbar virou async Server Component, chama `loadSwitcherData()` (mesma cache da Sidebar — 1 round-trip total) e passa pro `<MobileNav workspaces activeWorkspaceId>` (que continua client por causa do `useState` do Sheet).
- [x] [`apps/web/features/onboarding/components/welcome-wizard.tsx`](apps/web/features/onboarding/components/welcome-wizard.tsx) — **3 steps** agora (WhatsApp, Agent, CSV); step 1 "Confirme seu workspace" removido (workspace é criado em `/onboarding` antes do dashboard). `finish()` chama `markWizardCompletedAction()` em vez do mock.
- [x] [`apps/web/features/onboarding/components/welcome-wizard-controller.tsx`](apps/web/features/onboarding/components/welcome-wizard-controller.tsx) — recebe `hasWorkspace` + `wizardCompleted` via prop do server.
- [x] [`apps/web/app/(dashboard)/layout.tsx`](<apps/web/app/(dashboard)/layout.tsx>) + [`apps/web/app/(dashboard)/dashboard/page.tsx`](<apps/web/app/(dashboard)/dashboard/page.tsx>) + [`apps/web/app/(dashboard)/dashboard/dashboard-content.tsx`](<apps/web/app/(dashboard)/dashboard/dashboard-content.tsx>) — fluxo de `wizardCompleted` 100% server-side via `readWizardCookie()`, sem cookie client read.
- [x] [`apps/web/app/layout.tsx`](apps/web/app/layout.tsx) — `<WorkspaceMockProvider>` removido do `<ThemeProvider>`. Comentário documenta a remoção e o padrão "sem provider — cada consumer pega direto da fonte canônica (cookies + Supabase Auth)".
- [x] **Deletados** (arquivos mortos): [`apps/web/features/workspace/workspace-mock-provider.tsx`](apps/web/features/workspace/workspace-mock-provider.tsx), [`apps/web/lib/fixtures/workspaces.ts`](apps/web/lib/fixtures/workspaces.ts), [`apps/web/features/onboarding/components/steps/workspace-step.tsx`](apps/web/features/onboarding/components/steps/workspace-step.tsx).
- [x] [`apps/web/app/api/smoke-test/workspaces/route.ts`](apps/web/app/api/smoke-test/workspaces/route.ts) — smoke endpoint cobrindo **34 asserts em 5 grupos** (verificado ao vivo via `curl`: `HTTP 200 · 34/34 ✓`): **slugify** (10 — diacritics, casos limite Unicode, truncate 64, non-string fallback), **ensureUniqueSlug** (5 — append -2, iteração, base livre, fallback "workspace", throw após 50), **schema** (5 — válido, < 2 chars, > 60, control chars, emoji+acento aceito), **initials** (6 — 1/2 palavras, vazio, espaços, lowercase→uppercase), **switcher-item** (8 — propagação + accent determinístico em índices 0/3/5). Não toca no banco — Server Actions exigem sessão real, cobertura E2E vai pro Playwright M7#6.

**Decisões registradas:**

- **`setActiveWorkspaceAction` valida membership server-side:** confiamos no cookie como cache, mas a action que escreve o cookie chama Prisma pra confirmar acesso. Devtools trocando cookie diretamente → action devolve "Você não tem acesso a esse workspace" antes de qualquer query rodar com tenant errado.
- **`Sidebar` e `Topbar` compartilham `loadSwitcherData()`:** evita 2 round-trips. `getCurrentUserContext` já é cached por request via React `cache()`, mas extrair o helper documenta a intenção e facilita reuso futuro (settings/team list em M7#5 vai reaproveitar).
- **`presentation.ts` server-only:** o adaptador `MembershipSummary → WorkspaceSwitcherItem` tem `import 'server-only'` pra garantir que a derivação acontece no boundary correto. Se rodasse no client, `workspaceInitials` viraria duplicação e o `accent` determinístico (que vira coluna real em M8) precisaria sync.
- **Switcher step 1 do wizard removido (não cosmético):** wizard tinha "Confirme seu workspace" como step 1 mockado em M3. Em M7#4 Onda 1, `/onboarding` virou a criação real → step 1 sobrou apenas como input cosmético. Onda 3 remove pra a UI alinhar com o fluxo real (3 steps: WhatsApp, Agent, CSV).
- **`markWizardCompletedAction` como Server Action e não cliente:** cookie httpOnly só pode ser setado pelo server. Server Action devolve no header `Set-Cookie` da response; `router.refresh()` após a action garante que o próximo render do layout lê o cookie atualizado.
- **`workspace_step.tsx` deletado mesmo sendo "ainda usável":** YAGNI — restaurar do git é trivial se mudarmos de ideia, ter o arquivo no repo confunde futuro reviewer que pensa "esse step é parte do fluxo?". Limpeza explícita > legado preservado.

**Validação local:**

- `pnpm -w run typecheck` 5/5 ✓
- `pnpm -w run lint` 5/5 ✓
- `pnpm -w run format:check` ✓
- `pnpm --filter @papopro/web build` ✓ — 37 rotas (`/api/smoke-test/workspaces` nova), middleware Edge 82.8 kB (estável vs Onda 2 — sem regra nova no middleware)
- E2E manual pendente (mesmo motivo das ondas anteriores; smoke endpoint roda local quando `pnpm dev` está ativo: `curl http://localhost:3000/api/smoke-test/workspaces`)

**Commit:** `feat(workspace): switcher real + cleanup do mock provider + smoke endpoint (M7#4 onda 3)`

**Entregas — M7#4 Pós-Onda 3 — Fixes do code review:**

Após o merge das 3 ondas em local, code-reviewer agent revisou os ~4977 linhas adicionadas (61 arquivos) e levantou **4 CRÍTICO + 9 HIGH + 9 MEDIUM + 13 LOW**. Este commit endereça **2 CRÍTICO + 5 HIGH + 2 MEDIUM** mais impactantes — bloqueadores reais de produção. LOW + parte do MEDIUM ficam pra M7#5 (`requireRole` + audit log) ou M8+.

| Severidade | ID  | Fix one-liner                                                                                                                                                                                                                           | Arquivo                                                     |
| ---------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 🔴 CRÍTICO | #3  | Email enumeration leak em `inviteMemberAction` (2 queries timing-attackable → 1 query via relation filter `workspaceMember.findFirst({ user: { email } })`)                                                                             | `features/invitations/actions.ts`                           |
| 🔴 CRÍTICO | #4  | Email header injection no subject (Resend repassa subject como header MIME — `\r\n` em `inviterName` permitiria adicionar `Bcc:`). Fix: `signupSchema.name` bloqueia control chars + template chama `stripControlChars` antes de compor | `features/auth/schemas.ts`, `lib/email/templates/invite.ts` |
| 🟠 HIGH    | #5  | `AbortSignal.timeout(10_000)` não portável (Node 17.3+, alguns Edge runtimes não suportam) — trocado por `AbortController` + `setTimeout` manual com `clearTimeout` no `finally`                                                        | `lib/email/resend.ts`                                       |
| 🟠 HIGH    | #6  | Race em `acceptInvitationAction` — duplo-clique disparava 2 transactions, segunda violava `@@unique([workspaceId, userId])` (P2002). Fix: catch P2002 e trata como sucesso silente — UX final idêntica                                  | `features/invitations/actions.ts`                           |
| 🟠 HIGH    | #8  | `WorkspaceMember.invitedAt = now()` errado (igual a `joinedAt`); agora `invitation.createdAt` — diferença alimenta métrica "tempo até aceite" em M7#5                                                                                   | `features/invitations/actions.ts`                           |
| 🟠 HIGH    | #9  | `safeNextParam` middleware sem length limit nem control-char guard — adicionado max 512 chars + bloqueio de `\r\n` (smuggling)                                                                                                          | `middleware.ts`                                             |
| 🟠 HIGH    | #10 | Audit log de `member_invited` rodava ANTES do envio do email — se Resend falhasse, log dizia "convite enviado" mas convidado nunca recebia. Agora registra DEPOIS do email OK                                                           | `features/invitations/actions.ts`                           |
| 🟡 MEDIUM  | #14 | Reinvite após `revoked`/`expired` reaproveitava token antigo (que podia ter vazado em logs/forwards) — agora gera novo via `crypto.randomUUID()` quando status anterior não era `pending`                                               | `features/invitations/actions.ts`                           |
| 🟡 MEDIUM  | #18 | `escapeHtml` faltava `'` (apóstrofo) — adicionado escape pra `&#39;` (alinha com OWASP HTML escape)                                                                                                                                     | `lib/email/templates/invite.ts`                             |
| 🟡 MEDIUM  | #19 | `inviteMemberAction` e `revokeInvitationAction` não validavam formato UUID do cookie de workspace antes de bater no Prisma — adicionado `isUuid()` guard como defense-in-depth contra cookie corrompido                                 | `features/invitations/actions.ts`                           |

**Refatorações estruturais:**

- [`apps/web/lib/utils/prisma-errors.ts`](apps/web/lib/utils/prisma-errors.ts) (novo) — `isPrismaErrorCode(err, code)` extraído de `workspace/actions.ts`. Era duplicado entre 2 actions; movido pra util **fora de `'use server'`** porque `'use server'` transforma exports em RPC callable do client (vetor de probing) — vale tanto pro próprio helper quanto pra qualquer função de utilidade futura.
- [`apps/web/lib/utils/uuid.ts`](apps/web/lib/utils/uuid.ts) (novo) — `isUuid(value)` regex compartilhado; estava duplicado entre `features/workspace/actions.ts` e `features/invitations/queries.ts`.

**Smoke endpoint ampliado:** [`apps/web/app/api/smoke-test/workspaces/route.ts`](apps/web/app/api/smoke-test/workspaces/route.ts) cresceu de **34 → 48 asserts em 8 grupos** (verificado ao vivo via `curl`: `HTTP 200 · 48/48 ✓`). Novos: `isUuid` (7 asserts: v4 lowercase/uppercase, empty, non-uuid, null, sql injection, extra chars), `signup-control` (3 asserts: clean name, `\r\n` header injection, bare `\n`), `invite-email` (5 asserts: subject sem `\r`/`\n`, subject sem `Bcc:`, HTML escapa `<script>`, HTML escapa `'` como `&#39;`).

**Débitos do review que NÃO entraram aqui** (rolam pra M7#5 + M7#6):

| Severidade | Origem    | Débito                                                                                                                                                                                                      | Vai pra |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 🔴 CRÍTICO | #1        | Smoke test cobrindo `safeNextParam` com query-strings codificadas (falso-positivo do review confirmado por trace manual)                                                                                    | M7#5    |
| 🔴 CRÍTICO | #2        | Wrap invitations actions (`inviteMember`, `accept`, `revoke`) em `withWorkspace` — hoje funciona porque Prisma roda como postgres superuser que bypassa RLS, mas em produção com role restrito vai precisar | M7#5    |
| 🟠 HIGH    | #7 / #11  | `User.email` é `@db.Citext` — query Prisma fragmenta se normalize sumir; documentar invariante OU usar `mode: 'insensitive'`                                                                                | M7#5    |
| 🟠 HIGH    | #12       | `createWorkspaceAction` silenciosamente reaproveita workspace existente — input do user é dropped (UX wart aceitável pra agora)                                                                             | M7#5    |
| 🟠 HIGH    | #13       | `searchParams.token` pode vir como array; primeiro normalizar antes de validar (defesa em profundidade)                                                                                                     | M7#5    |
| 🟡 MEDIUM  | #15       | `/verify-email` redirect deleta token — perde fluxo do convidado novo que clica antes de verificar email                                                                                                    | M7#5    |
| 🟡 MEDIUM  | #16       | `users.email` upsert defensivo com `??''` mascara bug do trigger — falhar barulhento seria mais honesto                                                                                                     | M7#5    |
| 🟡 MEDIUM  | #17       | Cookie TTL de 30d descasa com sessão Supabase (refresh token expira antes) — middleware deveria validar membership do cookie                                                                                | M7#5    |
| 🟡 MEDIUM  | #20       | `getMembershipCountForUser` chamado em cold-start sem cache em memória — 1 query Supabase REST por request quando cookie ausente                                                                            | M7#5    |
| 🟡 MEDIUM  | #21       | `resolveHasWorkspace` chamado 2x na mesma request em fluxos como `/dashboard` — vale memoize com `Map<userId, Promise>`                                                                                     | M7#5    |
| 🟡 LOW     | múltiplos | Cast unsafe de `user.user_metadata`, fonte Poppins não web-safe no email, `accept-form.tsx` double-render com `refresh+push`, etc                                                                           | M7#5+   |

**Decisões registradas:**

- **`isPrismaErrorCode` e `isUuid` em `lib/utils/`:** fora de `'use server'` files pra evitar virar RPC callable do client. Padrão consistente com `lib/auth/get-membership-count.ts` (que vive em `features/workspace/queries.ts` com `'server-only'`).
- **Token rotation em re-invite:** chave de segurança — link antigo não deve sobreviver a `revoke` + re-emit. `crypto.randomUUID()` (Web Crypto API, runtime universal) gera no app side; default DB (`gen_random_uuid()`) só cobre o `create` path.
- **Audit log depois do email:** trade-off entre "audit é fonte de verdade de tudo que tentamos" vs "audit é fonte de verdade do que realmente aconteceu". Escolhemos o segundo — alinha com leitura de compliance LGPD (CLAUDE.md §7.5).
- **CRÍTICO #1 falso-positivo:** o review apontou que `?token=` viraria `%3F` no path por dupla codificação. Trace manual mostra que `searchParams.get('next')` retorna valor já decodificado e `new URL(next, req.url)` parsea `?token=…` corretamente como query (não como path). Mantemos como `not a bug` mas adicionamos smoke test em M7#5.
- **Wrap em `withWorkspace` (CRÍTICO #2) deferred:** o ambiente atual (Prisma com `DATABASE_URL` apontando pra Supavisor pooler como `postgres` superuser) bypassa RLS por design — não é falha real hoje. Vira bloqueador quando endurecermos a connection string em produção com role restrito; aí M7#5 wrap-a junto com `requireRole`.

**Validação local final:**

- `pnpm -w typecheck` 5/5 ✓
- `pnpm -w lint` 5/5 ✓
- `pnpm -w format:check` ✓
- `pnpm --filter @papopro/web build` 37 rotas ✓
- Smoke endpoint `/api/smoke-test/workspaces` **48/48 ✓** (ao vivo via `curl`)
- Login Supabase + onboarding + dashboard testados em browser (`NODE_USE_SYSTEM_CA=1 pnpm dev` no Windows pra contornar TLS strict; ver `docs/SETUP.md`)

**Commit:** `fix(m7-invites-workspaces): aplicar fixes do code review (CRITICO + HIGH + MEDIUM)`

**Commit final do M7#4 (entregue só no último sub-PR):** já efetivado nos 4 commits (3 ondas + fixes do review) — não há squash separado.

**Entregas — M7#5 — RBAC + Audit Log + /settings/team + débitos do review do PR #39:**

Branch `m7-rbac-audit-team`. PR único monolítico fechando 4 frentes coesas + 9 débitos do review do PR #39 (2 CRÍTICO, 4 HIGH, 3 MEDIUM, 1 falso-positivo confirmado). Decisão: contra o padrão "sub-PRs pequenos" do M7#1–#4, mas o escopo é coeso — RBAC, audit e `/settings/team` se exercitam mutuamente (sem `requireRole`, as actions novas de role/remove seriam mais inline duplicado).

**Frente A — RBAC genérico (`requireRole`):**

- [x] [`apps/web/lib/auth/require-role.ts`](apps/web/lib/auth/require-role.ts) — helper canônico. Retorna `{ ok: true, ctx }` em sucesso ou `{ ok: false, error, code }` em qualquer falha. `code: 'no_session' | 'no_workspace' | 'not_member' | 'forbidden'` permite o caller mapear pra microcopy contextual via `forbiddenMessage`. **Não joga** `redirect()` nem throw — caller decide UX. `ctx.userEmail` exposto explicitamente (sem `user.email!` espalhado pelo código).
- [x] [`apps/web/features/invitations/actions.ts`](apps/web/features/invitations/actions.ts) — `inviteMemberAction` e `revokeInvitationAction` migrados pra `requireRole(['Owner','Admin'], { forbiddenMessage: … })`. 4 blocos inline (`getCurrentUser` + email guard + `readWorkspaceCookie` + `isUuid` + `workspaceMember.findUnique` + role check) viram 1 chamada. Constante `ADMIN_ROLES` removida.
- **Decisão `setActiveWorkspaceAction` NÃO usa `requireRole`:** o action recebe `workspaceId` como argumento (não vem do cookie ativo) — o helper canônico lê do cookie. Refatorar exigiria opção `workspaceId` no helper que só `setActiveWorkspaceAction` usaria. Mantemos inline (4 linhas, RBAC mínimo) e documentamos no comentário do `require-role.ts`.

**Frente B — Audit log expandido + wrap em `withWorkspace` (CRÍTICO #2):**

- [x] [`apps/web/lib/audit/context.ts`](apps/web/lib/audit/context.ts) — helper `getRequestAuditContext()` lê `x-forwarded-for` (Vercel sanitiza spoofing — primeiro IP é o cliente real) com fallback `x-real-ip`, mais `user-agent`. Centraliza convenção pra todos os audit logs novos. Mascaramento LGPD do IP completo fica como TODO pro M7#6.
- [x] [`apps/web/features/auth/actions.ts`](apps/web/features/auth/actions.ts) — `loginAction` registra `user_logged_in` pós-`signInWithPassword` (resolve workspaceId via cookie ativo OU primeiro membership; skip silente se user sem workspace — não polui audit_logs com órfãos). `logoutAction` registra `user_logged_out` **ANTES** de `signOut()` (senão `getUser()` volta null e perde o vínculo).
- [x] **Wrap em `withWorkspace`** ([CRÍTICO #2 do review do PR #39]): `inviteMemberAction` envolve check de existing member + invitation upsert + lookup de inviterRecord em UMA tx com discriminated union no retorno (`{ ok: true, invitation, inviterName } | { ok: false, code: 'already_member' }`); audit log em tx separada (non-fatal). `acceptInvitationAction` substitui `prisma.$transaction` por `withWorkspace(invitation.workspaceId, …)` — chicken-and-egg da leitura do convite por token continua via `prisma.` (caller não é membro ainda; admin client documentado no header). `revokeInvitationAction` envolve `updateMany` + audit em txs separadas.

**Frente C — `features/team/` + `/settings/team` real:**

- [x] [`apps/web/features/team/types.ts`](apps/web/features/team/types.ts) — `TeamMemberRow` (join de `workspace_members` + `users`) e `PendingInviteRow` (status='pending' só). Strings ISO 8601 em datas pra trivializar Server→Client boundary.
- [x] [`apps/web/features/team/schemas.ts`](apps/web/features/team/schemas.ts) — `changeRoleSchema` (aceita `Owner` no schema mas action bloqueia — sinal de "Use Transferir propriedade"), `removeMemberSchema`, `resendInviteSchema`.
- [x] [`apps/web/features/team/queries.ts`](apps/web/features/team/queries.ts) — `getTeamMembersAndInvitations(workspaceId)` server-only via admin client (Server Component não roda em tx Prisma; defense-in-depth = filtro `.eq('workspace_id', …)` explícito). Errors em invitations não bloqueiam a tela — log + retorna lista vazia.
- [x] [`apps/web/features/team/actions.ts`](apps/web/features/team/actions.ts) — 3 Server Actions: `changeRoleAction` (bloqueios: self-change, same-role no-op silente, promote Owner, demote Owner; audit `member_role_changed` com `changes: { from, to, targetUserId }`), `removeMemberAction` (bloqueios: Owner, self-remove; audit `member_removed`), `resendInviteAction` (token NÃO rotaciona — UX repetível; sem audit pois é repetição do invite original). Todas em `withWorkspace` com discriminated union no retorno.
- [x] [`apps/web/features/team/presentation.ts`](apps/web/features/team/presentation.ts) — `memberInitials` (2 letras name→email), `memberDisplayName` (name OR local-part do email), `isActiveMember` type guard.
- [x] [`apps/web/app/(dashboard)/settings/team/page.tsx`](<apps/web/app/(dashboard)/settings/team/page.tsx>) — vira Server Component com `dynamic = 'force-dynamic'` (mesma razão de `(dashboard)/layout.tsx`). Carrega ctx + workspaceId + dados reais e passa pro Client.
- [x] [`apps/web/app/(dashboard)/settings/team/team-view.tsx`](<apps/web/app/(dashboard)/settings/team/team-view.tsx>) — Client Component próprio (não reusou `TeamList`/`InviteMemberDialog` do `features/settings/` legacy pra evitar adapter entre enum `MemberRole` lowercase e Prisma `Role` PascalCase). Bloco "Convites pendentes" novo acima dos membros (tabela responsiva + dropdown Reenviar/Cancelar). RBAC visual: `canManage = Owner | Admin`; ações somem pra Manager/Vendedor/Viewer (defense in depth — Server Actions revalidam server-side). `router.refresh()` pós-mutation; sem optimistic update (fica pra M8+ quando volume justificar).

**Frente D — Débitos do review do PR #39:**

| ID            | Débito                                                                          | Solução                                                                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 CRÍTICO #1 | smoke test cobrindo `safeNextParam`                                             | Extraído de `middleware.ts` pra [`apps/web/lib/auth/safe-next-param.ts`](apps/web/lib/auth/safe-next-param.ts). 4 asserts novos no `/api/smoke-test/supabase`: aceita path de convite codificado, rejeita protocolo-relativo `//evil.com`, rejeita CRLF, rejeita >512 chars. |
| 🔴 CRÍTICO #2 | wrap invitations em `withWorkspace`                                             | Frente B2 — todas as 3 actions agora rodam em `withWorkspace`.                                                                                                                                                                                                               |
| 🟠 HIGH #11   | `User.email @db.Citext` — documentar invariante                                 | Comentário invariante em [schema.prisma:96](packages/db/prisma/schema.prisma) explicando que citext só é case-insensitive na comparação Postgres; app SEMPRE normaliza com `.toLowerCase().trim()` na borda.                                                                 |
| 🟠 HIGH #13   | `searchParams.token` pode vir como array                                        | [`apps/web/app/invite/accept/page.tsx`](apps/web/app/invite/accept/page.tsx) normaliza `Array.isArray ? [0] : raw` antes do Zod — em vez de descartar arrays como "convite não encontrado", pega o primeiro elemento.                                                        |
| 🟡 MEDIUM #15 | `/verify-email` redirect deleta `?token=`                                       | Middleware preserva o destino original (`pathname + search`) no `?next=` do `/verify-email`. Handler do `/verify-email` honra `next` quando `emailVerified`, redirecionando pra `/invite/accept?token=…` em vez de `/onboarding`.                                            |
| 🟡 MEDIUM #16 | `users.email ?? ''` mascara bug do trigger                                      | `createWorkspaceAction` valida `user.email` antes da tx e lança Error barulhento se faltar (em vez de inserir string vazia). `acceptInvitationAction` extrai `const userEmail = user.email` pra preservar narrowing dentro da `withWorkspace` callback e usar limpo.         |
| 🟡 MEDIUM #17 | cookie TTL vs sessão Supabase                                                   | Middleware fast-path agora valida membership via `isUserMemberOfWorkspace(userId, cookieWs)` (cached 60s) antes de confiar no cookie. Mismatch limpa cookie + cai pro slow path. Novo helper [`clearWorkspaceCookieOnResponse`](apps/web/lib/auth/workspace-cookie.ts).      |
| 🟡 MEDIUM #20 | `getMembershipCountForUser` sem cache                                           | `Map<key, { value, expires }>` no module scope de [`features/workspace/queries.ts`](apps/web/features/workspace/queries.ts) com TTL 60s. Edge worker mantém o Map vivo entre requests da mesma instance.                                                                     |
| 🟡 MEDIUM #21 | `resolveHasWorkspace` chamado 2x na mesma request                               | **Auditado: falso-positivo no middleware.** Cada path do middleware é exclusivo (raiz, auth routes, verify-email, onboarding, demais) — só 1 chamada por request. O cache TTL de MEDIUM #20 já cobre eventual chamada dupla cross-context (middleware + Server Component).   |
| LOW (vários)  | cast `user_metadata`, fonte Poppins email, `accept-form.tsx` double-render, etc | Rolam pra M7#6.                                                                                                                                                                                                                                                              |

**Validação local:**

- `pnpm --filter @papopro/web typecheck` ✓ (após cada frente — A, D-rápidos, B1, B2, C-backend, C-UI, D-smoke).
- 4 asserts novos no smoke endpoint elevam o total esperado de 6 → 10 checks.
- Cenários de browser a validar pós-merge:
  1. Owner em `/settings/team` vê membros reais + convites pendentes
  2. Convida novo email (Resend dispara)
  3. Muda papel Vendedor → Manager — `audit_logs.member_role_changed` aparece com ipAddress + userAgent
  4. Revoga convite pending — some da tela
  5. Logout — `audit_logs.user_logged_out` com workspaceId correto
  6. Login com Vendedor — `/settings/team` mostra read-only (sem botões de ação)

**Commits onda 1 (7 commits, em ordem):**

1. `feat(rbac): require-role helper + refactor invitations actions (M7#5 frente A)`
2. `fix(m7#5): débitos rápidos do review — token array, citext invariant, user.email throw`
3. `feat(audit): user_logged_in / user_logged_out com helper de request context`
4. `refactor(invitations): wrap actions em withWorkspace (M7#5 CRÍTICO #2)`
5. `feat(team): features/team backend + audit member_role_changed/removed`
6. `feat(settings/team): UI real consumindo features/team (Server Component + Client)`
7. `fix(middleware): preserve ?token= em verify-email + valida cookie + cache TTL + safeNextParam smoke`

**Entregas — M7#5 Onda 2 — fixes pós-review do PR #39:**

Após onda 1 ser revisada, mais 3 débitos HIGH foram identificados (todos comportamento real de produção, não estético). Onda 2 fecha eles na mesma branch antes do PR ir pro `dev`.

- [x] **HIGH #1 — `logLoginEvent` confiava no cookie de workspace de outra sessão** ([apps/web/features/auth/actions.ts](apps/web/features/auth/actions.ts)). Cenário: user A logado em workspace W1 → troca de conta no mesmo browser → user B faz login. Cookie `papopro_workspace_id` ainda é W1 (do user A), mas userId do request é B. Gravava audit `(workspaceId=W1, userId=B)` em tenant que B não pertence. Em produção com RLS restritiva, INSERT é rejeitado e login deixa de ser auditado. Em dev (superuser bypassa RLS), polui W1 com evento órfão. **Solução:** `logLoginEvent` sempre busca via `firstMembership` ordenado por `createdAt asc` do user que acabou de entrar — heurística simples até o switcher persistir "última seleção" em coluna do banco. Multi-workspace: audit vai sempre pro mais antigo (aceitável porque é login, não ação de domínio).
- [x] **HIGH #2 — `resendInviteAction` sem rate-limit** ([apps/web/features/team/actions.ts](apps/web/features/team/actions.ts)). Owner click-spam disparava N emails Resend pro mesmo convidado, consumindo cota Resend cross-tenant (a API key é compartilhada entre todos os workspaces). **Solução:** cooldown server-side de 60s entre reenvios do MESMO convite, proxy do `lastSentAt` via aritmética `expiresAt - INVITATION_TTL_DAYS` (evita migration nova). Erro retornado em pt-BR ("Aguarde Xs antes de reenviar esse convite.") cai no toast genérico do team-view — sem mudança de UI necessária. Em M8+ quando uma coluna `last_sent_at` dedicada entrar, trocar a aritmética por leitura direta.
- [x] **HIGH #3 — Ações destrutivas em /settings/team sem confirmação** ([apps/web/app/(dashboard)/settings/team/team-view.tsx](<apps/web/app/(dashboard)/settings/team/team-view.tsx>)). Clique acidental no dropdown removia membro / cancelava convite / rebaixava papel sem aviso, sem desfazer. **Solução:** ConfirmContext + `useConfirm()` hook evita prop drilling 3 níveis abaixo (TeamView → MembersSection → MemberRow → MemberActions). Cada ação destrutiva chama `useConfirm({ title, description, confirmLabel, destructive: true, onConfirm })`. Ações que NÃO passam por confirm (são reversíveis ou repetíveis): Promover, Convidar novo, Reenviar convite. Ações que passam: Remover membro, Cancelar convite, Rebaixar papel. `confirmPending` trava o cancelar enquanto a Server Action roda — evita fechar o dialog no meio da request.

**Commits onda 2 (4 commits, em ordem):**

8. `fix(m7-rbac-audit-team): logLoginEvent resolve workspaceId via firstMembership (HIGH #1)` (`ddb8f3a`)
9. `fix(m7-rbac-audit-team): cooldown 60s em resendInviteAction (HIGH #2)` (`f9538a8`)
10. `feat(m7-rbac-audit-team): confirm dialogs em ações destrutivas de /settings/team (HIGH #3)` (`b153da3`)
11. `chore(claude): ajustar permissões locais de Bash + Read sob WSL` (`06a870c`)

**Bônus pós-push — fix de CI:** PR #40 caiu vermelho na primeira tentativa porque pnpm 9.15+ parou silenciosamente de rodar o postinstall do `@prisma/client` (`PR #39 ainda mostrava o postinstall executando no log; PR #40 só mostrou `husky prepare`). Sem postinstall, `prisma generate`não corre e`@papopro/db:typecheck`quebra com`Module '@prisma/client' has no exported member 'PrismaClient'`. Fix: step explícito `pnpm --filter @papopro/db db:generate` antes de Lint no [.github/workflows/ci.yml](.github/workflows/ci.yml) — determinístico, alinha com SETUP.md.

12. `docs(plan): registrar onda 2 do M7#5 (fixes HIGH #1 + #2 + #3 pós-review)` (`0f5d39f`)
13. `ci: gerar prisma client explicitamente antes de lint/typecheck` (`f0e1aea`)

**Validação local pós-onda 2:** `pnpm -w typecheck` 5/5 ✓, `pnpm -w lint` 5/5 ✓, `pnpm -w build` 2/2 ✓ (37 rotas em apps/web), `pnpm -w run format:check` ✓.

**PR #40** (`m7-rbac-audit-team → dev`) — squash merged como [`c006556`](https://github.com/Mateusli23/papopro/commit/c006556) em 12-mai-26.

**Débitos LOW abertos pra M8+:**

- **`INVITATION_TTL_DAYS = 7` duplicado** em [`apps/web/features/team/actions.ts:48`](apps/web/features/team/actions.ts#L48) e [`apps/web/features/invitations/actions.ts:55`](apps/web/features/invitations/actions.ts#L55). A matemática do cooldown HIGH #2 (`lastSentAt = expiresAt - INVITATION_TTL_DAYS`) assume que ambos sempre concordam — se alguém mudar uma e esquecer a outra, o cooldown quebra silenciosamente (lastSentAt computado dias antes do envio real → cooldown sempre passa). Fix em M8: extrair pra módulo compartilhado tipo `apps/web/features/invitations/constants.ts` ou `apps/web/lib/invitations/constants.ts`.

**Commit:** `feat(m7-rbac-audit-team): rbac + audit + /settings/team + débitos PR #39 (M7#5)`

---

## Release: M7#1–#5 → main (parcial — 12-mai-26)

**PR de release:** `dev → main` aberto pós-merge do PR #40. **M7#6 (Playwright E2E + Sentry) fica fora desse release** — decisão de baixar batch size pra acelerar feedback de produção em M7#1-#5 antes de empilhar mais escopo.

**Conteúdo da release:**

| Sub-PR | Branch (já deletada)    | PR                                                   | Resumo                                                    |
| ------ | ----------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| M7#1   | `feat/supabase-core`    | [#39](https://github.com/Mateusli23/papopro/pull/39) | Setup Supabase + SDK + `with-workspace` helper            |
| M7#2   | `m7-schema-rls`         | [#39](https://github.com/Mateusli23/papopro/pull/39) | Schema (7 tabelas) + RLS (19 policies) + hardening        |
| M7#3   | `m7-schema-rls`         | [#39](https://github.com/Mateusli23/papopro/pull/39) | Supabase Auth real + middleware com `getUser()`           |
| M7#4   | `m7-invites-workspaces` | [#39](https://github.com/Mateusli23/papopro/pull/39) | Convites Resend + aceite magic link + switcher real       |
| M7#5   | `m7-rbac-audit-team`    | [#40](https://github.com/Mateusli23/papopro/pull/40) | RBAC + audit log + `/settings/team` real + débitos review |

**Por que release parcial:** lower batch size aproxima validação ao deploy. Se algo quebrar (Supabase config, RLS, Resend, RBAC), debug fica focado em M7#1-#5 — sem ruído de E2E/Sentry novos. M7#6 entra na próxima release.

**Configuração pendente do operador pós-release** (Vercel env vars + Supabase Dashboard) — listadas no body do PR de release. Sem essas, `/login` cai em erro de Supabase config.

---

## Entregas — M7#6 — Playwright E2E + Sentry (cirúrgico)

Branch `m7-e2e-sentry`. Último sub-PR do M7. Substitui smoke tests `/api/smoke-test/supabase` por testes E2E reais cobrindo o fluxo crítico via browser + middleware + Server Actions + RLS, e instrumenta erros server-side com Sentry sem mexer no build pipeline.

**Frente A — Playwright E2E (7 commits):**

- [x] [`apps/web/playwright.config.ts`](apps/web/playwright.config.ts) — chromium-only, `pnpm dev` como webServer auto-iniciado (reuseExistingServer fora do CI), `fullyParallel: false` + `workers: 1` (specs compartilham banco), retries 0 CI / 1 local, timeout 60s/teste, reporters `list` + `html`, trace `on-first-retry`, screenshot `only-on-failure`, video `retain-on-failure`.
- [x] Scripts em [`apps/web/package.json`](apps/web/package.json): `e2e`, `e2e:ui`, `e2e:install`. `@playwright/test@^1.60.0` em `devDependencies`.
- [x] [`apps/web/lib/email/outbox.ts`](apps/web/lib/email/outbox.ts) + branch em [`apps/web/lib/email/resend.ts`](apps/web/lib/email/resend.ts) — `RESEND_MODE=outbox` desvia `sendEmail()` pra `e2e/.tmp/outbox.jsonl` (gitignored). Path hardcoded propositalmente (defense in depth contra leak de tokens). Em prod (`RESEND_MODE` unset), comportamento idêntico.
- [x] `data-testid` em 7 forms críticos: [`login-form`](apps/web/features/auth/components/login-form.tsx), [`signup-form`](apps/web/features/auth/components/signup-form.tsx), [`forgot-form`](apps/web/features/auth/components/forgot-form.tsx), [`verify-email-card`](apps/web/features/auth/components/verify-email-card.tsx), [`onboarding-form`](apps/web/features/auth/components/onboarding-form.tsx), [`accept-form`](apps/web/app/invite/accept/accept-form.tsx), [`team-view`](<apps/web/app/(dashboard)/settings/team/team-view.tsx>). Padrão `<feature>-<element>`. Linhas/menus que se repetem por entidade incluem ID (`member-row-{userId}`, `invitation-menu-{id}`).
- [x] 4 helpers em [`apps/web/e2e/helpers/`](apps/web/e2e/helpers/):
  - `supabase-admin.ts` — singleton admin client com **guard rail**: trava se `E2E_SUPABASE_URL` apontar pra `iffmjydjeukozopxxitb` (projeto de prod).
  - `test-users.ts` — `createTestUser` (idempotent em 422 already-registered), `confirmTestUser` (força `email_confirmed_at`), `cleanupTestUser`, `cleanupTestWorkspace` (FK CASCADE redundante).
  - `outbox.ts` — `waitForEmail(predicate)`, `waitForEmailTo(email)`, `extractInviteToken(html)` (regex tolerante a `&amp;`), `extractInviteUrl(html)`. Polling 100ms até timeout 10s default; diagnóstico no fail lista outbox atual.
  - `fixtures.ts` — `freshUser` (user confirmado sem workspace) e `loggedInOwner` (user + workspace + Owner membership + login via UI). Teardown automático: workspace + cascade → user → outbox clear.
- [x] 3 specs em [`apps/web/e2e/`](apps/web/e2e/):
  - **`01-auth-flow.spec.ts`** (~10 asserts): signup → verify (admin force) → login → onboarding → dashboard. DB assertions: workspace_members[1] com role Owner, audit `user_logged_in` + `workspace_created`. **Cobre HIGH #1** indiretamente (workspaceId resolvido via firstMembership).
  - **`02-invite-flow.spec.ts`** (~12 asserts em 2 contexts): Owner → invite UI → outbox → extract magic link → context2 (browser limpo) → opens link (LoggedOutState) → CTA "Criar conta e aceitar" → signup com email pré-fillado → /verify-email → admin confirm → reabre magic link → AcceptInvitationForm → /dashboard. DB: workspace_members[2], invitations.status=accepted, audit `member_joined`, outbox=1 email (não duplicou).
  - **`03-team-management.spec.ts`** (~15 asserts em 3 sub-tests): (1) promote sem confirm + resend success + **resend < 60s = cooldown HIGH #2** + remove com confirm dialog HIGH #3; (2) **HIGH #1 cross-context** — Owner em browser limpo loga, audit grava com workspaceId correto; (3) **RBAC visual** — Vendedor logado vê `/settings/team` sem `invite-button` e sem `member-menu-*`.

**Frente B — Sentry server-side cirúrgico (2 commits):**

Escopo intencionalmente menor que o plano original (sem `withSentryConfig` em `next.config.mjs`, sem `withServerActionInstrumentation` em 14 actions, sem client/edge configs, sem source map upload).

- [x] `@sentry/nextjs@^10.53.1` em `apps/web/dependencies`.
- [x] [`apps/web/instrumentation.ts`](apps/web/instrumentation.ts) — Next 14 hook oficial. `register()` carrega `sentry.server.config.ts` via dynamic import só em `NEXT_RUNTIME=nodejs`. Re-exporta `captureRequestError` como `onRequestError` (hook obrigatório do Sentry 9+ pra erros em RSCs).
- [x] [`apps/web/sentry.server.config.ts`](apps/web/sentry.server.config.ts) — `Sentry.init` condicional ao DSN setado (no-op silente em dev). `tracesSampleRate: 0` (só error capture, sem custo de tracing). `release: VERCEL_GIT_COMMIT_SHA`, `environment: VERCEL_ENV`. `beforeSend: scrubPiiFromEvent`.
- [x] [`apps/web/lib/observability/scrubber.ts`](apps/web/lib/observability/scrubber.ts) — strip recursivo de 19 chaves sensíveis (password, secret, api_key, service_role_key, token, inviteToken, code, email, phone, cpf, cnpj, rg…) em `event.{request, extra, contexts, tags, breadcrumbs}` + `event.user.email`. WeakSet evita ciclos. **Strip > mask** (mask permitiria cross-reference de eventos similares).
- [x] [`apps/web/lib/observability/report.ts`](apps/web/lib/observability/report.ts) — `reportNonFatal(scope, err, ctx)` preserva `console.error` E chama `Sentry.captureException` com tags `{ scope, severity }`. Convenção de scope: `<feature>.<action>.<step>` (ex: `auth.login.audit`).
- [x] **11 swaps** dos `console.error('[scope] msg', err)` em Server Actions por `reportNonFatal`: auth (3) + invitations (4) + team (1) + workspace (3). `console.warn` do P2002 race em `acceptInvitationAction` mantido (não é erro). Queries `console.error` NÃO trocadas (escopo da PR é actions).

**Decisão Frente B "cirúrgica":**

- **Sem `withSentryConfig`** → zero acoplamento de build, zero risco de quebrar `pnpm build`, sem `SENTRY_AUTH_TOKEN` necessário (sem upload de source maps).
- **Sem `withServerActionInstrumentation`** → contrato das actions inalterado; cobertura suficiente via swap dos `console.error` que já cobrem todos os caminhos non-fatal críticos.
- **Sem client/edge configs** → M7 é server-side; forms já têm error states locais; middleware errors aparecem nos logs do Vercel.
- **Reusa `NEXT_PUBLIC_SENTRY_DSN_WEB`** já provisionado em `.env.example` desde M2.

**Docs (2 commits):**

- [x] [`docs/SETUP.md`](docs/SETUP.md) — nova seção 4.5 "Rodar E2E Playwright localmente" (operador cria projeto Supabase E2E `papopro-e2e`, popula `E2E_SUPABASE_*` + `RESEND_MODE=outbox` no `.env.local`, roda `pnpm e2e:install` + `pnpm e2e`); seção Sentry atualizada pra refletir M7#6 real (1 DSN, sem AUTH_TOKEN, scopes de scrubber).
- [x] Este registro no PLAN.md.

**Commits (11 na branch, em ordem):**

1. `chore(e2e): playwright config + scripts + gitignore` (`a4963b9`)
2. `feat(e2e): resend outbox file-based pra RESEND_MODE=outbox` (`bd39cbe`)
3. `chore(ui): data-testid em forms críticos do fluxo auth + team` (`d8875a1`)
4. `feat(e2e): helpers de teste (supabase-admin, test-users, outbox, fixtures)` (`e23b117`)
5. `test(e2e): spec 01 — auth flow` (`ac3fe10`)
6. `test(e2e): spec 02 — invite flow` (`9e9b65a`)
7. `test(e2e): spec 03 — team management` (`9be3799`)
8. `feat(observability): sentry server-side + instrumentation + scrubber LGPD` (`0cf0341`)
9. `feat(observability): reportNonFatal + swap 11 console.error em Server Actions` (`61c4843`)
10. `docs(setup): rodar E2E + Sentry config atualizada` (`b239a4a`)
11. `docs(plan): registrar M7#6 entregue + release notes M7#1-#5 + débito INVITATION_TTL_DAYS` (este commit)

**Validação local:** `pnpm -w typecheck` 5/5 ✓, `pnpm --filter @papopro/web build` ✓ (37 rotas, Middleware 81.5kB).
**Execução dos specs:** pendente operador criar projeto Supabase E2E (`E2E_SUPABASE_*` no `.env.local`). Specs typecheck/lint passam — execução real fica pós-merge quando operador rodar.

**Débitos NÃO entram aqui (rolam pra polimento pós-M7 ou M8):**

- LGPD IP masking em `getRequestAuditContext` (último octeto IPv4 / últimos 80 bits IPv6, com flag Enterprise pra gravar completo).
- Cast seguro de `user.user_metadata` (hoje `as any` em alguns lugares).
- Fonte Poppins não web-safe no email (Outlook não renderiza).
- `accept-form.tsx` `router.refresh() + router.push()` double-render.
- CI rodando Playwright (job `e2e` em [.github/workflows/ci.yml](.github/workflows/ci.yml)) — fica pra polimento subsequente; M7#6 entrega specs **runnable localmente**.
- Remover smoke endpoint `/api/smoke-test/supabase` (mantém por valor incremental em CI atual).
- Vitest setup pra unit tests (pipeline `test` do turbo.json segue vazio até primeira necessidade real, provavelmente M8).
- Coverage de firefox/webkit (Chromium-only pra MVP).
- `withSentryConfig` + source maps + client/edge configs Sentry (escopo cirúrgico desta PR).
- Swap dos `console.error` em queries (escopo cirúrgico — só actions trocadas).

**Commit:** `feat(m7-e2e-sentry): Playwright E2E (3 specs) + Sentry server-side cirúrgico (M7#6)`

---

## M8 — Backend de Domínio: Leads, Deals, Pipelines, Tarefas

**Branches:** múltiplos sub-PRs empilhados sobre `dev` (gitflow strict, CLAUDE.md §10), partindo de `m8-schema-leads-deals`.

**Objetivo:** Persistir o core do CRM. Substituir fixtures de M4/M5 por queries reais com RLS. CRUD ponta-a-ponta funcional, importação de CSV, webhooks de entrada.

**Estratégia de sub-PRs.** Mesmo padrão de M7: fatiar pra cada review focar numa coisa. M8#1 entrega o alicerce (schema, RLS, seed) sem mexer em UI ainda — sub-PRs seguintes substituem mocks por queries.

| Sub-PR | Escopo                                                                                          | Branch                   | Status      | PR                                                   |
| ------ | ----------------------------------------------------------------------------------------------- | ------------------------ | ----------- | ---------------------------------------------------- |
| M8#1   | Schema + migration + RLS (11 tabelas) + seed pipeline default + 8 audit_action novos            | `m8-schema-leads-deals`  | ✅ entregue | [#45](https://github.com/Mateusli23/papopro/pull/45) |
| M8#2   | `/leads` lê DB real — queries + Server Actions de CRUD (`createLead`, `updateLead`, …)          | `m8-leads-crud`          | ✅ entregue | _aberto após validação_                              |
| M8#3   | Kanban persiste drag-and-drop — `moveDealStage` + `updateDealOrder` otimista                    | `m8-kanban-persistence`  | ✅ entregue | [#48](https://github.com/Mateusli23/papopro/pull/48) |
| M8#4   | Timeline real do lead + tasks (CRUD `createTask`, `completeTask`) lendo do DB                   | `m8-timeline-tasks`      | ✅ entregue | [#49](https://github.com/Mateusli23/papopro/pull/49) |
| M8#5   | Importação CSV (≤1k síncrono) + webhook `/api/webhooks/leads/[token]` + round-robin de assignee | `m8-csv-webhooks`        | ✅ entregue | [#51](https://github.com/Mateusli23/papopro/pull/51) |
| M8#6   | Storage Supabase para anexos (`bucket attachments` + RLS) + cleanup órfão diário                | `m8-storage-attachments` | ✅ entregue | [#53](https://github.com/Mateusli23/papopro/pull/53) |
| M8#7   | Realtime Kanban (postgres_changes em `deals`) + export CSV de leads + audit LGPD                | `m8-realtime-export`     | ✅ entregue | _aberto após validação local_                        |

Google Calendar sync (PRD §3.7) e custom_fields UI são polimentos posteriores — schema preparado em M8#1, UI em onda separada.

**Entregas (consolidadas, marcadas conforme sub-PRs entregam):**

- [x] Schema Prisma: `leads`, `deals`, `pipelines`, `pipeline_stages`, `tags`, `lead_tags`, `tasks`, `activities`, `attachments`, `custom_fields`, `lead_custom_values` _(M8#1)_
- [x] RLS em todas (filtro por `workspace_id` via `current_workspace_id()`; defense-in-depth no código) _(M8#1 — 41 policies validadas)_
- [x] Migration versionada + seed de pipeline default (Novo → Em contato → Proposta → Negociação → Ganho → Perdido) — semeada por `createWorkspaceAction` na transação do signup _(M8#1)_
- [x] Server Actions: `createLead`, `updateLead`, `assignLead`, `archiveLead`, `moveLeadToStage` _(M8#2)_; `createDeal`, `moveDealStage`, `addActivity`, `createTask`, `completeTask`, `addAttachment` _(M8#3-#6)_
- [x] Queries server-side: `listLeads(filters)`, `getLead(id)`, `listSalesReps`, `listLeadTags`, `listDefaultPipeline` — todas via `withWorkspace` _(M8#2)_; `listDeals`, `listTasks` _(M8#3-#4)_
- [x] Defense-in-depth: toda query inclui `where: { workspaceId }` no código _(M8#2)_
- [x] Tela `/leads` lê dados reais; filtros client-side em memória (volume MVP); pg*trgm/tsvector ficam pra otimização se virar gargalo *(M8#2)\_
- [x] Detalhe do lead lê timeline real (`activities` + `tasks` + `stage_change` + `lead_created` + `note`) _(M8#4)_
- [x] Kanban persiste drag-and-drop (`moveDealStage` + `updateDealOrder` Server Actions otimistas) _(M8#3)_
- [x] Importação CSV: até 1.000 linhas síncrono; `previewImportAction` + `importLeadsAction` com checkbox LGPD obrigatório; dedup por phone/email; round-robin de assignee _(M8#5)_. Volumes >1k via Edge Function ficam pra pós-MVP (antivírus + TLS quebra dev local nessa máquina — memória `dev-local-windows-antivirus-tls`).
- [x] Webhook genérico de leads: [`app/api/webhooks/leads/[token]/route.ts`](apps/web/app/api/webhooks/leads/[token]/route.ts) — token URL-safe único por workspace (`workspaces.webhook_token`, regenerável por Owner/Admin em Settings → Connections), valida payload mínimo (Zod), idempotência via SHA256 em `webhook_events`, rate-limit 100 req/min/token, cria lead com round-robin + activity `lead_created` _(M8#5)_
- [x] Storage Supabase para anexos (bucket `attachments` privado, 10 MB, whitelist MIME + 3 policies RLS em `storage.objects` workspace-scoped via path prefix) _(M8#6)_
- [x] Cleanup de mídia órfã agendado (Next route `/api/cron/cleanup-attachments` + GitHub Action diário 03:00 BRT; rows + storage objects com `deletedAt > 30d`) _(M8#6)_. Migração pra `pg_cron + pg_net + Edge Function` fica pós-MVP (Edge Functions bloqueadas em dev local).
- [ ] Integração Google Calendar (OAuth + sync bidirecional de tarefas a cada 2 min via Edge Function) _(polimento pós-M8#4)_
- [x] Exportação CSV de leads (≤5k linhas síncrono; CSV UTF-8 BOM RFC 4180; respeitando filtros aplicados; audit `export_started` com IP/UA pra LGPD §3.4) _(M8#7)_. XLSX + background >5k (Edge Function + email link 7d) ficam pra pós-MVP.
- [x] Realtime no Kanban (Supabase postgres*changes em `deals` filter `workspace_id`; `REPLICA IDENTITY FULL`; hook `useRealtimeDeals` dispara `router.refresh()` debounced) *(M8#7)\_

**Entregas — M8#1 Schema + RLS + seed (entregue, PR pós-validação local):**

- [x] [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) — 11 modelos novos espelhando os tipos de M4/M5 (`apps/web/features/leads/types.ts`, `deals/types.ts`, etc.): Pipeline, PipelineStage, Lead, Deal, Tag, LeadTag, Task, Activity, Attachment, CustomField, LeadCustomValue. Reverse relations adicionadas em Workspace e WorkspaceMember.
- [x] 8 enums novos: `lead_origin` (9 valores), `lead_status`, `deal_status`, `task_kind`, `task_status`, `activity_type` (10 valores), `stage_tone`, `custom_field_type`. Convenção: snake_case com `@@map`, espelhando UI.
- [x] 8 valores adicionados ao enum existente `audit_action` (`lead_created`, `lead_updated`, `lead_deleted`, `deal_created`, `deal_updated`, `deal_stage_changed`, `task_created`, `task_completed`) via `ALTER TYPE ADD VALUE IF NOT EXISTS` (idempotente).
- [x] [`supabase/migrations/20260513120000_m8_1_domain_leads_deals.sql`](supabase/migrations/20260513120000_m8_1_domain_leads_deals.sql) — DDL idempotente (tudo `IF NOT EXISTS` / `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object`). 11 `CREATE TABLE` + ~25 índices + 41 policies RLS + 7 triggers `touch_updated_at` + `COMMENT ON TABLE` em todas.
- [x] RLS habilitada via `ENABLE ROW LEVEL SECURITY` + policies por `(workspace_id = public.current_workspace_id())`. Tabelas junction (`lead_tags`, `lead_custom_values`) e `pipeline_stages` usam subquery `pipeline_id IN (SELECT … FROM pipelines WHERE workspace_id = …)` pra herdar tenant. `activities` é append-only — só policy SELECT + INSERT, sem UPDATE/DELETE.
- [x] [`apps/web/lib/workspace/default-pipeline.ts`](apps/web/lib/workspace/default-pipeline.ts) — constante `DEFAULT_PIPELINE_STAGES` com os 6 stages do funil padrão (slugs, names, order, rot_days, terminal, tone). Tipo `tone` como union literal (`'default' | 'success' | 'destructive'`) seguindo padrão do repo (sem importar enums Prisma como runtime).
- [x] [`apps/web/features/workspace/actions.ts`](apps/web/features/workspace/actions.ts) — `createWorkspaceAction` agora cresce a transação com `pipeline.create` (isDefault=true) + `pipelineStage.createMany` (6 stages). Atomicidade preservada: se qualquer parte falhar, nada persiste (rollback automático).
- [x] Validação local: `supabase db reset` aplica todas as 3 migrations (2 do M7 + 1 do M8#1), `prisma generate` regenera client com os 11 modelos, signup pelo navegador semeia workspace + pipeline + 6 stages na ordem correta (validado via SQL — 6 rows com slugs `novo`, `em_contato`, `proposta`, `negociacao`, `ganho`, `perdido`; `ganho`/`perdido` com `terminal=true` e tone correto).
- [x] Typecheck `pnpm --filter @papopro/web typecheck` passa sem warnings.
- [x] Smoke test `/api/smoke-test/supabase` mantém 10 checks verdes (M7#1 não-regressão).

**Entregas — M8#2 `/leads` lê DB real + CRUD via Server Actions (entregue, PR pós-validação local):**

- [x] [`apps/web/features/leads/queries.ts`](apps/web/features/leads/queries.ts) — server-only (`import 'server-only'`). 5 funções via `withWorkspace` + defense-in-depth `where: { workspaceId }`: `listLeads(workspaceId, filters?)` (oculta soft-deleted e arquivados por default; filtros via Postgres `where`), `getLead(workspaceId, id)` (retorna `LeadWithRelations` com tags + open deals), `listSalesReps` (membros com role Owner/Admin/Manager/Vendedor, accent cyclado), `listLeadTags` (tags em uso ordenadas alfabeticamente), `listDefaultPipeline` (pipeline isDefault + stages ordenadas).
- [x] [`apps/web/features/leads/transforms.ts`](apps/web/features/leads/transforms.ts) — funções puras Prisma row → UI `Lead`. `deriveLeadTemperature(lastInteractionAt, referenceDate?)` injetável (CLAUDE.md §5 — `now()` testável) com regra de M4 (≤3d → hot, 4-10d → warm, >10d/null → cold). `flattenLeadTags` achata m:n em `string[]`. `toLeadUI` converte `Date → ISO string` + null → undefined.
- [x] [`apps/web/features/leads/filters.ts`](apps/web/features/leads/filters.ts) — extraído de `queries.ts` antigo. Mantém `applyLeadFilters`/`sumPipelineValue` puros (importáveis de client). Volume MVP ~500 leads/workspace torna filtragem client imperceptível.
- [x] [`apps/web/features/leads/actions.ts`](apps/web/features/leads/actions.ts) — 5 Server Actions seguindo anatomia de [`features/team/actions.ts`](apps/web/features/team/actions.ts): Zod → `requireRole` → `withWorkspace` tx → defense-in-depth + audit log na mesma tx → `revalidatePath` → retorno padrão.
  - `createLeadAction` — RBAC Owner/Admin/Manager/Vendedor; valida que `stageId` e `assignedTo` pertencem ao workspace antes de FK; sincroniza tags m:n via `syncLeadTags` helper (upsert idempotente); grava activity `lead_created` + audit `lead_created`.
  - `updateLeadAction` — mesma RBAC; valida FK de stage/assignee se patch tocá-los; só atualiza campos presentes no patch (não sobrescreve com undefined); resincroniza tags se `tags` no patch; audit `lead_updated` com diff.
  - `moveLeadToStageAction` — mesma RBAC; bloqueia same-stage como no-op; atualiza `lastInteractionAt` (sinaliza atividade do vendedor); grava activity `stage_change` + audit `deal_stage_changed`.
  - `assignLeadAction` — RBAC mais restrito: **Owner/Admin/Manager** (Vendedor não reassigna leads de colegas pra evitar "roubo"); valida que novo assignee tem role permitido + pertence ao workspace.
  - `archiveLeadAction` — RBAC Owner/Admin/Manager; soft-archive via `status='arquivado'` (lead some da listagem default mas continua acessível); audit `lead_deleted` (mapeia "delete lógico" ao enum existente).
- [x] [`apps/web/features/leads/schemas.ts`](apps/web/features/leads/schemas.ts) — `stageId`/`assignedTo` viraram `.uuid()` (eram `min(1)` por causa de slugs em M4). Adicionados `moveStageSchema`, `assignLeadSchema`, `archiveLeadSchema`, `updateLeadSchema` (= `leadUpdateSchema.extend({ leadId })`).
- [x] [`apps/web/app/(dashboard)/leads/page.tsx`](<apps/web/app/(dashboard)/leads/page.tsx>) — vira Server Component. `dynamic = 'force-dynamic'`. Padrão de `/settings/team/page.tsx`: `getCurrentUserContext` → `readWorkspaceCookie` → defense check membership → `Promise.all` de 4 queries → passa props.
- [x] [`apps/web/app/(dashboard)/leads/leads-view.tsx`](<apps/web/app/(dashboard)/leads/leads-view.tsx>) — recebe `initialLeads`, `salesReps`, `pipeline`, `tags`, `callerRole` por prop (não chama mais `useLeads()` do store). Filtros continuam client-side. **Botões "Adicionar" e "Importar" escondidos pra Viewer** (RBAC server-side também bloqueia se forjar request).
- [x] [`apps/web/features/leads/components/lead-create-dialog.tsx`](apps/web/features/leads/components/lead-create-dialog.tsx) — `onSubmit` chama `createLeadAction` via async + erro em `submitError`. Recebe `salesReps` + `activeStages` por prop (não importa mais `SALES_REPS`/`ACTIVE_STAGES` de fixtures). On success: `router.refresh()` re-fetcha Server Component + `router.push(/leads/${id})` navega pro detalhe.
- [x] [`apps/web/app/(dashboard)/leads/[id]/page.tsx`](<apps/web/app/(dashboard)/leads/[id]/page.tsx>) — Server Component, `notFound()` se RLS bloquear ou registro não existir. Carrega `getLead` + `listSalesReps` + `listDefaultPipeline` em paralelo. `dynamic = 'force-dynamic'`.
- [x] [`apps/web/app/(dashboard)/leads/[id]/lead-detail-view.tsx`](<apps/web/app/(dashboard)/leads/[id]/lead-detail-view.tsx>) — recebe `lead: LeadWithRelations` + `salesReps` + `stages` + `callerRole` por prop. Banner "Timeline e Próximas ações ainda mock — real em M8#4" pra transparência. Mostra bloco de "Negócios em aberto" se `lead.openDeals.length > 0`.
- [x] [`apps/web/features/leads/components/lead-detail-card.tsx`](apps/web/features/leads/components/lead-detail-card.tsx) — substitui `updateLead` (store) por `updateLeadAction` + `moveLeadToStageAction` + `assignLeadAction` + `archiveLeadAction`. Edição inline com `router.refresh()` no sucesso. RBAC granular nos handlers: `canEdit` (não-Viewer), `canAssign` (Owner/Admin/Manager), `canArchive` (Owner/Admin/Manager). Botão "Arquivar lead" só aparece se `canArchive` + `status==='ativo'`.
- [x] [`apps/web/app/api/smoke-test/leads/route.ts`](apps/web/app/api/smoke-test/leads/route.ts) — import path migrado (`queries` → `filters`); +15 checks novos do grupo `transforms-m8`: `deriveLeadTemperature` (3 janelas + null), `flattenLeadTags`, e validação de UUID em `moveStageSchema`/`assignLeadSchema`/`archiveLeadSchema`/`updateLeadSchema`. **77/77 checks verdes**; smoke `/api/smoke-test/supabase` continua 10/10 (não-regressão M7).
- [x] `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅, `pnpm --filter @papopro/web build` ✅ (rotas dinâmicas conforme esperado).
- [x] **`store.ts` mantido propositalmente** — 11 outros features (dashboard, reports, inbox, tasks) ainda dependem; serão migrados em M8#3/M8#4/M9.

**Entregas — M8#3 Kanban persiste drag-and-drop (entregue, PR pós-validação local):**

- [x] [`apps/web/features/deals/queries.ts`](apps/web/features/deals/queries.ts) — server-only (`import 'server-only'`). 2 funções via `withWorkspace` + defense-in-depth: `listDeals(workspaceId, filters?)` retorna deals com `stage.slug + stage.name` e `lead.name + lead.company` denormalizados (sort canônico `stage.order ASC, orderInStage ASC, createdAt DESC`); `listLeadsForCombobox(workspaceId)` carrega até 200 leads ativos pro modal "Adicionar negócio".
- [x] [`apps/web/features/deals/transforms.ts`](apps/web/features/deals/transforms.ts) — estendido com `toDealUI(PrismaDealRow): Deal` (denormaliza stage.slug + lead.name + lead.company; converte Date → ISO; null → undefined). Novos `computeOrderBetween(beforeOrder, afterOrder)` puro pra calcular `orderInStage` midpoint, e constante `ORDER_STEP=1000` (espaçamento generoso pra muitas inserções midpoint antes de precisar rebalancear).
- [x] [`apps/web/features/deals/actions.ts`](apps/web/features/deals/actions.ts) — 3 Server Actions seguindo anatomia de M8#2:
  - `createDealAction` — RBAC Owner/Admin/Manager/Vendedor; valida FK de `leadId`/`stageId`/`ownerId`; calcula `orderInStage = (MAX+1) * ORDER_STEP` (append no fim da coluna); deriva `status` automaticamente do tone da stage destino (`success` → won, `destructive` → lost, default → open); seta `closedAt` se nasce terminal; audit `deal_created`.
  - `moveDealStageAction({ dealId, stageId, beforeId?, afterId? })` — mesma RBAC; valida FK; calcula novo `orderInStage` via `resolveOrderInStage` helper (computeOrderBetween + rebalance fallback se midpoint colapsa); muda `status`+`closedAt` automaticamente quando entra/sai de stage terminal; audit `deal_stage_changed` com `from→to` + status diff.
  - `updateDealOrderAction({ dealId, beforeId?, afterId? })` — mesma RBAC; só reordena dentro da stage atual; audit `deal_updated` curto (reorder é evento de baixa relevância mas mantemos rastro pra LGPD/diagnóstico).
- [x] **Rebalance da coluna em caso de colisão**: quando os vizinhos colapsam (gap < 2 em `orderInStage`), o helper `resolveOrderInStage` reescreve toda a coluna em múltiplos de `ORDER_STEP` na mesma tx (operação O(N) raríssima com ORDER_STEP=1000).
- [x] [`apps/web/features/deals/schemas.ts`](apps/web/features/deals/schemas.ts) — `leadId`/`stageId`/`ownerId` viraram `.uuid()` (eram `.min(1)` em M4 por causa de slugs em fixture). Novos `moveDealStageSchema`, `updateDealOrderSchema` (`beforeId`/`afterId` opcionais).
- [x] [`apps/web/features/deals/types.ts`](apps/web/features/deals/types.ts) — `Deal` ganhou 4 campos opcionais pra suportar modo server-fed sem quebrar consumidores fixture (dashboard, reports, tasks ainda usam o store legado): `stageSlug?`, `orderInStage?`, `leadName?`, `leadCompany?`.
- [x] [`apps/web/features/leads/types.ts`](apps/web/features/leads/types.ts) — `PipelineStage` ganhou `slug?` opcional (mesma razão: server-fed stages têm UUID em `id` + slug separado pro `getStageStyle`; fixtures legadas mantêm `id === slug`).
- [x] [`apps/web/app/(dashboard)/kanban/page.tsx`](<apps/web/app/(dashboard)/kanban/page.tsx>) — vira Server Component (`dynamic = 'force-dynamic'`). `Promise.all` de 4 queries (`listDeals`, `listDefaultPipeline`, `listSalesReps`, `listLeadsForCombobox`). Envolve `<KanbanView>` em `<Suspense>` por causa de `useSearchParams` no filho.
- [x] [`apps/web/app/(dashboard)/kanban/kanban-view.tsx`](<apps/web/app/(dashboard)/kanban/kanban-view.tsx>) — **dono do estado otimista** via `React.useOptimistic`. Reducer puro `applyOptimisticMove(deals, event, stages)` calcula `orderInStage` via `computeOrderBetween` + atualiza `status`/`closedAt` quando entra em terminal. Handler `handleDrop` despacha `moveDealStageAction` ou `updateDealOrderAction` conforme `fromStage !== toStage`. Toast contextual (`🏆 ganho` / `✖️ perdido` / `movido para X`); reorder intra-coluna silencioso. Em erro: toast destrutivo + `window.location.reload()` pra ressincronizar (revalidate não dispara em falha). RBAC: `canEdit = role !== 'Viewer'`; Viewer não vê o botão "+ Adicionar" e sensors são desativados.
- [x] [`apps/web/features/deals/components/deals-kanban-board.tsx`](apps/web/features/deals/components/deals-kanban-board.tsx) — vira **componente controlado**: recebe `deals` + `stages` + `canEdit` + `onDrop` por prop, sem estado interno de deals. Calcula `beforeId`/`afterId` no `handleDragEnd` a partir do índice do drop e emite `DragMoveEvent` pro parent. `dealsByStage` ordena por `orderInStage ASC` + tie-break `createdAt DESC` (cobre fixtures legacy com `orderInStage=0`). Sensores idênticos a M4 (mouse 6px, touch 250ms long-press, keyboard Tab/Space/Arrows).
- [x] [`apps/web/features/deals/components/deal-create-dialog.tsx`](apps/web/features/deals/components/deal-create-dialog.tsx) — recebe `stages`, `salesReps`, `leadOptions` por prop. `onSubmit` chama `createDealAction` via `useTransition`. On success: `router.refresh()` + toast + fecha modal. On error: `submitError` inline (mesma anatomia do `LeadCreateDialog` de M8#2).
- [x] [`apps/web/features/deals/components/deal-card.tsx`](apps/web/features/deals/components/deal-card.tsx) — `getStageStyle(deal.stageSlug ?? deal.stageId)` cobre server-fed (slug separado) e fixture (slug em id). `leadName`/`leadCompany` lidos do `Deal` denormalizado; fallback pra `getLead(deal.leadId)` se o leadId é slug (modo fixture).
- [x] [`apps/web/features/deals/components/deals-kanban-column.tsx`](apps/web/features/deals/components/deals-kanban-column.tsx) — usa `stage.slug ?? stage.id` pro lookup de style; detecta colunas terminais por `tone === 'success'`/`'destructive'` (mais robusto que comparar string).
- [x] [`apps/web/features/deals/components/pipeline-stats.tsx`](apps/web/features/deals/components/pipeline-stats.tsx) — recebe `deals` por prop (estado otimista do parent `KanbanView`). Reativo a optimistic updates (KPIs atualizam imediato no drop). Detecta "negociação" via `stageSlug ?? stageId` (compat fixture).
- [x] [`apps/web/features/leads/queries.ts`](apps/web/features/leads/queries.ts) — `listDefaultPipeline` agora retorna `slug` em cada stage (necessário pro `getStageStyle` do kanban server-fed).
- [x] [`apps/web/app/api/smoke-test/leads/route.ts`](apps/web/app/api/smoke-test/leads/route.ts) — +18 checks novos:
  - Grupo `zod-deal` atualizado: leadId/stageId/ownerId agora exigem UUIDs (`'lead_001'`/`'novo'`/`'user_mateus'` rejeitados);
  - Novo grupo `deals-m8` (16 checks): `moveDealStageSchema` + `updateDealOrderSchema` UUID validation; `computeOrderBetween` em 5 cenários (ambos null, só before, só after, midpoint, colisão); `toDealUI` denormalização (stage.slug, lead.name, orderInStage, Date→ISO, closedAt null→undefined, status won, company null).
  - **95/95 checks verdes** (saímos de 77/77 do M8#2); smoke `/api/smoke-test/supabase` segue 10/10.
- [x] `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅, `pnpm --filter @papopro/web build` ✅ (`/kanban` agora dynamic, 29.1 kB).
- [x] **`store.ts` de deals ainda intocado** — 7 outros consumers (dashboard kpi-grid/funnel-horizontal/recent-activity/upcoming-deals/trend-chart, reports summary-kpis/stage-time-card/rep-performance/conversion-funnel, tasks/store) ainda usam `useDeals()`. Migram quando essas features pegarem dados reais em M9+.

**Entregas — M8#4 Timeline real + tasks CRUD (entregue, PR pós-validação local):**

- [x] [`apps/web/features/tasks/actions.ts`](apps/web/features/tasks/actions.ts) — 5 Server Actions seguindo anatomia M8#2/M8#3:
  - `createTaskAction` (RBAC Owner/Admin/Manager/Vendedor) — valida FK lead+assignee, cria task + activity `task` (eventKind=created), recalcula `Lead.nextActionAt`/`Label`, audit `task_created`.
  - `updateTaskAction` — patch parcial (`kind`, `title`, `notes`, `assignedToId`, `dueAt`); recalcula nextAction se `dueAt` mudou; sem activity (ruído).
  - `completeTaskAction` — seta `status='done'+doneAt=now()`; cria activity `task` (eventKind=completed); atualiza `Lead.lastInteractionAt` (task feita é interação real); audit `task_completed`.
  - `reopenTaskAction` — inverso; sem activity; recalcula nextAction.
  - `deleteTaskAction` (RBAC Owner/Admin/Manager) — hard delete (tasks são efêmeras); recalcula nextAction.
  - Helper `recomputeLeadNextAction(tx, workspaceId, leadId)` — chamado nas 5 actions, busca próxima task pending (orderBy dueAt asc + createdAt asc) e atualiza `Lead.nextActionAt`/`Label`. Quando ninguém pending: seta null.
- [x] [`apps/web/features/activities/actions.ts`](apps/web/features/activities/actions.ts) — 1 Server Action: `createNoteActivityAction(leadId, body)`. Cria activity tipo `note` com `authorId=callerMember.id`, atualiza `lastInteractionAt`, audit `lead_updated` (`changes.eventKind='note_added'`). Notas são append-only por design (CLAUDE.md §7.5 LGPD).
- [x] [`apps/web/features/tasks/queries.ts`](apps/web/features/tasks/queries.ts) — server-only. `listTasksForLead(workspaceId, leadId)` (sem include de lead — ficha já conhece); `listTasks(workspaceId, filters?)` com include de lead pra `/tasks`; `getTask(workspaceId, taskId)` pra `TaskEditDialog`. Sort `status asc + dueAt asc + createdAt asc`. Também expõe `listLeadsForCombobox` (duplicado com `features/deals/queries.ts` do M8#3 — consolida após PR #48 mergear).
- [x] [`apps/web/features/activities/queries.ts`](apps/web/features/activities/queries.ts) — `listActivitiesForLead(workspaceId, leadId)`. Defense-in-depth via relação `lead: { workspaceId }`. Include `author.user.name+email` pra renderizar "por X" sem outro fetch.
- [x] [`apps/web/features/tasks/transforms.ts`](apps/web/features/tasks/transforms.ts) — estendido: `toTaskUI(row)` denormaliza `lead.name`/`company` quando incluído, Date → ISO; `computeNextActionFromTasks(tasks)` pura (ordena pending por dueAt + createdAt, retorna primeira ou null) — espelha lógica do helper backend pra teste isolado.
- [x] [`apps/web/features/activities/transforms.ts`](apps/web/features/activities/transforms.ts) — novo: `toActivityUI(row)` com fallback de `author.name → email split → undefined`; `enrichStageChangeMeta(meta, stages)` resolve `fromStageId/toStageId` em nomes pra timeline mostrar "Em contato → Proposta".
- [x] [`apps/web/features/tasks/schemas.ts`](apps/web/features/tasks/schemas.ts) — `leadId.uuid()` + `assignedTo.uuid()` em `taskCreateSchema` (eram `.min(1)` em M4). Novos `updateTaskSchema` (com `taskId.uuid()` + partial), `completeTaskSchema`, `reopenTaskSchema`, `deleteTaskSchema`. Mantido `taskUpdateSchema` legacy pra compat de fixture/store mocks (dashboard/reports).
- [x] [`apps/web/features/activities/schemas.ts`](apps/web/features/activities/schemas.ts) — novo: `createNoteSchema({ leadId, body 1-2000 })`.
- [x] [`apps/web/features/leads/types.ts`](apps/web/features/leads/types.ts) — `Activity.meta` ganhou `eventKind: 'created' | 'completed'` + `taskId` + `kind` (sub-eventos de task activities). `PipelineStage` já tinha `slug?` opcional do plano de M8#3p mas pode estar ausente nesta branch — mantém compat.
- [x] [`apps/web/app/(dashboard)/leads/[id]/page.tsx`](<apps/web/app/(dashboard)/leads/[id]/page.tsx>) — `Promise.all` estendido com `listActivitiesForLead` + `listTasksForLead`. Passa initial props.
- [x] [`apps/web/app/(dashboard)/leads/[id]/lead-detail-view.tsx`](<apps/web/app/(dashboard)/leads/[id]/lead-detail-view.tsx>) — **banner `MockedDataNotice` removido**. Passa `initialActivities` + `initialTasks` + `stages` + `canAddNote/canEdit` pros componentes. Botões `Ligar`/`Mandar WhatsApp`/`Atribuir IA` continuam disabled (chegam em M9/M11).
- [x] [`apps/web/app/(dashboard)/tasks/page.tsx`](<apps/web/app/(dashboard)/tasks/page.tsx>) — vira Server Component. `dynamic = 'force-dynamic'`. Resolve `callerMember.id` via Prisma direto pra filtro "Minhas tarefas". `Promise.all` de 3 queries.
- [x] [`apps/web/app/(dashboard)/tasks/tasks-view.tsx`](<apps/web/app/(dashboard)/tasks/tasks-view.tsx>) — recebe `initialTasks`+`salesReps`+`leadOptions`+`callerMemberId`+`callerRole` por prop. Filtros "Minhas/Time" agora usam `callerMemberId` real. Calendário também recebe tasks via prop.
- [x] [`apps/web/features/leads/components/lead-timeline.tsx`](apps/web/features/leads/components/lead-timeline.tsx) — recebe `initialActivities` + `stages` + `canAddNote`. Botão **"Adicionar nota"** abre `NoteCreateDialog`. Renderiza `stage_change` como "De X para Y" via `enrichStageChangeMeta`. `task` activities mostram "Tarefa criada"/"Tarefa concluída" baseado em `meta.eventKind`.
- [x] [`apps/web/features/leads/components/lead-next-actions.tsx`](apps/web/features/leads/components/lead-next-actions.tsx) — recebe `initialTasks` + `salesReps` + `leadName`/`leadCompany` + `callerRole`. Botão **"Concluir"** vira funcional → `completeTaskAction`. Quick action "Adicionar tarefa" abre `TaskCreateDialog` pré-preenchido com `leadId`. Item da task ganha dropdown `⋮` (Editar/Excluir). Mensagem/Ligar/Reunião continuam disabled (M9/M10).
- [x] [`apps/web/features/tasks/components/task-row.tsx`](apps/web/features/tasks/components/task-row.tsx) — Checkbox dispara `completeTaskAction`/`reopenTaskAction`; dropdown `⋮` (Editar/Excluir). Recebe `salesReps`+`canEdit`+`canDelete` por prop pra alimentar `TaskEditDialog` e gateamento.
- [x] [`apps/web/features/tasks/components/task-list.tsx`](apps/web/features/tasks/components/task-list.tsx) — recebe `tasks` + `salesReps` + flags por prop (não usa mais `useTasks()` store).
- [x] [`apps/web/features/tasks/components/task-create-dialog.tsx`](apps/web/features/tasks/components/task-create-dialog.tsx) — chama `createTaskAction` via `useTransition`. Recebe `salesReps`/`leadOptions` por prop. `router.refresh()` no sucesso.
- [x] [`apps/web/features/tasks/components/task-edit-dialog.tsx`](apps/web/features/tasks/components/task-edit-dialog.tsx) — **novo**, análogo a `DealEditDialog` de M8#3p. Edita 5 campos (title, kind, assignedTo, dueAt, notes) via `updateTaskAction`. Mudança de status fica fora (fluxo próprio via checkbox/dropdown).
- [x] [`apps/web/features/activities/components/note-create-dialog.tsx`](apps/web/features/activities/components/note-create-dialog.tsx) — **novo**, minimalista: textarea 1-2000 + Salvar. Chama `createNoteActivityAction`.
- [x] [`apps/web/features/tasks/components/{month,week,day,calendar}-view.tsx`](apps/web/features/tasks/components/) — aceitam `tasks?` + `salesReps?` + `canEdit?` + `canDelete?` por prop (fallback no store mantém compat com `dashboard`/`reports`).
- [x] [`apps/web/app/api/smoke-test/leads/route.ts`](apps/web/app/api/smoke-test/leads/route.ts) — +23 checks novos (M8#4 adicionou 18+ ao já estendido pelo M8#2). Grupos `tasks-m8` (12 checks: schemas UUIDs + `computeNextActionFromTasks` em 4 cenários + `toTaskUI` em 3 casos) e `activities-m8` (8 checks: `createNoteSchema` + `toActivityUI` com author null/fallback + `enrichStageChangeMeta` em 3 cenários). **100/100 checks verdes** (era 77/77 em M8#2).
- [x] `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅, `pnpm --filter @papopro/web build` ✅ (`/tasks` agora dynamic 9.06 kB; `/leads/[id]` ok).
- [x] **`store.ts` de tasks ainda intocado** — 4 outros consumers (dashboard, reports, inbox placeholder) ainda usam `useTasks()`. Migram em M9+.

**Entregas — M8#5 CSV import + webhook genérico (entregue, PR pós-validação local):**

- [x] **Schema + migration:** `Workspace.webhookToken String? @unique @db.VarChar(64)` em [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma); enum `LeadOrigin` ganha `webhook_generico`; enum `AuditAction` ganha `webhook_token_regenerated`. SQL espelho em [`supabase/migrations/20260515120000_m8_5_webhook_token.sql`](supabase/migrations/20260515120000_m8_5_webhook_token.sql) faz backfill (`encode(gen_random_bytes(32), 'base64')` URL-safe via `replace`) pros workspaces existentes — `WebhookEvent.workspace_id` já existia desde M7#2.
- [x] [`apps/web/lib/leads/pick-assignee.ts`](apps/web/lib/leads/pick-assignee.ts) — `pickNextAssignee(tx, workspaceId)` round-robin: Vendedor/Manager com **menor `count(lead.status='ativo')`**, tie-break `workspaceMember.createdAt ASC`, fallback Owner se workspace não tem Vendedor. Versão pura `pickNextAssigneePure(members, loads)` exposta pra smoke test.
- [x] [`apps/web/lib/leads/dedupe.ts`](apps/web/lib/leads/dedupe.ts) — `findDuplicates(tx, workspaceId, candidates)` faz 1 query `OR (phone IN …, email IN …)` no workspace; retorna `Map<key, {id, name}>` pra lookup O(1) no caller. Versão pura `findDuplicatesPure(existing, candidates)`.
- [x] [`apps/web/lib/webhooks/rate-limit.ts`](apps/web/lib/webhooks/rate-limit.ts) — `checkRateLimit(key, limit=100, windowMs=60_000)` in-memory por bucket. Promove pra Redis em V2 (mesma assinatura). Versão pura `checkRateLimitPure(store, key, now, limit, windowMs)` pro smoke.
- [x] [`apps/web/lib/webhooks/token.ts`](apps/web/lib/webhooks/token.ts) — `generateWebhookToken()` = `randomBytes(32).toString('base64url')` (43 chars URL-safe). Separado do `'use server'` file porque Next exige funções async em Server Actions.
- [x] [`apps/web/features/leads/actions.ts`](apps/web/features/leads/actions.ts) — `previewImportAction({ rows })` dry-run + `importLeadsAction({ rows, consentConfirmed: true })`. RBAC Owner/Admin/Manager (Vendedor não importa em massa). Loop dentro de tx: skip duplicatas, cria lead + activity `lead_created` (`meta.via='csv_import'`, `meta.importBatchId`, `meta.consentConfirmed=true`) + audit `lead_created` por linha. `assignedToId` via `pickNextAssignee`. LGPD enforced no Zod (`z.literal(true)`).
- [x] [`apps/web/features/leads/schemas.ts`](apps/web/features/leads/schemas.ts) — `leadImportRowSchema`, `previewImportSchema`, `importLeadsSchema` (com `consentConfirmed: z.literal(true)`). Constante `CSV_IMPORT_MAX_ROWS=1000`. `LEAD_ORIGINS` + enum `origin` ganham `webhook_generico`.
- [x] [`apps/web/features/workspace/actions.ts`](apps/web/features/workspace/actions.ts) — `regenerateWebhookTokenAction()` RBAC Owner/Admin; audit `webhook_token_regenerated` com `changes.oldTokenPrefix` (8 chars iniciais). `createWorkspaceAction` agora seeds `webhookToken` na criação.
- [x] [`apps/web/app/api/webhooks/leads/[token]/route.ts`](apps/web/app/api/webhooks/leads/[token]/route.ts) — **POST handler**. 1) Sanity check token (16-64 chars) — 404 fora; 2) rate limit (100 req/min/token); 3) lookup workspace; 4) parse + Zod; 5) idempotência via SHA256(`token + payload`) em `webhook_events.(source='generic_leads', external_id=hash)`; 6) tx `withWorkspace`: cria webhook_event + dedup phone/email (existe → atualiza `lastInteractionAt` + activity `meta.duplicate=true`; novo → cria lead com origin mapeado de `source` + assignee round-robin + activity `lead_created` + audit). GET retorna 405. Sempre JSON pt-BR.
- [x] [`apps/web/features/webhooks/schemas.ts`](apps/web/features/webhooks/schemas.ts) — `webhookLeadPayloadSchema`: `name` obrigatório, `phone` obrigatório (PapoPro é CRM WhatsApp-first), `email` opcional, `source` enum `['meta_ads','google_ads','rd_station','hotmart','site','indicacao']` opcional (fallback `webhook_generico`), `utm_*`, `custom_fields: Record<string,string>`, `tags` ≤8.
- [x] [`apps/web/features/webhooks/queries.ts`](apps/web/features/webhooks/queries.ts) — `getWebhookSettings(workspaceId, origin)` retorna `{token, fullUrl}`. `listWebhookEvents(workspaceId, {limit=20})` via `withWorkspace`, sort `createdAt desc`.
- [x] [`apps/web/features/leads/components/lead-import-sheet.tsx`](apps/web/features/leads/components/lead-import-sheet.tsx) — refatora: limit 1000 (era 200 mock); chama `previewImportAction` → mostra Badge "X já cadastrados"; checkbox LGPD obrigatório (`ConsentCheckbox`); botão "Importar" → `importLeadsAction` com `useTransition` + `router.refresh()`.
- [x] [`apps/web/features/workspace/components/webhook-settings-card.tsx`](apps/web/features/workspace/components/webhook-settings-card.tsx) — **novo**. Mostra URL completa + botão copiar (`navigator.clipboard`) + tabela últimos 20 eventos (status ✅/⚠️/pendente, timestamp pt-BR, origem, externalId truncado/erro). Botão "Regenerar token" abre `Dialog` de confirmação destrutiva → `regenerateWebhookTokenAction`. Botão e dialog só aparecem se `canRegenerate=true` (Owner/Admin).
- [x] [`apps/web/app/(dashboard)/settings/connections/page.tsx`](<apps/web/app/(dashboard)/settings/connections/page.tsx>) — vira Server Component. `requireRole(['Owner','Admin','Manager'])`; resolve `origin` via `headers()` (`x-forwarded-proto/host`); `Promise.all` de `getWebhookSettings` + `listWebhookEvents`. Manager vê webhook read-only; Vendedor/Viewer → 403.
- [x] [`apps/web/app/(dashboard)/settings/connections/connections-view.tsx`](<apps/web/app/(dashboard)/settings/connections/connections-view.tsx>) — recebe `webhookUrl`/`webhookEvents`/`canRegenerateWebhook` por prop; renderiza `WebhookSettingsCard` entre `WhatsAppConnectionCard` e `DisconnectionHistory`.
- [x] [`apps/web/app/api/smoke-test/leads/route.ts`](apps/web/app/api/smoke-test/leads/route.ts) — +20 checks. Grupos `csv-import-m8` (9 checks: `CSV_IMPORT_MAX_ROWS=1000`, `leadImportRowSchema`, `previewImportSchema`, `importLeadsSchema` rejeita consent=false / >1k linhas, `findDuplicatesPure` match por phone/email/case-insensitive, `pickNextAssigneePure` 5 cenários incluindo tie-break por createdAt + fallback Owner) e `webhook-leads-m8` (11 checks: payload schema obrig/opc, source enum, tags ≤8, custom_fields record, rate limit dentro/excedeu/janela expirada/buckets separados).
- [x] `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅ (zero warnings), `pnpm --filter @papopro/web build` ✅. Recursive monorepo typecheck ✅.
- [x] **Edge Function pra >1k fica fora do MVP** — antivírus + TLS quebra dev local nessa máquina (memória `dev-local-windows-antivirus-tls`); hard limit 1k entrega 80% do valor sem o risco de deploy-only sem teste local.

**Entregas — M8#6 Storage Supabase pra anexos + cleanup órfão (entregue, PR pós-validação local):**

- [x] **Schema + migration:** `AuditAction` ganha `attachment_uploaded` + `attachment_deleted` em [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma); SQL espelho em [`supabase/migrations/20260516120000_m8_6_storage_attachments.sql`](supabase/migrations/20260516120000_m8_6_storage_attachments.sql) cria bucket `attachments` privado (10MB, whitelist MIME PDF/PNG/JPEG/WebP/DOC/DOCX) + 3 policies RLS em `storage.objects` (SELECT/INSERT/DELETE) com workspace via `split_part(name, '/', 1)::uuid`.
- [x] [`apps/web/lib/storage/attachments.ts`](apps/web/lib/storage/attachments.ts) — helpers server-only: `validateAttachmentInput` (MIME/size/name puro), `sanitizeFileName` (remove acentos/espaços, mantém ext), `buildStoragePath` (`<wid>/<lid>/<uuid>-<safeFileName>`), `uploadToStorage`/`deleteFromStorage`/`createSignedDownloadUrl` (admin client). Constante `MAX_FILE_SIZE=10MB` + `ALLOWED_MIME_TYPES` Set.
- [x] [`apps/web/features/attachments/actions.ts`](apps/web/features/attachments/actions.ts) — 3 Server Actions:
  - `uploadAttachmentAction(formData)` — RBAC O/A/M/V; valida MIME+size (defense-in-depth); upload no Storage antes da tx; cria `Attachment` row + activity `attachment` (`meta.attachmentId`, `meta.fileName`, `meta.fileSizeKb`, `meta.mimeType` — compat com `LeadTimeline` mock M4) + atualiza `lastInteractionAt` + audit `attachment_uploaded`. Compensação: se tx falhar pós-upload, remove storage object.
  - `deleteAttachmentAction({ attachmentId })` — **RBAC híbrido:** O/A/M deleta qualquer anexo; Vendedor só seu próprio upload (`uploadedById === userId`). Soft-delete via `deletedAt = NOW()`; storage object removido em +30d pelo cleanup job. Audit `attachment_deleted`.
  - `getAttachmentDownloadUrlAction({ attachmentId })` — qualquer membro (inclusive Viewer); signed URL TTL 1h via admin client.
- [x] [`apps/web/features/attachments/{schemas,queries,transforms}.ts`](apps/web/features/attachments/) — `uploadAttachmentMetadataSchema` (UUID, MIME enum, size ≤10MB) + `deleteAttachmentSchema` + `signedUrlSchema`; `listAttachmentsForLead(workspaceId, leadId)` server-only com `where: { workspaceId, leadId, deletedAt: null }` + include `uploadedBy: { id, name, email }`; `toAttachmentUI(row)` denormaliza nome do uploader (`name → email split → null`) + adiciona `sizeLabel` formatado.
- [x] [`apps/web/features/attachments/components/lead-attachments-card.tsx`](apps/web/features/attachments/components/lead-attachments-card.tsx) — novo card client. Drag-and-drop overlay + botão "Anexar" + lista com dropdown `⋮` (Baixar/Excluir). Validação client (MIME/size) antes da chamada. "Excluir" só aparece se Manager+ OU autor do upload. Click no item baixa via signed URL em nova aba. Validação `accept=...` no `<input type="file">`.
- [x] [`apps/web/app/(dashboard)/leads/[id]/page.tsx`](<apps/web/app/(dashboard)/leads/[id]/page.tsx>) — `Promise.all` estendido com `listAttachmentsForLead`. Passa `initialAttachments` + `callerUserId` pro view.
- [x] [`apps/web/app/(dashboard)/leads/[id]/lead-detail-view.tsx`](<apps/web/app/(dashboard)/leads/[id]/lead-detail-view.tsx>) — renderiza `LeadAttachmentsCard` abaixo de `LeadNextActions` no desktop (coluna direita); tabs mobile ganham 4ª aba "Anexos".
- [x] [`apps/web/app/api/cron/cleanup-attachments/route.ts`](apps/web/app/api/cron/cleanup-attachments/route.ts) — POST handler. Autoriza via `Authorization: Bearer ${CRON_SECRET}` com `timingSafeEqual` anti-timing-attack. Apaga em batch (LIMIT 500) rows + storage objects com `deletedAt < NOW() - 30d`. Apaga row independente do storage delete (defense-in-depth — não fica em limbo). `maxDuration=300s`, `runtime=nodejs`. GET retorna 405.
- [x] [`.github/workflows/cron-cleanup-attachments.yml`](.github/workflows/cron-cleanup-attachments.yml) — cron diário 06:00 UTC (= 03:00 BRT, baixo tráfego) + `workflow_dispatch` pra trigger manual. Curl com `CRON_SECRET` + `APP_HOST` secrets. Falha barulhento se HTTP != 200.
- [x] `.env.example` + `apps/web/.env.local.example` ganham `CRON_SECRET` com instrução de geração via `randomBytes(32).hex`.
- [x] [`apps/web/app/api/smoke-test/leads/route.ts`](apps/web/app/api/smoke-test/leads/route.ts) — +18 checks no grupo `attachments-m8`: `MAX_FILE_SIZE=10MB`, `ALLOWED_MIME_TYPES` cobertura; `validateAttachmentInput` cenários (PDF OK, ZIP rejeita, >10MB rejeita, nome vazio rejeita, tamanho 0 rejeita); `sanitizeFileName` (acentos/espaços/nome inválido); `buildStoragePath` puro com `idGen` injetável; `formatFileSize` 3 cenários; schemas Zod rejeitam input inválido.
- [x] `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅ (zero warnings), `pnpm --filter @papopro/web build` ✅, `pnpm -r typecheck` ✅.
- [x] **Decisão técnica — pg_cron + pg_net fora**: Edge Functions desabilitadas em dev local nessa máquina (antivírus + TLS quebra TLS — memória `dev-local-windows-antivirus-tls`). Next route + GitHub Action é portável, testável local, com mesma garantia operacional. Migração pra `pg_cron + pg_net + Edge Function` (alinhada com CLAUDE.md §6) fica pra pós-MVP.

**Entregas — M8#7 Realtime Kanban + export CSV (entregue, PR pós-validação local):**

- [x] **Migration:** [`supabase/migrations/20260517120000_m8_7_realtime_export.sql`](supabase/migrations/20260517120000_m8_7_realtime_export.sql) — adiciona `public.deals` à publication `supabase_realtime` (idempotente via `pg_publication_tables` guard) e seta `REPLICA IDENTITY FULL` na tabela. Sem isso, payload de UPDATE/DELETE no canal teria só a PK e o cliente precisaria re-fetchar. FULL é aceitável pro volume (~50-500 deals/workspace).
- [x] [`apps/web/features/deals/hooks/use-realtime-deals.ts`](apps/web/features/deals/hooks/use-realtime-deals.ts) — hook client. Subscribe ao canal `workspace:<id>:deals` em `postgres_changes` event=`*` filter=`workspace_id=eq.<id>`. **Decisão:** dispara `router.refresh()` debounced 200ms em vez de mergear payload manualmente — Server Component pai re-fetcha, `useOptimistic` reconcilia. Evita race de merge sutil. Unsubscribe limpo no unmount via `supabase.removeChannel`.
- [x] [`apps/web/app/(dashboard)/kanban/page.tsx`](<apps/web/app/(dashboard)/kanban/page.tsx>) + [`kanban-view.tsx`](<apps/web/app/(dashboard)/kanban/kanban-view.tsx>) — passa `workspaceId` por prop; `KanbanView` chama `useRealtimeDeals(workspaceId)` no mount. **RLS garante isolamento** — Supabase Realtime aplica a policy SELECT de `deals` (`workspace_id = current_workspace_id()`), então mesmo se outro tenant disparar event, o JWT do anon key filtra na ponta.
- [x] [`apps/web/lib/exports/csv.ts`](apps/web/lib/exports/csv.ts) — writer puro RFC 4180. `escapeCsvValue` (quote/comma/newline → envolve em aspas e duplica `"`), `serializeCsvRow`/`serializeCsv`, BOM UTF-8 (`﻿`) prefixado, CRLF entre linhas. `LeadCsvRow` interface + `LEAD_CSV_HEADER` em pt-BR + `serializeLeadsCsv` (formata `valueCents` com vírgula decimal BR, tags joinadas com `; `, datas ISO `yyyy-MM-dd HH:mm`).
- [x] [`apps/web/features/leads/schemas.ts`](apps/web/features/leads/schemas.ts) — `exportLeadsSchema` (todos filtros opcionais: search/stageIds/assigneeIds/origins/tagNames/statuses) + constante `EXPORT_MAX_ROWS = 5000` (Plan Pro 5k leads/workspace cobre tudo síncrono no Vercel 4.5MB limit).
- [x] [`apps/web/features/leads/actions.ts`](apps/web/features/leads/actions.ts) — `exportLeadsAction(filters)` RBAC Owner/Admin/Manager. Reusa lógica de `listLeads` (mesma `where`); `tx.lead.count` antes pra detectar >5k e abortar com mensagem propositiva; `findMany` com `take: 5k` + include `tags/stage/assignedTo.user`. **M8#7p:** audit `export_started` movido pra DENTRO da tx (all-or-nothing). LGPD §3.4 + CLAUDE.md §7.5 exigem registro em toda exportação — versão original (audit best-effort fora da tx) violava esse contrato silenciosamente.
- [x] [`apps/web/app/api/exports/leads/route.ts`](apps/web/app/api/exports/leads/route.ts) — POST handler. Valida payload Zod (defense-in-depth), chama action, envolve resultado em `Response(csv, { headers: 'Content-Type: text/csv; charset=utf-8', 'Content-Disposition': attachment, 'X-Row-Count' })`. GET retorna 405.
- [x] [`apps/web/app/(dashboard)/leads/leads-view.tsx`](<apps/web/app/(dashboard)/leads/leads-view.tsx>) — botão "Exportar CSV" no header (visível pra O/A/M, disabled se workspace vazio). Aplica filtros atuais (search/stageIds/assigneeIds/origins/tagNames; `temperatures` é client-only e não vai no payload). Client faz `fetch('/api/exports/leads', { method: 'POST', body: JSON.stringify(payload) })` → `response.blob()` → `URL.createObjectURL` → trigger download. Toast com `X-Row-Count` no sucesso.
- [x] [`apps/web/app/api/smoke-test/leads/route.ts`](apps/web/app/api/smoke-test/leads/route.ts) — +18 checks no grupo `exports-m8`: `EXPORT_MAX_ROWS=5000`, `escapeCsvValue` (string simples / vírgula / aspas / newline / null / undefined / number), `serializeCsvRow` (join + escape inline), `serializeLeadsCsv` contrato completo (BOM, header pt-BR, valueCents com vírgula, tags joinadas, CRLF), `exportLeadsSchema` (vazio aceito, UUID inválido rejeita, origin enum, payload completo).
- [x] `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅ (zero warnings), `pnpm --filter @papopro/web build` ✅, `pnpm -r typecheck` ✅.
- [x] **Decisão técnica — CSV-only no MVP**: PRD §3.4 menciona XLSX também, mas adiciona dep `xlsx` ~800KB. CSV cobre 95% dos casos (Zapier/Make/Sheets/Excel). XLSX entra em polimento quando justificado por demanda real.
- [x] **Decisão técnica — postgres_changes vs broadcast**: postgres_changes ganha porque RLS é automática e sem código extra nas Server Actions. Broadcast exigiria instrumentar 3 actions e perderia garantia "mudou no DB → broadcast".
- [x] **Decisão técnica — hard limit 5k síncrono**: PRD §3.4 menciona Edge Function + email link 7d pra >1k. Plan Pro tem 5k leads/workspace; CSV de 5k fica em ~1MB (bem abaixo do 4.5MB Vercel response limit). Background pra Enterprise/V2.

**Commit final M8:** `feat(backend): leads, deals, pipelines, tasks crud + storage + realtime + export with rls`

---

## M9 — WhatsApp: Adapter, uazapi, Anti-ban e Inbox real

**Estratégia:** 5 sub-PRs sequenciais sobre `dev` (gitflow strict, igual M8). Cada sub-PR é feature isolada com schema/actions/UI/smoke próprio.

| Sub-PR   | Escopo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Branch                 | Status      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------- |
| **M9#1** | Schema Prisma (7 models + 4 enums + 8 valores AuditAction + RLS) + adapter interface + mockAdapter + smoke schema                                                                                                                                                                                                                                                                                                                                                                                     | `m9-whatsapp-schema`   | ✅ entregue |
| **M9#2** | `lib/whatsapp/uazapi.ts` (HTTP client) + `factory.ts` (env-based) + Server Actions `connectInstance`/`getInstanceStatus`/`disconnectInstance` + UI `WhatsAppConnectionCard` server-fed + QR polling 2s/timeout 60s + monta em `/settings/connections`                                                                                                                                                                                                                                                 | `m9-uazapi-connection` | ✅ entregue |
| **M9#3** | Webhook `app/api/webhooks/whatsapp/route.ts` (HMAC SHA256 contra `UAZAPI_WEBHOOK_SECRET`, idempotência via `WhatsappEvent`) + auto-cria lead inbound (round-robin via `pickNextAssignee` M8#5) + detecta opt-out `^(pare\|sair\|cancelar)$` → BlackList + bloqueio outbound + `lib/whatsapp/anti-ban.ts` (rate-limit, janela 9-21h timezone-aware, pausa 50 envios, jitter 30-50s, health update) + Server Actions `sendTextMessageAction`/`sendInternalNoteAction` (não plugadas no composer — M9#4) | `m9-webhook-antiban`   | ✅ entregue |
| **M9#4** | Inbox page Server Component que hidrata o store via `features/inbox/queries.ts` + hook `use-realtime-messages.ts` (3 canais: messages + conversations + quick_replies) + actions complementares (archive/unarchive/transfer/markConversationRead) + QuickReply CRUD + composer plugado em `sendTextMessageAction`/`sendInternalNoteAction` do M9#3 + migration adiciona 3 tabelas a publication `supabase_realtime` com `REPLICA IDENTITY FULL`                                                       | `m9-inbox-server-fed`  | ✅ entregue |
| **M9#5** | Edge Function `supabase/functions/whatsapp-heartbeat/index.ts` (Deno; itera instances `connected`, chama uazapi status, atualiza `lastSeenAt`/`healthScore` via `computeNextHealth`, registra `WhatsappEvent type='heartbeat_ok/fail'`) + deploy via MCP `deploy_edge_function` + migration `pg_cron + pg_net` agenda invocação a cada 1 min. Push/email em queda fica pra M10                                                                                                                        | `m9-heartbeat`         | ✅ entregue |

**Decisões fechadas (não reabrir):**

- **1 número por workspace** (`Workspace 1—1 WhatsappAccount`). Multi-número fica pra Pro+/Enterprise pós-MVP.
- **MVP só texto + nota interna.** Mídia (imagem/áudio/doc) entra em M9.x ou M10. Bucket `whatsapp-media` adiado.
- **Lead inbound desconhecido vira lead automático** com round-robin (reusa `lib/leads/pick-assignee.ts` de M8#5), `origin='whatsapp_inbound'`, `name=phone`.
- **Opt-out regex `^(pare|sair|cancelar)$`** (case-insensitive trim) bloqueia + notifica (CLAUDE.md §7.5 LGPD).
- **QR via Server Action + polling 2s** (timeout 60s).
- **Heartbeat via Edge Function + pg_cron** (canônico PRD §6 / CLAUDE.md §6). Deploy via MCP — memória `dev-local-windows-antivirus-tls` impede CLI local.

### M9#1 — Schema + adapter interface (entregue 2026-05-15)

**Branch:** `m9-whatsapp-schema`

**Objetivo:** preparar o terreno persistente do WhatsApp e o contrato do adapter. Zero rotas novas, zero integração externa, zero UI tocada — próximos sub-PRs herdam essa base.

**Entregas:**

- [x] [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) — +4 enums (`MessageDirection`, `MessageKind`, `ConversationStatus`, `HealthScore`), +8 valores em `AuditAction` (`whatsapp_connected`, `whatsapp_disconnected`, `whatsapp_message_sent`, `whatsapp_blocked_optout`, `quick_reply_created`, `quick_reply_deleted`, `conversation_archived`, `conversation_transferred`), +7 modelos (`WhatsappAccount` 1:1 Workspace, `WhatsappInstance` 1:1 Account, `Conversation` espelhando `features/inbox/types.ts:Conversation`, `Message` append-only espelhando `features/inbox/types.ts:Message`, `QuickReply`, `BlackList`, `WhatsappEvent`), +relations em `Workspace`/`WorkspaceMember`/`Lead`. Decisão: `WhatsappInstance.status` é `varchar(24)` (não enum) pra evoluir sem migration; `Conversation` unique por `(workspaceId, contactPhone)` por causa de 1 número/WS.
- [x] [`supabase/migrations/20260518120000_m9_1_whatsapp_schema.sql`](supabase/migrations/20260518120000_m9_1_whatsapp_schema.sql) — DDL idempotente (`CREATE TYPE ... EXCEPTION WHEN duplicate_object`, `CREATE TABLE IF NOT EXISTS`, `ALTER TYPE ... ADD VALUE IF NOT EXISTS`). RLS workspace-scoped em todas 7 tabelas seguindo padrão M7#2/M8#1 (`current_workspace_id()`). `messages` e `whatsapp_events` são append-only (sem DELETE policy); `messages` ganha UPDATE policy preservando `workspace_id` pra liberar `read_at`/`delivered_at`. `messages.external_message_id` tem **UNIQUE PARCIAL** `(workspace_id, external_message_id) WHERE external_message_id IS NOT NULL` — Prisma 5 não suporta `WHERE` em `@@unique`, declarado direto no SQL.
- [x] [`packages/db/src/index.ts`](packages/db/src/index.ts) — re-export dos enums (`AuditAction`, `ConversationStatus`, `HealthScore`, `MessageDirection`, `MessageKind`, `Role`) pra que `@papopro/db` seja a única fonte. Server Actions e smoke importam direto.
- [x] [`apps/web/lib/whatsapp/adapter.ts`](apps/web/lib/whatsapp/adapter.ts) — interface `WhatsAppAdapter` com `connectInstance`, `getInstanceStatus`, `disconnectInstance`, `sendText`. Tipos `WhatsAppQrCode`, `WhatsAppInstanceStatus`, `SendTextResult`. `'server-only'` — adapter usa segredos uazapi e bypassa RLS via Service Role.
- [x] [`apps/web/lib/whatsapp/mock-adapter.ts`](apps/web/lib/whatsapp/mock-adapter.ts) — implementação determinística para smoke + dev sem env uazapi. QR base64 fake (1x1 PNG transparente), `getInstanceStatus` retorna `connected`, `sendText` retorna `externalMessageId = 'mock-<hex>'`. Zero rede.
- [x] [`apps/web/app/api/smoke-test/whatsapp/route.ts`](apps/web/app/api/smoke-test/whatsapp/route.ts) — grupo `whatsapp-schema-m9` com 6 checks: enums resolvem, AuditAction tem os 8 valores novos, `mockAdapter satisfies WhatsAppAdapter`, `connectInstance` retorna QR com expiração futura, `sendTextMessageSchema`/`sendInternalNoteSchema` continuam intactos (regressão M5), `getInstanceStatus` shape OK.
- [x] [`apps/web/app/api/smoke-test/supabase/route.ts`](apps/web/app/api/smoke-test/supabase/route.ts) — +1 check `rlsBlocksWhatsappEventsCrossWorkspace`. Seed via admin client (bypass RLS), `withWorkspace(WS_A) + SET LOCAL ROLE authenticated` filtra rows e confirma que policy SELECT bloqueia leitura cross-tenant.
- [x] `pnpm --filter @papopro/db db:generate` ✅, `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅ (zero warnings), `pnpm --filter @papopro/web build` ✅, `pnpm -r typecheck` ✅.

**Não-objetivos M9#1 (explícitos):**

- `uazapi.ts` (HTTP client real) → M9#2
- `factory.ts` (escolhe mock vs uazapi por env) → M9#2
- Server Actions (`connectInstance`, `sendTextMessage`, etc.) → M9#2/M9#3
- Webhook `app/api/webhooks/whatsapp/route.ts` → M9#3
- `anti-ban.ts` → M9#3
- Migrar `features/inbox/store.ts` → M9#4
- Adicionar `Message`/`Conversation` a publication `supabase_realtime` → M9#4
- Edge Function `whatsapp-heartbeat` → M9#5
- Montar `WhatsAppConnectionCard` em `/settings/connections` → M9#2

### M9#2 — uazapi client + connection (QR) (entregue 2026-05-15)

**Branch:** `m9-uazapi-connection`

**Objetivo:** ligar o adapter real (uazapi HTTP client) ao banco. Owner/Admin gera QR, escaneia no celular, sistema detecta pareamento via polling, persiste a sessão. Toda a UI passa a ler `WhatsappAccount`/`WhatsappInstance` server-fed em vez do mock M5.

**Entregas:**

- [x] [`apps/web/lib/whatsapp/uazapi.ts`](apps/web/lib/whatsapp/uazapi.ts) — HTTP client implementando `WhatsAppAdapter`. Endpoints: `POST /instance/connect`, `GET /instance/:id/status`, `POST /instance/:id/disconnect`, `POST /instance/:id/sendText`. `Authorization: Bearer ${UAZAPI_API_KEY}`. **Retries 3x** com backoff 250ms/500ms/1000ms pra 5xx + network errors; 4xx propaga direto. **Timeout 10s** por tentativa via `AbortController`. Cada catch chama `reportNonFatal('whatsapp.uazapi.<method>', err, ctx)` (Sentry scope estruturado).
- [x] [`apps/web/lib/whatsapp/factory.ts`](apps/web/lib/whatsapp/factory.ts) — `getWhatsAppAdapter()` lazy reading `process.env`. Se `UAZAPI_BASE_URL` + `UAZAPI_API_KEY` presentes (não-vazios após trim) → `uazapiAdapter`; senão → `mockAdapter`. Exporta também `selectAdapter(hasEnv: boolean)` puro pra smoke testar os dois ramos sem mutar env.
- [x] [`apps/web/lib/whatsapp/adapter.ts`](apps/web/lib/whatsapp/adapter.ts) + [`mock-adapter.ts`](apps/web/lib/whatsapp/mock-adapter.ts) — `WhatsAppQrCode` ganhou `externalInstanceId` (uazapi retorna no connect; mock gera `mock-instance-<hex>`). Necessário pras chamadas subsequentes ao adapter.
- [x] [`apps/web/features/connections/types.ts`](apps/web/features/connections/types.ts) — `ConnectionUI` shape consumido pelo card (status, health, phoneNumber, qrBase64, qrExpiresAt, connectedAt, lastSeenAt, messagesSent24h, pausedUntil). `null` explícito em vez de `undefined` pra serializar bem via Server Action.
- [x] [`apps/web/features/connections/transforms.ts`](apps/web/features/connections/transforms.ts) — `toConnectionUI(account, instance)` puro: account null → `accountExists=false`, status fallback `disconnected`. Normaliza `instance.status` (varchar) — se string desconhecida vier do banco vira `disconnected` (defense-in-depth). `isQrCodeFresh(qrExpiresAt, nowMs)` puro pra smoke.
- [x] [`apps/web/features/connections/queries.ts`](apps/web/features/connections/queries.ts) — `getWorkspaceConnection(workspaceId)` server-only. `withWorkspace` tx + defense-in-depth `workspaceId`. Retorna sempre `ConnectionUI` (vazio quando não há registro).
- [x] [`apps/web/features/connections/schemas.ts`](apps/web/features/connections/schemas.ts) — Zod schemas strict de input vazio `{}` pras 3 actions. Validar na borda mesmo input vazio rejeita props extras (defense-in-depth CLAUDE.md §5).
- [x] [`apps/web/features/connections/actions.ts`](apps/web/features/connections/actions.ts) — 3 Server Actions:
  - **`connectInstanceAction()`** — RBAC Owner/Admin. Chama `adapter.connectInstance()` fora da tx, depois upsert de `WhatsappAccount` (1:1 workspace, unique `workspaceId`) + upsert de `WhatsappInstance` (com `status='connecting'`, `qrCode`, `qrExpiresAt`, `externalInstanceId`) + insert `WhatsappEvent type='qr_refreshed'` (não vira audit ainda — só observability até a conexão se confirmar). Retorna `ConnectionUI`. `revalidatePath('/settings/connections')`.
  - **`getConnectionStatusAction()`** — RBAC qualquer membro. Lê estado do banco; se `status='connecting'` E `externalInstanceId` presente, chama `adapter.getInstanceStatus()` fora da tx. Quando detecta transição `connecting → connected`, atualiza `WhatsappInstance` (status, `connectedAt`, `lastSeenAt`, limpa QR) + insert `WhatsappEvent type='connected'` + audit `whatsapp_connected` + atualiza `phoneNumber` no account. Falha do provedor não derruba UI (retorna estado cache). Polling do client chama isso a cada 2s.
  - **`disconnectInstanceAction()`** — RBAC Owner/Admin. Best-effort `adapter.disconnectInstance()` (catch silencioso — provedor pode já estar offline). Atualiza `WhatsappInstance` (`status='disconnected'`, `disconnectedAt`, limpa QR) + `WhatsappEvent type='disconnected'` + audit `whatsapp_disconnected`. `revalidatePath`.
- [x] [`apps/web/features/connections/hooks/use-qr-polling.ts`](apps/web/features/connections/hooks/use-qr-polling.ts) — hook client que chama `getConnectionStatusAction` a cada **2s** enquanto `status === 'connecting'`. Para quando provedor confirma conexão, status vira disconnected, OU passa **60s** (`timedOut=true`). Cleanup no unmount. Callback `onConnected(c)` permite fechar dialog + toast.
- [x] [`apps/web/features/connections/components/whatsapp-connection-card.tsx`](apps/web/features/connections/components/whatsapp-connection-card.tsx) — card server-fed (substitui o mock M5 em `features/settings/components/`). Recebe `initial: ConnectionUI` + `canConnect: boolean` por prop. Dialog do QR mostra base64 da uazapi + spinner enquanto polling; quando timedOut, mostra botão "Gerar novo QR". Dialog destrutivo de disconnect mantido. RBAC client (`canConnect`) + RBAC server (Owner/Admin nas actions) — defense-in-depth.
- [x] [`apps/web/app/(dashboard)/settings/connections/page.tsx`](<apps/web/app/(dashboard)/settings/connections/page.tsx>) — `Promise.all` ganha `getWorkspaceConnection(workspaceId)`. Passa `connection` + `canManageWhatsapp = role in {Owner, Admin}` pro `ConnectionsView`.
- [x] [`apps/web/app/(dashboard)/settings/connections/connections-view.tsx`](<apps/web/app/(dashboard)/settings/connections/connections-view.tsx>) — agora renderiza `WhatsAppConnectionCard` do feature `connections` (não do `features/settings`).
- [x] **Cleanup:** removido `features/settings/components/whatsapp-connection-card.tsx`, `qr-code-mock.tsx`, `health-score-bar.tsx` — substituídos. Store mock (`useWhatsAppConnection` em `features/settings/store.ts` + `features/inbox/store.ts`) **permanece** porque Inbox e DisconnectionHistory ainda dependem — migram em M9#4.
- [x] [`apps/web/app/api/smoke-test/whatsapp/route.ts`](apps/web/app/api/smoke-test/whatsapp/route.ts) — +grupo `whatsapp-connection-m9` com 7 checks: `factoryReturnsMockWithoutEnv`, `factoryReturnsUazapiWithEnv`, `connectInstanceReturnsExternalId`, `toConnectionUIWithoutAccount`, `toConnectionUIConnecting`, `toConnectionUINormalizesUnknownStatus`, `isQrCodeFreshLogic`, `connectionSchemasStrict`. Target: 6 (M9#1) + 7 = **13 checks no grupo whatsapp**.
- [x] `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅, `pnpm --filter @papopro/web build` ✅.

**Não-objetivos M9#2 (explícitos):**

- Webhook `app/api/webhooks/whatsapp/route.ts` (recebimento de mensagens + ACKs) → M9#3
- `lib/whatsapp/anti-ban.ts` → M9#3
- `sendTextMessageAction` (envio real) → M9#3
- Migrar `features/inbox/store.ts` → M9#4
- Edge Function `whatsapp-heartbeat` (60s polling automático server-side) → M9#5
- Push/email em queda de conexão → M9#5/M10

### M9#3 — Webhook inbound + anti-ban + Server Actions (entregue 2026-05-15)

**Branch:** `m9-webhook-antiban`

**Objetivo:** fechar o loop de mensagens — receber inbound via webhook uazapi (com HMAC + idempotência), enviar outbound via Server Action passando por anti-ban completo. Composer continua chamando o store mock até M9#4 (próximo).

**Entregas:**

- [x] [`apps/web/lib/whatsapp/webhook-verify.ts`](apps/web/lib/whatsapp/webhook-verify.ts) — `verifyUazapiSignature(secret, rawBody, header)` faz HMAC-SHA256 + `timingSafeEqual`. Aceita header com/sem prefixo `sha256=`. Versão pura `verifyUazapiSignaturePure` para smoke. Dev mode: secret vazio = `{ok:true, skipped:true}` (curl local sem env).
- [x] [`apps/web/lib/whatsapp/webhook-schemas.ts`](apps/web/lib/whatsapp/webhook-schemas.ts) — `uazapiWebhookSchema` discriminated union por `event` dos 3 tipos: `message.received` (id, from E.164, type text/image/audio/document, text.body opcional), `message.status` (sent/delivered/read/failed), `instance.status` (connected/disconnected/qr_refreshed, phone_number opcional). Regex E.164 `^\+\d{10,15}$`. Quando integrarmos com uazapi de verdade pré-launch, ajustes ficam em 1 arquivo.
- [x] [`apps/web/lib/whatsapp/anti-ban.ts`](apps/web/lib/whatsapp/anti-ban.ts) — constantes `OUTBOUND_LIMIT_24H=1000`, `JITTER_MIN/MAX_MS=30/50s`, `BURST_PAUSE_THRESHOLD=50`, `BUSINESS_HOUR_START/END=9/21`. `assertCanSendPure(input)` em ordem: blacklisted → instance_disconnected → instance_unhealthy → instance_paused → outside_business_hours → rate_limit_24h. Cada bloqueio retorna `{reason, message}` pt-BR propositivo. `applyJitter(randomFn, sleepFn)` injetável pra smoke. `recordSent(tx, instanceId)` incrementa `messagesSent24h` + seta `pausedUntil = now+30min` ao atingir múltiplo de 50. Janela horária via `Intl.DateTimeFormat({timeZone})` com fallback `America/Sao_Paulo`.
- [x] [`apps/web/features/inbox/handlers.ts`](apps/web/features/inbox/handlers.ts) — 3 handlers server-only chamados dentro da tx do route:
  - **`handleMessageReceived`** — dedup por `external_message_id` (partial unique M9#1), `findDuplicates` por phone (M8#5), cria lead novo com `pickNextAssignee` + activity `lead_created` + audit se phone desconhecido, upsert `Conversation (workspaceId+contactPhone)` com `status='responded'` + `unreadCount: { increment: 1 }`, insert `Message direction='in' authorId=null externalMessageId`, atualiza `lead.lastInteractionAt`, insert `Activity type='whatsapp_in'`. Opt-out regex `^(pare|sair|cancelar)$` (case-insensitive trim) → upsert `BlackList` + activity + audit `whatsapp_blocked_optout`.
  - **`handleMessageStatus`** — busca Message por `external_message_id`. `delivered` → seta `deliveredAt`. `read` → seta `readAt` (e `deliveredAt` se ainda null). `failed` → grava `WhatsappEvent type='message_failed'`. `sent` → no-op. Mensagem não rastreada → `WhatsappEvent type='message_status_unknown'`.
  - **`handleInstanceStatus`** — `connected`: update instance (status, connectedAt, lastSeenAt, limpa QR) + atualiza `WhatsappAccount.phoneNumber` se vier + audit `whatsapp_connected`. `disconnected`: update instance (status, disconnectedAt, limpa QR) + audit `whatsapp_disconnected`. `qr_refreshed`: só registra `WhatsappEvent` (observability).
- [x] [`apps/web/features/inbox/actions.ts`](apps/web/features/inbox/actions.ts) — Server Actions com `maxDuration = 60`:
  - **`sendTextMessageAction({leadId, body})`** — RBAC O/A/M/V. Pre-flight tx readonly carrega lead + workspace.timezone + account + instance. Se faltar conexão, retorna `{reason: 'not_connected'}`. `assertCanSend` consulta BlackList + checks anti-ban; blacklisted registra audit `whatsapp_blocked_optout` na mesma tx + retorna `{ok: false, reason: 'blacklisted'}`. `applyJitter` (30-50s). `adapter.sendText(...)` FORA da tx. Tx final: upsert Conversation, insert Message + Activity `whatsapp_out`, update `lead.lastInteractionAt`, `recordSent`, audit `whatsapp_message_sent`.
  - **`sendInternalNoteAction({leadId, body})`** — RBAC mesmo grupo. Upsert Conversation (não muda status — nota não é resposta), insert `Message kind='internal_note' direction='out' authorId=member.id` (sem `externalMessageId`), Activity type='note' com `meta.internalNote=true`. **NÃO toca o adapter** — fica só no banco.
- [x] [`apps/web/app/api/webhooks/whatsapp/route.ts`](apps/web/app/api/webhooks/whatsapp/route.ts) — POST. Lê raw body → HMAC verify → JSON parse + Zod → rate limit por `whatsapp:${instance_id}` (200 req/min) → lookup `WhatsappInstance.externalInstanceId` SEM workspace context (cross-tenant, select estreito `{id, workspaceId, accountId}`) → idempotência via `WebhookEvent (source='whatsapp_inbound', externalId=sha256(rawBody))` → `withWorkspace` tx → dispatch handler → marca `processedAt`. Sempre 200 OK em sucesso (provedor não retenta; idempotência protege). GET → 405.
- [x] [`apps/web/app/api/smoke-test/whatsapp/route.ts`](apps/web/app/api/smoke-test/whatsapp/route.ts) — +2 grupos:
  - `whatsapp-webhook-m9` (10 checks): HMAC válido com/sem prefixo, inválido, malformado, secret vazio skip, header missing, schemas dos 3 eventos, phone E.164 rejeitado se faltar `+`.
  - `whatsapp-antiban-m9` (10 checks): `assertCanSendPure` happy path + cada uma das 6 razões de bloqueio + `isWithinBusinessHours` timezone-aware + constantes + `applyJitter` injetável (min/max). **Total whatsapp: 13 (M9#1+M9#2) + 10 + 10 = 33 checks.**
- [x] `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅, `pnpm --filter @papopro/web build` ✅ (rota `/api/webhooks/whatsapp` registrada).

**Decisões fechadas M9#3:**

- ACK de mensagem (delivered/read/failed) entra em M9#3 — UI mostra check duplo azul em M9#4 quando o composer migrar.
- Bloqueio outbound por blacklist registra audit `whatsapp_blocked_optout` + retorna `{ok: false}` com toast destrutivo (LGPD §7.5 + defense-in-depth).
- Jitter síncrono cap 50s pra caber em Vercel Server Action default 60s. Fila assíncrona real em M10 junto com motor de cadência.
- Conversation upsert na action: outbound first-message sem inbound prévio cria conversa automaticamente.
- Lookup cross-tenant da instance via `prisma.findFirst({externalInstanceId})` com select estreito — toda mutação subsequente em `withWorkspace` (RLS).
- Webhook HMAC opcional em dev (secret vazio = skipped) — obrigatório em produção; documentar pré-launch.

**Não-objetivos M9#3 (explícitos):**

- Migrar `features/inbox/store.ts` e/ou plugar composer nas novas actions → M9#4
- Realtime channel `workspace:<id>:messages` + publication update → M9#4
- Quick replies CRUD → M9#4
- Heartbeat Edge Function 60s server-side → M9#5
- Push/email em opt-out ou queda de conexão → M9#5+/M10

### M9#4 — Inbox server-fed + Realtime (entregue 2026-05-15)

**Branch:** `m9-inbox-server-fed`

**Entregas principais:**

- [x] [`supabase/migrations/20260519120000_m9_4_inbox_realtime.sql`](supabase/migrations/20260519120000_m9_4_inbox_realtime.sql) — adiciona `messages`/`conversations`/`quick_replies` à publication `supabase_realtime` + `REPLICA IDENTITY FULL` em cada (idempotente via `pg_publication_tables` guard).
- [x] [`apps/web/features/inbox/queries.ts`](apps/web/features/inbox/queries.ts) — 3 queries server-only: `listConversations`, `listRecentMessages` (via `$queryRaw` com `ROW_NUMBER() OVER (PARTITION BY conversation_id)` pra evitar N+1), `listQuickReplies`. Mapeia rows do Prisma pros shapes do contrato fechado em `features/inbox/types.ts`.
- [x] [`apps/web/features/inbox/conversation-actions.ts`](apps/web/features/inbox/conversation-actions.ts) — 4 Server Actions complementares ao composer do M9#3: `archive`/`unarchive` (RBAC O/A/M/V) + `transfer` (RBAC O/A/M só — atualiza Conversation.vendorId + Lead.assignedToId) + `markConversationRead` (qualquer membro, zera unreadCount + readAt nas inbound).
- [x] [`apps/web/features/quick-replies/{schemas,actions}.ts`](apps/web/features/quick-replies/actions.ts) — CRUD completo (Owner/Admin/Manager): `create` (order auto = max+1), `update` (refine ≥1 campo), `delete` (idempotente), `reorder` (batch). Trata P2002 (label unique).
- [x] [`apps/web/features/inbox/hooks/use-realtime-messages.ts`](apps/web/features/inbox/hooks/use-realtime-messages.ts) — subscribe em 3 canais (`workspace:<id>:messages`, `:conversations`, `:quick_replies`) com filter `workspace_id=eq.<id>`. Debounce 250ms dispara `router.refresh()` → page Server Component re-fetcha → InboxView re-hidrata o store.
- [x] [`apps/web/features/inbox/store.ts`](apps/web/features/inbox/store.ts) — adiciona `hydrateInboxFromServer({conversations, messages, quickReplies, whatsappConnection})` que substitui os snapshots iniciais + emite. `useQuickReplies`/`useWhatsAppConnection` agora reativos via `useSyncExternalStore`. API pública dos demais hooks inalterada — componentes não mudaram.
- [x] [`apps/web/app/(dashboard)/inbox/page.tsx`](<apps/web/app/(dashboard)/inbox/page.tsx>) — Server Component async com RBAC qualquer membro. `Promise.all` carrega 4 streams. Mapeia `ConnectionUI.{status,health}` → `WhatsAppConnection.health` (`connected/unstable/disconnected`).
- [x] [`apps/web/app/(dashboard)/inbox/inbox-view.tsx`](<apps/web/app/(dashboard)/inbox/inbox-view.tsx>) — props `initial` + `workspaceId`. `useEffect([initial])` chama `hydrateInboxFromServer`; `useRealtimeMessages(workspaceId)` subscribe nos canais.
- [x] [`apps/web/features/inbox/components/message-composer.tsx`](apps/web/features/inbox/components/message-composer.tsx) — `handleSubmit` async chama `sendTextMessageAction`/`sendInternalNoteAction` do M9#3 com `leadId` (não `conversationId` — actions fazem upsert da conversation). Toast `loading` "Enviando — pode levar até 50s pelo anti-ban…" cobre o jitter síncrono. `reason` retornado (`not_connected`/`blacklisted`/`outside_business_hours`/...) vira toast erro propositivo. Mídia desabilitada com aviso "em breve".
- [x] [`apps/web/features/inbox/components/lead-ficha-quick-actions.tsx`](apps/web/features/inbox/components/lead-ficha-quick-actions.tsx) — `handleReassign`/`handleArchiveToggle` async chamam `transferConversationAction`/`archiveConversationAction`/`unarchiveConversationAction`. `showUndoableToast` invoca action contrária no undo.
- [x] [`apps/web/features/inbox/components/message-thread.tsx`](apps/web/features/inbox/components/message-thread.tsx) — `markConversationRead` mock substituído por `markConversationReadAction` (fire-and-forget; realtime atualiza badge).
- [x] [`apps/web/app/api/smoke-test/whatsapp/route.ts`](apps/web/app/api/smoke-test/whatsapp/route.ts) — +grupo `whatsapp-inbox-m9` com 9 checks (`fallbackPreview` + schemas QuickReply CRUD/reorder). **Total whatsapp: 42 checks (33 anteriores + 9).**
- [x] `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅, `pnpm --filter @papopro/web build` ✅ (rota `/inbox` 17.2 kB).

**Decisões fechadas M9#4:**

- **Não substituir `useSyncExternalStore` por TanStack Query** — page Server + hidrate via realtime/`router.refresh()` é padrão mais simples sem dupla source-of-truth.
- **Mutações via Server Actions diretas, sem optimistic UI** — vendedor vê spinner durante envio (jitter 30-50s); UX explícito via toast. Otimismo + fila assíncrona entram em M10.
- **`maxDuration` não exportável de Server Action file** (Next 14 só aceita async exports em `'use server'`); rotas chamadoras herdam timeout Vercel default 60s.
- **Mídia desabilitada** — `attachMedia` agora é toast "em breve"; bucket `whatsapp-media` adiado pra M9.x/M10.
- **Store mock permanece com hidratação** — outras telas (`useLeads`, `disconnection-history`, etc.) seguem mockadas; substituição progressiva.
- **`Conversation.vendorId` nullable no DB, string no contrato Inbox** — query mapeia `null → ''` (UI mostra "Sem dono").

**Não-objetivos M9#4 (explícitos):**

- Heartbeat Edge Function 60s → M9#5
- Push/email em queda → M9#5/M10
- Fila assíncrona de outbound → M10
- Mídia (image/audio/doc) real → M9.x/M10
- `useLeads` server-fed → polimento

### M9#5 — Heartbeat Edge Function + pg_cron (entregue 2026-05-15)

**Branch:** `m9-heartbeat`

**Objetivo:** detectar queda de conexão WhatsApp em ≤1 min sem depender da Vercel. Edge Function (Deno) roda dentro do Supabase, agendada por `pg_cron`, ativada via `pg_net` HTTP POST. Push/email pro vendedor em queda fica pra M10 (motor de cadência).

**Entregas:**

- [x] [`apps/web/lib/whatsapp/heartbeat-helpers.ts`](apps/web/lib/whatsapp/heartbeat-helpers.ts) — `computeNextHealth(currentHealth, success)` puro com política de 3 estados (success → healthy; falha em healthy → degraded; falha em degraded → unhealthy; falha em unhealthy → stays). `summarizeHeartbeat(outcomes)` puro agrega por estado. Fonte canônica da regra — Edge Function tem cópia inline em Deno.
- [x] [`supabase/functions/whatsapp-heartbeat/index.ts`](supabase/functions/whatsapp-heartbeat/index.ts) — Deno `Deno.serve()`. Valida `x-heartbeat-secret` contra env `HEARTBEAT_SECRET` (timing-safe via `===` — single-byte secret compare é OK pra equality-only auth de cron interno). Lista `whatsapp_instances WHERE status='connected' AND external_instance_id IS NOT NULL` via Service Role (bypassa RLS). Pra cada: `fetch(uazapi /instance/<id>/status)` com timeout 5s. Atualiza `health_score = computeNextHealth(curr, success)` + `last_seen_at = now()` (se success) + insert `WhatsappEvent type='heartbeat_ok'|'heartbeat_fail'`. Retorna `{ok, summary: {checked, healthy, degraded, unhealthy, errors}, outcomes}`.
- [x] [`supabase/migrations/20260520120000_m9_5_heartbeat_cron.sql`](supabase/migrations/20260520120000_m9_5_heartbeat_cron.sql):
  - `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron`
  - `CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions`
  - Função `public.invoke_whatsapp_heartbeat()` (`SECURITY DEFINER`, `search_path` fixo) que faz `extensions.http_post` pra `${app.supabase_url}/functions/v1/whatsapp-heartbeat` com header `x-heartbeat-secret: ${app.heartbeat_secret}` e timeout 30s. Settings (`app.supabase_url`/`app.heartbeat_secret`) lidos via `current_setting(..., true)` — operador configura via `ALTER DATABASE postgres SET ...`. Função RETURNS `NULL` se settings ausentes (não quebra cron).
  - `cron.schedule('whatsapp-heartbeat-every-minute', '* * * * *', $cron$ SELECT public.invoke_whatsapp_heartbeat() $cron$)` — idempotente via unschedule prévia. pg_cron mínimo é 1 min (`* * * * *`).
- [x] [`apps/web/app/api/smoke-test/whatsapp/route.ts`](apps/web/app/api/smoke-test/whatsapp/route.ts) — +grupo `whatsapp-heartbeat-m9` com 6 checks: `computeNextHealth` (success recupera de qualquer estado; falha em healthy/degraded/unhealthy) + `summarizeHeartbeat` (agregação correta + lista vazia). **Total whatsapp: 42 (M9#1..#4) + 6 = 48 checks.**
- [x] `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅, `pnpm --filter @papopro/web build` ✅.

**Decisões fechadas M9#5:**

- **1 min em vez de 60s exatos** — pg_cron mínimo é `* * * * *`. Cobre detecção em ~30s média; alinhado com SLO realista do PRD.
- **Política health 3-estados conservadora** — uma falha vai pra `degraded` (não direto `unhealthy`), evitando alarme em flake de rede.
- **Cópia inline da regra em Deno** — Edge Function não pode importar do Next; helper canônico em `apps/web/lib/whatsapp/heartbeat-helpers.ts` é o smoke; manter os dois em sync na review de PR.
- **Service Role na Edge** — heartbeat é processo interno do Supabase, bypassa RLS por design. Defense-in-depth: select estreito + filter por status.
- **Push/email em queda fica pra M10** — heartbeat só persiste estado; cadência consulta `health_score != 'healthy'` antes de disparar mensagens. Notificação ativa do vendedor depende do sistema de notificações que entra em M11/M12.
- **`net.http_post` assíncrono** — função SQL não bloqueia esperando resposta; Edge escreve no DB e o próximo cron 1min depois tenta novamente se algo falhou.

**Configuração pós-deploy (ops, fora do PR):**

1. **Deploy Edge Function** via MCP `deploy_edge_function` (memória `dev-local-windows-antivirus-tls` impede CLI local).
2. **Secret na Edge Function** via `supabase secrets set HEARTBEAT_SECRET=<random64> UAZAPI_BASE_URL=... UAZAPI_API_KEY=...` ou via Dashboard.
3. **Settings no Postgres** via SQL Editor:
   ```sql
   ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
   ALTER DATABASE postgres SET app.heartbeat_secret = '<mesmo random64>';
   ```
4. **Migration via MCP `apply_migration`** depois do deploy da Edge.
5. **Smoke pós-deploy:** `SELECT cron.job` lista o agendamento; `SELECT * FROM net._http_response ORDER BY id DESC LIMIT 5` mostra os últimos requests pra Edge; `SELECT type, count(*) FROM whatsapp_events WHERE type LIKE 'heartbeat%' GROUP BY type` mostra a divisão sucesso/falha.

**Não-objetivos M9#5 (explícitos):**

- Push/email pro vendedor em queda → M10 (depende de notification system)
- Heartbeat para Cloud API Meta → V2 (mesma estrutura, troca o adapter via factory)
- Auto-reconexão (regenerar QR se cai) → M10 polimento; hoje vendedor reconecta manual em `/settings/connections`
- Retry de envios pausados após recovery → M10 com fila assíncrona

**Commit final M9:** `feat(whatsapp): uazapi adapter with anti-ban, real-time inbox and capture`

---

## M10 — Motor de Cadência + Alertas de Lead Frio

**Estratégia:** 5 sub-PRs sequenciais sobre `dev` (gitflow strict, igual M8/M9). Sub-PR único M10 ficaria com 30+ arquivos cruzando SQL/Deno/TS/React — fatiar permite validação incremental.

| Sub-PR    | Escopo                                                                                                                                                                                                                                                         | Branch                 | Status      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------- |
| **M10#1** | Schema das 6 tabelas + ALTER `leads` (temperature + cold_alerted_at) + trigger `pause_cadence_on_inbound` em `messages` + seed inline dos 3 templates + 5 cold thresholds default por workspace + backfill                                                     | `m10-1-schema-seed`    | ✅ entregue |
| **M10#2** | Edge Function `cadence-runner` (Deno, 5min via `pg_cron`) + rota interna `/api/internal/cadence-dispatch` (anti-ban + uazapi) + resolver de placeholders `{nome}/{empresa}/{produto}` + cron migration + helpers puros + smoke                                 | `m10-2-cadence-runner` | ✅ entregue |
| **M10#3** | UI conectada (hydrate-from-server), Server Actions reais de CRUD + steps + enrollments, modelos Prisma das 6 tabelas cadence\_\*, métricas reais agregadas, seção "Cadências" na página do lead, settings `/settings/cadences/cold-thresholds`, seed em signup | `m10-3-ui-wiring`      | ✅ entregue |
| **M10#4** | Edge Function `cold-lead-detector` (Deno, 1h via `pg_cron`) + RPC detector + auto-ack triggers + Server Action `acknowledgeColdAlert` + badge sidebar `/leads` + cold alerts reais no sino + banner no lead detail                                             | `m10-4-cold-detector`  | ✅ entregue |
| **M10#5** | Seção "Cadências" em `/reports` (KPI strip + tabela performance + BarChart lead frio por etapa) + smoke +18 contratos (helpers puros, sem DB) + atualização final de PLAN.md                                                                                   | `m10-5-reports-smoke`  | ✅ entregue |

**Decisões fechadas (não reabrir):**

- **PR único M10 era inicialmente o plano**, mas fatiamento bateu com padrão M8/M9 que já se mostrou superior — review rápido, revert isolado, validação incremental. Decisão tomada antes de M10#1 abrir.
- **Email é stub no MVP** — runner só processa `channel='whatsapp'`; steps `'email'` recebem `cadence_step_runs.status='skipped' skip_reason='email_stub'` e enrollment avança. Resend entra em milestone futuro junto com webhook de bounce. UI/templates mantêm a opção email visível pra evitar refactor quando integrar.
- **Pausa automática via trigger SQL** em `messages AFTER INSERT WHERE direction='in'` — não no runner. Latência ~ms (não ~5min), zero overhead no tick do runner, e re-aquece lead frio (cold→warm) ao mesmo tempo sem degradar `'hot'`.
- **Templates seedados em SQL inline** (não importando de TS) — função `seed_default_cadences_for_workspace(workspace_id)` cria as 3 cadências com 17 steps total fielmente copiados de [apps/web/lib/fixtures/cadence-templates.ts](apps/web/lib/fixtures/cadence-templates.ts). Cadências template criadas como `status='paused'` por default — usuário ativa explicitamente.
- **Backfill no fim da migration** roda `seed_default_*` pra todos workspaces existentes; chamada também é exposta pra Server Action de signup integrar em M10#3.
- **Edge Function delega anti-ban pro Next** — `cadence-runner` em Deno só agenda + idempotência (claim slot via INSERT ON CONFLICT DO NOTHING no `UNIQUE(enrollment_id, step_id)` do M10#1). Envio real passa por `/api/internal/cadence-dispatch` (Next API route protegida por `timingSafeEqual(Bearer CADENCE_DISPATCH_SECRET)`) que reusa exatamente `lib/whatsapp/uazapi.ts` + `lib/whatsapp/anti-ban.ts` + `resolvePlaceholders` do M9 sem reimplementar em Deno.
- **Backoff transiente vs cancelamento permanente** — anti-ban `blacklisted` (LGPD opt-out) cancela enrollment definitivamente + audit `cadence_paused` com `meta.reason='blacklist'`. Anti-ban transiente (`rate_limit`/`unhealthy`/`outside_business_hours`/`workspace_paused`) faz step_run skipped + adia `enrollment.next_run_at = NOW() + 30min` mas enrollment continua active.
- **Backoff transiente avança o step** — o LEFT JOIN da RPC `cadence_runner_pick_candidates` trata QUALQUER `cadence_step_runs` row (sent/skipped/failed) como "executada". Retry do MESMO step em rate_limit transient exigiria DELETE do skipped row antes do backoff — adiado pra M10.x. Trade-off escolhido em M10#2: simples e previsível.

**Commit final M10 (release):** `feat(cadence): automated follow-up engine with smart pause and cold lead alerts`

### M10#1 — Schema + seed + trigger pausa (entregue 2026-05-15)

**Branch:** `m10-1-schema-seed`

**Objetivo:** preparar o terreno persistente do motor de cadência. Zero rotas novas, zero integração externa, zero UI tocada — próximos sub-PRs herdam essa base.

**Entregas:**

- [x] [`supabase/migrations/20260521120000_m10_1_cadence_schema.sql`](supabase/migrations/20260521120000_m10_1_cadence_schema.sql) — 8 enums novos (`cadence_status`, `cadence_step_channel`, `cadence_template_key`, `cadence_enrollment_status`, `cadence_enrollment_pause_reason`, `cadence_step_run_status`, `cadence_step_run_skip_reason`, `lead_temperature`), 12 valores novos em `audit_action` (`cadence_*` + `cold_lead_*` + `cold_threshold_updated`), ALTER `leads` (`temperature` default `'warm'`, `cold_alerted_at` nullable) + índice `(workspace_id, temperature)`, 6 tabelas (`cadences`, `cadence_steps`, `cadence_enrollments`, `cadence_step_runs`, `cold_lead_thresholds`, `cold_lead_alerts`) com FKs, 15 índices (vários parciais — ex: `cadence_enrollments_runner_idx (status, next_run_at) WHERE status='active'`), 5 triggers `touch_updated_at` + 1 trigger `pause_cadence_on_inbound`, 24 policies RLS (4 × 6 — `cadence_steps` herda via subquery do `cadences`, padrão M8 `pipeline_stages`), 2 funções de seed idempotentes.
- [x] **Trigger `pause_cadence_on_inbound`** (`SECURITY DEFINER`) em `messages` AFTER INSERT WHERE `direction='in'` — pausa todos `cadence_enrollments` active do lead com `paused_reason='lead_replied'`, atualiza `leads.last_interaction_at`, re-aquece se temperature='cold' (cold→warm). **NÃO degrada `'hot'` pra `'warm'`** via `CASE WHEN temperature='cold' THEN 'warm' ELSE temperature END` — preserva sinal de alta intenção.
- [x] **Função `seed_default_cold_thresholds_for_workspace(workspace_id uuid)`** — cria 5 thresholds default: 7d Novo, 14d Em Contato, 7d Proposta, 5d Negociação, 30d Global (`stage_id IS NULL`). Idempotente via UNIQUE NULLS NOT DISTINCT (Postgres 15+).
- [x] **Função `seed_default_cadences_for_workspace(workspace_id uuid)`** — cria 3 cadências paused com 17 steps total: Imobiliário (6 steps, etapa Novo), B2B Consultivo (5 steps, Em Contato), Alto Ticket (6 steps, Proposta). Conteúdo dos steps inline em SQL (fielmente copiado de [apps/web/lib/fixtures/cadence-templates.ts](apps/web/lib/fixtures/cadence-templates.ts)). Idempotente via `NOT EXISTS (SELECT 1 FROM cadences WHERE workspace_id=p AND template_key=k)`. Aborta silenciosamente se pipeline default ainda não foi seedado pro workspace.
- [x] **Backfill DO block** no fim da migration — itera todos workspaces existentes chamando as 2 funções de seed.
- [x] **Enum `cadence_template_key` alinhado com frontend** — usa `'alto-ticket'` (com hífen) em vez de `'alto_ticket'`, batendo com `TEMPLATE_KEY_VALUES` em [apps/web/features/cadences/schemas.ts](apps/web/features/cadences/schemas.ts). Evita mapping em runtime na Server Action de M10#3.
- [x] **Validação local end-to-end** via `supabase db reset` + script SQL: 6 tabelas + 24 policies + RLS habilitada + 12 audit_action novos + trigger instalado, seed gera 5 thresholds + 3 cadences (17 steps) idempotente, trigger pausa em inbound (cold→warm) + ignora outbound + preserva hot. **Pré-requisito local**: M8#6 precisa do fix de `COMMENT ON POLICY storage.objects` envolvido em DO + EXCEPTION (Docker `postgres` não é owner desse schema) — fix vai num PR à parte (não bloqueia CI, só dev local).

**Decisões fechadas M10#1:**

- **Templates seedados como `status='paused'`** — usuário ativa explicitamente em 1 clique. Evita disparo acidental quando o motor virar (M10#2).
- **Backfill no fim da migration roda pra workspaces existentes** — funções são idempotentes, então a Server Action de signup (M10#3) pode chamar de novo sem duplicar. Workspaces criados antes de M10#1 não ficam sem defaults.
- **`messages` NÃO ganha coluna `from_lead`** — `direction='in'`/`'out'` já existe desde M9 e o trigger consulta direto. Evita coluna redundante e migration de backfill.
- **Trigger é `SECURITY DEFINER`** — webhook inbound pode rodar como service role ou no contexto da tx; função precisa atravessar RLS pra atualizar `cadence_enrollments` cross-table. `search_path = pg_catalog, public` previne path-shadowing.
- **`cold_lead_thresholds.stage_id` é nullable** — NULL representa fallback global do workspace; constraint `UNIQUE NULLS NOT DISTINCT (workspace_id, stage_id)` (PG 15+) garante unique mesmo com null.

**Não-objetivos M10#1 (explícitos):**

- Edge Function `cadence-runner` (Deno) → M10#2
- Cron schedule `pg_cron` pro runner → M10#2
- Rota interna `/api/internal/cadence-dispatch` (anti-ban + uazapi) → M10#2
- Resolver de placeholders `{nome}/{empresa}/{produto}` → M10#2
- Server Actions de cadência reais (createCadence/enrollLead/etc.) → M10#3
- Migrar store de `useSyncExternalStore` pra TanStack Query → M10#3
- Edge Function `cold-lead-detector` → M10#4
- Notificações push/in-app de lead frio → M10#4
- Seção "Cadências" em `/reports` + smoke endpoint → M10#5

### M10#2 — cadence-runner Edge Function + rota interna de dispatch (entregue 2026-05-16)

**Branch:** `m10-2-cadence-runner`

**Objetivo:** transformar `cadence_enrollments active` em mensagens reais WhatsApp. M10#1 entregou o schema; M10#2 entrega o motor que executa. **Diferencial nº 1 do PRD finalmente funcional.**

**Entregas:**

- [x] [`supabase/migrations/20260522120000_m10_2_cadence_runner_cron.sql`](supabase/migrations/20260522120000_m10_2_cadence_runner_cron.sql) — Extensões `pg_cron` + `pg_net` (idempotente, também criadas em M9#5); RPC `public.cadence_runner_pick_candidates(p_limit int DEFAULT 100)` LANGUAGE sql SECURITY DEFINER que faz LATERAL JOIN do próximo step não-executado (LEFT JOIN `cadence_step_runs` + `r.id IS NULL`) ordenado por `(day_offset, order_index)`; função `public.invoke_cadence_runner()` SECURITY DEFINER que lê `app.supabase_url` + `app.cadence_runner_secret` via `current_setting(..., true)` e dispara `extensions.http_post` (assíncrono, timeout 30s) pra `/functions/v1/cadence-runner`; `cron.schedule('cadence-runner-every-5-min', '*/5 * * * *', …)` idempotente via `cron.unschedule` prévia. Por que 5 min e não 1 min: cadência tem granularidade de dias; 5 min é imperceptível e reduz pressão no DB+Edge ~12×.
- [x] [`supabase/functions/cadence-runner/index.ts`](supabase/functions/cadence-runner/index.ts) — Edge Function Deno. `Deno.serve` valida header `x-cadence-runner-secret` contra env `CADENCE_RUNNER_SECRET` (simple equality). Cria Service Role client (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) com `auth.persistSession=false`. Chama RPC `cadence_runner_pick_candidates(100)` cross-tenant. Pra cada candidato: INSERT em `cadence_step_runs (workspace_id, enrollment_id, step_id, status='pending', scheduled_for)` — Postgres `23505` unique violation = outro runner já claimou, skip silenciosamente. Pra cada slot reivindicado: `fetch POST` pra `/api/internal/cadence-dispatch` com `Authorization: Bearer ${CADENCE_DISPATCH_SECRET}` em batches de 5 (Promise.allSettled), timeout 60s por request. Retorna `{ok, summary: {picked, claimed, dispatched, errors}, outcomes, errors}`. `eslint-disable` + `deno-lint-ignore-file` no topo (runtime Deno, sem package.json).
- [x] [`apps/web/app/api/internal/cadence-dispatch/route.ts`](apps/web/app/api/internal/cadence-dispatch/route.ts) — POST handler Next runtime nodejs. Auth via `timingSafeEqual(Bearer CADENCE_DISPATCH_SECRET)` (mesmo padrão da `cleanup-attachments` M8#6). Valida payload Zod (`workspace_id`, `enrollment_id`, `lead_id`, `cadence_id`, `step_id`, `step_run_id`, `scheduled_for` — strict). Pre-flight via `withWorkspace(tx)` + `$queryRaw` que faz JOIN de enrollment + cadence + step + lead + workspace + step_run pra carregar tudo numa query. Branches em ordem: enrollment/cadence não-active → skip(workspace_paused); lead deletado → skipAndCancel(lead_deleted); step.channel='email' → skipStepRun(email_stub) + advance; lead sem phone → skipAndCancel(no_phone); WhatsApp não conectado → backoff transiente(workspace_paused); `assertCanSend(tx)` retorna bloqueio → `mapAntiBanToSkipReason` + `isPermanentBlock` decide `skipAndCancel` (blacklist) vs `backoffAfterTransientBlock` (+30min). Happy path: `applyJitter()` 30-50s, `resolvePlaceholders` (reusa `features/inbox/transforms.ts`), `adapter.sendText()` FORA da tx, depois tx final com upsert Conversation + create Message + Activity `whatsapp_out` com `meta.source='cadence'` + `recordSent` + UPDATE step_run='sent'. Avança enrollment fora da tx (`computeNextRunAt` ou `status='completed'`) + audit `cadence_step_sent` ou `cadence_completed`. `maxDuration=60`.
- [x] [`apps/web/features/cadences/dispatch/types.ts`](apps/web/features/cadences/dispatch/types.ts) — string literal types pra `CadenceStepRunStatus`, `CadenceStepRunSkipReason`, `CadenceEnrollmentStatus`, `CadenceEnrollmentPauseReason`, `CadenceStepChannel`. Comentário explica por que não importa do Prisma client (M10#1 criou ENUMs em SQL mas não modelos Prisma; M10#3 adiciona modelos e este arquivo pode re-exportar).
- [x] [`apps/web/features/cadences/dispatch/schemas.ts`](apps/web/features/cadences/dispatch/schemas.ts) — `dispatchPayloadSchema` Zod strict (`.strict()` rejeita props extras — defense-in-depth contra Edge Function comprometida).
- [x] [`apps/web/features/cadences/dispatch/map-antiban-reason.ts`](apps/web/features/cadences/dispatch/map-antiban-reason.ts) — `mapAntiBanToSkipReason(reason: AntiBanReason): CadenceStepRunSkipReason` cobre 6 razões + `isPermanentBlock` (só `blacklisted` é permanente — `no_phone`/`lead_deleted` são tratados na rota antes do anti-ban).
- [x] [`apps/web/features/cadences/dispatch/compute-next-run-at.ts`](apps/web/features/cadences/dispatch/compute-next-run-at.ts) — `computeNextRunAt(enrolledAt, currentStepDayOffset, availableDayOffsets)` puro retorna `{nextRunAt, isComplete}` baseado em `addDays(enrolledAt, nextOffset)`. `computeBackoffNextRunAt(now, minutes=30)` retorna `addMinutes(now, minutes)`. `DAY_OFFSETS = [0,1,3,7,14,30]` exportado.
- [x] [`apps/web/features/cadences/dispatch/select-next-step.ts`](apps/web/features/cadences/dispatch/select-next-step.ts) — `pickNextStep(steps, executedStepIds)` espelho TS da RPC SQL pra testar lógica de ordenação `(day_offset, order_index)` sem banco.
- [x] [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) — +12 valores em `AuditAction` (`cadence_*` + `cold_*`) espelhando os `ALTER TYPE ADD VALUE` do M10#1 SQL. Necessário pra TS tipar `tx.auditLog.create({action: 'cadence_step_sent', ...})` sem error.
- [x] [`apps/web/app/api/smoke-test/cadences/route.ts`](apps/web/app/api/smoke-test/cadences/route.ts) — +15 checks no grupo `cadence-dispatch-m10`: `AuditAction` extension (12 valores M10#1 presentes), `mapAntiBanToSkipReason` (6 razões), `isPermanentBlock` (só blacklisted), `computeNextRunAt` advance/complete, `computeBackoffNextRunAt`, `pickNextStep` ordenação + skip executed + null quando tudo executado, `dispatchPayloadSchema` accept/reject extra/reject uuid, regressão `resolvePlaceholders`.
- [x] **Tabelas cadence\_\* via `$queryRaw`/`$executeRaw`**: M10#1 criou as 6 tabelas em SQL puro mas o `schema.prisma` ainda não tem os modelos correspondentes (M10#3 adiciona junto com Server Actions de CRUD). M10#2 acessa tudo via raw SQL nessas tabelas; Prisma client lida com Conversation/Message/Activity/AuditLog/Lead/WhatsappAccount/WhatsappInstance normalmente.
- [x] **Validação manual local:** smoke endpoint retorna `cadence-dispatch-m10` com 15/15 verdes.
- [x] `pnpm --filter @papopro/db db:generate` ✅, `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅ (zero warnings), `pnpm --filter @papopro/web build` ✅.

**Não-objetivos M10#2 (explícitos — ficam pra outros sub-PRs):**

- UI conectada / Server Actions de CRUD de cadência → M10#3
- Cold lead detector (Edge Function + cron + notificações) → M10#4
- Reports + smoke end-to-end lifecycle → M10#5
- Push/email pro vendedor em queda de envio → M10#4 (depende de notification system)
- Mídia (image/audio/doc) em cadência → adiado V2
- Retry do MESMO step em transient block (DELETE skipped row antes do backoff) → adiado M10.x

**Ops pós-deploy (adiado pra pré-launch, fora do escopo deste PR):**

1. Deploy Edge Function via MCP `deploy_edge_function name=cadence-runner` ou `supabase functions deploy cadence-runner`.
2. `supabase secrets set CADENCE_RUNNER_SECRET=<random64> CADENCE_DISPATCH_SECRET=<random64> APP_URL=https://app.pipeflow.com.br UAZAPI_BASE_URL=... UAZAPI_API_KEY=...` (via Dashboard ou CLI).
3. SQL no Editor: `ALTER DATABASE postgres SET app.cadence_runner_secret = '<mesmo>';` (`app.supabase_url` já configurado em M9#5).
4. Aplicar migration via MCP `apply_migration name=m10_2_cadence_runner_cron` (após #69 ter sido aplicada).
5. Validar: `SELECT cron.job WHERE jobname = 'cadence-runner-every-5-min'`; `SELECT * FROM cron.job_run_details ORDER BY end_time DESC LIMIT 5` deve mostrar invocações sucessivas a cada 5 min.

### M10#3 — UI conectada + Prisma models + Server Actions reais (entregue 2026-05-16)

**Branch:** `m10-3-ui-wiring`

**Objetivo:** transformar o `features/cadences` de fixture mockada (M5/M6) em produto funcional ponta-a-ponta. Backend (M10#1 schema + M10#2 motor) já está em `dev`; M10#3 conecta a UI existente (10 componentes prontos) ao banco real, adiciona Prisma models, abre seção "Cadências" na página do lead e settings cold-thresholds.

**Entregas:**

- [x] [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) — **+8 enums** (`CadenceStatus`, `CadenceStepChannel`, `CadenceTemplateKey` com `alto_ticket @map("alto-ticket")`, `CadenceEnrollmentStatus`, `CadenceEnrollmentPauseReason`, `CadenceStepRunStatus`, `CadenceStepRunSkipReason`, `LeadTemperature`) + **6 models** (`Cadence`, `CadenceStep`, `CadenceEnrollment`, `CadenceStepRun`, `ColdLeadThreshold`, `ColdLeadAlert`) mapeando as tabelas criadas em M10#1 SQL. Adiciona campos `temperature` (default `warm`) e `coldAlertedAt` em `Lead` (espelhando ALTER do M10#1). +relations em `Workspace`/`PipelineStage`/`Lead`/`Message`/`User` (cadencesCreated, coldLeadAlertsAcked).
- [x] [`packages/db/src/index.ts`](packages/db/src/index.ts) — re-export dos 8 enums novos pra que `@papopro/db` seja a única fonte. `apps/web/features/cadences/dispatch/types.ts` (M10#2) agora apenas re-exporta de `@papopro/db` em vez de manter string literal types.
- [x] [`apps/web/features/cadences/queries.ts`](apps/web/features/cadences/queries.ts) — 5 queries server-only: `listCadences(workspaceId)` (todas + steps + métricas agregadas via `$queryRaw` GROUP BY pra evitar N+1), `getCadence(workspaceId, id)`, `getCadenceMetrics(workspaceId, cadenceId)`, `listLeadEnrollments(workspaceId, leadId)` (com `cadenceName`/`stepsSent`/`stepsTotal`), `listColdThresholds(workspaceId)`, `listAvailableCadencesForLead(workspaceId)` (cadências `active` pra o dialog de inscrição). Métricas reais: `activeEnrollments`, `totalDispatched` (step_runs `sent`), `responseRate` (% com `paused_reason='lead_replied'`). `stageAdvanceRate` fica em 0 — exige snapshot pós-enrollment do `deal.stageId` em M10#5/reports.
- [x] [`apps/web/features/cadences/actions.ts`](apps/web/features/cadences/actions.ts) — **12 Server Actions** com padrão idiomático M8/M9 (Zod safeParse → `requireRole` → `getRequestAuditContext` → `withWorkspace(tx)` → audit log MESMA tx → `revalidatePath`):
  - **Cadências** (Owner/Admin/Manager): `createCadenceAction` (clona steps do template via `getTemplate`), `updateCadenceAction`, `toggleCadenceStatusAction`, `duplicateCadenceAction` (com `templateKey='custom'` + `status='paused'` + ` (cópia)` no nome), `deleteCadenceAction` (Owner/Admin only — Manager não pode deletar)
  - **Steps** (Owner/Admin/Manager): `addStepAction` (calcula `order_index = max + 1` no mesmo `day_offset`), `updateStepAction` (recalcula order ao mudar `day_offset`), `deleteStepAction`
  - **Enrollments** (Owner/Admin/Manager/Vendedor — Vendedor RBAC fino só do próprio lead): `enrollLeadAction` (rejeita duplicata via UNIQUE P2002), `pauseEnrollmentAction` (no-op se já pausado; preserva `lead_replied` reason quando manual override), `resumeEnrollmentAction` (rejeita reativar `cancelled`/`completed`)
  - **Cold thresholds** (Owner/Admin only): `updateColdThresholdAction`
- [x] [`apps/web/features/cadences/store.ts`](apps/web/features/cadences/store.ts) — refatorado pra **hydrate-from-server pattern** (padrão M9#4 Inbox): remove `FAKE_CADENCES` init + mutações in-memory (createCadence/toggle/etc); mantém apenas `useCadences()`/`useCadence(id)` + adiciona `hydrateCadencesFromServer(initial)` que substitui snapshot. Decisão arquitetural: **pessimismo total** (toast loading → action → revalidatePath → re-render) em vez de otimismo client-side — elimina dupla fonte de verdade. Otimismo entra em M10#5 se UX exigir.
- [x] [`apps/web/app/(dashboard)/cadences/page.tsx`](<apps/web/app/(dashboard)/cadences/page.tsx>) — Server Component com `dynamic = 'force-dynamic'`. Lê `getCurrentUserContext()` + `readWorkspaceCookie()` (padrão `/leads/page.tsx`), chama `listCadences(workspaceId)`, passa `initialCadences` pro `<CadencesView>`. `redirect('/login')` se sem auth; `redirect('/onboarding')` se membership inexistente.
- [x] [`apps/web/app/(dashboard)/cadences/cadences-view.tsx`](<apps/web/app/(dashboard)/cadences/cadences-view.tsx>) — recebe `initialCadences` + `useEffect([initial])` chama `hydrateCadencesFromServer`. Resto inalterado (search/filter/groups/empty state).
- [x] [`apps/web/app/(dashboard)/cadences/[id]/page.tsx`](<apps/web/app/(dashboard)/cadences/[id]/page.tsx>) — Server Component carrega `getCadence(workspaceId, id)`; `notFound()` se inexistente ou de outro workspace (Prisma respeita RLS via `withWorkspace`).
- [x] [`apps/web/app/(dashboard)/cadences/[id]/cadence-editor-view.tsx`](<apps/web/app/(dashboard)/cadences/[id]/cadence-editor-view.tsx>) — recebe `initialCadence: Cadence` em vez de `id: string`. Handlers `handleDuplicate`/`handleDelete`/`handleToggleStatus`/`handleDeleteStep` viram `async` chamando Server Actions com toast loading + dismiss + erro/sucesso.
- [x] [`apps/web/features/cadences/components/cadence-create-dialog.tsx`](apps/web/features/cadences/components/cadence-create-dialog.tsx) + [`cadence-status-toggle.tsx`](apps/web/features/cadences/components/cadence-status-toggle.tsx) + [`step-edit-dialog.tsx`](apps/web/features/cadences/components/step-edit-dialog.tsx) — substitui chamadas a `store.createCadence`/`toggleCadenceStatus`/`addStep`/`updateStep` por Server Actions. State `pending` no toggle previne double-click.
- [x] [`apps/web/features/cadences/components/lead-enrollments-section.tsx`](apps/web/features/cadences/components/lead-enrollments-section.tsx) — **novo componente**. Card "Cadências" na página do lead que lista enrollments (active/paused/completed/cancelled) com status badge + `nextRunAt` relativo (date-fns ptBR) + `stepsSent/stepsTotal`. Botões Pausar/Reativar inline (Server Actions). Mensagem específica pra `paused_reason='lead_replied'`. Botão "Inscrever" abre `<EnrollLeadDialog>`.
- [x] [`apps/web/features/cadences/components/enroll-lead-dialog.tsx`](apps/web/features/cadences/components/enroll-lead-dialog.tsx) — **novo componente**. Select de cadências `active` do workspace, filtra fora as que o lead já está inscrito (`alreadyEnrolledIds`). Chama `enrollLeadAction`. Empty state quando todas cadências já inscritas.
- [x] [`apps/web/app/(dashboard)/leads/[id]/page.tsx`](<apps/web/app/(dashboard)/leads/[id]/page.tsx>) — adiciona `listLeadEnrollments` + `listAvailableCadencesForLead` ao `Promise.all` de queries. Passa props pra view.
- [x] [`apps/web/app/(dashboard)/leads/[id]/lead-detail-view.tsx`](<apps/web/app/(dashboard)/leads/[id]/lead-detail-view.tsx>) — encaixa `<LeadEnrollmentsSection>` no desktop (3ª coluna, acima de `LeadNextActions`) e como 5ª aba "Cadências" no mobile.
- [x] [`apps/web/app/(dashboard)/settings/cadences/cold-thresholds/page.tsx`](<apps/web/app/(dashboard)/settings/cadences/cold-thresholds/page.tsx>) + [`cold-thresholds-view.tsx`](<apps/web/app/(dashboard)/settings/cadences/cold-thresholds/cold-thresholds-view.tsx>) — **nova rota Owner/Admin only** (redirect `/settings` pra outros papéis). Tabela editável com 5 thresholds default seedados, auto-save em blur (input numérico 1-365) + toggle enabled. Padrão "configuração inline" sem botão Salvar (Linear/Notion).
- [x] [`apps/web/features/settings/components/settings-nav-config.ts`](apps/web/features/settings/components/settings-nav-config.ts) — adiciona item "Lead frio" (ícone Snowflake, ownerOnly). [`packages/ui/src/icons.ts`](packages/ui/src/icons.ts) — exporta `Snowflake` (novo).
- [x] [`apps/web/features/workspace/actions.ts`](apps/web/features/workspace/actions.ts) — `createWorkspaceAction` chama `seed_default_cold_thresholds_for_workspace` + `seed_default_cadences_for_workspace` na MESMA tx do signup (best-effort com try/catch — erro loga e segue, não derruba signup). Funções SQL M10#1 são idempotentes (`ON CONFLICT DO NOTHING`) — workspaces backfilled não duplicam.
- [x] [`apps/web/app/api/smoke-test/cadences/route.ts`](apps/web/app/api/smoke-test/cadences/route.ts) — **+7 checks no grupo `cadences-actions-m10`**: `cadenceCreateSchema` accept `alto-ticket` / reject unknown templateKey / reject stage terminal; `stepCreateSchema` reject invalid `dayOffset` (5/10/60) + reject body curto + accept body com placeholders + accept channel `email`. Total cadences: **95/95 verde** (17 M10#2 + 7 M10#3 + 71 pre-existentes).
- [x] `pnpm --filter @papopro/db db:generate` ✅, `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅ (zero warnings), `pnpm --filter @papopro/web build` ✅ (rota `/settings/cadences/cold-thresholds` registrada).

**Decisões fechadas M10#3:**

- **Hydrate-from-server em vez de TanStack Query** — padrão M9#4 Inbox já validado; mantém API pública `useCadences()`/`useCadence(id)` inalterada; zero nova dep. TanStack Query entra em M11 quando agentes IA precisarem de cache server-state mais complexo.
- **Pessimismo total nas mutações** — sem otimismo client-side. Toast loading → Server Action → revalidatePath → re-render. Elimina dupla fonte de verdade (race conditions). Otimismo entra em M10#5 se UX exigir.
- **Editor de cadência recebe prop `initialCadence`** (não usa store) — Server Component carrega; mutações revalidam path; Next refetcha. Mais simples + testável.
- **Manager NÃO pode deletar cadência** — `deleteCadenceAction` exige Owner/Admin. Cascade impacta enrollments + step_runs, ação irrecuperável.
- **Vendedor enroll/pause/resume só do próprio lead** — RBAC fino check `lead.assignedTo.userId === userId`. Owner/Admin/Manager livre.
- **Settings cold-thresholds em auto-save** sem botão Salvar — padrão Linear/Notion. Erro reverte ao último valor válido.
- **Seed em signup é best-effort** — try/catch dentro da tx evita derrubar criação de workspace se M10#1 não rodou em ambiente legacy. M10#1 backfill já cobriu workspaces existentes.

**Não-objetivos M10#3 (explícitos):**

- TanStack Query install + migration → M11 (decisão fechada)
- Optimistic UI agressivo nas mutações → M10#5 se necessário
- Edge Function `cold-lead-detector` + cron 1h → M10#4
- Notificações push/in-app de lead frio → M10#4 (depende de notification system)
- Tela de reports com volume disparado / performance por cadência → M10#5
- Smoke endpoint lifecycle end-to-end (enroll → dispatch → step_run) → M10#5
- Validação local end-to-end com `supabase db reset` + DB real — Docker Desktop precisa estar rodando; helpers puros + Zod validados via smoke 95/95.

**Pré-requisito de operação:**

- Smoke endpoint não exercita o banco. Validação manual end-to-end exige Docker Desktop subir o stack local Supabase (`supabase start` + `supabase db reset` aplica M10#1 + M10#2 + outras migrations).

### M10#4 — cold-lead-detector (entregue 2026-05-17)

**Branch:** `m10-4-cold-detector`

**Objetivo:** entregar o **2º diferencial do PRD** — avisar antes do negócio esfriar, com defaults por etapa. Schema (`cold_lead_thresholds` + `cold_lead_alerts`) e UI de settings já vieram em M10#1/M10#3; M10#4 entrega a detecção + propagação pra UI em tempo real.

**Decisões fechadas (validadas com usuário antes de implementar):**

- **Push real adiado pra M13** (PWA + Push). M10#4 entrega só in-app + audit. Comentário em [notifications-button.tsx](apps/web/components/app-shell/notifications-button.tsx) original já antecipava.
- **Badge no item "Leads" existente** da sidebar (não criar item dedicado "Frios"). Mesmo padrão do badge unread no "Caixa" (M5#4c).
- **Sem email no M10#4** — gestor vê via in-app + badge + filtro "Frios" na lista. Email digest fica pra milestone futuro (precisa de dispatcher universal).
- **Auto-acknowledge via triggers Postgres** — quando lead responde (estende `pause_cadence_on_inbound` do M10#1) ou muda de etapa (trigger novo `auto_ack_cold_on_stage_change`). Badge zera sozinho sem clique do usuário.

**Entregas:**

- [x] [`supabase/migrations/20260524120000_m10_4_cold_lead_detector.sql`](supabase/migrations/20260524120000_m10_4_cold_lead_detector.sql) — **(1)** RPC `public.cold_lead_detect_candidates(p_limit int DEFAULT 500)` `LANGUAGE sql SECURITY DEFINER SET search_path = public`. JOIN de `leads × cold_lead_thresholds` com `DISTINCT ON (lead_id) ORDER BY threshold.stage_id NULLS LAST` (threshold específico ganha do global). WHERE `threshold.enabled = true AND lead.deleted_at IS NULL AND lead.status = 'ativo' AND lead.temperature <> 'cold' AND lead.cold_alerted_at IS NULL`. `idle_since = COALESCE(last_interaction_at, created_at)`. Retorna `(workspace_id, lead_id, stage_id, threshold_id, days_inactive, idle_since)`. **(2)** `CREATE OR REPLACE` da função `pause_cadence_on_inbound` adicionando UPDATE final em `cold_lead_alerts SET acknowledged_at = NOW(), acknowledged_by_id = NULL WHERE lead_id = X AND acknowledged_at IS NULL` — auto-ack quando lead responde. Trigger M10#1 não precisa ser recriado (CREATE OR REPLACE FUNCTION cobre). **(3)** Trigger novo `auto_ack_cold_on_stage_change` em `leads BEFORE UPDATE OF stage_id` — auto-ack + re-aquece cold→warm quando vendedor move o lead manualmente. Usa `IS DISTINCT FROM` pra evitar fire em no-op. **(4)** pg_cron schedule `cold-lead-detector-hourly` (`0 * * * *`) via `invoke_cold_lead_detector()` SECURITY DEFINER lendo `app.supabase_url` + `app.cold_lead_detector_secret`. Idempotente via `cron.unschedule` prévia.

- [x] [`supabase/functions/cold-lead-detector/index.ts`](supabase/functions/cold-lead-detector/index.ts) — Edge Function Deno. `Deno.serve` valida header `x-cold-lead-detector-secret`. Service Role client. Chama RPC `cold_lead_detect_candidates(500)`. Para cada candidato em batches de 10 com `Promise.allSettled`: INSERT em `cold_lead_alerts (workspace_id, lead_id, threshold_id)` — `23505` (UNIQUE violation) skip silencioso. Pros leads que tiveram alert NOVO: UPDATE `leads SET temperature='cold', cold_alerted_at=NOW()` + INSERT batch em `audit_logs (action='cold_lead_alerted', user_id=NULL, entity=lead, changes={threshold_id, days_inactive, idle_since})`. Retorna `{ok, summary: {scanned, alertedNew, alreadyAlerted, errors}, errors}`.

- [x] [`apps/web/features/cadences/queries.ts`](apps/web/features/cadences/queries.ts) — 3 queries novas + tipo `ColdAlertUI`:
  - `countActiveColdAlerts(workspaceId, userId, role)` → `number`. RBAC fino: Vendedor conta só dos próprios leads (`leads.assignedTo.userId = userId`); Owner/Admin/Manager workspace todo.
  - `listActiveColdAlerts(workspaceId, userId, role, { limit = 30 })` → `ColdAlertUI[]` com JOIN incluindo nome do lead/etapa + `daysInactive` do threshold. Ordenado `triggered_at DESC`.
  - `getActiveColdAlertForLead(workspaceId, leadId, userId, role)` → `ColdAlertUI | null`. Usado pelo banner em `/leads/[id]`.

- [x] [`apps/web/features/cadences/cold-alerts.helpers.ts`](apps/web/features/cadences/cold-alerts.helpers.ts) — **arquivo novo**. Helpers puros extraídos de queries/actions pra vitest poder importar sem cair em `server-only`: `ackColdAlertWhereForRole(workspaceId, userId, role): Prisma.ColdLeadAlertWhereInput` (Vendedor = nested `lead.assignedTo.userId`) + `acknowledgeColdAlertSchema` Zod.

- [x] [`apps/web/features/cadences/actions.ts`](apps/web/features/cadences/actions.ts) — `+acknowledgeColdAlertAction(alertId)`. Padrão idiomático (Zod safeParse → requireRole O/A/M/V → withWorkspace tx → audit `cold_lead_acknowledged` → revalidatePath). RBAC fino check `lead.assignedTo.userId === userId` pra Vendedor. No-op se já foi ack (auto-ack pelo trigger pode rodar em paralelo). Revalida `/leads`, `/leads/[id]`, `/dashboard`.

- [x] [`apps/web/lib/cold-alerts/load-count.ts`](apps/web/lib/cold-alerts/load-count.ts) — **arquivo novo**. 2 helpers Server-only cached por request via React `cache()`: `loadColdAlertsCount()` retorna number (default 0 em qualquer falha) e `loadActiveColdAlerts()` retorna `ColdAlertUI[]` (default `[]`). Resolve user/workspace/role e delega pra queries.ts. Viewer recebe 0/[] (UI esconde).

- [x] [`apps/web/components/app-shell/sidebar-nav.tsx`](apps/web/components/app-shell/sidebar-nav.tsx) — aceita nova prop `coldAlertsCount?: number`. Mesma técnica do badge `/inbox` (M5#4c): mesclado via `React.useMemo` no item `/leads`. Quando 0, badge some.
- [x] [`apps/web/components/app-shell/sidebar.tsx`](apps/web/components/app-shell/sidebar.tsx) + [`topbar.tsx`](apps/web/components/app-shell/topbar.tsx) + [`mobile-nav.tsx`](apps/web/components/app-shell/mobile-nav.tsx) — chamam `loadColdAlertsCount` em `Promise.all` (Sidebar e Topbar) e passam prop pra `SidebarNav` (desktop) + `MobileNav` (mobile). `cache()` garante single round-trip por request mesmo com 2 callers.

- [x] [`apps/web/components/app-shell/notifications-dropdown.tsx`](apps/web/components/app-shell/notifications-dropdown.tsx) — **arquivo novo**. Client component que renderiza o dropdown atual + cold alerts reais no topo (com `ColdAlertRow` clicável que linka pro lead + botão inline "Marcar como visto" otimista). Total unread = `coldAlerts.length + fakeUnread`.
- [x] [`apps/web/components/app-shell/notifications-button.tsx`](apps/web/components/app-shell/notifications-button.tsx) — refatorado de Client puro pra **Server wrapper** que carrega `loadActiveColdAlerts` e passa pro `<NotificationsDropdown>`. Fixture legacy continua viva (full migration pra `notifications` table fica pra M13 conforme decidido).

- [x] [`apps/web/features/cadences/components/cold-alert-banner.tsx`](apps/web/features/cadences/components/cold-alert-banner.tsx) — **arquivo novo**. Banner tom `warning` (amarelo mostarda semântico) + ícone Snowflake no topo de `/leads/[id]` quando o lead tem alert ativo. Botão "Marcar como visto" chama `acknowledgeColdAlertAction` com optimistic dismissal.
- [x] [`apps/web/app/(dashboard)/leads/[id]/page.tsx`](<apps/web/app/(dashboard)/leads/[id]/page.tsx>) — adiciona `getActiveColdAlertForLead(workspaceId, leadId, userId, role)` ao `Promise.all` existente. Passa `activeColdAlert` pro view.
- [x] [`apps/web/app/(dashboard)/leads/[id]/lead-detail-view.tsx`](<apps/web/app/(dashboard)/leads/[id]/lead-detail-view.tsx>) — aceita prop `activeColdAlert: ColdAlertUI | null`. Encaixa `<ColdAlertBanner>` logo após o `PageHeader` (acima dos "Negócios em aberto" + grid).

- [x] [`apps/web/features/cadences/cold-alerts.test.ts`](apps/web/features/cadences/cold-alerts.test.ts) — **arquivo novo, vitest**. 7 testes cobrindo `acknowledgeColdAlertSchema` (aceita UUID/rejeita string/rejeita undefined) + `ackColdAlertWhereForRole` (Vendedor → filtro nested, Owner/Admin/Manager → workspace todo).
- [x] [`apps/web/app/api/smoke-test/cadences/route.ts`](apps/web/app/api/smoke-test/cadences/route.ts) — **+5 checks** no grupo `cold-detector-m10`: `auditAction` tem `cold_lead_alerted` + `cold_lead_acknowledged`; shape do payload da RPC (6 chaves obrigatórias); contract test do UNIQUE `(lead_id, threshold_id)`.

- [x] `pnpm --filter @papopro/db db:generate` ✅, `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅ (zero warnings), `pnpm --filter @papopro/web build` ✅, `pnpm test` ✅ (vitest M10#3 + M10#4 = 13 testes verdes).

**Decisões fechadas M10#4:**

- **Edge Function NÃO faz fanout externo** — diferente do `cadence-runner` (que POSTa pra rota Next), aqui é detect → insert → done. Notificação acontece via query no NotificationsButton/badge sidebar (in-app). Push real é M13.
- **`leads.cold_alerted_at` evita re-alerta em loop** — uma vez setado, RPC ignora o lead. Trigger inbound + stage_change zeram esse campo quando há sinal de re-engajamento. **MVP não re-alerta** após ack manual — `cold_alerted_at` continua setado até o lead responder/mudar etapa.
- **Auto-ack diferencia de manual** via `acknowledged_by_id = NULL` (auto) vs `userId` real (manual). Audit log preserva isso.
- **Notification dropdown mistura cold real + fixture legacy** — `Marcar todas como lidas` continua mock pros fakes; cold alerts exigem ação explícita ou auto-ack.
- **Filtro por temperatura na listagem `/leads`** já existia (lead-filters.tsx) — escopo M10#4 NÃO adiciona `?temperature=cold` via search params. Sidebar badge linka pra `/leads` simples; usuário usa o chip "Frio" existente. Polimento pra search params fica pra M10.x.

**Não-objetivos M10#4 (explícitos):**

- Push notifications reais (Web Push + VAPID + service worker) → M13 (PWA + Push)
- Email pro gestor (individual ou digest) → M10#5+ (precisa dispatcher universal)
- Search params `?temperature=cold` na lista de leads → polimento futuro
- Realtime listener pra cold alerts que chegam enquanto a página tá aberta → V2
- Re-alerta automático após N dias do ack → V2 (decisão MVP: ack é definitivo até lead responder/mudar etapa)
- Tela de reports com volume de cold leads → M10#5
- Smoke endpoint lifecycle end-to-end (detect → insert → ack) com DB real → M10#5

**Ops pós-deploy (fora do PR — adiar pra pré-launch junto com M10#2):**

1. `supabase secrets set COLD_LEAD_DETECTOR_SECRET=<random64>` (CLI ou Dashboard)
2. SQL no Editor: `ALTER DATABASE postgres SET app.cold_lead_detector_secret = '<mesmo>';`
3. MCP `deploy_edge_function name=cold-lead-detector` ou `supabase functions deploy cold-lead-detector`
4. MCP `apply_migration name=m10_4_cold_lead_detector` (depende de M10#1 + M10#2 já aplicadas)
5. Validar: `SELECT * FROM cron.job WHERE jobname = 'cold-lead-detector-hourly'`; `SELECT * FROM cron.job_run_details ORDER BY end_time DESC LIMIT 5` mostra invocações horárias

---

**Review fixes pós-M10#3 (mesmo PR):**

3 achados de review embutidos antes do merge em `dev`:

- **P1 — stageId UUID end-to-end.** Schema/transforms/dialog/editor usavam `DEFAULT_STAGES` (fixture com slugs `'novo'`/`'em_contato'`/...), mas `cadences.stage_id` é UUID real de `pipeline_stages`. Cadências reais sumiam do agrupamento em `/cadences` e o modal de criação rejeitava o submit. Fix: [page.tsx](<apps/web/app/(dashboard)/cadences/page.tsx>) carrega `listDefaultPipeline` em paralelo e propaga `stages` via prop; [transforms.ts](apps/web/features/cadences/transforms.ts) `groupCadencesByStage(cadences, stages)` agora recebe stages explícitas; [schemas.ts](apps/web/features/cadences/schemas.ts) `stageId: z.string().uuid()`; [actions.ts](apps/web/features/cadences/actions.ts) `loadActiveStageInWorkspace` valida ownership + recusa terminal em create/update (defesa-em-profundidade); [cadence-create-dialog.tsx](apps/web/features/cadences/components/cadence-create-dialog.tsx) resolve slug→UUID do template (`tpl.defaultStageId='novo'` → UUID equivalente) antes do submit; editor de `/cadences/[id]` também migrado.
- **P1 — RPC `cadence_runner_pick_candidates` guarda `scheduled_for`.** Nova migration [20260523120000_m10_runner_guard_scheduled_for.sql](supabase/migrations/20260523120000_m10_runner_guard_scheduled_for.sql) adiciona `AND (e.enrolled_at + s.day_offset days) <= NOW()` à RPC. Sem isso, `backoffAfterTransientBlock` (+30min em `enrollment.next_run_at` quando bloqueio transiente) fazia a RPC pegar D+1, D+3 etc. como "próximo step não-executado" em 30 min, comprimindo cadências de dias em minutos. Corrige só a compressão — "retry do MESMO step em transient block" continua adiado pra M10.x (decisão fechada).
- **P2 — `pnpm test` real (vitest).** Antes rodava `turbo run test` com zero pacotes tendo script `test`, dando falsa sensação de cobertura. Adicionado [vitest.config.ts](apps/web/vitest.config.ts) (env Node, `features/**/*.test.ts` + `lib/**/*.test.ts`), script `"test": "vitest run"` e devDep `vitest@^2.1.8`. Primeiro arquivo [transforms.test.ts](apps/web/features/cadences/transforms.test.ts) cobre P1#1 (agrupamento por UUID, exclusão de terminais, ordem do pipeline, lista vazia, schema UUID) — 6 testes, todos passando. Playwright E2E continua em `e2e/` rodando via `pnpm e2e`.

Checks: typecheck ✅, lint (max-warnings=0) ✅, build ✅, `pnpm test` ✅ (1 task, 6/6).

---

### M10#5 — reports (seção "Cadências") + smoke contratos + fechamento PLAN (entregue 2026-05-17)

**Branch:** `m10-5-reports-smoke`

**Objetivo:** fechar o motor M10 dando visibilidade ao gestor das duas alavancas — volume disparado e leads esfriando — sem migrar o resto de `/reports`, que segue fixture-client. M10#1-#4 já entregaram o motor + UI de configuração; M10#5 é a vitrine analítica.

**Decisão de escopo:** **híbrido** em `/reports` (validado com usuário). Só a nova seção é server-fed real (Prisma + RLS via `withWorkspace`); KPIs/funil/rep performance/cooling existentes continuam TanStack Query + fixtures NOW=2026-05-09. Migração total fica pra M10.x ou M13.

**Decisão de scope alt 2:** **smoke puro** (sem tocar DB). Lifecycle end-to-end (enroll → dispatch → step_run com adapter mockado) ficaria caro pra rodar em CI sem Docker — segue manual via `supabase db reset` documentado no body do PR. Os checks novos são contratos puros que fecham brechas dos M10#2/M10#4.

**Entregas:**

- [x] [`apps/web/features/cadences/reports.helpers.ts`](apps/web/features/cadences/reports.helpers.ts) — **arquivo novo, puro** (sem `'server-only'`, sem Prisma): `computeResponseRate(replied, enrolled)` clampa [0,1] + protege contra divide-by-zero + NaN; `formatRate(rate, fraction=0)` formata pt-BR com vírgula decimal sem `Intl.NumberFormat` (evita drift de locale entre Vercel/dev); `sortCadenceReportRows` sort `dispatched30d DESC` com tiebreak alfabético pt-BR estável; `filterColdRowsForChart` drop zeros antes da BarChart; `ANTI_BAN_SKIP_REASONS = ['rate_limit','unhealthy','outside_business_hours']` const tipado.
- [x] [`apps/web/features/cadences/queries.ts`](apps/web/features/cadences/queries.ts) — **+3 queries server-only + 3 tipos**:
  - `getCadenceReportsSummary(workspaceId)` → `CadenceReportsSummary` (4 KPIs: cadências ativas, inscrições ativas, mensagens 30d, taxa resposta 30d). 1 round-trip via subqueries escalares — sem JOIN, cada subquery toca 1 tabela.
  - `listCadenceReportsByCadence(workspaceId)` → `CadenceReportRow[]` agregação cross-cadência via `$queryRaw` com 2 LATERAL JOINs (enrollment + step_run) pra evitar multiplicação de linhas. Ordem `dispatched_30d DESC, name ASC`.
  - `listColdAlertsByStage(workspaceId, userId, role)` → `ColdByStageRow[]` Prisma `findMany` cold alerts + JOIN com pipeline default + groupBy in TS. Reusa `ackColdAlertWhereForRole` pra RBAC fino (Vendedor só vê alerts dos próprios leads).
- [x] [`apps/web/app/(dashboard)/reports/cadences-reports-section.tsx`](<apps/web/app/(dashboard)/reports/cadences-reports-section.tsx>) — **Server Component novo**. KPI strip (4 cards, mesma estética de `SummaryKpis`), tabela "Performance por cadência" (HTML semântica, padrão `RepPerformanceTable`, linka pra `/cadences/[id]`), wraps a BarChart via `<ColdByStageChart>` Client. EmptyState propositivo em cada bloco vazio.
- [x] [`apps/web/app/(dashboard)/reports/cold-by-stage-chart.tsx`](<apps/web/app/(dashboard)/reports/cold-by-stage-chart.tsx>) — **Client Component novo**. Recharts BarChart (SVG client-only), cor `hsl(var(--warning))` alinhada com banner `ColdAlertBanner` (M10#4). Aplica `filterColdRowsForChart` no client (esconde etapas com 0 leads frios). `isAnimationActive={false}` evita flicker em revalidatePath.
- [x] [`apps/web/app/(dashboard)/reports/page.tsx`](<apps/web/app/(dashboard)/reports/page.tsx>) — refatorado de Server Component fino (só metadata + render client) pra Server Component que carrega 3 queries via `Promise.allSettled` (uma quebrada não derruba as outras), `dynamic = 'force-dynamic'`, `redirect('/login')` sem sessão, `redirect('/onboarding')` sem membership. `reportNonFatal` em cada query rejeitada — UI degrada com `[]`/zerado, sem 500.
- [x] [`apps/web/app/api/smoke-test/cadences/route.ts`](apps/web/app/api/smoke-test/cadences/route.ts) — **+3 grupos com 22 checks novos**:
  - `cadence-reports-m10` (13) — `computeResponseRate` (zero denominator, ratio normal, clamp >1/<0, NaN-safe); `formatRate` (default 0 fraction, fraction digits pt-BR com vírgula, clamp invalid); `sortCadenceReportRows` (desc + tiebreak estável); `filterColdRowsForChart` (drop zeros + empty stays empty); `ANTI_BAN_SKIP_REASONS` const cobre 3 razões esperadas.
  - `cadence-dispatch-contracts-m10` (6) — `dispatchPayloadSchema.strict()` rejeita 2 props inéditas; `mapAntiBanToSkipReason` mapeia todas 6 razões; `isPermanentBlock` retorna false pras 5 razões transientes (regressão M10#4); `computeBackoffNextRunAt` delta exato (30min e 15min custom); `DAY_OFFSETS` ordem [0,1,3,7,14,30] preservada; `pickNextStep` estável dentro do mesmo dayOffset por order_index.
  - `cold-detector-contracts-m10` (5) — `acknowledgeColdAlertSchema` aceita UUID válido / rejeita string não-UUID / rejeita prop ausente; `ackColdAlertWhereForRole` Owner/Admin/Manager workspace-wide (sem nested filter) / Vendedor com nested `lead.assignedTo.userId` / Viewer não throw.
- [x] **Total smoke `/api/smoke-test/cadences`: 117/117 verde** (95 anteriores + 22 novos).
- [x] `pnpm --filter @papopro/db db:generate` ✅, `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅ (zero warnings), `pnpm --filter @papopro/web build` ✅, `pnpm test` ✅.

**Decisões fechadas M10#5:**

- **Híbrido em `/reports`** — só a nova seção é server-fed real; KPIs/funil/rep performance/cooling existentes continuam fixture-client. Validado com usuário antes de implementar. Migração total fica pra M10.x ou M13.
- **Smoke puro (sem DB)** — validado com usuário. Lifecycle real continua manual via `supabase db reset` documentado no body do PR. Adicionar `/api/smoke-test/cadences/lifecycle` que toca DB com workspace fixture + cleanup foi descartado: precisa Docker no CI ou desabilitar lá, mais fragilidade.
- **Sem date range filter** — mantém o padrão dos outros cards de `/reports` (window hardcoded). DateRangePicker entra em iteração futura, fora de M10.
- **`reportNonFatal` + `Promise.allSettled`** — uma query quebrada (RLS/migration desincronizada/Prisma type drift) degrada graciosamente. Erro vai pro Sentry, UI mostra vazio. Não é regressão visível pro usuário.
- **`computeResponseRate` clampa [0,1]** — em teoria SQL nunca produz `replied > enrolled` (FILTER usa o mesmo predicado), mas defesa-em-profundidade contra drift de schema ou bug futuro de janela divergente.
- **`formatRate` sem `Intl.NumberFormat`** — Vercel default `en-US` produziria `12.5%`; queremos `12,5%` consistente. Manual + `.replace('.', ',')` é mais simples e previsível.
- **BarChart usa `warning` (mostarda)** — alinha visualmente com `<ColdAlertBanner>` (M10#4). Não usa `destructive` (vermelho de "lead frio na sidebar") porque o painel é analítico, não alerta acionável.
- **`Bloqueios anti-ban 30d` tem coluna própria** (não embutida no Disparadas) — diferencia volume útil de bloqueio operacional. Cresce muito = problema com a conexão WhatsApp, não com a cadência.
- **Cadências `paused` aparecem na tabela** (não filtradas) — gestor precisa ver performance histórica delas mesmo pausadas. Status badge informa.
- **Filtro de cold por etapa terminal** — etapas terminais (`ganho`/`perdido`) ficam fora do BarChart por padrão. Lead em `ganho` nunca esfria; em `perdido` faz menos sentido alertar.

**Não-objetivos M10#5 (explícitos):**

- Migração de KPIs/funil/rep performance/cooling pra server-fed → M10.x ou M13
- Date range filter (DateRangePicker + searchParams) → iteração futura
- Endpoint smoke lifecycle que toca DB → descartado; manual via `supabase db reset`
- Export CSV da tabela de performance → V2 (depende do dispatcher de export pesado do PRD §3.5)
- Notificação push pro gestor quando taxa de resposta cai → M13 (junto com PWA + Push)
- Optimistic UI nas mutações de cadência → sem necessidade (pessimismo total decidido em M10#3)
- Smoke endpoint protegido por auth (continua dev-only sem header secret) — issue separada se vier a ser exposto em produção

**Ops pós-deploy:** none — sub-PR é pure code (Server Component + helpers TS + smoke). Não cria Edge Function, não muda migration, não muda cron job. Reusa toda a base de M10#1–#4 já documentada nas seções acima.

**Release final M10 incluso neste PR.** Como M10#5 é o último sub-PR e fecha o milestone, o flip do header `parcial → completo` + a row da tabela de release entram aqui mesmo. Release PR `dev → main` subsequente carrega apenas commits sem mudança de docs.

---

## Release: M10 motor de cadência + alertas de lead frio (completo — 17-mai-26)

**Dois PRs de release.** Primeiro batch (M10#1–#4 + M8#6 fix) saiu em [`#74 dev → main`](https://github.com/Mateusli23/papopro/pull/74), commit de merge `a41b757`. Fechamento (M10#5) sai em release subsequente — mesma data, batch menor pra aproximar validação do deploy seguindo estratégia M7#1–#5.

**Conteúdo do release:**

| Sub-PR   | Branch (deletada)            | PR                                                   | Resumo                                                                                                                                                                                                                    |
| -------- | ---------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M10#1    | `m10-1-schema-seed`          | [#69](https://github.com/Mateusli23/papopro/pull/69) | Schema 6 tabelas cadence\_\* + ALTER leads (temperature + cold_alerted_at) + trigger `pause_cadence_on_inbound` + seed 3 templates + 5 cold thresholds default + backfill                                                 |
| M8#6 fix | `m8-6-storage-comment-local` | [#70](https://github.com/Mateusli23/papopro/pull/70) | Hotfix `COMMENT ON POLICY storage.objects` compat com user `postgres` Docker local (destrava `supabase db reset` em dev local)                                                                                            |
| M10#2    | `m10-2-cadence-runner`       | [#71](https://github.com/Mateusli23/papopro/pull/71) | Edge Function `cadence-runner` (Deno, 5min via pg_cron) + rota interna `/api/internal/cadence-dispatch` (anti-ban + uazapi) + RPC + helpers + smoke +17                                                                   |
| M10#3    | `m10-3-ui-wiring`            | [#72](https://github.com/Mateusli23/papopro/pull/72) | UI conectada (hydrate-from-server) + Prisma models + 12 Server Actions + métricas reais + seção "Cadências" no lead + settings cold-thresholds + 3 review fixes pré-merge                                                 |
| M10#4    | `m10-4-cold-detector`        | [#73](https://github.com/Mateusli23/papopro/pull/73) | Edge Function `cold-lead-detector` (Deno, 1h via pg_cron) + RPC detect + auto-ack triggers (com audit log) + acknowledgeColdAlertAction + badge sidebar + cold no sino + banner no lead detail + 8 review fixes pré-merge |
| M10#5    | `m10-5-reports-smoke`        | (release subsequente)                                | Seção "Cadências" em `/reports` server-fed (KPI strip + tabela performance + BarChart lead frio) + smoke +24 contratos puros (helpers/Zod) — fecha M10                                                                    |

**Diferenciais do PRD entregues no release:**

1. **Motor de cadência automática** (PRD #1) ✅ funcional ponta-a-ponta — vendedor cria/ativa cadência → enroll lead → Edge runner agenda → rota dispatch executa via uazapi com anti-ban → step_run sent + audit + advance enrollment.
2. **Alertas de lead frio por etapa** (PRD #2) ✅ funcional — Edge detector roda 1h → popula `cold_lead_alerts` → badge sidebar + sino + banner → auto-ack quando lead responde ou muda de etapa (audit `auto=true`).

**Configuração pendente do operador pós-release** (consolidada de M9#5 + M10#2 + M10#4, listada no body do PR #74):

- Deploy 3 Edge Functions: `whatsapp-heartbeat` (M9#5, já deployada anteriormente), `cadence-runner` (M10#2), `cold-lead-detector` (M10#4)
- Secrets via `supabase secrets set`: `HEARTBEAT_SECRET`, `CADENCE_RUNNER_SECRET`, `CADENCE_DISPATCH_SECRET`, `COLD_LEAD_DETECTOR_SECRET`, `APP_URL`, `UAZAPI_BASE_URL`, `UAZAPI_API_KEY`
- `ALTER DATABASE postgres SET app.{supabase_url, heartbeat_secret, cadence_runner_secret, cold_lead_detector_secret}`
- Aplicar migrations na ordem: `m10_1_cadence_schema` → `m10_2_cadence_runner_cron` → `m10_runner_guard_scheduled_for` → `m10_4_cold_lead_detector`
- Validar `cron.job` ativo: 3 jobs (`whatsapp-heartbeat-every-minute`, `cadence-runner-every-5-min`, `cold-lead-detector-hourly`)

**M10 completo.** Próximo milestone: **M11** (Agentes IA + Cérebro da Empresa em pgvector).

---

## M11 — Agentes IA + Cérebro da Empresa (pgvector)

**Estratégia:** sub-PRs sequenciais sobre `dev` (mesmo padrão de M8/M9/M10/M12). M11#1 entrega o foundation de persistência (schema + RLS + Prisma + smoke contratos). Sub-PRs subsequentes (#2–#7) constroem lib/ai, UI, KB, runtime, handoffs e métricas.

| Sub-PR    | Escopo                                                                                                                                                                                                                                           | Branch            | Status      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ----------- |
| **M11#1** | Schema (10 tabelas + 7 enums + 8 audit_action) + RLS + Prisma sync + smoke contratos (18 checks novos). pgvector já habilitado.                                                                                                                  | `m11-ai-agents`   | ✅ entregue |
| **M11#2** | `lib/ai/` (5 arquivos: pricing/usage/claude/embeddings/memory) + `usage_events` schema + SDKs (`@anthropic-ai/sdk` + `openai`) + smoke 28 checks. Prompt caching, retry built-in, top-K pgvector, lead summary background.                       | `m11-2-ai-lib`    | ✅ entregue |
| **M11#3** | UI hidratada do servidor + 16 Server Actions (CRUD agente + versionamento + roteamento + handoff config + KB campos + simulation real Claude) + helper `buildSystemPrompt` + smoke 52 contratos. Store M5 + fixtures deletados.                  | `m11-3-ui-wiring` | ✅ entregue |
| **M11#4** | Cérebro upload (PDF/TXT/MD) + extração + chunking + embedding síncrono + Storage bucket `knowledge-base` + re-indexação automática dos 5 campos estruturados em `updateKnowledgeBaseAction` + smoke chunking (11 checks). DOC/DOCX em follow-up. | `m11-4-knowledge` | ✅ entregue |
| **M11#5** | Roteador em runtime — match na chegada de mensagem (etapa/tag/número/keyword, primeiro hit), persiste `agent_sessions`, despacha pro Claude com memória 3 camadas. Integra com webhook uazapi M9.                                                | `m11-5-router`    | ⏳ pendente |
| **M11#6** | Handoffs — agente→agente (keyword/etapa/comando, resumo automático passado, pausa o anterior) + agente→humano (manual via botão "Assumir", keyword, intenção comercial, mudança pra Negociação, fora do horário).                                | `m11-6-handoffs`  | ⏳ pendente |
| **M11#7** | Métricas por agente em `/reports` (total conversas, taxa resolução sem handoff, tempo médio resposta, satisfação inferida via sentimento). Enforcement de 3 agentes ativos no Pro IA (reusa pattern M12#4 limits.ts).                            | `m11-7-metrics`   | ⏳ pendente |

**Commit final do milestone:** `feat(ai): claude agents with 3-layer memory, pgvector knowledge base and handoffs`

### M11#1 — schema + RLS + Prisma sync + smoke contratos (entregue 2026-05-17)

**Branch:** `m11-ai-agents`

**Objetivo:** entregar a fundação persistente de M11 sem qualquer Server Action, lib/ai ou UI wiring. Garante que o domínio (10 tabelas + 7 enums) está modelado fielmente ao contrato fechado em M5 (`apps/web/features/agents/types.ts`), com RLS multi-tenant, AuditAction values reservados, e smoke validando shape antes do código de runtime chegar (M11#2+).

**Decisões de escopo:**

- **10 tabelas, não 11.** `agent_handoff_triggers` colapsado em coluna `handoff_config jsonb` em `ai_agents`. Justificativa: os 6 gatilhos são fixos por design (M5 types.ts), `enabled` + `config` por gatilho cabem em JSONB, e tabela separada teria sempre 6 rows fixas por agente — overhead sem ganho. Shape validado por Zod no Server Action (M11#3).
- **`knowledge_embeddings` separada de `knowledge_chunks`.** Permite re-embed (mudou de modelo) sem rewrite de chunks + isola HNSW index numa tabela menor (chunks tem `text` grande; embeddings tem só `vector(1536)`).
- **Reuso de `message_direction`** pra `agent_messages.direction` (mesma semântica in/out — não vale criar enum duplicado).
- **Sem seed em M11#1.** Diferente de M10#1 (cadências template seedadas no signup), agentes IA + KB são criação explícita do usuário via UI (M11#3+). Seed atrapalharia onboarding ("você já tem 3 agentes mockados").
- **`usage_events` fica pra M11#2.** Schema de metering cross-feature criado junto com `lib/ai/claude.ts`. M11#1 já reserva os 4 campos de tokens em `agent_messages` (input/output/cache_read/cache_creation) — contabilização local já funciona; agregação global vem depois.
- **Tipo `vector(1536)` via `Unsupported`** no Prisma. Decisão obrigatória: Prisma 6 não tipa pgvector nativamente. `Unsupported("vector(1536)")` faz o client reconhecer a coluna sem permitir leitura/escrita via API tipada — queries top-K via `$queryRaw` (que é o que pgvector exige pra `<=>` cosine operator de qualquer jeito).

**Entregas:**

- [x] [`supabase/migrations/20260526120000_m11_1_ai_agents_schema.sql`](../supabase/migrations/20260526120000_m11_1_ai_agents_schema.sql) — **10 tabelas + 7 enums + 8 audit_action values + RLS + HNSW index**:
  - **Agentes (5):** `ai_agents`, `agent_versions`, `agent_routing_rules`, `agent_sessions`, `agent_messages`
  - **Memória lead (1):** `lead_summaries` (UNIQUE em `lead_id`, compartilhado entre agentes)
  - **Cérebro da Empresa (4):** `knowledge_base_fields` (singleton por workspace), `knowledge_documents`, `knowledge_chunks`, `knowledge_embeddings` (vector(1536), HNSW cosine)
  - **Enums:** `agent_status`, `agent_tone`, `agent_route_kind`, `agent_session_kind`, `knowledge_source_kind`, `knowledge_doc_status`, `knowledge_doc_kind`
  - **AuditAction values novos:** `agent_created`, `agent_version_saved`, `agent_activated`, `agent_paused`, `agent_deleted`, `handoff_triggered`, `knowledge_doc_uploaded`, `knowledge_doc_processed`
  - **CHECK constraint crítico** em `agent_sessions`: `kind=production` exige `conversation_id + lead_id NOT NULL`; `kind=simulation` exige ambos NULL. Impede sessão de teste tocar lead real por engano.
  - **CHECK constraint crítico** em `knowledge_chunks`: `source=document` exige `document_id`; `source=structured_field` exige `structured_field` (discriminação rígida).
  - **FK circular `ai_agents.active_version_id` → `agent_versions.id`** resolvida via `ALTER TABLE ADD CONSTRAINT` após criação das duas tabelas. `ON DELETE SET NULL` (delete de versão NÃO cascateia pro agente).
  - **RLS via `current_workspace_id()`** em todas as 10 tabelas, padrão M7–M10/M12. `agent_versions` + `agent_routing_rules` herdam via subquery `agent_id IN (SELECT id FROM ai_agents WHERE workspace_id = …)` (padrão `cadence_steps`/`pipeline_stages`).
  - **`agent_messages` é append-only** — sem policy UPDATE/DELETE (audit + tokens preservados).
  - **HNSW index** `USING hnsw (embedding vector_cosine_ops)` em `knowledge_embeddings` — pronto pra busca top-K via `<=>` operator. Parâmetros default (m=16, ef_construction=64) suficientes pra volumes MVP.
  - **Sem backfill** — workspaces existentes ficam sem agentes nem KB até o usuário criar via UI (M11#3+).
- [x] [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma) — sync completo com SQL:
  - **+7 enums** (`AgentStatus`/`AgentTone`/`AgentRouteKind`/`AgentSessionKind`/`KnowledgeSourceKind`/`KnowledgeDocStatus`/`KnowledgeDocKind`)
  - **+8 `AuditAction` values** espelhando ALTER TYPE
  - **+10 models** (`AiAgent`, `AgentVersion`, `AgentRoutingRule`, `AgentSession`, `AgentMessage`, `LeadSummary`, `KnowledgeBaseField`, `KnowledgeDocument`, `KnowledgeChunk`, `KnowledgeEmbedding`)
  - **Relations** em `Workspace` (+8 navigations), `User` (+3 `@relation`s nomeadas: `AiAgentCreatedBy`, `AgentVersionCreatedBy`, `KnowledgeDocumentUploadedBy`), `Lead` (+`summary`+`agentSessions`), `Conversation` (+`agentSessions`).
  - **FK circular** modelada via 2 `@relation`s nomeadas em `AgentVersion` (`AiAgentVersions` pra histórico + `AiAgentActiveVersion` pro ponteiro).
  - **`embedding Unsupported("vector(1536)")`** — única coluna que não passa pela API tipada do Prisma (acessada via `$queryRaw` em M11#2+).
- [x] [`packages/db/src/index.ts`](../packages/db/src/index.ts) — re-export dos 7 enums novos pra que smoke + Server Actions (M11#3) importem via `@papopro/db` (mesmo padrão `SubscriptionPlan`/`CadenceStatus`).
- [x] [`apps/web/app/api/smoke-test/agents/route.ts`](../apps/web/app/api/smoke-test/agents/route.ts) — **+19 checks novos** em 3 grupos, sem hit no DB:
  - `db-enums-m11` (9): cada um dos 7 enums tem o set exato de values + AgentStatus/AgentRouteKind casam com `AGENT_STATUSES`/`ROUTE_KINDS` da UI M5 (anti-regressão de contrato).
  - `audit-actions-m11` (8): cada um dos 8 audit values novos existe no enum.
  - `db-handoff-config-shape-m11` (2): `HANDOFF_TRIGGER_KINDS` tem 6 valores + cobre os 6 esperados (contrato JSONB).
  - Total smoke `/api/smoke-test/agents`: era 71 (M5 transforms), passa pra **90**.
- [x] `pnpm --filter @papopro/db db:generate` ✅, `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅ (zero warnings), smoke `/api/smoke-test/agents` **90/90 verde** ✅.

**Não-objetivos M11#1 (explícitos — ficam pra sub-PRs):**

- `lib/ai/{claude,embeddings,memory}.ts` → M11#2
- `usage_events` schema (metering cross-feature) → M11#2
- Server Actions de agente (`createAgent`/`saveVersion`/`activate`) → M11#3
- UI hidratada do servidor (editor + lista) → M11#3
- Server Actions de roteamento (`addRoute`/`reorderRoutes`/`deleteRoute`) → M11#3
- Chat de simulação chamando Claude real → M11#3
- Upload de documento + Edge Function de chunking+embedding → M11#4
- Trigger inbound (uazapi webhook) → match no roteador → cria session → despacha Claude → M11#5
- Handoffs agente→agente e agente→humano → M11#6
- Métricas por agente + enforcement de 3 ativos no Pro IA → M11#7
- E2E Playwright do flow "criar agente → conectar → atender" → M13

**Ops pós-deploy (vai no body do PR):**

1. Aplicar migration via MCP `apply_migration name=m11_1_ai_agents_schema` (depende de M12#1 já aplicada).
2. Validar via `SELECT typname FROM pg_type WHERE typname LIKE 'agent_%' OR typname LIKE 'knowledge_%'` — esperado 7 tipos.
3. Validar HNSW index criado: `SELECT indexname FROM pg_indexes WHERE indexname = 'knowledge_embeddings_hnsw_idx'`.
4. **Nada mais** — sem Edge Function, sem cron job, sem secret, sem env var.

### M11#2 — lib/ai/ + usage_events + SDKs Anthropic/OpenAI (entregue 2026-05-17)

**Branch:** `m11-2-ai-lib`

**Objetivo:** entregar o motor de IA — a camada `apps/web/lib/ai/` que Server Actions (M11#3) e Edge Functions (M11#4/#5) vão importar pra chamar Claude, gerar embeddings, e montar a memória 3 camadas em runtime. Sem UI, sem chamadas reais no smoke (zero hit Anthropic/OpenAI). Schema mínimo (`usage_events`) pra metering cross-feature de custo IA.

**Decisões fechadas:**

- **`usage_events` tabela única, não uma por kind.** Padrão `audit_logs`/`webhook_events` (1 tabela + enum discriminador). Evita N migrations futuras pra `summary_call`/`transcription_call`/etc. Schema do payload (tokens + cost) é estável entre kinds.
- **`cost_micros` é bigint USD × 10⁶.** Evita float drift em `SUM` de milhões de rows. `bigint` cobre até ~$9.2T (suficiente).
- **Preço armazenado em `micros/1M tokens`, não `micros/token`.** Cache read $0.30/1M = 0.3 micros/token truncaria pra 0 em integer; embedding $0.02/1M = 0.02 micros/token idem. Em micros/1M (300_000 e 20_000) tudo vira integer perfeito; dividimos por 1M no final (perda ≤ 1 micro/chamada, irrelevante).
- **Sonnet 4.6 default** (env `ANTHROPIC_MODEL`). Haiku 4.5 disponível pra workspaces que aceitem qualidade menor por ~4× custo a menos.
- **`text-embedding-3-small`** (1536 dims, $0.02/1M) — alinha com decisão M11#1 (`vector(1536)` na schema).
- **Non-streaming pra agentes.** Decisão M11#2: resposta inteira de uma vez (mensagem WhatsApp, baixa latência ≠ urgente). Streaming entra em M11#3 quando chat de simulação no editor precisar.
- **Retry built-in do SDK.** Anthropic e OpenAI SDKs têm `maxRetries` com backoff exponencial em 429/5xx. Setamos 3 (default é 2). Não reimplementamos loop manual.
- **Prompt caching obrigatório** (CLAUDE.md §6). System + cacheableBlocks em até 4 system text blocks com `cache_control: ephemeral`. Quando >3 cacheable blocks chegam, consolidamos num único block (sacrifica granularidade, mantém o teto Anthropic).
- **`vector(1536)` via `$queryRaw`/`$executeRaw`** — decisão M11#1. Top-K usa `<=>` (cosine distance), upsert usa `ON CONFLICT (chunk_id) DO UPDATE`.
- **Cache local em memória (sha1) — não distribuído.** `Map<hash, vector>` por processo. Dedup eficaz dentro do mesmo cold start (re-indexação, retries). Redis fica pra V2 quando o volume justificar.
- **`claude.ts`/`embeddings.ts`/`memory.ts` não persistem.** Wrappers de API retornam `{ text, usage, ... }`. Caller (Server Action de M11#3) chama `recordUsage(...)` + `prisma.agentMessage.create(...)` separado. Mantém wrappers testáveis sem mock de DB.
- **Memória 3 camadas montada em paralelo** quando possível. `assembleContext` dispara 3 promises (sessão + lead + embed query) em `Promise.all`, depois resolve top-K que depende do embed.

**Entregas:**

- [x] [`supabase/migrations/20260527120000_m11_2_usage_events_schema.sql`](../supabase/migrations/20260527120000_m11_2_usage_events_schema.sql) — tabela `usage_events` + enum `usage_event_kind` (3 values) + RLS (SELECT/INSERT por workspace; append-only) + 3 indexes (workspace+created, workspace+kind+created, entity partial).
- [x] [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma) + [`packages/db/src/index.ts`](../packages/db/src/index.ts) — `UsageEventKind` enum + `UsageEvent` model (com `BigInt` em `costMicros`) + relation em `Workspace`. Re-export do enum.
- [x] [`apps/web/package.json`](../apps/web/package.json) — `@anthropic-ai/sdk@^0.96.0` + `openai@^6.38.0`. Instalação no Windows precisou `NODE_OPTIONS=--use-system-ca` + `--ignore-scripts` (antivírus interceptando TLS, memória `dev-local-windows-antivirus-tls`).
- [x] [`apps/web/lib/ai/pricing.ts`](../apps/web/lib/ai/pricing.ts) — `ANTHROPIC_PRICING_MICROS_PER_MILLION` + `OPENAI_PRICING_MICROS_PER_MILLION` (snapshot 2026-05-17). `computeCostMicros(model, usage) → bigint` puro + sanity checks (negativo, modelo desconhecido). `getDefaultAnthropicModel`/`getDefaultEmbeddingModel`.
- [x] [`apps/web/lib/ai/usage.ts`](../apps/web/lib/ai/usage.ts) — `recordUsage({ workspaceId, eventKind, feature, model, usage, entityKind?, entityId? })` via `withWorkspace(tx)` + cálculo automático de `cost_micros`. Sem UPDATE/DELETE (tabela append-only).
- [x] [`apps/web/lib/ai/claude.ts`](../apps/web/lib/ai/claude.ts) — lazy singleton `getAnthropic()` (server-only + throw em falta de API key) + `complete({ workspaceId, sessionId, feature, system, cacheableBlocks?, messages, model?, maxTokens? }) → { text, usage, model, stopReason }`. System blocks com `cache_control: ephemeral` (1 system + ≤3 KB chunks; consolidação automática se >3). `maxRetries: 3` no construtor.
- [x] [`apps/web/lib/ai/embeddings.ts`](../apps/web/lib/ai/embeddings.ts) — lazy singleton `getOpenAI()` + `embedTexts({ workspaceId, texts, model? }) → { embeddings, usage, model, cacheHits }`. Batch de até 96 + dedup via `hashEmbeddingInput(text, model)` sha1 + cache local `Map`. `upsertChunkEmbedding({ workspaceId, chunkId, vector, model })` via `$executeRaw` com `ON CONFLICT (chunk_id) DO UPDATE`. `clearEmbeddingCache`/`getEmbeddingCacheSize` pra observabilidade.
- [x] [`apps/web/lib/ai/memory.ts`](../apps/web/lib/ai/memory.ts) — `assembleContext({ workspaceId, agentId, sessionId?, leadId?, latestUserMessage, topK?, sessionMessagesTake? }) → { sessionMessages, leadSummary, knowledgeChunks, cacheableBlocks }`. `topKKnowledge({ workspaceId, queryVector, k? })` via pgvector `<=>` + JOIN com `knowledge_chunks`. `updateLeadSummary({ workspaceId, leadId, agentId, recentMessages, existingSummary }) → { newSummary, usage, model }` pra job background. `formatKnowledgeBlock`/`buildSummaryPrompt` puros (testáveis).
- [x] [`apps/web/app/api/smoke-test/ai/route.ts`](../apps/web/app/api/smoke-test/ai/route.ts) — **28 checks** em 5 grupos (`pricing-m11-2` 14, `usage-event-shape-m11-2` 4, `embedding-cache-m11-2` 5, `memory-contract-m11-2` 6, `claude-contract-m11-2` 1). Zero hit Anthropic/OpenAI.
- [x] `pnpm --filter @papopro/db db:generate` ✅, `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅, smoke `/api/smoke-test/ai` 28/28 verde ✅. Smoke `/api/smoke-test/agents` (M11#1) ainda 90/90 ✅ (sem regressão).

**Não-objetivos M11#2 (explícitos):**

- Server Actions (`createAgentAction`, `sendAgentMessageAction`, etc.) → M11#3
- UI hidratada do servidor + chat de simulação chamando Claude real → M11#3
- Upload de documento + Edge Function de chunking + embedding em background → M11#4
- Trigger inbound (uazapi webhook → match no roteador → cria session → despacha Claude) → M11#5
- Handoffs agente↔agente + agente→humano → M11#6
- Métricas por agente + enforcement 3 ativos no Pro IA → M11#7
- Cache distribuído (Redis) pra embeddings → V2
- Streaming responses (chat simulação real-time) → M11#3

**Ops pós-deploy (vai no body do PR):**

1. `supabase apply_migration name=m11_2_usage_events_schema` (depende de M11#1 já aplicada).
2. Validar enum: `SELECT typname FROM pg_type WHERE typname = 'usage_event_kind'`.
3. Configurar `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` no Vercel env quando entrar M11#3 (M11#2 sozinho não usa as chaves em runtime — smoke não bate API).
4. **Custo $0 antes de M11#3** — esta entrega só prepara a biblioteca.

### M11#3 — UI wiring + Server Actions chamando Claude real (entregue 2026-05-17)

**Branch:** `m11-3-ui-wiring`

**Objetivo:** trocar o store in-memory de M5 (que rodava sobre fixtures `FAKE_AGENTS`/`FAKE_KNOWLEDGE_BASE`) por persistência real via Server Actions sobre o schema M11#1, hidratar a UI a partir do servidor (Server Components), e conectar o chat de simulação ao Claude real via `lib/ai/` (M11#2). **Sub-PR onde o custo Anthropic/OpenAI passa de $0 a $X** — cada uso do simulation chat consome tokens.

**Decisões fechadas:**

- **Substituir o store, não coexistir.** `features/agents/store.ts` e fixtures (`FAKE_AGENTS`, `FAKE_KNOWLEDGE_BASE`) deletados — workspaces começam vazios (estado vazio orienta criação). Templates (`AGENT_TEMPLATES`) ficam — usados por `createAgentAction` pra materializar v1.
- **Server Actions + `revalidatePath`, não TanStack Query.** Padrão M8/M10/M12. Componente Client chama Server Action → action revalidatePath → Server Component refetcha → re-passa via prop.
- **Sem enforcement 3 agentes ativos no Pro IA.** Fica pra M11#7 (junto com métricas + `lib/limits.ts` billing-aware). Em M11#3 deixa qualquer quantidade.
- **Métricas zeradas até M11#7.** `Agent.metrics` retorna `{ 0, 0, 0, 0 }` em queries serializer — VIEW Postgres real entra com M11#7 (agregando `agent_sessions` + `agent_messages`).
- **Simulation = sandbox isolado.** `agent_session kind='simulation'` (CHECK constraint M11#1 garante `conversation_id`+`lead_id` NULL). Mensagens persistem em `agent_messages` pra rastreabilidade + tokens registrados em `usage_events`. "Nova simulação" fecha sessão atual (`ended_at = NOW()`).
- **Memória 3 camadas em simulation:** session ✅, lead ❌ (sem `leadId`), empresa ✅ (Cérebro). `assembleContext` lida com `leadId=undefined` retornando `leadSummary: null`.
- **`handoff_config` JSONB serializer:** `queries.ts:serializeHandoffConfig` materializa os 6 triggers (com defaults `enabled:false` quando JSONB não tem entrada). `manual` sempre começa enabled em `createAgentAction`.
- **Cérebro upload de documentos fica pra M11#4.** M11#3 conecta apenas os 5 campos estruturados (`about`/`products`/`faq`/`scripts`/`policy`) via `updateKnowledgeBaseAction` (Owner/Admin only). Components `KnowledgeFileList`/`KnowledgeUploadZone` viraram stubs "em breve".
- **Roteador runtime fica pra M11#5.** M11#3 só persiste as regras em `agent_routing_rules`; uazapi inbound → match → cria session production entra em M11#5.
- **Handoffs em runtime ficam pra M11#6.** M11#3 só persiste o estado dos 6 triggers em `handoff_config`; lógica de "passar pra outro agente/humano" entra em M11#6.
- **Custo $0.05-$0.30 por turno de simulation** (Sonnet 4.6 default). UI mostra disclaimer no header do chat: "Chamada Claude real — não vai pro WhatsApp. Cada turno consome tokens".
- **Erro propositivo em falta de API key:** action retorna "IA não configurada — verifique a chave Anthropic em Configurações." em vez de erro técnico.

**Entregas:**

- [x] [`apps/web/features/agents/queries.ts`](../apps/web/features/agents/queries.ts) (novo, ~280 linhas) — `listAgentsForWorkspace`, `getAgentDetailById`, `getKnowledgeBaseFields`, `getActiveSimulationState`. Serializer JSONB→UI (`serializeHandoffConfig`, `serializeAgent`) preserva contrato `features/agents/types.ts`.
- [x] [`apps/web/features/agents/actions.ts`](../apps/web/features/agents/actions.ts) (novo, ~700 linhas) — **16 Server Actions**: `createAgentAction`, `updateAgentDraftAction`, `toggleAgentStatusAction`, `setAgentStatusAction`, `duplicateAgentAction`, `deleteAgentAction`, `saveAgentVersionAction`, `restoreAgentVersionAction`, `addRouteAction`, `updateRouteAction`, `deleteRouteAction`, `updateHandoffTriggerAction`, `updateKnowledgeBaseAction`, `simulateAgentMessageAction`, `endSimulationSessionAction`. RBAC (`requireRole`), `withWorkspace(tx)`, audit log na mesma tx, `revalidatePath`. Defense-in-depth (`workspaceId` em todo `where`).
- [x] [`apps/web/lib/ai/build-system-prompt.ts`](../apps/web/lib/ai/build-system-prompt.ts) (novo) — helper puro que monta o 1º system block enviado ao Claude. Anti-overtrigger (sem "CRITICAL: YOU MUST"), 4 tons descritos, guardrails fixos pt-BR.
- [x] [`apps/web/app/(dashboard)/agents/page.tsx`](<../apps/web/app/(dashboard)/agents/page.tsx>) — vira Server Component async, fetch via `listAgentsForWorkspace` + `getKnowledgeBaseFields`, passa via prop.
- [x] [`apps/web/app/(dashboard)/agents/[id]/page.tsx`](<../apps/web/app/(dashboard)/agents/[id]/page.tsx>) — Server Component async, fetch via `getAgentDetailById` + `getActiveSimulationState`, 404 via `notFound()` quando id inválido ou agente deletado.
- [x] [`apps/web/app/(dashboard)/agents/agents-view.tsx`](<../apps/web/app/(dashboard)/agents/agents-view.tsx>) + [`agent-editor-view.tsx`](<../apps/web/app/(dashboard)/agents/[id]/agent-editor-view.tsx>) — recebem dados via prop, removeram `useAgents`/`useAgent`. Editor sobe handlers de save/duplicate/delete + name debounce 600ms.
- [x] **13 components refatorados** — todos os imports de `../store` trocados por `../actions`. Mutations passam por Server Actions; debounce 800ms no prompt editor, 600ms no persona. `KnowledgeFileList` + `KnowledgeUploadZone` viraram stubs (M11#4 implementa).
- [x] [`apps/web/features/agents/components/agent-simulation-chat.tsx`](../apps/web/features/agents/components/agent-simulation-chat.tsx) — **substitui canned script** por chamada real `simulateAgentMessageAction`. Optimistic UI (mensagem do user aparece antes do response). Header com disclaimer de custo. "Nova simulação" chama `endSimulationSessionAction`.
- [x] [`apps/web/app/api/smoke-test/agents/route.ts`](../apps/web/app/api/smoke-test/agents/route.ts) — re-escrito do zero. **52 checks** em 7 grupos (db-enums-m11: 9, audit-actions-m11: 8, db-handoff-config-shape-m11: 2, templates: 6, transforms-pure: 5, schemas: 12, build-system-prompt-m11-3: 10). Sem hit DB/API.
- [x] **Cleanup:** `apps/web/features/agents/store.ts`, `apps/web/features/agents/hooks/use-simulation-script.ts`, `apps/web/lib/fixtures/agents.ts`, `apps/web/lib/fixtures/knowledge-base.ts` deletados. `agent-templates.ts` mantido (usado por `createAgentAction`).
- [x] `pnpm db:generate` ✅, `pnpm typecheck` ✅, `pnpm lint` ✅ (zero warnings), smoke `/api/smoke-test/agents` **52/52 verde** ✅, smoke `/api/smoke-test/ai` (M11#2) 31/31 sem regressão ✅.

**Não-objetivos M11#3 (explícitos):**

- Upload de documentos do Cérebro (PDF/DOC/DOCX/TXT/MD) + extração + chunking + embedding → **M11#4** (Edge Function)
- Roteador runtime real (uazapi inbound → match → cria session production → despacha Claude) → **M11#5**
- Handoffs agente↔agente + agente→humano em runtime → **M11#6**
- Métricas reais por agente em `/reports` + enforcement 3 ativos no Pro IA → **M11#7**
- Diff visual entre versões (era opcional em M11#3) → adiado pra M11#7
- Real-time updates de simulação via SSE/Supabase Realtime → V2
- E2E Playwright do flow "criar → conversar → ativar" → M13

**Ops pós-deploy (vai no body do PR):**

1. **`ANTHROPIC_API_KEY` + `OPENAI_API_KEY` no Vercel env — críticas a partir de M11#3.** Sem elas, `simulateAgentMessageAction` retorna erro propositivo e UI bloqueia o envio; outras actions (CRUD, versionamento, roteamento, handoff config, KB campos) funcionam normais.
2. Migrations M11#1 + M11#2 já aplicadas (M11#3 não cria migration nova).
3. **Custo $X começa aqui.** Cada simulation chat consome ~$0.05-$0.30/turno (Sonnet 4.6). Monitorar `usage_events` desde primeiro turno.

### M11#4 — Cérebro upload + extração + chunking + embedding (entregue 2026-05-17)

**Branch:** `m11-4-knowledge`

**Objetivo:** completar o "Cérebro da Empresa" — admin sobe PDF/TXT/MD, sistema extrai texto, chunkeia, gera embeddings via OpenAI (M11#2 `embedTexts`), persiste em `knowledge_chunks` + `knowledge_embeddings`. Os 5 campos estruturados de M11#3 agora também ficam indexados após cada save. A partir daqui, `assembleContext.topKKnowledge` (M11#2) retorna **resultados reais** no simulation chat.

**Decisões fechadas:**

- **Processing síncrono na Server Action** (não Edge Function em background) — MVP: arquivos típicos ≤2MB texto extraído processam em <15s. Edge Function async fica pra V2 quando volumes pedirem.
- **PDF/TXT/MD suportados em M11#4** — DOC/DOCX entram em sub-PR follow-up (lib `mammoth`). Schema M11#1 enum `knowledge_doc_kind` aceita os 5; processing dos não-suportados retorna `failed` com `error_detail` propositivo.
- **`pdf-parse@^2.4.5`** (class-based `PDFParse` v2 API) — pure JS, ~250KB, sem nativo. Lazy import só carrega quando precisa.
- **Chunking 2800 chars target, 8000 cap, 400 overlap** — split por `\n\n` → sentence → char. Overlap preserva contexto entre chunks pra busca semântica.
- **Hard delete imediato do Storage** no `deleteKnowledgeDocumentAction` (vs soft 30d do M8#6 attachments) — chunks + embeddings ocupam DB; arquivo só atrasa cleanup.
- **Status lifecycle**: `uploading` → `processing` → `processed` | `failed`. Server Action faz tudo numa request; se falhar, status fica `failed` + `error_detail` (admin reupload).
- **Re-indexação inline dos 5 campos estruturados** no `updateKnowledgeBaseAction` (via `reindexStructuredField` helper) — `Promise.allSettled` paraleliza os 5; falha em 1 não bloqueia outros.
- **MIME whitelist no bucket** — `application/pdf`, `text/plain`, `text/markdown` + 2 reservados (`doc`/`docx`) que aceitam upload mas processing falha.
- **Storage path** `<workspaceId>/<documentId>/<sanitizedFilename>` — workspace_id no prefix permite policies RLS em `storage.objects` (mesmo padrão M8#6 attachments).
- **`sanitizeFileName` char-by-char** (não regex com control chars) — ESLint `no-control-regex` evita o pattern; iteração explícita testa códigos < 32 e separadores filesystem.
- **Custo trivial** — 50KB texto = ~12k tokens × \$0.02/1M = \$0.00024 por upload. `recordUsage(feature='kb_indexing')` registra em `usage_events`.

**Entregas:**

- [x] [`supabase/migrations/20260528120000_m11_4_knowledge_storage_setup.sql`](../supabase/migrations/20260528120000_m11_4_knowledge_storage_setup.sql) — bucket `knowledge-base` (privado, 10MB, MIME whitelist) + 3 policies RLS em `storage.objects` + RPC helper `delete_structured_field_chunks` (SECURITY DEFINER, atravessa RLS pra delete + cascade de chunks).
- [x] [`apps/web/lib/knowledge/chunking.ts`](../apps/web/lib/knowledge/chunking.ts) (novo, puro) — `chunkText(text, opts?) → ChunkOutput[]` com 3 níveis de fallback (parágrafo → sentence → char). `splitLargeParagraph` + `estimateTokens` exportados pra smoke.
- [x] [`apps/web/lib/knowledge/extract.ts`](../apps/web/lib/knowledge/extract.ts) (novo, server-only) — `extractText({ buffer, kind })` despacha pra `extractPdf` (lazy import `pdf-parse@2.4.5` class API) ou `extractPlainText` (UTF-8 direto). DOC/DOCX lança erro propositivo.
- [x] [`apps/web/features/agents/knowledge-actions.ts`](../apps/web/features/agents/knowledge-actions.ts) (novo, ~430 linhas) — 2 Server Actions + 1 helper exportado: `uploadKnowledgeDocumentAction` (FormData → Storage upload → extract → chunk → embed → persist + `recordUsage` `feature='kb_indexing'`; erros marcam `failed`), `deleteKnowledgeDocumentAction` (soft delete row + hard delete Storage; cascade limpa chunks+embeddings), `reindexStructuredField` (delete chunks antigos do campo + re-chunk + re-embed; chamado pelo `updateKnowledgeBaseAction`).
- [x] [`apps/web/features/agents/actions.ts`](../apps/web/features/agents/actions.ts) — `updateKnowledgeBaseAction` agora dispara `reindexStructuredField` pros 5 campos em paralelo após upsert (`Promise.allSettled` + `reportNonFatal` em cada falha).
- [x] [`apps/web/features/agents/queries.ts`](../apps/web/features/agents/queries.ts) — `getKnowledgeBaseFields` agora popula `files` com documentos reais de `knowledge_documents` (não mais `[]` stub). Serializers `serializeDocKind`/`serializeDocStatus` mapeiam enum DB (5 kinds, 4 statuses) → contrato M5 UI (3 kinds, 2 statuses).
- [x] [`apps/web/features/agents/components/knowledge-upload-zone.tsx`](../apps/web/features/agents/components/knowledge-upload-zone.tsx) — dropzone funcional (não mais stub). Drag+drop ou click-to-pick. `FormData` + `uploadKnowledgeDocumentAction` + loading state + toast por arquivo (success/error/failed-with-detail). `router.refresh()` após sucesso.
- [x] [`apps/web/features/agents/components/knowledge-file-list.tsx`](../apps/web/features/agents/components/knowledge-file-list.tsx) — lista real com status badge, tamanho formatado, timestamp, `deleteKnowledgeDocumentAction` com confirm dialog + `router.refresh()`.
- [x] [`apps/web/features/agents/components/knowledge-base-tab.tsx`](../apps/web/features/agents/components/knowledge-base-tab.tsx) — microcopy atualizado (sem mais "em breve"), upload zone só visível pra Owner/Admin.
- [x] [`apps/web/package.json`](../apps/web/package.json) — `pdf-parse@^2.4.5` + `@types/pdf-parse@^1.1.5`. Install no Windows com `NODE_OPTIONS=--use-system-ca` + `--ignore-scripts` (TLS antivírus workaround M11#2).
- [x] [`apps/web/app/api/smoke-test/agents/route.ts`](../apps/web/app/api/smoke-test/agents/route.ts) — **+11 checks** em grupo `chunking-m11-4` (vazio, whitespace, texto pequeno, target/max chars, overlap default/desligado, chunkIndex sequencial, tokens estimados, consolidação de parágrafos curtos). Total smoke: 63/63.
- [x] `pnpm db:generate` ✅, `pnpm typecheck` ✅, `pnpm lint` ✅ (zero warnings), smoke `/api/smoke-test/agents` **63/63 verde** ✅, smoke `/api/smoke-test/ai` (M11#2) 31/31 sem regressão ✅.

**Não-objetivos M11#4 (explícitos):**

- **DOC/DOCX** — lib `mammoth` em sub-PR follow-up (~50 linhas de mudança).
- **OCR pra PDFs scanneados** (sem camada de texto extraível) — V2.
- **Edge Function async processing** — V2 quando volumes pedirem.
- **Versionamento da KB** (snapshots por mudança) — V2.
- **Re-indexação automática quando troca o modelo de embedding** — manual via migration script futura.
- **Roteador runtime real** (uazapi inbound consume KB) → M11#5.

**Ops pós-deploy:**

1. `supabase apply_migration name=m11_4_knowledge_storage_setup` (cria bucket + policies + RPC).
2. Validar bucket: `SELECT id, allowed_mime_types FROM storage.buckets WHERE id = 'knowledge-base'`.
3. **`OPENAI_API_KEY` já configurada em M11#3 ops** — sem isso, upload retorna `failed` com erro propositivo.
4. **Custo embedding por upload ~\$0.0003 / 50KB texto** — trivial; sem alerta.

---

## M12 — Stripe Billing + Trial + Bloqueio Progressivo

**Estratégia:** sub-PRs sequenciais sobre `dev` (gitflow strict M8/M9/M10). M12#1 entrega o foundation Free↔Pro funcional ponta-a-ponta. Sub-PRs subsequentes (#2–#6) expandem pra cobrir o resto do PRD.

| Sub-PR    | Escopo                                                                                                                                                                                         | Branch          | Status      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------- |
| **M12#1** | Schema (`stripe_customers` + `subscriptions`) + lib/stripe + Server Actions Checkout/Portal + webhook 5 eventos (signature + idempotência) + UI `/settings/billing` Free↔Pro + smoke contratos | `feat/billing`  | ✅ entregue |
| **M12#2** | Trial 7d sem cartão no signup + avisos D-2/D-1 (push + email Resend)                                                                                                                           | `m12-2-trial`   | ⏳ pendente |
| **M12#3** | Stripe Pro IA (R$ 497/mês) + Enterprise (price flexível) + upgrade/downgrade no Customer Portal                                                                                                | `m12-3-pro-ia`  | ⏳ pendente |
| **M12#4** | Enforcement de limites por plano (Free: 50 leads / 2 membros) + página de cobrança com comparação Free×Pro + Customer Portal + banners de aviso em /leads e /settings/team                     | `m12-4-limits`  | ✅ entregue |
| **M12#5** | Bloqueio progressivo (read-only 30d após cancel + scheduled deletion com email) + notificações pagamento falhado (in-app + email)                                                              | `m12-5-lockout` | ⏳ pendente |
| **M12#6** | Métricas internas MRR/churn/conversion (PostHog) + E2E Playwright trial → upgrade → webhook → plano ativo                                                                                      | `m12-6-metrics` | ⏳ pendente |

**Commit final:** `feat(billing): stripe checkout, customer portal, trial flow and progressive lockout`

### M12#1 — schema + Stripe lib + Checkout/Portal + Webhook (entregue 2026-05-17)

**Branch:** `feat/billing`

**Objetivo:** entregar o caminho mínimo funcional **Free → Pro → Webhook → ativa → Cancel → Free**, com tudo passando por Server Action (única exceção é o webhook do Stripe, que precisa de Route Handler pelo raw body da assinatura HMAC).

**Decisão de escopo:** simplificação Free/Pro (vs PRD Pro/Pro IA/Enterprise). MVP só `pro` no enum + 1 price ID. Sub-PRs subsequentes (#2–#6) expandem os outros planos, trial, enforcement, bloqueio progressivo e métricas.

**Entregas:**

- [x] [`supabase/migrations/20260525120000_m12_1_billing_schema.sql`](supabase/migrations/20260525120000_m12_1_billing_schema.sql) — 2 enums (`subscription_plan` só `pro`; `subscription_status` com 5 valores Stripe-canônicos), 5 valores novos em `audit_action` (`checkout_initiated`, `subscription_activated`, `subscription_canceled`, `payment_succeeded`, `payment_failed`), 2 tabelas (`stripe_customers` PK=workspace_id 1:1; `subscriptions` 1:N por workspace com UNIQUE `stripe_subscription_id` pra idempotência de webhook), RLS habilitada (4+3 policies — DELETE só via cascade do workspace), 2 triggers `touch_updated_at`.
- [x] [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) — +2 enums (`SubscriptionPlan`, `SubscriptionStatus`), +2 models (`StripeCustomer`, `Subscription`), +5 `AuditAction` values espelhando o SQL, relations em `Workspace`. Re-exports em `@papopro/db`.
- [x] [`apps/web/lib/stripe/`](apps/web/lib/stripe/) — **3 arquivos**:
  - `client.ts`: Stripe SDK singleton lazy + apiVersion pinned `2026-04-22.dahlia` + `appInfo` pra telemetria. Lança em falta de `STRIPE_SECRET_KEY` (sem fallback silencioso).
  - `plans.ts`: `priceIdToPlan(priceId)` puro + `planToPriceId(plan)` consultando env vars. Sem `'server-only'` — smoke importa.
  - `verify-signature.ts`: wrapper de `stripe.webhooks.constructEvent` retornando `{ ok, event } | { ok: false, code, message }`. Sem fallback "skipped" pra dev — CLAUDE.md §7.4 exige verify estrita.
- [x] [`apps/web/features/billing/`](apps/web/features/billing/) — feature completa:
  - `schemas.ts`: `checkoutSessionInputSchema` Zod strict (aceita só `plan: 'pro'`); `portalSessionInputSchema` placeholder.
  - `types.ts`: `BillingStateUI` (plan='free'|'pro' + subscription nullable + hasStripeCustomer) consumido pela UI.
  - `queries.ts`: `getBillingState(workspaceId)` server-only — single round-trip que retorna estado pronto pra render (sem JOIN — duas queries paralelas Subscription + StripeCustomer).
  - `actions.ts`: 2 Server Actions Owner-only — `createCheckoutSessionAction({plan})` faz `getOrCreateStripeCustomer` + `checkout.sessions.create` com metadata workspace_id em duas camadas (session + subscription_data); `createPortalSessionAction()` abre Stripe Customer Portal (caminho de cancelamento). Ambas com `requireRole(['Owner'])` + audit log + `reportNonFatal`.
  - `webhook/extract.ts`: helpers puros — `getWorkspaceIdFromMetadata`, `mapStripeStatus` (10 valores Stripe → 5 enum local; `trialing/paused → active`), `getFirstPriceId`, `getCurrentPeriod` (lê `items.data[0].current_period_*` — API 2025-09+ migrou esses campos de root pra item-level).
  - `webhook/handlers.ts`: 5 handlers tipados (`handleCheckoutSessionCompleted`, `handleSubscriptionUpserted` cobre `created`/`updated`, `handleSubscriptionDeleted`, `handleInvoicePaymentSucceeded`, `handleInvoicePaymentFailed`). Upsert por `stripe_subscription_id` UNIQUE é idempotente.
- [x] [`apps/web/app/api/webhooks/stripe/route.ts`](apps/web/app/api/webhooks/stripe/route.ts) — POST handler `runtime=nodejs` `maxDuration=30`. Sequência: raw body → signature verify (401 se inválida; 500 se secret ausente) → resolve `workspace_id` em 3 camadas (`session.metadata` → `subscription.metadata` → lookup `stripe_customers` por customer_id; 200 skipped se nada bate) → idempotência via `WebhookEvent (source='stripe', externalId=event.id)` reusando tabela M9#3 → `withWorkspace(tx)` → dispatch por `event.type` → mark `processedAt`. Errors retornam 500 pra Stripe re-entregar (idempotência protege).
- [x] [`apps/web/app/(dashboard)/settings/billing/page.tsx`](<apps/web/app/(dashboard)/settings/billing/page.tsx>) + [`billing-view.tsx`](<apps/web/app/(dashboard)/settings/billing/billing-view.tsx>) — Server Component **Owner only** (redirect `/settings` pra outros papéis) carrega `getBillingState` + passa pro Client View. UI bifurca em 2 estados visuais:
  - **Free**: card "Plano Free" com bullets do que o Pro entrega + CTA `Assinar Pro` (chama `createCheckoutSessionAction` → `window.location.href = result.url`).
  - **Pro ativo**: card "Plano Pro" com status badge (active/past_due/canceled), próxima cobrança (date-fns ptBR), CTA `Gerenciar assinatura` (chama `createPortalSessionAction` → redireciona pro Stripe Portal pra cancelar/atualizar cartão).
- [x] [`apps/web/app/api/smoke-test/billing/route.ts`](apps/web/app/api/smoke-test/billing/route.ts) — **+22 checks puros** em 7 grupos sem hit no Stripe API: `audit-actions-m12` (1), `enums-m12` (2), `schemas-m12` (4), `plans-m12` (3), `webhook-extract-m12` (4), `webhook-status-map-m12` (8), `webhook-period-m12` (2), `webhook-price-extract-m12` (3) — total 27 checks. Lifecycle E2E real fica com `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
- [x] [`apps/web/.env.local.example`](apps/web/.env.local.example) — vars já documentadas em M12 (M5/M7 antecipou): `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`. Body do PR documenta os passos de Stripe Dashboard pra preencher (criar product "Pro" R$ 197/mês + webhook endpoint + copiar IDs).
- [x] `pnpm --filter @papopro/db db:generate` ✅, `pnpm --filter @papopro/web typecheck` ✅, `pnpm --filter @papopro/web lint` ✅ (zero warnings), `pnpm --filter @papopro/web build` ✅, smoke `/api/smoke-test/billing` 27/27 verde.

**Decisões fechadas M12#1:**

- **Free como ausência de subscription** (não enum value). `workspace.plan` legacy fica intocado (M5 default "Pro" string); source-of-truth do plano é "tem row em `subscriptions` com status ∈ {active, past_due}?". Evita ALTER em workspaces existentes + simplifica enum (1 valor `pro` em vez de 4 com `free`).
- **MVP só `pro`** — Pro IA / Enterprise entram em M12#3. Decisão valida com usuário antes de implementar.
- **Webhook é a única Route Handler** — todo o resto usa Server Action. Motivo do webhook ser exceção: precisa do raw body literal pra HMAC + recebe POST cross-origin Stripe sem sessão.
- **Stripe API version pinned** (`2026-04-22.dahlia`) — pin via SDK type. Mudar via skill `stripe:upgrade-stripe` em batch controlado.
- **Idempotência reusa `webhook_events`** (mesma tabela do uazapi M9#3) com `source='stripe'`. Evita duplicação de schema.
- **Workspace_id em 2 camadas de metadata** — Stripe NÃO propaga `session.metadata` → `subscription.metadata` automaticamente; setamos nos dois. Webhook tenta `session.metadata` primeiro (checkout completed), depois `subscription.metadata`, depois lookup via `stripe_customers`.
- **Não há audit "subscription_updated"** — usamos `subscription_activated` pros 3 eventos (`created`/`updated`/`activated`). Distingue via `changes.eventType` no audit log. Reduz enum sprawl.
- **Custom Portal substitui dialog de cancel** — em M5 a UI tinha `<CancelSubscriptionDialog>` mockado. Em M12#1 o cancelamento acontece no Stripe Portal (clique em "Gerenciar assinatura"). Dialog mockado fica órfão até M12 finalizar (não removo agora pra evitar churn de M5 demo).
- **`stripeCustomer` é 1:1** (workspace_id PK) — não há cenário de mesmo workspace ter 2 customers Stripe. Multi-currency / multi-region é V3+.

**Não-objetivos M12#1 (explícitos — ficam pra sub-PRs):**

- Trial 7d sem cartão + avisos D-2/D-1 → M12#2
- Pro IA / Enterprise tiers → M12#3
- Enforcement de limites por plano → M12#4
- Bloqueio progressivo (read-only 30d + scheduled deletion) → M12#5
- Notificações de pagamento falhado (push + email) → M12#5 (depende de notification system completo)
- Métricas internas MRR/churn/conversion (PostHog) → M12#6
- E2E Playwright → M12#6
- UI legacy de Usage limits / Invoices table (M5 fixtures) — não removida; será reescrita em M12#4/#5 quando virar real.

**Stripe Dashboard — setup manual antes de testar (vai no body do PR):**

1. Stripe Dashboard (test mode) → Products → Create product **"PapoPro — Pro"** → Recurring price **R$ 197,00 BRL / mês** → copiar `price_xxx`.
2. Developers → Webhooks → Add endpoint local (via `stripe listen`):
   ```
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Stripe CLI imprime `whsec_xxx` temporário.
3. Eventos pra subscrever no webhook prod (depois): `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
4. Colocar em `apps/web/.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_... (do stripe listen)
   STRIPE_PRICE_PRO_MONTHLY=price_xxx
   ```
5. Test cards (skill `stripe:test-cards`): `4242 4242 4242 4242` (sucesso), `4000 0000 0000 9995` (failed).

**Ops pós-deploy (fora do PR — pré-launch):**

1. Aplicar migration via MCP `apply_migration name=m12_1_billing_schema` (depende de M10#4 já aplicada).
2. Stripe Dashboard **live mode**: criar product "Pro" R$ 197/mês + endpoint webhook `https://app.pipeflow.com.br/api/webhooks/stripe`.
3. `supabase secrets set` (Vercel env): `STRIPE_SECRET_KEY=sk_live_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`, `STRIPE_PRICE_PRO_MONTHLY=price_live_...`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`.
4. Validar webhook: criar uma test subscription → conferir row em `subscriptions` + audit log `subscription_activated`.

### M12#4 — limit enforcement + comparação Free×Pro + banners (entregue 2026-05-17)

**Branch:** `m12-4-limits`

**Objetivo:** travar o uso do plano Free a 50 leads ativos + 2 membros, dar visibilidade do uso atual em `/settings/billing` (com comparação Free vs Pro) e avisar usuário antes do bloqueio nas páginas `/leads` e `/settings/team`. Customer Portal já existia em M12#1 (`Gerenciar assinatura`) — M12#4 só confirma o caminho.

**Decisão de escopo:** apenas dois limites (leads + members), não os 6 do PRD §3.12 (disparos/mês, números WhatsApp, agentes IA, storage). Os outros entram em M11/M9 quando o domínio existir de fato. Free→Pro só — Pro IA/Enterprise vêm em M12#3.

**Entregas:**

- [x] [`apps/web/lib/limits.ts`](apps/web/lib/limits.ts) — biblioteca server-only:
  - `PLAN_LIMITS` (Free: 50/2; Pro: `Number.POSITIVE_INFINITY`).
  - `canAddLead(workspaceId, opts?)` / `canAddMember(workspaceId, opts?)` — gate pra Server Actions. Aceita `tx` opcional pra rodar atômico com o INSERT (bloqueia race "2 cliques simultâneos com 49 leads → 51 leads") e `increment` (usado pelo `importLeadsAction` pra checar batch CSV inteiro).
  - `getWorkspaceUsage(workspaceId)` — snapshot pra UI (banners + página `/settings/billing`).
  - `computeLimitState` puro extraído pra smoke (testa sem mock de DB).
  - `toLimitStateUI` + `toWorkspaceUsageUI` — converte `Infinity` em `null + isUnlimited:true` pra serializar via RSC sem perder valor (Flight encoding).
  - `limitReachedMessage` — copy padronizado pros toast/banner.
- [x] [`apps/web/features/leads/actions.ts`](apps/web/features/leads/actions.ts) — enforcement em `createLeadAction` (dentro da tx, antes do INSERT) + `importLeadsAction` (após dedup, com `increment = willCreateCount` pra bloquear CSV grande no Free).
- [x] [`apps/web/features/invitations/actions.ts`](apps/web/features/invitations/actions.ts) — enforcement em `inviteMemberAction` contando `WorkspaceMember + pending Invitation`. Pula a checagem quando o convite reaproveitado já é `pending` (slot já contado — re-send não consome).
- [x] [`apps/web/components/plan-limit-banner.tsx`](apps/web/components/plan-limit-banner.tsx) — Server Component (sem `'use client'`). Renderiza só em ≥90% do limite. 90–99%: amarelo + "X slots restantes"; 100%: vermelho + "Limite atingido". Owner vê CTA linkando pra `/settings/billing`; outros papéis veem só o aviso.
- [x] [`apps/web/app/(dashboard)/settings/billing/billing-view.tsx`](<apps/web/app/(dashboard)/settings/billing/billing-view.tsx>) — atualizado:
  - **Free card** ganha `UsageStat` em 2 colunas (leads + membros) com barras de progresso (cor escalando `primary` → `warning` → `destructive`).
  - **Pro card** mostra contadores "X (ilimitado)" em vez de só status.
  - **Tabela "Free × Pro"** nova com 9 linhas (Leads ativos, Membros, CRM/Kanban, Importação CSV, Motor de cadência, Lead frio, Inbox, IA, Anti-ban) + preço + badge "Atual" no plano corrente + bloco vermelho quando atinge limite.
- [x] [`apps/web/app/(dashboard)/leads/page.tsx`](<apps/web/app/(dashboard)/leads/page.tsx>) + [`settings/team/page.tsx`](<apps/web/app/(dashboard)/settings/team/page.tsx>) — Server Components carregam `getWorkspaceUsage` em paralelo com queries existentes + renderizam `<PlanLimitBanner>` acima do conteúdo.
- [x] [`packages/ui/src/icons.ts`](packages/ui/src/icons.ts) — `AlertTriangle` + `XCircle` adicionados ao re-export central.
- [x] [`apps/web/lib/stripe/client.ts`](apps/web/lib/stripe/client.ts) — **fix dev local Windows**: Stripe HTTPS Agent custom usando `tls.getCACertificates('system')` (Node 22.16+/24+) concatenado com `tls.rootCertificates`. Resolve `UNABLE_TO_VERIFY_LEAF_SIGNATURE` quando antivírus injeta cert no Windows trust store (mesma raiz do `pnpm install` documentado em memória `dev-local-windows-antivirus-tls`). Produção Linux: no-op funcional (system store ≡ bundle padrão).
- [x] [`apps/web/app/api/smoke-test/billing/route.ts`](apps/web/app/api/smoke-test/billing/route.ts) — **+17 checks puros** em 3 grupos: `plan-limits-m12-4` (4), `limit-state-m12-4` (6), `limit-ui-m12-4` (7). Total 27 → **44** checks verdes. Sem hit Stripe API. Lifecycle real continua via Stripe CLI.
- [x] `pnpm --filter @papopro/web typecheck` ✅, `lint` ✅ (zero warnings), smoke 44/44 ✅, dev server responde 307 nas 3 rotas (auth gate ok).

**Decisões fechadas M12#4:**

- **Apenas 2 limites no MVP** (leads ativos + membros) — outros 4 do PRD §3.12 (disparos/mês, números WhatsApp, agentes IA, storage) ficam fora porque dependem de domínios M11+. Avaliar incluir em M12#5+ ou em sub-PR M12#4p (patch) se demanda concreta surgir.
- **Leads ativos** = `status='ativo' AND deletedAt IS NULL`. Arquivados/deletados não ocupam slot — caso contrário workspace fica permanentemente bloqueado pelo histórico. Lead recém-arquivado libera slot imediatamente.
- **Membros** = `WorkspaceMember.count + Invitation.count(pending)`. Pending entra no count pra evitar oversubscription ("Owner com 2 slots manda 5 convites; quando aceitam o slot estourou"). Re-send de convite pending NÃO consome novo slot (mesmo invite, mesma row).
- **Threshold do banner**: 90% (warning amarelo) + 100% (destructive vermelho). Inspirado em quotas de cloud (Vercel/Supabase) — fora desse range é ruído pro usuário.
- **Gate dentro da tx do INSERT**: `canAddLead({ tx })` recebe a tx do caller pra ser atômico com o `tx.lead.create`. Sem isso, race de 2 cliques quase simultâneos com 49 leads passaria os dois (count=49 nos dois) e criaria o 51º. Idem invitations.
- **Banner é Server Component** (sem `'use client'`) — não precisa de interatividade, render no servidor é mais barato + acessível por default. Click no CTA Owner é `<Link href="/settings/billing">`.
- **Comparação Free×Pro fica em tabela na própria página** (não modal/drawer separado) — densidade visual permite, e o caso comum é "comparar antes de decidir assinar".
- **Customer Portal já existia em M12#1** (`createPortalSessionAction` + botão "Gerenciar assinatura") — M12#4 só registra. Cancel/upgrade pelo Portal continua. Free não tem Portal porque ainda não tem customer Stripe.
- **Stripe TLS fix no client.ts**: aceita ficar em produção. Mais limpo que `NODE_OPTIONS=--use-system-ca` (que Next 14 rejeita ao re-spawn de subprocess), mais auditável que `NODE_EXTRA_CA_CERTS` (path do PEM). Tomada de decisão pequena — afeta só HTTPS Agent do Stripe SDK.

**Não-objetivos M12#4 (explícitos):**

- Limites de disparos/mês, números WhatsApp, agentes IA, storage → quando o domínio existir (M11/M9 follow-ups).
- Tela dedicada "Limite atingido" full-page com ilustração — banners inline são suficientes pro MVP. Full-page bloqueante (lockout) entra em M12#5.
- Pro IA / Enterprise tiers + limites diferenciados → M12#3.
- E2E Playwright do flow "criar 51º lead falha" → M12#6.

**Ops pós-deploy:** nenhum (puro código + smoke). Não precisa apply migration nem deploy Edge Function.

---

## M13 — PWA + Push + Polimento + Deploy de Produção

**Branch:** `m13-pwa-deploy`

**Objetivo:** Tornar o produto instalável como PWA, ativar push notifications ponta-a-ponta, polimento final (LGPD, auditoria, observabilidade), deploy em produção.

**Entregas — PWA:**

- [ ] `public/manifest.json` com nome, ícones (192/512/maskable), theme color, display standalone
- [ ] `public/sw.js` com Workbox: cache de shell offline-first, network-first para data
- [ ] Suporte iOS Safari 16.4+ (notificações depois de "Adicionar à Tela Inicial")
- [ ] Tela "Instalar app" com instruções por plataforma

**Entregas — Push Notifications:**

- [ ] Subscribe via VAPID + persistir `push_subscriptions` por usuário/dispositivo
- [ ] Edge Function `send-push` chamada nos eventos da matriz PRD §3.2
- [ ] Tela `/settings/notifications` totalmente funcional (preferências por evento × canal; eventos administrativos não desligáveis)
- [ ] Testes manuais nos 3 ambientes: iOS Safari 16.4+ instalado como PWA, Android Chrome, Desktop Chrome/Edge

**Entregas — LGPD e Auditoria:**

- [ ] Tela de exportação completa de dados do lead (formulário + log de auditoria)
- [ ] Exclusão de lead sob solicitação do titular (cascade controlado, mantém log)
- [ ] Auditoria com filtros por usuário, tipo de evento, período (Owner/Admin)
- [ ] Retenção de logs: 12 meses (Pro/Pro IA), 24 meses (Enterprise) — job de purge mensal
- [ ] Política de cookies + banner de consentimento na landing
- [ ] Termos de uso e privacidade publicados em `/legal/terms` e `/legal/privacy`

**Entregas — Observabilidade & Polimento:**

- [ ] Sentry com source maps em landing e web; alertas Slack/email para erros novos
- [ ] PostHog tracking dos eventos-chave: `signup`, `email_verified`, `workspace_created`, `whatsapp_connected`, `first_lead_created`, `first_message_sent`, `cadence_activated`, `agent_activated`, `trial_ended`, `subscription_started`
- [ ] Vercel Analytics ativo
- [ ] Dashboards internos no PostHog: funil de ativação, conversão de trial, churn
- [ ] Lighthouse ≥ 90 em todas as páginas-chave
- [ ] Auditoria de a11y com axe; sem violações sérias
- [ ] Smoke test E2E (Playwright) cobrindo: signup → verificação → workspace → conectar WhatsApp → criar lead → cadência → handoff IA → upgrade

**Entregas — Deploy:**

- [ ] DNS configurado: raiz aponta para Vercel `landing`, `app.` aponta para Vercel `web`
- [ ] SSL automático ativo (Let's Encrypt via Vercel)
- [ ] Variáveis de ambiente populadas em production (Vercel + Supabase)
- [ ] Stripe em modo live com webhook de produção registrado
- [ ] uazapi com chip de produção
- [ ] Resend com domínio verificado e SPF/DKIM
- [ ] Smoke test em produção (signup real, lead real, mensagem real, cobrança em sandbox)
- [ ] Backup do Supabase configurado (snapshot diário + retenção 7 dias)
- [ ] Runbook de incidentes em `docs/RUNBOOK.md` (queda WhatsApp, queda Supabase, falha Stripe webhook)
- [ ] Onboarding de 5–10 usuários beta fechados; canal WhatsApp/Slack para feedback

**Commit final:** `feat(release): pwa, push notifications, lgpd compliance and production deploy`

**Tag:** `v1.0.0` no merge final.

---

## Riscos e pontos de atenção

- **uazapi e bloqueio de números:** maior risco operacional. M9 entrega anti-ban, mas validação real só acontece em volume — monitorar health score dos beta users como métrica de saúde do produto.
- **Migração Standard → Enterprise (Cloud API):** previsto pra V2, mas a interface `WhatsAppAdapter` já em M9 deve ser desenhada pra suportar `cloud.ts` sem rework — caso contrário, refatoração cara depois.
- **Multi-tenant + Prisma + RLS:** o helper `with-workspace.ts` é peça crítica. Bug aqui = vazamento de dados entre clientes. Cobrir com testes específicos em M7 e revisar manualmente cada Server Action nova.
- **Custo de Claude:** monitorar tokens em `usage_events` desde M11. Cliente abusivo (workspace com volume anormal) deve ser detectado antes de virar prejuízo.
- **LGPD na prática:** consentimento + opt-out + retenção precisam funcionar antes do trial público. Se M13 atrasar, segurar o lançamento.
- **Beta fechado em M9:** se feedback indicar problemas estruturais (ex: anti-ban insuficiente), pode ser necessário rebobinar antes de M10.

---

## Fora de escopo (V2/V3 — não construir agora)

Da PRD §2.4–§3.8 e §3.6, explicitamente fora do MVP:

- WhatsApp Cloud API oficial (M9 deixa adapter pronto, mas implementação `cloud.ts` é V2)
- App nativo iOS/Android (PWA atende o MVP)
- OAuth Google e 2FA no login
- Busca global Cmd+K com indexação cross-feature
- Editor de templates de proposta com variáveis (biblioteca estática no MVP)
- Transferência de conversa entre vendedores
- Tradução automática de mensagens
- Forecast por probabilidade × etapa, cohorts mensais (métricas avançadas V2)
- SSO corporativo, integrações ERP, customizações enterprise (PRD §12 anti-personas)

Quando o backlog do beta sugerir uma destas, registrar em `docs/BACKLOG-V2.md` (a criar) e seguir o plano.
