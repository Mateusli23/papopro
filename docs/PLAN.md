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

| Sprint   | Dias    | Marcos cobertos |
| -------- | ------- | --------------- |
| Sprint 1 | 1–15    | M1, M2          |
| Sprint 2 | 16–30   | M3              |
| Sprint 3 | 31–45   | M4              |
| Sprint 4 | 46–60   | M5              |
| Sprint 5 | 61–75   | M6, M7          |
| Sprint 6 | 76–90   | M8              |
| Sprint 7 | 91–105  | M9, M10         |
| Sprint 8 | 106–120 | M11, M12, M13   |

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

## M4 — Leads, Pipeline e Kanban (UI completa, mockada)

**Branch:** `m4-leads-kanban-ui`

**Objetivo:** Listagem de leads, página de detalhe e Kanban com drag-and-drop totalmente navegáveis com fixtures realistas. Mostra densidade visual, filtros, atalhos.

**Entregas:**

- [ ] Fixtures: 50 leads coerentes em `apps/web/lib/fixtures/leads.ts` (com timeline, tarefas, anexos)
- [ ] `/leads/page.tsx` — tabela densa estilo Attio: nome, telefone, etapa, vendedor, temperatura, valor, última interação, próxima ação, tags
- [ ] Filtros combináveis em chips (status, etapa, vendedor, origem, tag, temperatura, período de cadastro) — funcionais client-side sobre fixtures
- [ ] Busca por nome/telefone/email/empresa (filtro client-side)
- [ ] Modal "Adicionar lead" com formulário Zod
- [ ] Modal "Importar CSV" com upload + mapeamento visual de colunas + preview
- [ ] `/leads/[id]/page.tsx` — 3 colunas: ficha (esquerda), timeline cronológica (centro), próximas ações (direita)
- [ ] Timeline com tipos visuais distintos: mensagem WhatsApp, ligação, email, reunião, nota interna (fundo amarelo), tarefa, mudança de etapa, anexo
- [ ] Editor inline de campos da ficha (clique → edita → salva no fixture)
- [ ] `/kanban/page.tsx` com colunas customizáveis e cards densos
- [ ] Drag-and-drop com `@dnd-kit` (entre etapas + reordenar dentro da coluna)
- [ ] Indicador de temperatura no canto superior do card
- [ ] Indicador de "deal rotting" no canto do card (vermelho atrasado / amarelo próximo / verde do dia / cinza sem) — paleta Pipedrive
- [ ] Top bar com switch de visualização (Kanban / Lista)
- [ ] Atalhos: `n` adiciona lead, `/` foca busca, `Esc` fecha modal/detalhe
- [ ] Empty states tratados (sem leads, sem resultados de filtro, sem etapas)
- [ ] Mobile: Kanban vira lista colapsável por etapa; detalhe vira tabs

**Commit final:** `feat(web): leads list, detail page and kanban with drag-and-drop (mocked)`

---

## M5 — Inbox, Agentes, Cadências, Tarefas e Configurações (UI mockada)

**Branch:** `m5-features-ui`

**Objetivo:** UI das demais features de domínio. Maior marco de UI do plano — finaliza o produto navegável de ponta a ponta com fixtures.

**Entregas — Inbox WhatsApp:**

- [ ] `/inbox/page.tsx` em 3 painéis: lista de conversas (esquerda), thread (centro), ficha do lead (direita)
- [ ] Composer: texto + emoji picker, anexar imagem/áudio/documento, gravação de áudio (Web Audio API)
- [ ] Bolhas com timestamps, check de leitura, indicador "digitando..."
- [ ] Notas internas com fundo amarelo + ícone de cadeado
- [ ] Botões de respostas rápidas (templates do workspace)
- [ ] Atalhos: `Enter` envia, `Shift+Enter` quebra linha, `↑↓` navega conversas, `Esc` fecha thread
- [ ] Filtros: vendedor, status (aguardando/respondido/arquivado), etapa, sem resposta há X dias

**Entregas — Agentes IA:**

- [ ] `/agents/page.tsx` — lista de agentes com status, conversas atendidas, taxa de handoff
- [ ] `/agents/new` e `/agents/[id]` — editor com prompt, persona, tom, gatilhos de handoff
- [ ] 4 templates pré-configurados (Qualificação SDR, Atendimento, Recuperação, Em branco)
- [ ] Configuração de roteamento (etapa, tag, número, palavra-chave)
- [ ] Chat de simulação dentro do editor (mock de respostas)
- [ ] Tela "Cérebro da Empresa" com campos editáveis estilo Notion (sobre, produtos, FAQ, scripts, política)
- [ ] Upload de arquivos para base de conhecimento (UI + lista, sem processar)
- [ ] Versionamento e rollback (UI mockada)

**Entregas — Cadências:**

- [ ] `/cadences/page.tsx` — lista de cadências por etapa
- [ ] Editor visual de passos: D+0, D+1, D+3, D+7, D+14, D+30 com canal (WhatsApp/email) e template
- [ ] Templates pré-configurados (imobiliário, B2B, alto ticket) selecionáveis

**Entregas — Tarefas e Calendário:**

- [ ] `/tasks/page.tsx` com abas "Minhas tarefas", "Atribuídas a mim", "Calendário"
- [ ] Calendário views mês/semana/dia (`react-day-picker` customizado)
- [ ] Modal de criação com tipo, status, prazo, lembrete, recorrência, atribuição

**Entregas — Configurações:**

- [ ] `/settings/workspace`, `/settings/team`, `/settings/billing`, `/settings/notifications`, `/settings/connections`, `/settings/integrations`
- [ ] Tela "Conexões" com QR Code mockado, status, health score visual, histórico de desconexões
- [ ] Preferências de notificação por evento × canal (matriz PRD §3.2)
- [ ] Convite de membros (lista + form de convite com papel RBAC)

**Entregas — Relatórios:**

- [ ] `/reports/page.tsx` com cards: total de leads, pipeline aberto, conversão por etapa, tempo médio por etapa, leads esfriando, performance por vendedor
- [ ] Gráfico de funil (Recharts) com volume e valor por etapa

**Commit final:** `feat(web): inbox, agents, cadences, tasks, reports and settings UI (mocked)`

---

## M6 — Landing Page

**Branch:** `m6-landing`

**Objetivo:** Landing page completa em `apps/landing` com 8 seções, otimizada para Lighthouse 90+, calculadora de ROI funcional e formulário de trial linkando para `app.`.

**Entregas:**

- [ ] Hero com proposta de valor + CTA principal "Começar grátis 7 dias"
- [ ] Seção de problema com estatísticas (48% / 80% / 92% / 79%) com fontes citadas
- [ ] Seção de funcionalidades em 4 blocos (Kanban + WhatsApp + IA + Cadência) com mockups/screenshots
- [ ] Seção de demo em vídeo com poster placeholder (vídeo a ser produzido depois)
- [ ] Calculadora de ROI funcional: input leads/mês + ticket médio → output receita estimada recuperada
- [ ] Tabela de planos (Pro R$197 / Pro IA R$497 / Enterprise sob consulta) com CTAs distintos
- [ ] FAQ acordeão (LGPD, troca de plano, cancelamento, segurança, suporte)
- [ ] Seção CTA final + formulário (nome, email, senha, empresa) → POST mockado redirect para `app.pipeflow.com.br/signup`
- [ ] Botão WhatsApp flutuante (link `wa.me`)
- [ ] SEO: meta tags por seção, schema.org `SoftwareApplication`, sitemap.xml + robots.txt
- [ ] OG image dinâmica (Vercel OG) ou estática
- [ ] Snippets de Meta Pixel + GA4 condicionados a env (não disparam em dev)
- [ ] Lighthouse ≥ 90 em performance, acessibilidade, best practices, SEO
- [ ] Responsivo mobile-first; testado em 360px, 768px, 1280px

**Commit final:** `feat(landing): full landing page with 8 sections, ROI calculator and SEO`

---

## M7 — Backend Foundation: Supabase + Auth + Multi-tenant + RLS

**Branch:** `m7-backend-foundation`

**Objetivo:** Substituir os mocks de auth/workspace por Supabase real. Schema mínimo, RLS aplicada, helper de contexto de workspace, convites por email funcionando.

**Entregas:**

- [ ] Projeto Supabase Pro provisionado (região São Paulo)
- [ ] `packages/db` com Prisma: schema inicial (`users`, `workspaces`, `workspace_members`, `invitations`, `audit_logs`, `notification_preferences`, `webhook_events`)
- [ ] Migration inicial aplicada
- [ ] Policies RLS em todas as tabelas (leitura/escrita filtra por `workspace_id` + papel RBAC)
- [ ] `lib/supabase/with-workspace.ts` — helper que abre transação, faz `SET LOCAL app.workspace_id = $1` e roda callback
- [ ] `lib/supabase/{client,server,admin}.ts` configurados (anon vs service role)
- [ ] Supabase Auth integrado: signup com confirmação de email, login, recuperar senha, logout em todos dispositivos
- [ ] Server Actions de auth substituem mocks de M3
- [ ] Convite por email via Resend + aceite via magic link
- [ ] Switcher de workspace lê `workspace_members` real
- [ ] Wizard de onboarding (M3) cria workspace de verdade
- [ ] Middleware com gate de auth + redirect inteligente (0/1/N workspaces)
- [ ] RBAC enforce nas Server Actions: helper `requireRole(ctx, ['Owner', 'Admin'])`
- [ ] Log de auditoria em eventos críticos (login, criação de workspace, convite, mudança de papel)
- [ ] Tela `/settings/team` lista membros, status de convite, permite mudar papel (Owner/Admin)
- [ ] Testes E2E (Playwright): signup → verificação email → login → criar workspace → convidar → aceitar
- [ ] Sentry capturando erros de Server Actions e API routes

**Commit final:** `feat(backend): supabase auth, multi-tenant workspaces and RLS policies`

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
