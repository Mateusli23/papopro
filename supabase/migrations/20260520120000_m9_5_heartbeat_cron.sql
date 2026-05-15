-- M9#5 — Heartbeat WhatsApp via Edge Function agendada por pg_cron + pg_net.
--
-- Setup canônico (PRD §6 / CLAUDE.md §6): a cada 1 minuto pg_cron chama uma
-- função SQL que dispara `net.http_post` pra Edge Function
-- `whatsapp-heartbeat` (deployada via MCP `deploy_edge_function`). A Edge
-- itera `whatsapp_instances` connected, checa status no uazapi, atualiza
-- `health_score`/`last_seen_at`, registra `WhatsappEvent`.
--
-- **Por que 1 minuto e não 60s exatos**: pg_cron mínimo é 1 minuto (`* * * * *`).
-- Pra heartbeat realtime crítico precisaria de external scheduler; pro MVP
-- 1 min cobre detecção rápida de queda (~30s média).
--
-- **Idempotente**: extensões via `CREATE IF NOT EXISTS`; `cron.schedule` via
-- `cron.unschedule` + re-create.
--
-- **Secret**: `app.heartbeat_secret` é Postgres setting persistido por banco
-- (`ALTER DATABASE postgres SET app.heartbeat_secret = '...'`). Edge Function
-- valida contra env `HEARTBEAT_SECRET` configurado em
-- `supabase secrets set HEARTBEAT_SECRET=...` ou via MCP. Operador deve
-- configurar ambos pra que o cron chegue na Edge.

-- ============================================================================
-- 1. Extensões
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- 2. Função SQL que invoca a Edge Function
-- ============================================================================
--
-- `net.http_post` é assíncrono — retorna um request_id e a resposta vai pra
-- `net._http_response`. Não bloqueamos no resultado: heartbeat real é a Edge
-- escrever no DB; pg_cron só dispara. Se a Edge falhar, o próximo cron 1min
-- depois tenta de novo (idempotente).

CREATE OR REPLACE FUNCTION public.invoke_whatsapp_heartbeat()
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
  -- URL do projeto Supabase. Operador configura via:
  --   ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co'
  v_project_url := current_setting('app.supabase_url', true);
  v_secret := current_setting('app.heartbeat_secret', true);

  IF v_project_url IS NULL OR v_project_url = '' THEN
    RAISE NOTICE 'invoke_whatsapp_heartbeat: app.supabase_url not configured — skipping';
    RETURN NULL;
  END IF;
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'invoke_whatsapp_heartbeat: app.heartbeat_secret not configured — skipping';
    RETURN NULL;
  END IF;

  SELECT extensions.http_post(
    url := v_project_url || '/functions/v1/whatsapp-heartbeat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-heartbeat-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_whatsapp_heartbeat() IS
  'M9#5 — invoca a Edge Function whatsapp-heartbeat via pg_net. Agendada por pg_cron a cada 1 min. Lê app.supabase_url + app.heartbeat_secret de Postgres settings.';

-- ============================================================================
-- 3. Schedule no pg_cron (idempotente)
-- ============================================================================

DO $$
BEGIN
  -- Remove agendamento anterior se existir (idempotente em replays).
  PERFORM cron.unschedule('whatsapp-heartbeat-every-minute')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-heartbeat-every-minute'
  );

  -- Cria novo. `* * * * *` = a cada minuto. Mínimo permitido pelo pg_cron.
  PERFORM cron.schedule(
    'whatsapp-heartbeat-every-minute',
    '* * * * *',
    $cron$ SELECT public.invoke_whatsapp_heartbeat() $cron$
  );
END $$;

COMMENT ON EXTENSION pg_cron IS
  'Job scheduler — usado pelo M9#5 pra invocar a Edge Function whatsapp-heartbeat a cada 1 min.';
