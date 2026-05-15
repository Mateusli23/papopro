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

| Sprint   | Dias    | Marcos cobertos | Status                                                                                              |
| -------- | ------- | --------------- | --------------------------------------------------------------------------------------------------- |
| Sprint 1 | 1–15    | M1, M2          | ✅ concluído                                                                                        |
| Sprint 2 | 16–30   | M3              | ✅ concluído                                                                                        |
| Sprint 3 | 31–45   | M4              | ✅ concluído                                                                                        |
| Sprint 4 | 46–60   | M5              | ✅ concluído — 6 / 6 sub-PRs + 2 polimentos (M5p#1, M5p#2)                                          |
| Sprint 5 | 61–75   | M6, M7          | ✅ concluída — M6 (3/3) + M7 (6/6 — 2 releases: M7#1-#5 em 12-mai-26 parcial, M7#6 fecha milestone) |
| Sprint 6 | 76–90   | M8              | ⏳ pendente                                                                                         |
| Sprint 7 | 91–105  | M9, M10         | ⏳ pendente                                                                                         |
| Sprint 8 | 106–120 | M11, M12, M13   | ⏳ pendente                                                                                         |

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
| M8#6   | Storage Supabase para anexos (`bucket attachments` + RLS) + cleanup órfão diário                | `m8-storage-attachments` | ✅ entregue | _aberto após validação local_                        |
| M8#7   | Realtime Kanban (Supabase channel `workspace:<id>:deals`) + export CSV/XLSX                     | `m8-realtime-export`     | ⏳          | —                                                    |

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
- [ ] Exportação CSV/XLSX (background + email com link 7d) com log de auditoria _(M8#7)_
- [ ] Realtime para mudanças de Kanban (Supabase Realtime channel `workspace:<id>:deals`) _(M8#7)_

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

**Commit final M8:** `feat(backend): leads, deals, pipelines, tasks crud with rls and csv import`

---

## M9 — WhatsApp: Adapter, uazapi, Anti-ban e Inbox real

**Branch:** `m9-whatsapp`

**Objetivo:** Caixa de entrada WhatsApp ponta-a-ponta com uazapi, camada anti-ban completa, captura automática de leads, heartbeat com reconexão.

**Entregas:**

- [ ] `lib/whatsapp/adapter.ts` — interface `WhatsAppAdapter { sendText, sendMedia, getStatus, generateQR, disconnect }`
- [ ] `lib/whatsapp/uazapi.ts` — implementação Standard
- [ ] `lib/whatsapp/anti-ban.ts` — rate-limit por workspace, jitter aleatório (30–90s), janela horária (default 9h–21h por workspace), pausa a cada 50 envios consecutivos, blacklist por opt-out, escalonamento gradual de até 20%/dia
- [ ] Schema: `whatsapp_connections`, `conversations`, `messages`, `message_templates`, `quick_replies`, `blacklist`, `whatsapp_health_log`, `bulk_campaigns`
- [ ] Tela `/settings/connections` com QR Code real, status em tempo real (Realtime), health score visual, histórico de desconexões
- [ ] Edge Function `whatsapp-heartbeat` agendada a cada 60s via `pg_cron`; queda dispara push + email + pausa cadências em fila
- [ ] Reconexão automática + processamento de fila acumulada ao restabelecer
- [ ] Webhook inbound `app/api/webhooks/whatsapp/route.ts` — verifica origem, idempotência por hash, persiste mensagem, sync via Realtime
- [ ] Inbox (`/inbox`) ligada a dados reais — mocks de M5 substituídos
- [ ] Envio: texto, imagem, áudio gravado, documento — **todos passam por `anti-ban.ts`** antes de tocar o adapter
- [ ] Captura automática: primeira mensagem inbound de número novo → cria lead + atribui round-robin + dispara cadência de boas-vindas (placeholder de cadência ainda mock até M10)
- [ ] Opt-out por palavras-chave (PARE/SAIR/CANCELAR) → adiciona à blacklist + cancela envios pendentes
- [ ] Variação automática de templates (3+ variações rotativas por template em massa)
- [ ] Disparador de campanha em massa com agendamento e respeito aos limites anti-ban
- [ ] Notificações push: nova mensagem recebida, queda de conexão
- [ ] Storage para mídias trocadas (bucket `whatsapp-media`, cleanup órfão)
- [ ] Testes de integração: enviar texto → receber resposta → opt-out → blacklist

**Commit final:** `feat(whatsapp): uazapi adapter with anti-ban, real-time inbox and capture`

---

## M10 — Motor de Cadência + Alertas de Lead Frio

**Branch:** `m10-cadence-engine`

**Objetivo:** Cadências automáticas executando com pausa inteligente, alertas de lead frio disparando push/in-app, métricas por cadência.

**Entregas:**

- [ ] Schema: `cadences`, `cadence_steps`, `cadence_enrollments`, `cadence_step_runs`, `cold_lead_thresholds`, `cold_lead_alerts`
- [ ] Editor visual de cadência por etapa (M5 já tem UI; aqui conecta ao backend)
- [ ] Templates pré-configurados (imobiliário, B2B, alto ticket) seedados
- [ ] Edge Function `cadence-runner` agendada a cada 5 min via `pg_cron`
- [ ] Resolver de placeholders ({nome}, {empresa}, {produto}) por lead
- [ ] **Pausa automática quando cliente responde** (cancela `pending` enrollments do lead até reativação manual)
- [ ] Reativação manual de cadência pelo vendedor
- [ ] Edge Function `cold-lead-detector` agendada a cada 1h
- [ ] Defaults configuráveis por workspace: 7d Novo, 14d Em Contato, 7d Proposta, 5d Negociação, 30d global
- [ ] Notificação push + in-app para vendedor + gestor quando lead esfria
- [ ] Métricas por cadência: enrollments ativos, taxa de resposta, taxa de avanço de etapa, taxa de conversão final
- [ ] Tela `/reports` complementada com seção "Cadências" (volume disparado, performance por cadência)
- [ ] Testes de integração: enroll → step 1 envia → cliente responde → pausa → vendedor reativa → step 2 envia
- [ ] Testes de integração: lead criado → 7 dias sem interação → alerta dispara

**Commit final:** `feat(cadence): automated follow-up engine with smart pause and cold lead alerts`

---

## M11 — Agentes IA + Cérebro da Empresa (pgvector)

**Branch:** `m11-ai-agents`

**Objetivo:** Agentes Claude configuráveis atendendo conversas com memória em 3 camadas, base de conhecimento em pgvector, handoffs (agente↔agente e agente→humano), versionamento de prompt.

**Entregas:**

- [ ] Schema: `ai_agents`, `agent_versions`, `agent_routing_rules`, `agent_sessions`, `agent_messages`, `lead_summaries`, `knowledge_base_fields`, `knowledge_documents`, `knowledge_chunks`, `knowledge_embeddings` (pgvector)
- [ ] Extensão `pgvector` habilitada no Supabase
- [ ] `lib/ai/claude.ts` — wrapper Anthropic SDK com **prompt caching** habilitado (system + base de conhecimento estável)
- [ ] `lib/ai/embeddings.ts` — `text-embedding-3-small` (OpenAI), batch + cache local
- [ ] `lib/ai/memory.ts` — sessão (últimas N mensagens, isolada por agente), lead (resumo persistido em `lead_summaries`, compartilhado), empresa (top-K via pgvector, compartilhado)
- [ ] Editor de agente (M5 já tem UI) — conectado ao backend; salva versão a cada update
- [ ] Versionamento e rollback de prompt (lista de versões + diff visual)
- [ ] Chat de simulação dentro do editor — usa Claude real com prompt da versão em edição, sem efeito colateral
- [ ] Roteador de agentes por etapa, tag, número conectado, palavra-chave
- [ ] Handoff agente → agente: gatilho (palavra-chave, mudança de etapa, comando), resumo automático passado ao próximo, pausa do anterior
- [ ] Handoff humano: manual (botão "Assumir conversa"), palavra-chave, intenção comercial detectada, mudança para Negociação, fora do horário comercial
- [ ] Pausa automática do agente após handoff humano (até vendedor reativar)
- [ ] Resumo entregue ao vendedor no handoff: perfil do lead, demandas, etapa, próxima ação sugerida, qual agente vinha atendendo
- [ ] Cérebro da Empresa: campos estruturados (sobre, produtos, FAQ, scripts, política) + upload PDF/DOC/DOCX/TXT/MD com extração de texto e chunking + embeddings
- [ ] Versionamento da base de conhecimento (snapshots por mudança)
- [ ] Métricas por agente: total de conversas, taxa de resolução sem handoff, tempo médio de resposta, satisfação inferida (sentimento da última mensagem)
- [ ] Enforcement: limite de 3 agentes ativos no Pro IA (M12 fará billing-aware)
- [ ] Custo de tokens contabilizado em `usage_events` (preparação para M12)

**Commit final:** `feat(ai): claude agents with 3-layer memory, pgvector knowledge base and handoffs`

---

## M12 — Stripe Billing + Trial + Bloqueio Progressivo

**Branch:** `m12-billing`

**Objetivo:** Planos Pro / Pro IA / Enterprise com Stripe Checkout, Customer Portal, webhooks idempotentes, trial de 7d sem cartão e bloqueio progressivo.

**Entregas:**

- [ ] Schema: `subscriptions`, `plans`, `plan_limits`, `usage_events`, `trial_state`, `subscription_events`
- [ ] Produtos e prices criados no Stripe (test e prod): Pro R$ 197/mês, Pro IA R$ 497/mês, Enterprise (price flexível)
- [ ] Trial de 7 dias **sem cartão** criado no signup do workspace
- [ ] Avisos D-2 e D-1 (push + email) antes do fim do trial
- [ ] Tela `/settings/billing` (apenas Owner): plano atual, próxima cobrança, método de pagamento, histórico de faturas
- [ ] Stripe Checkout para upgrade/downgrade
- [ ] Stripe Customer Portal embutido (atualizar cartão, baixar fatura, cancelar)
- [ ] Webhook `app/api/webhooks/stripe/route.ts` com **verificação de assinatura** + idempotência por `event_id`
- [ ] Eventos tratados: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`
- [ ] Enforcement de limites por plano: usuários, leads ativos, disparos/mês, números WhatsApp, agentes IA, storage
- [ ] Bloqueio progressivo: read-only por 30 dias após cancelamento; após, scheduled deletion (com confirmação por email)
- [ ] Notificações de pagamento falhado (in-app + email; sem push, conforme matriz)
- [ ] Tela de bloqueio quando limite excedido com CTA de upgrade
- [ ] Métricas internas: MRR, churn, trial → paid conversion (PostHog)
- [ ] Testes E2E: trial → upgrade → webhook → plano ativo

**Commit final:** `feat(billing): stripe checkout, customer portal, trial flow and progressive lockout`

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
