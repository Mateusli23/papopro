-- ============================================================================
-- M10#4 — cold-lead-detector
-- ============================================================================
--
-- Detecta leads que esfriaram (sem interação há mais que o threshold da etapa)
-- e popula `cold_lead_alerts`. Schema das tabelas + 5 thresholds default já
-- vieram em M10#1. M10#4 entrega:
--
--   1. RPC `cold_lead_detect_candidates` consumida pela Edge Function
--      `cold-lead-detector` cross-tenant a cada hora.
--   2. Extensão do trigger M10#1 `pause_cadence_on_inbound` pra auto-acknowledge
--      cold alerts pendentes quando o lead responde — usuário vê o badge zerar
--      sozinho, sem precisar clicar "marcar como visto".
--   3. Novo trigger `auto_ack_cold_on_stage_change` em `leads AFTER UPDATE OF
--      stage_id` pra auto-ack quando vendedor move o lead manualmente
--      (presume re-engajamento).
--   4. pg_cron schedule horário invocando a Edge Function via pg_net
--      (mesmo pattern de M9#5 heartbeat + M10#2 cadence-runner).
--
-- **Não cria tabelas nem altera schema** — M10#1 já tem `cold_lead_thresholds`
-- + `cold_lead_alerts` + `leads.temperature` + `leads.cold_alerted_at`.

-- ============================================================================
-- 1. Extensões (idempotente — também criadas em M9#5 e M10#2)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- ============================================================================
-- 2. RPC cold_lead_detect_candidates
-- ============================================================================
--
-- Para cada lead ativo, encontra o threshold mais específico que se aplica
-- (stage_id matching > stage_id NULL global) e checa se `idle_since +
-- days_inactive < NOW()`. Filtra:
--
--   - leads.deleted_at IS NULL  (soft-deleted nunca alerta)
--   - leads.status = 'ativo'    (arquivado/perdido/ganho não alerta)
--   - leads.temperature <> 'cold' AND leads.cold_alerted_at IS NULL
--       (defense-in-depth — evita re-alertar leads já marcados; trigger
--        M10#1 inbound + trigger stage_change abaixo zeram esses campos
--        quando há sinal de re-engajamento).
--   - threshold.enabled = true
--
-- `idle_since = COALESCE(last_interaction_at, created_at)` — leads pré-M9 sem
-- interaction_at registrado usam created_at como baseline.
--
-- `DISTINCT ON (l.id) ORDER BY l.id, t.stage_id NULLS LAST` faz o threshold
-- específico ganhar precedência. Postgres avalia NULL maior que qualquer
-- valor por default; `NULLS LAST` força o stage-específico pra vir primeiro.
--
-- SECURITY DEFINER pra Edge Function (Service Role) ler cross-tenant.
-- search_path fixo previne schema injection.

CREATE OR REPLACE FUNCTION public.cold_lead_detect_candidates(p_limit int DEFAULT 500)
RETURNS TABLE (
  workspace_id  uuid,
  lead_id       uuid,
  stage_id      uuid,
  threshold_id  uuid,
  days_inactive integer,
  idle_since    timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (l.id)
    l.workspace_id,
    l.id            AS lead_id,
    l.stage_id,
    t.id            AS threshold_id,
    t.days_inactive,
    COALESCE(l.last_interaction_at, l.created_at) AS idle_since
  FROM public.leads l
  JOIN public.cold_lead_thresholds t
    ON  t.workspace_id = l.workspace_id
    AND t.enabled = true
    AND (t.stage_id = l.stage_id OR t.stage_id IS NULL)
  WHERE l.deleted_at      IS NULL
    AND l.status          = 'ativo'
    AND l.temperature    <> 'cold'
    AND l.cold_alerted_at IS NULL
    AND COALESCE(l.last_interaction_at, l.created_at)
        + (t.days_inactive || ' days')::interval <= NOW()
  ORDER BY l.id, t.stage_id NULLS LAST
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.cold_lead_detect_candidates(int) IS
  'M10#4 — leads que ultrapassaram threshold de inatividade (specific stage > global). Consumida pela Edge Function cold-lead-detector via Service Role. DISTINCT ON garante 1 threshold/lead.';

-- ============================================================================
-- 3. Extensão do trigger pause_cadence_on_inbound (M10#1 → M10#4)
-- ============================================================================
--
-- M10#1 original já pausa enrollments + re-aquece cold→warm + zera
-- cold_alerted_at em `leads`. M10#4 adiciona um UPDATE final pra auto-ack
-- cold_lead_alerts pendentes — sem isso o badge global continuaria pulsando
-- depois do lead responder.
--
-- `acknowledged_by_id = NULL` é proposital: o ack é automático, não veio de
-- um usuário específico. NULL diferencia auto-ack de ack manual via UI.

CREATE OR REPLACE FUNCTION public.pause_cadence_on_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  IF NEW.direction <> 'in' THEN
    RETURN NEW;
  END IF;

  SELECT c.lead_id INTO v_lead_id
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Pausa cadências (M10#1).
  UPDATE public.cadence_enrollments
     SET status        = 'paused',
         paused_at     = NOW(),
         paused_reason = 'lead_replied',
         updated_at    = NOW()
   WHERE lead_id = v_lead_id
     AND status  = 'active';

  -- Atualiza last_interaction_at + re-aquece lead se estava frio (M10#1).
  -- NÃO degrada 'hot' (sinal explícito de alta intenção) pra 'warm'.
  UPDATE public.leads
     SET last_interaction_at = NEW.created_at,
         temperature         = CASE WHEN temperature = 'cold' THEN 'warm'::public.lead_temperature ELSE temperature END,
         cold_alerted_at     = NULL,
         updated_at          = NOW()
   WHERE id = v_lead_id;

  -- M10#4: auto-ack cold alerts pendentes. NULL em acknowledged_by_id marca
  -- ack automático; audit log emitido logo abaixo registra `auto=true` +
  -- `trigger='lead_replied'` pra rastro LGPD diferenciar ack manual vs
  -- automático sem depender só do user_id NULL.
  WITH acked AS (
    UPDATE public.cold_lead_alerts
       SET acknowledged_at    = NOW(),
           acknowledged_by_id = NULL
     WHERE lead_id            = v_lead_id
       AND acknowledged_at    IS NULL
    RETURNING id, workspace_id, threshold_id
  )
  INSERT INTO public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, changes)
  SELECT
    workspace_id,
    NULL,
    'cold_lead_acknowledged'::public.audit_action,
    'cold_lead_alert',
    id,
    jsonb_build_object('auto', true, 'trigger', 'lead_replied', 'lead_id', v_lead_id, 'threshold_id', threshold_id)
  FROM acked;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.pause_cadence_on_inbound() IS
  'M10#1 + M10#4: Pausa cadências, re-aquece lead, e auto-ack cold alerts pendentes (com audit log auto=true) quando lead responde (PRD §2.2). Disparado por AFTER INSERT em messages com direction=in.';

-- Trigger M10#1 já existe; CREATE OR REPLACE FUNCTION acima cobre o upgrade
-- sem precisar recriar o trigger.

-- ============================================================================
-- 4. Trigger novo: auto-ack quando vendedor move o lead de etapa
-- ============================================================================
--
-- Move de etapa = vendedor agiu no lead manualmente. Mesma semântica que o
-- inbound: presume re-engajamento, fecha alerts pendentes. Também zera
-- temperature cold→warm e cold_alerted_at pra simetria com pause_cadence_on_inbound.

CREATE OR REPLACE FUNCTION public.auto_ack_cold_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Só age quando stage_id mudou de verdade (UPDATE ... OF stage_id já filtra
  -- mas no triggers WHEN não conseguimos referenciar OLD/NEW direto sem CASE).
  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  -- Auto-ack cold alerts pendentes do lead + audit log com trigger=stage_changed.
  -- Mesmo padrão de pause_cadence_on_inbound — rastro LGPD diferencia auto
  -- vs manual via `auto=true` no changes.
  WITH acked AS (
    UPDATE public.cold_lead_alerts
       SET acknowledged_at    = NOW(),
           acknowledged_by_id = NULL
     WHERE lead_id            = NEW.id
       AND acknowledged_at    IS NULL
    RETURNING id, workspace_id, threshold_id
  )
  INSERT INTO public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, changes)
  SELECT
    workspace_id,
    NULL,
    'cold_lead_acknowledged'::public.audit_action,
    'cold_lead_alert',
    id,
    jsonb_build_object(
      'auto', true,
      'trigger', 'stage_changed',
      'lead_id', NEW.id,
      'threshold_id', threshold_id,
      'old_stage_id', OLD.stage_id,
      'new_stage_id', NEW.stage_id
    )
  FROM acked;

  -- Re-aquece cold→warm (mesma lógica do inbound). Não degrada hot.
  -- Mantém last_interaction_at intocado — movimento de etapa não conta como
  -- interação direta com o cliente.
  IF NEW.temperature = 'cold' THEN
    NEW.temperature     := 'warm'::public.lead_temperature;
    NEW.cold_alerted_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_ack_cold_on_stage_change() IS
  'M10#4 — auto-ack cold alerts + re-aquece quando vendedor move o lead de etapa (presume re-engajamento).';

DROP TRIGGER IF EXISTS auto_ack_cold_on_stage_change ON public.leads;
CREATE TRIGGER auto_ack_cold_on_stage_change
  BEFORE UPDATE OF stage_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.auto_ack_cold_on_stage_change();

-- ============================================================================
-- 5. Cron schedule horário (pattern M9#5 / M10#2)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.invoke_cold_lead_detector()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, cron
AS $$
DECLARE
  v_project_url text;
  v_secret      text;
  v_request_id  bigint;
BEGIN
  v_project_url := current_setting('app.supabase_url', true);
  v_secret      := current_setting('app.cold_lead_detector_secret', true);

  IF v_project_url IS NULL OR v_project_url = '' THEN
    RAISE NOTICE 'invoke_cold_lead_detector: app.supabase_url not configured — skipping';
    RETURN NULL;
  END IF;
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'invoke_cold_lead_detector: app.cold_lead_detector_secret not configured — skipping';
    RETURN NULL;
  END IF;

  SELECT extensions.http_post(
    url := v_project_url || '/functions/v1/cold-lead-detector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cold-lead-detector-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_cold_lead_detector() IS
  'M10#4 — invoca a Edge Function cold-lead-detector via pg_net. Agendada por pg_cron de hora em hora. Lê app.supabase_url + app.cold_lead_detector_secret de Postgres settings.';

-- Schedule horário (0 * * * * = a cada hora cheia). Cold lead tem granularidade
-- de dias; horário é mais que suficiente.
DO $$
BEGIN
  PERFORM cron.unschedule('cold-lead-detector-hourly')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cold-lead-detector-hourly'
  );

  PERFORM cron.schedule(
    'cold-lead-detector-hourly',
    '0 * * * *',
    $cron$ SELECT public.invoke_cold_lead_detector() $cron$
  );
END $$;
