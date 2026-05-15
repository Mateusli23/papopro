-- M8#5 — CSV import + webhook genérico de leads.
--
-- Adições mínimas pro endpoint `POST /api/webhooks/leads/[token]` funcionar e
-- pra UI de Settings → Connections gerenciar o token. Idempotente — replay
-- seguro local via `supabase db reset` e cloud via `supabase db push`.
--
-- Refs:
--  - schema source of truth: `packages/db/prisma/schema.prisma`
--  - decisões: `docs/PLAN.md` §M8#5

-- ============================================================================
-- 1. Estender enums existentes
-- ============================================================================

ALTER TYPE public.lead_origin   ADD VALUE IF NOT EXISTS 'webhook_generico';
ALTER TYPE public.audit_action  ADD VALUE IF NOT EXISTS 'webhook_token_regenerated';

-- ============================================================================
-- 2. Coluna `webhook_token` em workspaces
-- ============================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS webhook_token varchar(64);

-- Backfill nos workspaces existentes — todos ganham token na primeira execução.
-- `gen_random_bytes(32)` precisa da extensão `pgcrypto` (já habilitada em M7#2).
-- `encode(..., 'base64')` produz padding `=` e caracteres `+/`; ajustamos pra
-- URL-safe (base64url) com `replace`. Resultado: 43 chars sem padding.
UPDATE public.workspaces
   SET webhook_token = replace(replace(replace(
         encode(gen_random_bytes(32), 'base64'),
         '+', '-'), '/', '_'), '=', '')
 WHERE webhook_token IS NULL;

-- Unique apenas após backfill garantir não-nulo em todas as linhas existentes.
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_webhook_token_key
  ON public.workspaces (webhook_token);

COMMENT ON COLUMN public.workspaces.webhook_token IS
  'Token URL-safe (base64url, 43 chars) usado em /api/webhooks/leads/[token]. Owner/Admin regenera em Settings → Connections.';
