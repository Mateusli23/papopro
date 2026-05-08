# PapoPro

CRM SaaS multi-empresa para times de vendas consultivas (1–15 vendedores) que usam **WhatsApp como canal principal**: motor de cadência automática, alertas de lead frio por etapa e caixa unificada com camada anti-bloqueio. Monorepo Turborepo + pnpm com Next.js 14 (landing + produto), Supabase Postgres com RLS, Prisma, Anthropic Claude (Sonnet) para agentes IA e Stripe para billing.

## Documentação

- **Briefing de engenharia:** [CLAUDE.md](CLAUDE.md) — stack, convenções, decisões arquiteturais críticas, regras a nunca violar.
- **Spec de produto:** [docs/PRD.md](docs/PRD.md) — requisitos completos.
- **Plano de execução:** [docs/PLAN.md](docs/PLAN.md) — 13 marcos em 120 dias.
- **Setup de ambiente:** [docs/SETUP.md](docs/SETUP.md) — guia de tooling local + contas externas, ordenado pelo marco que primeiro depende de cada item.

## Quick start

```bash
pnpm install
pnpm dev          # sobe landing (3001) e web (3000) em paralelo
pnpm lint         # ESLint em todos os pacotes
pnpm typecheck    # tsc --noEmit em todos os pacotes
pnpm build        # build de produção
```

Variáveis de ambiente: cada app tem seu próprio template — copie [apps/web/.env.local.example](apps/web/.env.local.example) e [apps/landing/.env.local.example](apps/landing/.env.local.example) pra `.env.local` no respectivo app. Pra ver onde gerar cada chave, ler [docs/SETUP.md](docs/SETUP.md).

## Estrutura

```
app_crm/
├── apps/
│   ├── landing/     pipeflow.com.br (raiz)
│   └── web/         app.pipeflow.com.br (produto/PWA)
├── packages/
│   ├── ui/          design system compartilhado (shadcn + tokens)
│   ├── db/          Prisma schema + client
│   └── config/      eslint, tsconfig, prettier, tailwind preset
└── docs/            PRD, plano de execução
```

## Requisitos

- Node 20 LTS (ver [.nvmrc](.nvmrc))
- pnpm 9+ (ver `packageManager` em [package.json](package.json))
- Git
