-- ============================================================================
-- M10 followup — guard de `scheduled_for` na RPC cadence_runner_pick_candidates
-- ============================================================================
--
-- **Bug (P1):** a RPC original (M10#2) só filtrava `e.next_run_at <= NOW()`.
-- Quando um step disparava `backoffAfterTransientBlock` (rate-limit, janela
-- horária, conexão instável etc.), o dispatch:
--   1. marcava o step atual como `skipped`
--   2. setava `enrollment.next_run_at = NOW() + 30min`
--
-- 30 min depois, a RPC selecionava o "próximo step não-executado" desse
-- enrollment — D+1, D+3 etc. — porque o LEFT JOIN considera qualquer
-- step_run (sent OU skipped) como "executado". Como a RPC não validava se
-- `enrolled_at + day_offset` já tinha chegado, dispatchava D+1 em 30 min
-- após D+0, comprimindo uma cadência de dias em minutos.
--
-- **Fix:** adicionar a condição `(e.enrolled_at + s.day_offset days) <= NOW()`.
-- O step só vira candidato quando o seu instante absoluto (`enrolled_at +
-- day_offset`) já passou. `enrollment.next_run_at` continua válido como
-- limiar inferior — útil pra backoff +30min adiar a próxima checagem; o
-- AND com `scheduled_for` impede o overshoot pro próximo step.
--
-- **Tradeoff conhecido:** quando o step atual é marcado `skipped` por
-- bloqueio transiente, ele é perdido (o D+0 não envia mais). Retry do
-- MESMO step ficou pra M10.x (ver comentário em route.ts:53-57). Esse fix
-- corrige só a compressão — não o "step perdido".
--
-- **Compatibilidade:** `CREATE OR REPLACE FUNCTION` mantém assinatura
-- idêntica (RETURNS TABLE com mesmas colunas). Edge Function `cadence-runner`
-- consome sem mudança. Migration é idempotente — pode rodar 2x sem efeito.

CREATE OR REPLACE FUNCTION public.cadence_runner_pick_candidates(p_limit int DEFAULT 100)
RETURNS TABLE (
  enrollment_id uuid,
  workspace_id uuid,
  lead_id uuid,
  cadence_id uuid,
  step_id uuid,
  scheduled_for timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id AS enrollment_id,
    e.workspace_id,
    e.lead_id,
    e.cadence_id,
    s.id AS step_id,
    (e.enrolled_at + (s.day_offset || ' days')::interval) AS scheduled_for
  FROM public.cadence_enrollments e
  JOIN public.cadences c ON c.id = e.cadence_id
  JOIN LATERAL (
    SELECT cs.id, cs.day_offset, cs.order_index
    FROM public.cadence_steps cs
    LEFT JOIN public.cadence_step_runs r
      ON r.enrollment_id = e.id AND r.step_id = cs.id
    WHERE cs.cadence_id = c.id
      AND r.id IS NULL
    ORDER BY cs.day_offset, cs.order_index
    LIMIT 1
  ) s ON true
  WHERE e.status = 'active'
    AND c.status = 'active'
    AND e.next_run_at <= NOW()
    -- Guard contra compressão: step só vira candidato quando seu instante
    -- absoluto (enrolled_at + day_offset) já chegou. Sem isso, backoff +30min
    -- no enrollment fazia o próximo step (D+1, D+3) disparar 30 min após o
    -- anterior em vez de no dia certo.
    AND (e.enrolled_at + (s.day_offset || ' days')::interval) <= NOW()
  ORDER BY e.next_run_at
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.cadence_runner_pick_candidates(int) IS
  'M10#2 + followup — seleciona até N enrollments active com seu próximo step não-executado E cujo scheduled_for absoluto (enrolled_at + day_offset) já chegou. Consumida pela Edge Function cadence-runner via Service Role. LATERAL JOIN garante apenas 1 step retornado por enrollment.';
