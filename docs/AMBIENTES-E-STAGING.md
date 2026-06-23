# PapoPro — Ambientes, Staging e Rotina Segura de Deploy

Este documento define como evoluir o PapoPro todos os dias sem mexer diretamente no app em produção.

## Situação atual identificada

- Repositório: `Mateusli23/papopro`
- Branch default atual: `dev`
- Branch de produção/release: `main`
- CI existente: `.github/workflows/ci.yml`
  - roda em `push` e `pull_request` para `dev` e `main`
  - valida `lint`, `typecheck`, `format:check` e `build`
- Environments no GitHub já existem:
  - `Preview`
  - `Production`
- `main` já possui proteção com check obrigatório `lint + typecheck + build`
- `dev` ainda deve ser protegida para impedir push direto acidental
- Stack de dados: Supabase/Postgres com variáveis `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`

## Objetivo

Trabalhar sempre neste fluxo:

```text
feature branch → Pull Request → dev/staging → Pull Request de release → main/produção
```

Ou seja:

- `main` representa produção.
- `dev` representa integração/staging.
- Cada melhoria diária nasce em uma branch pequena.
- Nada é alterado diretamente na produção.

## Ambientes recomendados

### 1. Produção

Uso: usuários reais.

- Branch: `main`
- Deploy: produção
- Banco: Supabase produção
- Dados: reais
- Variáveis devem apontar para o projeto Supabase real

Exemplo conceitual:

```env
NEXT_PUBLIC_APP_URL=https://app.pipeflow.com.br
NEXT_PUBLIC_SUPABASE_URL=https://<supabase-prod-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-prod>
SUPABASE_SERVICE_ROLE_KEY=<service-role-prod>
DATABASE_URL=<postgres-pooled-prod>
DIRECT_URL=<postgres-direct-prod>
NODE_ENV=production
```

### 2. Staging / Preview

Uso: testar mudanças antes dos usuários.

- Branch: `dev` ou deploy preview de PR
- Deploy: staging/preview
- Banco: Supabase staging separado
- Dados: fake ou cópia anonimizada
- Variáveis devem apontar para o projeto Supabase staging

Exemplo conceitual:

```env
NEXT_PUBLIC_APP_URL=https://staging.pipeflow.com.br
NEXT_PUBLIC_SUPABASE_URL=https://<supabase-staging-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-staging>
SUPABASE_SERVICE_ROLE_KEY=<service-role-staging>
DATABASE_URL=<postgres-pooled-staging>
DIRECT_URL=<postgres-direct-staging>
NODE_ENV=production
LOG_LEVEL=debug
```

### 3. Local

Uso: desenvolvimento do dia a dia.

- Branch: `feat/*`, `fix/*`, `chore/*`
- Banco: Supabase local via Docker ou Supabase staging, dependendo da tarefa
- Nunca usar banco de produção para desenvolvimento local

## Regra de ouro dos bancos

Os bancos não ficam sincronizando em tempo real.

```text
Produção → banco real
Staging  → banco de teste
Local    → banco local ou teste
```

Quando staging precisar de dados parecidos com produção, usar uma destas opções:

1. dados fake gerados por seed;
2. cópia manual/controlada;
3. cópia anonimizada semanal;
4. cópia parcial apenas de tabelas não sensíveis.

Nunca copiar sem revisão:

- senhas/tokens;
- chaves de API;
- dados de pagamento;
- conversas privadas;
- documentos;
- telefones/emails reais sem anonimização;
- webhooks reais de cobrança, WhatsApp ou emails.

## Processo diário de desenvolvimento

### 1. Atualizar base local

```bash
git checkout dev
git pull origin dev
```

### 2. Criar branch para uma tarefa pequena

```bash
git checkout -b feat/nome-curto-da-melhoria
```

Padrões:

- `feat/*` para funcionalidade nova
- `fix/*` para correção
- `chore/*` para configuração/manutenção
- `docs/*` para documentação
- `hotfix/*` para correção urgente

### 3. Implementar e testar

Antes de abrir PR, rodar:

```bash
pnpm install --frozen-lockfile
pnpm --filter @papopro/db db:generate
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

### 4. Abrir PR para `dev`

```text
feat/* → dev
```

O PR só deve ser aceito se:

- CI passou;
- revisão foi feita;
- não toca em produção diretamente;
- se houver migration, ela foi testada no staging/local.

### 5. Validar no staging

Após merge na `dev`, testar no ambiente de staging:

- login/cadastro;
- dashboard;
- features afetadas;
- webhooks desativados ou apontando para sandbox;
- migrations aplicadas no banco staging;
- logs sem erro crítico.

### 6. Promover para produção

Quando a `dev` estiver estável:

```text
dev → main
```

Abrir PR de release para `main`.

Antes do merge em `main`:

- CI verde;
- checklist de release concluído;
- backup do banco de produção, se houver migration;
- plano de rollback conhecido.

## Checklist inicial para preparar o PapoPro

### GitHub

- [x] Confirmar repositório `Mateusli23/papopro`
- [x] Confirmar CI existente
- [x] Confirmar `main` protegida
- [ ] Proteger branch `dev`
- [ ] Habilitar auto-delete de branches após merge
- [ ] Opcional: habilitar auto-merge após CI verde

### Supabase

- [ ] Confirmar projeto Supabase de produção
- [ ] Criar projeto Supabase de staging separado
- [ ] Aplicar migrations no staging
- [ ] Criar dados fake/seed de staging
- [ ] Configurar secrets do staging sem usar secrets de produção

### Deploy

- [ ] Confirmar onde produção está rodando: Vercel, Railway, Render ou outro
- [ ] Criar app/projeto de staging ou preview
- [ ] Configurar variáveis de ambiente do staging
- [ ] Garantir que `main` faz deploy em produção
- [ ] Garantir que `dev` ou PR faz deploy em staging/preview

### Segurança

- [ ] Conferir se nenhuma `.env.local` foi commitada
- [ ] Separar chaves de produção e staging
- [ ] Usar Stripe test mode em staging
- [ ] Usar Resend/email em modo seguro ou domínio de teste em staging
- [ ] Usar webhooks de teste em staging
- [ ] Não usar número WhatsApp real de produção em staging

## Checklist de release para produção

Antes de mergear `dev → main`:

- [ ] CI verde
- [ ] Staging testado manualmente
- [ ] Migrations testadas em staging
- [ ] Variáveis de ambiente confirmadas
- [ ] Backup do banco real, se migration alterar dados importantes
- [ ] Plano de rollback definido
- [ ] Logs monitorados após deploy

## Decisão importante

Para preparar o ambiente completo, precisamos das informações operacionais que não devem ficar no Git:

1. onde o app está hospedado;
2. qual projeto Supabase é produção;
3. se já existe ou não Supabase staging;
4. quais domínios serão produção e staging;
5. se o deploy será automático por Vercel/GitHub ou manual.

Essas informações entram em secrets/variáveis do provedor, não neste arquivo.
