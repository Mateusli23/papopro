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

| Sprint   | Dias    | Marcos cobertos | Status                                                                       |
| -------- | ------- | --------------- | ---------------------------------------------------------------------------- |
| Sprint 1 | 1–15    | M1, M2          | ✅ concluído                                                                 |
| Sprint 2 | 16–30   | M3              | ✅ concluído                                                                 |
| Sprint 3 | 31–45   | M4              | ✅ concluído                                                                 |
| Sprint 4 | 46–60   | M5              | ✅ concluído — 6 / 6 sub-PRs + 2 polimentos (M5p#1, M5p#2)                   |
| Sprint 5 | 61–75   | M6, M7          | ⚠️ em andamento — M6 ✅ (3 / 3 sub-PRs entregues); M7 ⏳ (1 sub-PR entregue) |
| Sprint 6 | 76–90   | M8              | ⏳ pendente                                                                  |
| Sprint 7 | 91–105  | M9, M10         | ⏳ pendente                                                                  |
| Sprint 8 | 106–120 | M11, M12, M13   | ⏳ pendente                                                                  |

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

| Sub-PR | Escopo                                                                                                                                       | Branch                  | Status                           | PR                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------- | ------------------ |
| M7#1   | Setup Supabase & Chaves: SDK + `lib/supabase/{client,server,admin,with-workspace}.ts` + Prisma client lazy + smoke endpoint                  | `feat/supabase-core`    | ✅ entregue                      | _aguardando abrir_ |
| M7#2   | Schema inicial + RLS (`workspaces`, `users`, `workspace_members`, `invitations`, `audit_logs`, `notification_preferences`, `webhook_events`) | `m7-schema-rls`         | ✅ entregue                      | _aguardando abrir_ |
| M7#3   | Supabase Auth real: signup/login/forgot/verify + remove `AuthMockProvider` + middleware com `getUser()`                                      | `m7-schema-rls`         | ✅ entregue                      | _aguardando abrir_ |
| M7#4   | Convite por email (Resend) + aceite via magic link + wizard cria workspace real + switcher                                                   | `m7-invites-workspaces` | ✅ entregue (3 ondas, 3 commits) | _aguardando abrir_ |
| M7#5   | RBAC `requireRole(ctx, …)` + log de auditoria + tela `/settings/team` real                                                                   | _a definir_             | ⏳ pendente                      | —                  |
| M7#6   | Playwright E2E (signup→verify→login→workspace→convidar→aceitar) + Sentry em Server Actions                                                   | _a definir_             | ⏳ pendente                      | —                  |

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
- [ ] RBAC enforce nas Server Actions: helper `requireRole(ctx, ['Owner', 'Admin'])` _(M7#5)_
- [ ] Log de auditoria em eventos críticos (login, criação de workspace, convite, mudança de papel) _(M7#5)_
- [ ] Tela `/settings/team` lista membros, status de convite, permite mudar papel (Owner/Admin) _(M7#5)_
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
- [x] [`apps/web/app/api/smoke-test/workspaces/route.ts`](apps/web/app/api/smoke-test/workspaces/route.ts) — smoke endpoint cobrindo 33 asserts em 5 grupos: **slugify** (10 — diacritics, casos limite Unicode, truncate 64, non-string fallback), **ensureUniqueSlug** (5 — append -2, iteração, base livre, fallback "workspace", throw após 50), **schema** (5 — válido, < 2 chars, > 60, control chars, emoji+acento aceito), **initials** (6 — 1/2 palavras, vazio, espaços, lowercase→uppercase), **switcher-item** (8 — propagação + accent determinístico em índices 0/3/5). Não toca no banco — Server Actions exigem sessão real, cobertura E2E vai pro Playwright M7#6.

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

**Commit final do M7#4 (entregue só no último sub-PR):** já efetivado nos commits das 3 ondas — não há squash separado.

---

## M8 — Backend de Domínio: Leads, Deals, Pipelines, Tarefas

**Branch:** `m8-backend-domain`

**Objetivo:** Persistir o core do CRM. Substituir fixtures de M4 por queries reais com RLS. CRUD ponta-a-ponta funcional, importação de CSV, webhooks de entrada.

**Entregas:**

- [ ] Schema Prisma: `leads`, `deals`, `pipelines`, `pipeline_stages`, `tags`, `lead_tags`, `tasks`, `activities`, `attachments`, `custom_fields`, `lead_custom_values`
- [ ] RLS em todas (filtro por `workspace_id` + papel)
- [ ] Migrations versionadas + seed de pipeline default (Novo → Contato → Proposta → Negociação → Ganho/Perdido)
- [ ] Server Actions: `createLead`, `updateLead`, `deleteLead`, `assignLead`, `createDeal`, `moveDealStage` (com `order` por etapa), `addActivity`, `createTask`, `completeTask`, `addAttachment`
- [ ] Queries server-side: `listLeads(filters, pagination)`, `getLead(id)`, `listDeals`, `listTasks` — todas via `with-workspace`
- [ ] Defense-in-depth: toda query inclui `where: { workspaceId }` no código
- [ ] Tela `/leads` lê dados reais; filtros/busca usam Postgres (`pg_trgm` para similar, `tsvector` para full-text em texto longo)
- [ ] Detalhe do lead lê timeline real (consolidando `activities`, `messages` placeholder, `tasks`, mudanças de etapa)
- [ ] Kanban persiste drag-and-drop (`updateDealOrder` Server Action otimista)
- [ ] Importação CSV: até 1.000 linhas síncrono; >1.000 vai para Edge Function com email de confirmação
- [ ] Webhook genérico de leads: `app/api/webhooks/leads/[token]/route.ts` — token único por workspace, valida payload mínimo, cria lead, atribui round-robin
- [ ] Storage Supabase para anexos (bucket `attachments` com RLS)
- [ ] Cleanup de mídia órfã agendado (`pg_cron` diário)
- [ ] Integração Google Calendar (OAuth + sync bidirecional de tarefas a cada 2 min via Edge Function)
- [ ] Exportação CSV/XLSX (background + email com link 7d) com log de auditoria
- [ ] Realtime para mudanças de Kanban (Supabase Realtime channel `workspace:<id>:deals`)

**Commit final:** `feat(backend): leads, deals, pipelines, tasks crud with rls and csv import`

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
