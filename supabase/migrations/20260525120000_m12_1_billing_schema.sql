-- ============================================================================
-- M12#1 — Schema de billing Stripe
-- ============================================================================
-- Cria a base persistente da monetização (PRD §2.7 e §3.12):
--   - stripe_customers: 1:1 workspace ↔ customer no Stripe (upsert via webhook
--     ou checkout action)
--   - subscriptions: 1:N por workspace, latest active determina o plano atual
--
-- Idempotência de webhooks Stripe reusa `webhook_events` (source='stripe',
-- external_id=stripe_event_id) — mesma tabela do uazapi inbound (M9#3).
--
-- "Free" = ausência de Subscription com status active/past_due. Não há row
-- placeholder pra free — UI/lógica deriva do estado da tabela.
-- ============================================================================

-- ============================================================================
-- 1. Enums novos
-- ============================================================================

DO $$ BEGIN
  -- MVP só 'pro'. M12#2+ adiciona 'pro_ia' e 'enterprise'.
  CREATE TYPE public.subscription_plan AS ENUM ('pro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Reflete os status canônicos da Stripe API (subscription.status).
  -- 'trialing' / 'paused' ficam fora — entram em M12#3 (trial 7d sem cartão).
  -- 'incomplete_expired' agrupado em 'canceled' pelo handler do webhook.
  CREATE TYPE public.subscription_status AS ENUM (
    'active', 'past_due', 'canceled', 'unpaid', 'incomplete'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. Estende audit_action com eventos de billing
-- ============================================================================

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'checkout_initiated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'subscription_activated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'subscription_canceled';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_succeeded';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_failed';

-- ============================================================================
-- 3. Tabelas
-- ============================================================================

-- 3.1 stripe_customers -------------------------------------------------------
-- Workspace PK porque é 1:1 com Stripe customer. Created pelo Server Action de
-- checkout (primeiro upgrade). Upgrades seguintes reusam o `stripe_customer_id`
-- pra evitar customer-órfão no Stripe.
CREATE TABLE IF NOT EXISTS public.stripe_customers (
  workspace_id       uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_customer_id varchar(255) NOT NULL,
  email              varchar(255),
  created_at         timestamptz  NOT NULL DEFAULT NOW(),
  updated_at         timestamptz  NOT NULL DEFAULT NOW(),
  CONSTRAINT stripe_customers_customer_id_unique UNIQUE (stripe_customer_id)
);
CREATE INDEX IF NOT EXISTS stripe_customers_customer_id_idx ON public.stripe_customers (stripe_customer_id);

COMMENT ON TABLE public.stripe_customers IS
  '1:1 workspace ↔ Stripe customer. PK = workspace_id porque há no máximo 1 customer por workspace.';

-- 3.2 subscriptions ----------------------------------------------------------
-- 1:N por workspace. Webhook upserta por `stripe_subscription_id` (UNIQUE).
-- Plano atual = SELECT * WHERE workspace_id = $1 AND status IN ('active','past_due')
-- ORDER BY created_at DESC LIMIT 1.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid                          NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_subscription_id  varchar(255)                  NOT NULL,
  stripe_customer_id      varchar(255)                  NOT NULL,
  price_id                varchar(255)                  NOT NULL,
  plan                    public.subscription_plan      NOT NULL,
  status                  public.subscription_status    NOT NULL,
  current_period_start    timestamptz                   NOT NULL,
  current_period_end      timestamptz                   NOT NULL,
  cancel_at_period_end    boolean                       NOT NULL DEFAULT false,
  canceled_at             timestamptz,
  created_at              timestamptz                   NOT NULL DEFAULT NOW(),
  updated_at              timestamptz                   NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_stripe_id_unique UNIQUE (stripe_subscription_id)
);
CREATE INDEX IF NOT EXISTS subscriptions_workspace_status_idx ON public.subscriptions (workspace_id, status);
CREATE INDEX IF NOT EXISTS subscriptions_customer_idx         ON public.subscriptions (stripe_customer_id);

COMMENT ON TABLE public.subscriptions IS
  'Subscription Stripe ativa/histórica por workspace. Workspace sem row com status active/past_due está no plano free.';

-- ============================================================================
-- 4. Triggers — touch_updated_at
-- ============================================================================
-- Função `public.touch_updated_at()` já existe (criada em M7#3 / reusada em M8-M10).

DROP TRIGGER IF EXISTS touch_updated_at ON public.stripe_customers;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.stripe_customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.subscriptions;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 5. RLS — ambas tabelas filtram por current_workspace_id()
-- ============================================================================
-- Webhook do Stripe (route handler) usa `withWorkspace(workspaceId, tx)` após
-- lookup do customer_id → workspace_id pra setar `app.workspace_id` na tx —
-- mesmo padrão do webhook uazapi (M9#3).

ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions    ENABLE ROW LEVEL SECURITY;

-- stripe_customers -----------------------------------------------------------
DROP POLICY IF EXISTS stripe_customers_select ON public.stripe_customers;
CREATE POLICY stripe_customers_select ON public.stripe_customers FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS stripe_customers_insert ON public.stripe_customers;
CREATE POLICY stripe_customers_insert ON public.stripe_customers FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS stripe_customers_update ON public.stripe_customers;
CREATE POLICY stripe_customers_update ON public.stripe_customers FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

-- DELETE pra stripe_customers acontece via cascade do workspace (não Server Action
-- delete direto) — sem policy DELETE evita exposição acidental.

-- subscriptions --------------------------------------------------------------
DROP POLICY IF EXISTS subscriptions_select ON public.subscriptions;
CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS subscriptions_insert ON public.subscriptions;
CREATE POLICY subscriptions_insert ON public.subscriptions FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS subscriptions_update ON public.subscriptions;
CREATE POLICY subscriptions_update ON public.subscriptions FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

-- DELETE: subscriptions são append-only (preservam histórico pra audit).
-- Cascade do workspace cuida do cleanup definitivo.
