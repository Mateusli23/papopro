-- ============================================================================
-- M12#2 — Trial de 7 dias sem cartão
-- ============================================================================
-- Adiciona o estado de trial ao workspace. O trial é LOCAL — NÃO há
-- subscription Stripe durante o trial (sem cartão). Por isso é modelado como
-- colunas em `workspaces`, e não como um `subscription_status` 'trialing'.
--
--   - trial_ends_at:        fim do trial (created_at + 7d), setado pelo
--                           createWorkspaceAction na criação do workspace.
--   - trial_warn_d2_sent_at / trial_warn_d1_sent_at: idempotência dos avisos
--                           D-2/D-1 disparados pelo job diário
--                           (/api/cron/trial-warnings).
--
-- Expiração é LAZY: `getActivePlan` (lib/limits.ts) compara NOW() <
-- trial_ends_at ao vivo — sem job de downgrade. Durante o trial o workspace
-- tem acesso equivalente ao Pro.
--
-- Sem backfill: workspaces existentes ficam trial_ends_at NULL (sem trial).
-- RLS: `workspaces` já tem políticas (migration init) — ADD COLUMN não pede
-- policy nova.
-- ============================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS trial_ends_at         timestamptz,
  ADD COLUMN IF NOT EXISTS trial_warn_d2_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_warn_d1_sent_at timestamptz;

COMMENT ON COLUMN public.workspaces.trial_ends_at IS
  'Fim do trial de 7d sem cartão (created_at + 7d). NULL = workspace sem trial. M12#2.';
COMMENT ON COLUMN public.workspaces.trial_warn_d2_sent_at IS
  'Quando o aviso D-2 de trial expirando foi enviado. NULL = ainda não enviado. M12#2.';
COMMENT ON COLUMN public.workspaces.trial_warn_d1_sent_at IS
  'Quando o aviso D-1 de trial expirando foi enviado. NULL = ainda não enviado. M12#2.';

-- Índice parcial pro job diário de avisos: varre só workspaces que têm trial
-- e não estão deletados. Mantém a varredura barata conforme a base cresce.
CREATE INDEX IF NOT EXISTS workspaces_trial_ends_at_idx
  ON public.workspaces (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL AND deleted_at IS NULL;
