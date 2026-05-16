-- M10#2 — Motor de cadência: RPC de seleção + invocador + cron schedule.
--
-- Espelha estruturalmente o setup do M9#5 (heartbeat): pg_cron a cada 5 min
-- chama uma função SQL que dispara `net.http_post` pra Edge Function
-- `cadence-runner` (Deno, deployada via MCP `deploy_edge_function`). A Edge
-- seleciona enrollments prontos via `cadence_runner_pick_candidates`,
-- reivindica slot via INSERT idempotente em `cadence_step_runs`, e POSTa cada
-- step pra rota interna Next `/api/internal/cadence-dispatch` que reusa
-- anti-ban + uazapi + adapter do M9 (decisão arquitetural: motor delega envio,
-- não reimplementa stack TS em Deno).
--
-- **Por que 5 min e não 1 min**: cadência tem granularidade de dias
-- (`day_offset` em {0,1,3,7,14,30}). Latência de 5 min é imperceptível e
-- reduz pressão no DB + Edge runtime + Vercel ~12×. Pode ajustar pra
-- `* * * * *` (1 min) sem rework de schema.
--
-- **Idempotência forte**: a RPC retorna candidatos; a Edge tenta INSERT
-- `cadence_step_runs (enrollment_id, step_id)` com `UNIQUE` do M10#1. Se
-- duas invocações do cron sobrepuserem, a segunda perde no conflict —
-- nunca há envio duplicado.
--
-- **Secrets**:
--   - `app.supabase_url` e `app.cadence_runner_secret` configurados via
--     `ALTER DATABASE postgres SET app.<key> = '...'`.
--   - Edge Function valida contra env `CADENCE_RUNNER_SECRET` (header
--     `x-cadence-runner-secret`).
--   - Edge Function chama rota Next com `CADENCE_DISPATCH_SECRET` em header
--     `authorization: Bearer ...` (configurado em `supabase secrets set`).
--
-- Pré-requisito: este arquivo assume que a migration M10#1
-- (`20260521120000_m10_1_cadence_schema.sql`) já criou as tabelas
-- `cadence_enrollments`, `cadence_steps`, `cadence_step_runs` e suas
-- constraints/índices. Se rodar `supabase db reset` sem #69 mergeado,
-- as funções abaixo dão erro de tabela ausente — esperado.

-- ============================================================================
-- 1. Extensões (idempotente — também declaradas em M9#5)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- 2. RPC: seleciona enrollments prontos com seu próximo step pendente
-- ============================================================================
--
-- Estratégia: pra cada enrollment `active` com `next_run_at <= NOW()`, encontra
-- via `LATERAL` o primeiro `cadence_step` (menor `day_offset`, depois
-- `order_index`) que ainda NÃO tem row em `cadence_step_runs` (LEFT JOIN +
-- `r.id IS NULL`). Limita N pra cap de batch da Edge Function.
--
-- **Atenção arquitetural**: a query trata QUALQUER `cadence_step_runs` row
-- (sent/skipped/failed) como "step executado". Skip transiente
-- (`outside_business_hours`/`rate_limit`) também avança ao próximo step.
-- Retry do MESMO step em transient block exigiria DELETE do skipped row
-- antes do backoff — adiado pra M10.x. Trade-off escolhido em M10#2: simples
-- e previsível.
--
-- `SECURITY DEFINER` + `search_path` fixo pra rodar como dono da função
-- (bypassa RLS — necessário pra cross-tenant select da Edge). Service Role
-- consumindo a RPC já tem acesso total; isso só estabiliza o search_path
-- contra schema injection (Postgres best practice).

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
  ORDER BY e.next_run_at
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.cadence_runner_pick_candidates(int) IS
  'M10#2 — seleciona até N enrollments active com seu próximo step não-executado. Consumida pela Edge Function cadence-runner via Service Role. LATERAL JOIN garante apenas 1 step retornado por enrollment.';

-- ============================================================================
-- 3. Invocador do cron — dispara HTTP POST pra Edge Function
-- ============================================================================
--
-- `net.http_post` é assíncrono. Pg_cron só dispara; o trabalho real é a Edge
-- selecionar candidatos, reivindicar slots e POSTar pra rota dispatch. Se
-- algo cair, o próximo tick de 5 min retenta — idempotente.

CREATE OR REPLACE FUNCTION public.invoke_cadence_runner()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, cron
AS $$
DECLARE
  v_project_url text;
  v_secret text;
  v_request_id bigint;
BEGIN
  v_project_url := current_setting('app.supabase_url', true);
  v_secret := current_setting('app.cadence_runner_secret', true);

  IF v_project_url IS NULL OR v_project_url = '' THEN
    RAISE NOTICE 'invoke_cadence_runner: app.supabase_url not configured — skipping';
    RETURN NULL;
  END IF;
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'invoke_cadence_runner: app.cadence_runner_secret not configured — skipping';
    RETURN NULL;
  END IF;

  SELECT extensions.http_post(
    url := v_project_url || '/functions/v1/cadence-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cadence-runner-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_cadence_runner() IS
  'M10#2 — invoca a Edge Function cadence-runner via pg_net. Agendada por pg_cron a cada 5 min. Lê app.supabase_url + app.cadence_runner_secret de Postgres settings.';

-- ============================================================================
-- 4. Schedule no pg_cron (idempotente)
-- ============================================================================

DO $$
BEGIN
  -- Remove agendamento anterior se existir (idempotente em replays).
  PERFORM cron.unschedule('cadence-runner-every-5-min')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cadence-runner-every-5-min'
  );

  -- `*/5 * * * *` = a cada 5 min. Granularidade de cadência é dias —
  -- 5 min é mais que suficiente.
  PERFORM cron.schedule(
    'cadence-runner-every-5-min',
    '*/5 * * * *',
    $cron$ SELECT public.invoke_cadence_runner() $cron$
  );
END $$;
