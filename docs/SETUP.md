# PapoPro — Guia de Setup

> Roteiro de tudo que precisa estar pronto pra rodar o projeto, ordenado pelo
> marco do [PLAN.md](PLAN.md) que primeiro depende de cada item. Você não
> precisa ter tudo pronto no dia 1 — só o que está marcado em **🔴 agora**.

---

## 0. Tooling local (faça uma vez)

| Item                | Como instalar                                                                              | Verificar                         |
| ------------------- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| Node 20 LTS         | [nodejs.org](https://nodejs.org/) ou `winget install OpenJS.NodeJS.LTS`                    | `node --version` → v20.x          |
| pnpm 9+             | `npm install -g pnpm@9.15.0`                                                               | `pnpm --version` → 9.15.0         |
| Git                 | [git-scm.com](https://git-scm.com/)                                                        | `git --version`                   |
| GitHub CLI          | `winget install GitHub.cli` (recomendado)                                                  | `gh --version`                    |
| Cursor / VS Code    | [cursor.sh](https://cursor.sh/)                                                            | extensão Claude Code já instalada |
| TablePlus / DBeaver | [tableplus.com](https://tableplus.com/) (free) ou [DBeaver Community](https://dbeaver.io/) | inspecionar Postgres do Supabase  |

> **Heads-up:** se a sua rede tiver proxy SSL corporativo (vimos isso no M1), o
> `pnpm install` pode falhar com `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Não desabilite
> `strict-ssl` global. O CI no GitHub Actions roda sem proxy e funciona normal.

> **Heads-up 2 (Windows + Node 22+):** se o `pnpm dev` subir mas chamadas HTTPS
> do servidor (Supabase Auth via `@supabase/ssr`, Resend) falharem com
> `UNABLE_TO_VERIFY_LEAF_SIGNATURE` — sintoma típico: tela de login mostra "Não
> foi possível entrar agora" — exporte `NODE_USE_SYSTEM_CA=1` no shell antes de
> subir. Faz o Node confiar no cert store do Windows em vez do bundle interno
> (que pode estar faltando intermediário do Supabase/Cloudflare). Linux/Mac/Vercel
> ignoram a flag, então é seguro habilitar como default no Windows. Comando:
> `NODE_USE_SYSTEM_CA=1 pnpm dev`. Descoberta operacional do M7#4.

---

## 1. Já está pronto (M1) ✅

Gerados localmente e gravados em `apps/web/.env.local`:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` — par ECDSA P-256, RFC 8292
- `AUTH_SECRET` — 32 bytes random base64

Pra regenerar:

```bash
node scripts/generate-vapid.mjs --env                                      # VAPID
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" # AUTH_SECRET
```

> Importante: **reutilize as mesmas chaves em produção** (Vercel env vars). Se
> regenerar, todos os clientes do PWA precisarão se reinscrever no push.

---

## 2. Antes de M2–M6 (UI, dias 16–60) — opcional mas recomendado

Nada aqui bloqueia o desenvolvimento da UI mockada. São contas free que vale
abrir cedo pra começar a instrumentar.

### 🟡 GitHub repo

**Por quê:** ativa CI rodando de verdade + branch protection no `main`.
**Como:**

1. `gh auth login` (escolha HTTPS + browser auth)
2. `gh repo create papopro --private --source=. --remote=origin --push`
3. Pra branch protection após o primeiro PR mergear:
   ```bash
   gh api repos/{owner}/papopro/branches/main/protection -X PUT \
     --input .github/branch-protection.json
   ```
   _(arquivo `branch-protection.json` ainda não existe; criamos quando ativar)_

### 🟡 Sentry — free tier (wired up em M7#6)

**Por quê:** captura non-fatal de Server Actions (audit log fail, email fail, transaction fail) em prod. Em dev sem DSN é no-op silente (console.error preservado).
**Onde:** [sentry.io/signup](https://sentry.io/signup/)
**O que pegar:** 1 DSN do projeto `papopro-web` (o `papopro-landing` fica pra quando a landing tiver mais lógica). Não precisamos de `SENTRY_AUTH_TOKEN` por enquanto — M7#6 NÃO usa `withSentryConfig`, então não há upload de source maps.
**Onde colar:** `NEXT_PUBLIC_SENTRY_DSN_WEB` em `apps/web/.env.local` (e nas Environment Variables da Vercel pra preview/prod).
**Sentry em ação:** os 11 `reportNonFatal(scope, err, ctx)` em Server Actions enviam pra Sentry. Scopes seguem convenção `<feature>.<action>.<step>` (ex: `auth.login.audit`, `invitations.invite.email-send`) — agrupe alerts no dashboard por isso. Scrubber LGPD remove password/token/email/etc antes do envio (ver `apps/web/lib/observability/scrubber.ts`).

### 🟡 PostHog — free tier (1M eventos/mês)

**Por quê:** product analytics desde a landing. Funil de ativação fica mais rico quanto antes começar.
**Onde:** [posthog.com/signup](https://posthog.com/signup) (escolha **US Cloud** ou **EU Cloud** — ajuste `NEXT_PUBLIC_POSTHOG_HOST`).
**O que pegar:** `Project API Key` (começa com `phc_`).
**Onde colar:** `apps/{web,landing}/.env.local` na var `NEXT_PUBLIC_POSTHOG_KEY`.

### 🟡 Anthropic API key

**Por quê:** vai ser usado no M11, mas o setup é instantâneo e você só paga pelo uso.
**Onde:** [console.anthropic.com](https://console.anthropic.com/) → Settings → API Keys.
**O que pegar:** `sk-ant-...`.
**Onde colar:** `apps/web/.env.local` em `ANTHROPIC_API_KEY`.

---

## 3. Antes do M6 (Landing, dia 60) — bloqueante

### 🔴 Domínio `.com.br`

**Por quê:** landing referencia `pipeflow.com.br` no microcopy + Resend depende.
**Onde:** [registro.br](https://registro.br/) (~R$40/ano).
**Custo:** R$40 (1 ano) ou R$120 (3 anos).
**Pegadinhas:**

- DNS leva até 48h pra propagar — registre cedo.
- Você vai precisar do CPF.
- Defina os DNS pra Vercel quando estiver pronto pra deployar (M13). Por ora, deixe nos nameservers default do Registro.br.

### 🟡 Meta Pixel + GA4 — antes do M6

**Por quê:** snippets já vão na landing condicionados a env var (não dispara em dev).
**Meta Pixel:** [business.facebook.com](https://business.facebook.com) → Events Manager → Conectar Fontes de Dados → Web. Pegue `Pixel ID` (15 dígitos).
**GA4:** [analytics.google.com](https://analytics.google.com) → criar Property → Web → pegar `Measurement ID` (`G-XXXXXXXXXX`).
**Onde colar:** `apps/landing/.env.local`.

---

## 4. Antes do M7 (Backend Foundation, dia 75) — bloqueante

### 🔴 Supabase

**Por quê:** auth + Postgres + storage + realtime + pgvector + pg_cron.
**Onde:** [supabase.com](https://supabase.com/) → Sign in with GitHub → New Project.
**Plano:** comece em **Free** (suficiente até abrirmos beta). Suba pra **Pro (US$25/mês)** antes do beta fechado pra ter:

- Backup diário
- Resource limits maiores
- Daily compute up to 4GB
- 8GB database

**Configuração:**

- Region: **South America (São Paulo)** — `sa-east-1`
- Strong password no DB
- Pricing plan: Free pra dev, Pro quando virar beta

**O que pegar (Settings → API):**

- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **nunca expor no client**

**Connection strings (Settings → Database → Connection string):**

- **Pooled** (PgBouncer transaction mode, port 6543) → `DATABASE_URL`
- **Direct** (port 5432, pra Prisma migrations) → `DIRECT_URL`

**Extensões a habilitar (Database → Extensions):**

- `pg_trgm` (busca por similaridade em leads)
- `pgcrypto` (UUIDs, hashes)
- `vector` (pgvector pro Cérebro da Empresa em M11)
- `pg_cron` (jobs de cadência, lead frio, heartbeat)

> Se quiser, posso adiantar um Edge Function placeholder + a primeira migration
> do M7 (workspaces + RLS) assim que você me passar as keys.

### 🔴 Resend + DNS

**Por quê:** convite por email (M7), notificação de queda de WhatsApp, trial expirando.
**Pré-requisito:** domínio registrado E SPF/DKIM configurados.
**Onde:** [resend.com/signup](https://resend.com/signup).
**Plano:** **Pro US$20/mês** (100k emails/mês, domínios verificados).
**O que fazer:**

1. Adicionar domínio `pipeflow.com.br`
2. Resend te dá ~4 registros DNS (TXT pra SPF, CNAMEs pra DKIM, MX). Adicionar no Registro.br (Painel → DNS → editar zona).
3. Aguardar verificação (5min–24h dependendo do TTL do DNS).
4. Pegar `API Key` (Settings → API Keys, escopo `Sending access`).
5. Colar em `RESEND_API_KEY`.

---

## 4.4 Dev local sem Supabase Cloud — stack em Docker (alternativa robusta)

**Por quê:** o caminho default (apontar `.env.local` pro Supabase cloud `iffmjydjeukozopxxitb`) funciona bem na maioria das máquinas, **mas falha em redes com antivírus interceptando HTTPS** — Kaspersky, Bitdefender, ESET, Trend Micro, Zscaler corporativo etc. Sintomas: `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (signup), `Can't reach database server` (Prisma), `Tenant or user not found` (pooler do Supabase).

Solução: rodar a stack inteira do Supabase em containers locais via Supabase CLI + Docker. Zero TLS pra antivírus interceptar (tudo em `127.0.0.1`), zero pooler do Supavisor, dev offline-capable.

**Pré-requisitos (instalar uma vez):**

1. **Docker Desktop** — `https://www.docker.com/products/docker-desktop` (no Windows precisa WSL 2; o instalador habilita)
2. **Supabase CLI** — pode usar:
   - macOS: `brew install supabase/tap/supabase`
   - Linux: `npx -y supabase` (sem install) ou download da release
   - Windows: download direto de `https://github.com/supabase/cli/releases` (winget falha por TLS quando há antivírus interceptando)

**Setup:**

```bash
# 1. Sobe a stack (primeira vez baixa ~3GB de imagens, 5-8min; depois é cache)
supabase start

# 2. Vê as URLs e keys que ele gerou
supabase status --output env
# Output: API_URL, ANON_KEY (JWT), SERVICE_ROLE_KEY (JWT), DB_URL, etc.

# 3. Atualiza apps/web/.env.local:
#    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#    NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY do supabase status>
#    SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
#    DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
#    DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
#    (sem `sslmode=no-verify` — localhost não tem antivírus interceptando)

# 4. pnpm dev — Next vai falar com o Supabase do container
pnpm dev
```

**O que sobe** (todos em `127.0.0.1`):

- **API** (PostgREST + GoTrue Auth + Storage + Kong) — `:54321`
- **Postgres** — `:54322`
- **Studio** (admin UI tipo pgAdmin/Supabase web) — `:54323`
- **Mailpit** (inbox fake — emails de signup/convite caem aqui em vez de Resend real) — `:54324`

**Migrations:** `supabase start` aplica automaticamente o que está em `supabase/migrations/`. As 2 migrations iniciais (`init_auth_and_multi_tenant` + `harden_m7_2`) foram replicadas do cloud em 2026-05-12. Pra criar nova:

```bash
supabase migration new <slug>           # cria arquivo timestamped em supabase/migrations/
# edita o SQL
supabase db reset                       # apaga banco local + reaplica TUDO desde o início (idempotente)
# quando aprovado, sobe pro cloud:
supabase link --project-ref iffmjydjeukozopxxitb   # uma vez por máquina
supabase db push                                    # aplica só as migrations não-aplicadas no cloud
```

**Comandos do dia-a-dia:**

```bash
supabase start              # de manhã quando ligar o PC
supabase stop               # à noite (mantém os dados)
supabase stop --no-backup   # se quiser apagar o banco local (signups de teste etc.)
supabase status             # ver URLs/keys/health
```

**Edge runtime desabilitado:** em [supabase/config.toml](../supabase/config.toml) o `[edge_runtime]` está `enabled = false`. Motivo: Deno (que roda edge functions) tenta baixar `deno.land/std` no bootstrap, e em redes com antivírus interceptando isso falha com `UnknownIssuer`. PapoPro só usa edge functions a partir do M10/M11 (motor de cadência), então desligar agora não impacta. Reabilita quando chegar lá.

**Em prod (Vercel) tudo isso é irrelevante:** o Vercel aponta pro Supabase cloud (`iffmjydjeukozopxxitb`), sem Docker, sem `sslmode=no-verify`, sem CA bundle. A stack local existe **só pra desbloquear dev**.

---

## 4.45 Windows + antivírus interceptando HTTPS — fix do Node TLS

**Sintoma:** `UNABLE_TO_VERIFY_LEAF_SIGNATURE` em qualquer chamada HTTPS do Node (signup Supabase, `npm install`, Prisma, Resend etc.).

**Causa:** antivírus instalou um cert root próprio no `Cert:\LocalMachine\Root` do Windows pra reassinar TLS (SSL inspection). Node, Prisma engine (Rust) e Deno têm CA bundles internos que NÃO enxergam o trust store do Windows — então tudo que esses runtimes batem em HTTPS quebra.

**Fix (uma vez por máquina):**

```powershell
# 1. Exporta o trust store do Windows pra .windows-ca-bundle.pem (gitignored)
.\scripts\export-windows-ca.ps1

# 2. Aponta NODE_EXTRA_CA_CERTS pro bundle (persistente)
setx NODE_EXTRA_CA_CERTS "$(Resolve-Path .\.windows-ca-bundle.pem)"

# 3. Reabre o terminal (setx só vale em sessões NOVAS)
```

[turbo.json](../turbo.json) já declara `NODE_EXTRA_CA_CERTS` em `globalEnv`, então o Turbo propaga pro `next dev` filho.

**Pra Prisma + Supabase pooler** (caso esteja usando cloud em dev, não-recomendado em redes com antivírus): adiciona `&sslmode=no-verify` em `DATABASE_URL` e `DIRECT_URL`. O engine Rust do Prisma tem trust store próprio que `NODE_EXTRA_CA_CERTS` não cobre. Em prod (Vercel) tira esse parâmetro.

**Em prod (Vercel) nada disso é necessário:** rede do Vercel não tem o antivírus do seu PC. As env vars `NODE_EXTRA_CA_CERTS` e `sslmode=no-verify` só existem em dev local.

---

## 4.5 Rodar E2E Playwright localmente (M7#6 — opcional)

**Por quê:** os 3 specs Playwright em `apps/web/e2e/*.spec.ts` cobrem o fluxo crítico (signup→verify→login→onboarding, invite→accept, team management incluindo HIGH #1 + #2 + #3). Rodar local antes de PR confirma que não quebramos nada.

**O que precisa:**

### 🔴 Projeto Supabase dedicado a E2E

**NUNCA usar o projeto de produção** (`iffmjydjeukozopxxitb`). O helper `apps/web/e2e/helpers/supabase-admin.ts` tem guard rail que trava se você apontar pro projeto de prod, mas mesmo assim crie um separado:

1. Em [supabase.com](https://supabase.com) clica "New project". Sugiro nome `papopro-e2e`, região `sa-east-1` (São Paulo, mesma de prod), plano Free.
2. Aplica a migration inicial de M7#2: `psql $E2E_DATABASE_URL -f docs/m7-2-migration.sql` (ou cola o SQL no SQL Editor do Dashboard).
3. Pega `URL` (Project Settings → API → Project URL) e `service_role secret` (Project Settings → API → Project API keys → service_role).
4. Cola em `apps/web/.env.local`:

```
E2E_SUPABASE_URL=https://<ref>.supabase.co
E2E_SUPABASE_SERVICE_ROLE_KEY=<service_role_secret>
```

### 🔴 RESEND_MODE=outbox

Pra Playwright interceptar emails sem disparar Resend real, ativa o modo outbox:

```
RESEND_MODE=outbox
```

Em modo outbox, `sendEmail()` escreve em `apps/web/e2e/.tmp/outbox.jsonl` (gitignored) em vez de tocar HTTP. Specs leem do arquivo. **Deixa `RESEND_MODE` vazio em prod** — modo outbox em produção significaria emails de convite NÃO saindo (mas ficando no filesystem do servidor 😱).

### 🔴 Instalar browser Chromium do Playwright

```
pnpm --filter @papopro/web e2e:install
```

Baixa Chromium (~150MB) na primeira vez. Subsequentes runs reusam.

### Rodar

```bash
# Headless (CI-like):
pnpm --filter @papopro/web e2e

# UI interativo (debug, time-travel, network inspector):
pnpm --filter @papopro/web e2e:ui

# Spec específico:
pnpm --filter @papopro/web e2e e2e/01-auth-flow.spec.ts
```

O `playwright.config.ts` sobe `pnpm dev` automaticamente como webServer (timeout 120s pra primeira compilação do Next). Em CI (`process.env.CI`), força instância fresca; local reusa se já tiver `pnpm dev` rodando.

**Reports:** `apps/web/playwright-report/index.html` abre o relatório HTML após o run. Traces (`test-results/<spec>/trace.zip`) só ficam em failure — abrir via [trace.playwright.dev](https://trace.playwright.dev/).

---

## 5. Antes do M9 (WhatsApp, dia 91) — bloqueante

### 🔴 uazapi

**Por quê:** WhatsApp Standard (Whatsmeow). Maior risco operacional do produto.
**Onde:** [uazapi.com](https://uazapi.com/) ou similar.
**Custo:** ~R$30/número/mês.
**O que pegar:**

- `BASE_URL` (depende do servidor que assinar)
- `API_KEY`
- `WEBHOOK_SECRET` (você define)
- 1 chip dedicado pra dev (não use número pessoal!) — pode ser chip pré-pago de R$10
  **Onde colar:** `apps/web/.env.local` em `UAZAPI_*`.
  **Webhook URL pra apontar:** `https://app.pipeflow.com.br/api/webhooks/whatsapp` em prod, `http://localhost:3000/api/webhooks/whatsapp` em dev (precisa de `ngrok` ou `cloudflared` pra expor).

---

## 6. Antes do M11 (IA, dia 105) — bloqueante

### 🔴 OpenAI API key (apenas embeddings)

**Por quê:** `text-embedding-3-small` pro Cérebro da Empresa (pgvector).
**Onde:** [platform.openai.com](https://platform.openai.com/) → API keys.
**Modelo:** `text-embedding-3-small` (US$0.02 / 1M tokens — barato).
**Custo estimado:** US$1–5/mês com volume razoável.
**O que pegar:** `sk-proj-...`.
**Onde colar:** `OPENAI_API_KEY`.

> Anthropic já foi configurado em §2.

---

## 7. Antes do M12 (Stripe, dia 113) — bloqueante

### 🔴 Stripe (test mode primeiro)

**Por quê:** billing + Customer Portal + webhooks.
**Onde:** [stripe.com/br](https://stripe.com/br) → criar conta brasileira.
**Modo:** comece em **test mode**, ative live só na hora do beta público.

**O que pegar (Developers → API keys):**

- `pk_test_...` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `sk_test_...` → `STRIPE_SECRET_KEY`

**Webhook (Developers → Webhooks → Add endpoint):**

- URL: `http://localhost:3000/api/webhooks/stripe` em dev (com Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`)
- Eventos: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`
- Pegar `whsec_...` → `STRIPE_WEBHOOK_SECRET`

**Produtos a criar (Products):**

- `Pro` — preço recorrente mensal R$197 → pegar `price_id` → `STRIPE_PRICE_PRO_MONTHLY`
- `Pro IA` — preço recorrente mensal R$497 → `STRIPE_PRICE_PRO_AI_MONTHLY`
- Enterprise não precisa de price fixo (custom).

---

## 8. Antes do M13 (Deploy, dia 120) — bloqueante

### 🔴 Vercel Pro

**Por quê:** deploy de prod (`pipeflow.com.br` + `app.pipeflow.com.br`).
**Onde:** [vercel.com/signup](https://vercel.com/signup) → autenticar com GitHub.
**Plano:** **Pro US$20/mês** (necessário pra preview deploys ilimitados, custom domains, web analytics).
**Configurar 2 projetos:**

1. Importar repo, root = `apps/web`, framework = Next.js
2. Importar de novo, root = `apps/landing`, framework = Next.js
   **DNS:**

- `pipeflow.com.br` (apex) → projeto landing (CNAME do Vercel)
- `app.pipeflow.com.br` → projeto web (CNAME do Vercel)
  **Env vars:** colar TODAS as variáveis do `apps/{web,landing}/.env.local` em Vercel → Settings → Environment Variables.

### 🟡 Google Calendar OAuth (M8)

**Por quê:** sync bidirecional de tarefas com Google Calendar.
**Onde:** [console.cloud.google.com](https://console.cloud.google.com/) → Create Project → APIs & Services → OAuth consent screen + Credentials.
**Configurar:**

1. OAuth consent screen → External, scopes `calendar.events`, `calendar.readonly`
2. Credentials → OAuth 2.0 Client ID → Web application
3. Authorized redirect URIs: `http://localhost:3000/api/oauth/google/callback` + prod URL
   **Pegar:** `Client ID`, `Client secret` → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

---

## Checklist visual (ordem cronológica)

```
HOJE                               D-30                D-60                D-91                D-120
│                                    │                    │                   │                    │
✅ VAPID gerado                                                                                    │
✅ AUTH_SECRET gerado                                                                              │
🟡 GitHub repo  ───────────────────► │                    │                   │                    │
🟡 Sentry free                                                                                     │
🟡 PostHog free                                                                                    │
🟡 Anthropic key                                                                                   │
                                     🔴 Domínio  ────────►│                   │                    │
                                     🟡 Meta Pixel + GA4  │                   │                    │
                                                          🔴 Supabase ───────►│                    │
                                                          🔴 Resend (DNS)     │                    │
                                                                              🔴 uazapi ──────────►│
                                                                                                   🔴 OpenAI
                                                                                                   🔴 Stripe
                                                                                                   🔴 Vercel Pro
                                                                                                   🟡 Google OAuth
```

---

## Quanto vai custar mensalmente em produção?

| Categoria         | Item                        | Custo (mês)            |
| ----------------- | --------------------------- | ---------------------- |
| Infra             | Vercel Pro                  | US$20 (~R$110)         |
| Infra             | Supabase Pro                | US$25 (~R$140)         |
| Infra             | Sentry Team                 | US$26 (~R$145)         |
| Infra             | Resend Pro                  | US$20 (~R$110)         |
| Infra             | PostHog Free                | R$0 (até 1M eventos)   |
| Tooling           | Cursor + Anthropic Pro      | US$20 (~R$110)         |
| **Subtotal fixo** |                             | **~R$615/mês**         |
| Variável          | uazapi                      | ~R$30/número           |
| Variável          | Anthropic Claude tokens     | depende                |
| Variável          | OpenAI embeddings           | ~R$5/mês               |
| Variável          | Stripe (taxa por transação) | 3,99% + R$0,39         |
| Domínio           | Registro.br (anual)         | R$40/ano (~R$3,40/mês) |

Mais detalhe em [CLAUDE.md §2](../CLAUDE.md).
