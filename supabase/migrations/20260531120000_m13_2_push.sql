-- ============================================================================
-- M13#2 — Push Notifications
-- ============================================================================
-- Duas tabelas novas + dois triggers de fanout.
--
--   push_subscriptions — 1 linha por dispositivo/browser. Guarda o
--     `PushSubscription` (endpoint + chaves p256dh/auth) que o web-push usa
--     pra entregar a notificação criptografada (RFC 8291). `endpoint` é
--     UNIQUE global: o mesmo browser sempre gera o mesmo endpoint pra a
--     mesma VAPID key, então re-assinar = UPSERT (re-atribui user_id quando
--     outro usuário loga no mesmo device).
--
--   notifications — feed in-app append-only (PRD §3.2: sino com histórico
--     de 30d). O canal `inapp` do dispatcher escreve aqui; o sino do topbar
--     lê. `read_at` é o único campo mutável. `event` é texto livre (não
--     enum) — mesma decisão de `usage_events.feature`: evita migration por
--     evento novo da matriz.
--
-- RLS: workspace-scoped via `current_workspace_id()` — mesmo padrão de
-- `notification_preferences`/`usage_events` (compatível com Prisma +
-- `withWorkspace`). O escopo por usuário (`user_id`) é aplicado no `where`
-- do app (defense-in-depth, CLAUDE.md §7.2) — nenhuma dessas tabelas é lida
-- direto pelo browser; tudo passa por Server Action / Server Component.
--
-- Triggers de fanout (eventos cujo gatilho NÃO está no app Next):
--   notify_on_cold_lead_alert    — AFTER INSERT em cold_lead_alerts
--                                  → POST /api/internal/notify (lead_cooling)
--   notify_on_whatsapp_unhealthy — AFTER UPDATE OF health_score
--                                  → POST /api/internal/notify (connection_down)
-- Ambos via `pg_net` (fire-and-forget, não bloqueia a transação) — mesmo
-- mecanismo de `invoke_cold_lead_detector` (M10#4). Mantém o fanout no SQL
-- que o operador já aplica, sem tocar/redesployar as Edge Functions.
-- ============================================================================

-- ============================================================================
-- 1. Extensão pg_net (idempotente — já criada em M9#5/M10#2/M10#4)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- 2. Tabela push_subscriptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.users(id)      ON DELETE CASCADE,
  -- Endpoint do push service (FCM/Mozilla/Apple). UNIQUE global: re-assinar
  -- o mesmo browser cai em UPSERT (ON CONFLICT (endpoint)).
  endpoint     text        NOT NULL,
  -- Chave pública ECDH do browser (base64url, ponto não-comprimido 65B).
  p256dh       text        NOT NULL,
  -- Segredo de autenticação do browser (base64url, 16B).
  auth         text        NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  -- Atualizado a cada re-sync do client (app load com permissão concedida).
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_workspace_user_idx
  ON public.push_subscriptions (workspace_id, user_id);

COMMENT ON TABLE public.push_subscriptions IS
  'M13#2 — PushSubscription por dispositivo. endpoint UNIQUE (re-assinar = upsert). RLS por workspace.';

-- ============================================================================
-- 3. Tabela notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.users(id)      ON DELETE CASCADE,
  -- Chave da matriz PRD §3.2 (new_lead_assigned, lead_cooling, ...). Texto
  -- livre — não vira enum pra não exigir migration por evento novo.
  event        varchar(48) NOT NULL,
  title        text        NOT NULL,
  body         text        NOT NULL,
  -- Deep-link clicável no sino e no `notificationclick` do service worker.
  url          text,
  -- NULL = não lida. Único campo mutável da linha.
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT NOW()
);

-- Índice do sino: feed por usuário, mais recentes primeiro, janela de 30d.
CREATE INDEX IF NOT EXISTS notifications_workspace_user_created_idx
  ON public.notifications (workspace_id, user_id, created_at DESC);

COMMENT ON TABLE public.notifications IS
  'M13#2 — feed in-app (PRD §3.2). Escrito pelo dispatcher (canal inapp), lido pelo sino. read_at é o único campo mutável. Retenção 30d (purge em M13#3).';

-- ============================================================================
-- 4. RLS — workspace-scoped (padrão notification_preferences/usage_events)
-- ============================================================================

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select ON public.push_subscriptions FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS push_subscriptions_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert ON public.push_subscriptions FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS push_subscriptions_update ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update ON public.push_subscriptions FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS push_subscriptions_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete ON public.push_subscriptions FOR DELETE
USING (workspace_id = public.current_workspace_id());

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS notifications_delete ON public.notifications;
CREATE POLICY notifications_delete ON public.notifications FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- ============================================================================
-- 5. Fanout via pg_net — helper + triggers
-- ============================================================================
--
-- `notify_dispatch` faz um POST fire-and-forget pra rota interna Next
-- `/api/internal/notify`, que resolve destinatários + preferências e
-- escreve in-app / dispara push / email. Lê `app.app_url` +
-- `app.notify_dispatch_secret` de Postgres settings — o operador configura
-- via `ALTER DATABASE postgres SET app.app_url = '...'` (mesmo mecanismo de
-- `app.supabase_url`/`app.cold_lead_detector_secret` do M10#4). Sem os
-- settings, faz RAISE NOTICE e retorna — não quebra a transação que disparou
-- o trigger.

CREATE OR REPLACE FUNCTION public.notify_dispatch(
  p_event        text,
  p_workspace_id uuid,
  p_lead_id      uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_app_url text;
  v_secret  text;
BEGIN
  v_app_url := current_setting('app.app_url', true);
  v_secret  := current_setting('app.notify_dispatch_secret', true);

  IF v_app_url IS NULL OR v_app_url = '' THEN
    RAISE NOTICE 'notify_dispatch: app.app_url não configurado — pulando %', p_event;
    RETURN;
  END IF;
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'notify_dispatch: app.notify_dispatch_secret não configurado — pulando %', p_event;
    RETURN;
  END IF;

  PERFORM extensions.http_post(
    url := v_app_url || '/api/internal/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'event', p_event,
      'workspaceId', p_workspace_id,
      'leadId', p_lead_id
    ),
    timeout_milliseconds := 5000
  );
END;
$$;

COMMENT ON FUNCTION public.notify_dispatch(text, uuid, uuid) IS
  'M13#2 — POST fire-and-forget pra /api/internal/notify via pg_net. Lê app.app_url + app.notify_dispatch_secret de Postgres settings.';

-- ─── Trigger: lead esfriou (cold_lead_alerts AFTER INSERT) ──────────────────
-- A Edge Function `cold-lead-detector` (M10#4) insere 1 linha por (lead,
-- threshold). O trigger dispara o fanout `lead_cooling` — a rota resolve o
-- vendedor responsável pelo lead. Insert é idempotente (UNIQUE M10#1), então
-- o trigger roda 1× por alerta realmente novo.

CREATE OR REPLACE FUNCTION public.notify_on_cold_lead_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.notify_dispatch('lead_cooling', NEW.workspace_id, NEW.lead_id);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_on_cold_lead_alert() IS
  'M13#2 — fanout push/in-app quando um cold_lead_alert é criado (lead_cooling).';

DROP TRIGGER IF EXISTS notify_on_cold_lead_alert ON public.cold_lead_alerts;
CREATE TRIGGER notify_on_cold_lead_alert
  AFTER INSERT ON public.cold_lead_alerts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_cold_lead_alert();

-- ─── Trigger: WhatsApp caiu (whatsapp_instances health_score → unhealthy) ───
-- O heartbeat (M9#5) degrada `health_score` healthy→degraded→unhealthy. A
-- transição PARA `unhealthy` é o sinal de "conexão caiu" (PRD §3.2). Dispara
-- 1× por transição — a rota resolve Owner/Admin/Manager do workspace.

CREATE OR REPLACE FUNCTION public.notify_on_whatsapp_unhealthy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.notify_dispatch('whatsapp_connection_down', NEW.workspace_id, NULL);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_on_whatsapp_unhealthy() IS
  'M13#2 — fanout push/in-app/email quando uma instância WhatsApp vira unhealthy (whatsapp_connection_down).';

DROP TRIGGER IF EXISTS notify_on_whatsapp_unhealthy ON public.whatsapp_instances;
CREATE TRIGGER notify_on_whatsapp_unhealthy
  AFTER UPDATE OF health_score ON public.whatsapp_instances
  FOR EACH ROW
  WHEN (OLD.health_score <> 'unhealthy' AND NEW.health_score = 'unhealthy')
  EXECUTE FUNCTION public.notify_on_whatsapp_unhealthy();
