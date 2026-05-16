-- ============================================================================
-- M10#1 — Schema do motor de cadência + detector de lead frio
-- ============================================================================
-- Cria a base de domínio do motor de cadência (PRD §2.2 e §2.4):
--   - cadências configuráveis por etapa do funil (cadences + cadence_steps)
--   - inscrições de lead em cadência (cadence_enrollments)
--   - histórico/idempotência de envios (cadence_step_runs)
--   - thresholds e alertas de lead frio (cold_lead_thresholds + cold_lead_alerts)
--
-- Também:
--   - Estende `leads` com `temperature` (frio/morno/quente) e `cold_alerted_at`.
--   - Cria trigger `pause_cadence_on_inbound` em `messages` (AFTER INSERT WHERE
--     direction='in') que pausa todos enrollments active do lead com motivo
--     `lead_replied` — pausa automática quando o cliente responde (PRD §2.2).
--   - Seed inline dos cold thresholds default por etapa (7d novo, 14d em_contato,
--     7d proposta, 5d negociacao, 30d global) com backfill pra workspaces
--     existentes.
--   - Função `seed_default_cadences_for_workspace(workspace_id)` com os 3
--     templates pré-configurados (Imobiliário, B2B, Alto Ticket) — chamada
--     do código (Server Action) ou via backfill no fim desta migration.
--
-- RLS segue o padrão M7/M8/M9: `public.current_workspace_id()` é a fonte da
-- verdade (lida do `app.workspace_id` que `withWorkspace` seta na transação).
-- Toda query de domínio também filtra `workspace_id` no código (defense in
-- depth — CLAUDE.md §7.2).
-- ============================================================================

-- ============================================================================
-- 1. Enums novos
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.cadence_status AS ENUM ('active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cadence_step_channel AS ENUM ('whatsapp', 'email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Valores espelham TEMPLATE_KEY_VALUES em apps/web/features/cadences/schemas.ts.
  -- Postgres aceita hífen em enum value — alinhamos pra evitar mapping em runtime.
  CREATE TYPE public.cadence_template_key AS ENUM (
    'imobiliario', 'b2b', 'alto-ticket', 'blank', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cadence_enrollment_status AS ENUM (
    'active', 'paused', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cadence_enrollment_pause_reason AS ENUM (
    'lead_replied', 'manual', 'stage_changed', 'disconnected', 'admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cadence_step_run_status AS ENUM (
    'pending', 'sent', 'skipped', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cadence_step_run_skip_reason AS ENUM (
    'email_stub',
    'outside_business_hours',
    'blacklist',
    'rate_limit',
    'unhealthy',
    'no_phone',
    'lead_deleted',
    'workspace_paused'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_temperature AS ENUM ('cold', 'warm', 'hot');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. Estende audit_action com eventos do motor de cadência e cold detector
-- ============================================================================

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cadence_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cadence_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cadence_deleted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cadence_enrolled';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cadence_paused';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cadence_reactivated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cadence_completed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cadence_step_sent';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cadence_step_failed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cold_lead_alerted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cold_lead_acknowledged';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cold_threshold_updated';

-- ============================================================================
-- 3. ALTER leads — colunas de temperatura e cold alert
-- ============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS temperature      public.lead_temperature NOT NULL DEFAULT 'warm',
  ADD COLUMN IF NOT EXISTS cold_alerted_at  timestamptz;

CREATE INDEX IF NOT EXISTS leads_workspace_temperature_idx
  ON public.leads (workspace_id, temperature);

COMMENT ON COLUMN public.leads.temperature IS
  'Estado térmico do lead (PRD §2.4). Default warm. Cold setado pelo cold-lead-detector quando last_interaction_at ultrapassa threshold da etapa.';
COMMENT ON COLUMN public.leads.cold_alerted_at IS
  'Quando o cold-lead-detector mais recentemente sinalizou esse lead como frio. Usado pra evitar realertar em loop.';

-- ============================================================================
-- 4. Tabelas
-- ============================================================================

-- 4.1 cadences ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cadences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid                        NOT NULL REFERENCES public.workspaces(id)       ON DELETE CASCADE,
  stage_id      uuid                        NOT NULL REFERENCES public.pipeline_stages(id)  ON DELETE RESTRICT,
  name          varchar(120)                NOT NULL,
  description   varchar(280),
  template_key  public.cadence_template_key NOT NULL DEFAULT 'custom',
  status        public.cadence_status       NOT NULL DEFAULT 'active',
  created_by_id uuid                                 REFERENCES public.users(id)            ON DELETE SET NULL,
  created_at    timestamptz                 NOT NULL DEFAULT NOW(),
  updated_at    timestamptz                 NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cadences_workspace_id_idx       ON public.cadences (workspace_id);
CREATE INDEX IF NOT EXISTS cadences_workspace_stage_idx    ON public.cadences (workspace_id, stage_id);
CREATE INDEX IF NOT EXISTS cadences_workspace_status_idx   ON public.cadences (workspace_id, status);

-- 4.2 cadence_steps ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cadence_steps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id     uuid                          NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  day_offset     integer                       NOT NULL,
  channel        public.cadence_step_channel   NOT NULL,
  template_body  text                          NOT NULL,
  order_index    integer                       NOT NULL DEFAULT 0,
  created_at     timestamptz                   NOT NULL DEFAULT NOW(),
  updated_at     timestamptz                   NOT NULL DEFAULT NOW(),
  CONSTRAINT cadence_steps_day_offset_check     CHECK (day_offset IN (0, 1, 3, 7, 14, 30)),
  CONSTRAINT cadence_steps_unique_position      UNIQUE (cadence_id, day_offset, order_index),
  CONSTRAINT cadence_steps_template_body_length CHECK (char_length(template_body) BETWEEN 1 AND 2000)
);
CREATE INDEX IF NOT EXISTS cadence_steps_cadence_id_idx ON public.cadence_steps (cadence_id, day_offset, order_index);

-- 4.3 cadence_enrollments ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cadence_enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid                                       NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  cadence_id    uuid                                       NOT NULL REFERENCES public.cadences(id)   ON DELETE CASCADE,
  lead_id       uuid                                       NOT NULL REFERENCES public.leads(id)      ON DELETE CASCADE,
  status        public.cadence_enrollment_status           NOT NULL DEFAULT 'active',
  paused_reason public.cadence_enrollment_pause_reason,
  enrolled_at   timestamptz                                NOT NULL DEFAULT NOW(),
  paused_at     timestamptz,
  completed_at  timestamptz,
  next_run_at   timestamptz                                NOT NULL DEFAULT NOW(),
  created_at    timestamptz                                NOT NULL DEFAULT NOW(),
  updated_at    timestamptz                                NOT NULL DEFAULT NOW(),
  CONSTRAINT cadence_enrollments_unique_lead_cadence UNIQUE (cadence_id, lead_id)
);
CREATE INDEX IF NOT EXISTS cadence_enrollments_workspace_status_idx ON public.cadence_enrollments (workspace_id, status);
CREATE INDEX IF NOT EXISTS cadence_enrollments_runner_idx           ON public.cadence_enrollments (status, next_run_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS cadence_enrollments_lead_idx             ON public.cadence_enrollments (lead_id);
CREATE INDEX IF NOT EXISTS cadence_enrollments_cadence_idx          ON public.cadence_enrollments (cadence_id);

-- 4.4 cadence_step_runs ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cadence_step_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid                                    NOT NULL REFERENCES public.workspaces(id)         ON DELETE CASCADE,
  enrollment_id  uuid                                    NOT NULL REFERENCES public.cadence_enrollments(id) ON DELETE CASCADE,
  step_id        uuid                                    NOT NULL REFERENCES public.cadence_steps(id)       ON DELETE CASCADE,
  status         public.cadence_step_run_status          NOT NULL DEFAULT 'pending',
  skip_reason    public.cadence_step_run_skip_reason,
  error_detail   text,
  scheduled_for  timestamptz                             NOT NULL,
  executed_at    timestamptz,
  message_id     uuid                                             REFERENCES public.messages(id)            ON DELETE SET NULL,
  created_at     timestamptz                             NOT NULL DEFAULT NOW(),
  updated_at     timestamptz                             NOT NULL DEFAULT NOW(),
  CONSTRAINT cadence_step_runs_unique_enrollment_step UNIQUE (enrollment_id, step_id)
);
CREATE INDEX IF NOT EXISTS cadence_step_runs_workspace_status_idx ON public.cadence_step_runs (workspace_id, status);
CREATE INDEX IF NOT EXISTS cadence_step_runs_enrollment_idx       ON public.cadence_step_runs (enrollment_id);
CREATE INDEX IF NOT EXISTS cadence_step_runs_scheduled_idx        ON public.cadence_step_runs (scheduled_for)
  WHERE status = 'pending';

-- 4.5 cold_lead_thresholds ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cold_lead_thresholds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid        NOT NULL REFERENCES public.workspaces(id)      ON DELETE CASCADE,
  stage_id       uuid                 REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  days_inactive  integer     NOT NULL,
  enabled        boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT cold_lead_thresholds_days_positive CHECK (days_inactive > 0),
  -- Postgres 15+ permite NULLS NOT DISTINCT pra fazer unique mesmo com stage_id NULL (global threshold).
  CONSTRAINT cold_lead_thresholds_unique_stage UNIQUE NULLS NOT DISTINCT (workspace_id, stage_id)
);
CREATE INDEX IF NOT EXISTS cold_lead_thresholds_workspace_id_idx ON public.cold_lead_thresholds (workspace_id);

-- 4.6 cold_lead_alerts -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cold_lead_alerts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid        NOT NULL REFERENCES public.workspaces(id)           ON DELETE CASCADE,
  lead_id           uuid        NOT NULL REFERENCES public.leads(id)                ON DELETE CASCADE,
  threshold_id      uuid        NOT NULL REFERENCES public.cold_lead_thresholds(id) ON DELETE CASCADE,
  triggered_at      timestamptz NOT NULL DEFAULT NOW(),
  acknowledged_at   timestamptz,
  acknowledged_by_id uuid                REFERENCES public.users(id)                ON DELETE SET NULL,
  CONSTRAINT cold_lead_alerts_unique_lead_threshold UNIQUE (lead_id, threshold_id)
);
CREATE INDEX IF NOT EXISTS cold_lead_alerts_workspace_unack_idx ON public.cold_lead_alerts (workspace_id, acknowledged_at)
  WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS cold_lead_alerts_lead_idx ON public.cold_lead_alerts (lead_id);

-- ============================================================================
-- 5. Triggers
-- ============================================================================

-- 5.1 updated_at -------------------------------------------------------------
DROP TRIGGER IF EXISTS touch_updated_at ON public.cadences;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.cadences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.cadence_steps;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.cadence_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.cadence_enrollments;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.cadence_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.cadence_step_runs;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.cadence_step_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.cold_lead_thresholds;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.cold_lead_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5.2 pause_cadence_on_inbound ----------------------------------------------
-- Quando o webhook uazapi insere uma mensagem inbound (direction='in') vinda
-- do lead, pausa todos enrollments active desse lead com motivo `lead_replied`.
-- SECURITY DEFINER pra atravessar RLS — trigger é executado em INSERT do
-- backend que pode estar usando service_role ou no escopo da transação do
-- webhook. Função filtra por lead_id (que é coluna real) + conversation_id
-- via conversations.lead_id pra resolver o lead.

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

  UPDATE public.cadence_enrollments
     SET status        = 'paused',
         paused_at     = NOW(),
         paused_reason = 'lead_replied',
         updated_at    = NOW()
   WHERE lead_id = v_lead_id
     AND status  = 'active';

  -- Atualiza last_interaction_at + re-aquece lead se estava frio.
  -- NÃO degrada 'hot' (sinal explícito de alta intenção) pra 'warm'.
  UPDATE public.leads
     SET last_interaction_at = NEW.created_at,
         temperature         = CASE WHEN temperature = 'cold' THEN 'warm'::public.lead_temperature ELSE temperature END,
         cold_alerted_at     = NULL,
         updated_at          = NOW()
   WHERE id = v_lead_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.pause_cadence_on_inbound() IS
  'Pausa cadências e re-aquece lead quando ele responde (PRD §2.2). Disparado por AFTER INSERT em messages com direction=in.';

DROP TRIGGER IF EXISTS pause_cadence_on_inbound ON public.messages;
CREATE TRIGGER pause_cadence_on_inbound
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.pause_cadence_on_inbound();

-- ============================================================================
-- 6. RLS — todas as tabelas filtram por current_workspace_id()
-- ============================================================================

ALTER TABLE public.cadences             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_steps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_enrollments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_step_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cold_lead_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cold_lead_alerts     ENABLE ROW LEVEL SECURITY;

-- cadences -------------------------------------------------------------------
DROP POLICY IF EXISTS cadences_select ON public.cadences;
CREATE POLICY cadences_select ON public.cadences FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cadences_insert ON public.cadences;
CREATE POLICY cadences_insert ON public.cadences FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cadences_update ON public.cadences;
CREATE POLICY cadences_update ON public.cadences FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cadences_delete ON public.cadences;
CREATE POLICY cadences_delete ON public.cadences FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- cadence_steps — herda via cadence_id (subquery), espelhando padrão M8 pipeline_stages
DROP POLICY IF EXISTS cadence_steps_select ON public.cadence_steps;
CREATE POLICY cadence_steps_select ON public.cadence_steps FOR SELECT
USING (cadence_id IN (SELECT id FROM public.cadences WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS cadence_steps_insert ON public.cadence_steps;
CREATE POLICY cadence_steps_insert ON public.cadence_steps FOR INSERT
WITH CHECK (cadence_id IN (SELECT id FROM public.cadences WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS cadence_steps_update ON public.cadence_steps;
CREATE POLICY cadence_steps_update ON public.cadence_steps FOR UPDATE
USING (cadence_id IN (SELECT id FROM public.cadences WHERE workspace_id = public.current_workspace_id()))
WITH CHECK (cadence_id IN (SELECT id FROM public.cadences WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS cadence_steps_delete ON public.cadence_steps;
CREATE POLICY cadence_steps_delete ON public.cadence_steps FOR DELETE
USING (cadence_id IN (SELECT id FROM public.cadences WHERE workspace_id = public.current_workspace_id()));

-- cadence_enrollments --------------------------------------------------------
DROP POLICY IF EXISTS cadence_enrollments_select ON public.cadence_enrollments;
CREATE POLICY cadence_enrollments_select ON public.cadence_enrollments FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cadence_enrollments_insert ON public.cadence_enrollments;
CREATE POLICY cadence_enrollments_insert ON public.cadence_enrollments FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cadence_enrollments_update ON public.cadence_enrollments;
CREATE POLICY cadence_enrollments_update ON public.cadence_enrollments FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cadence_enrollments_delete ON public.cadence_enrollments;
CREATE POLICY cadence_enrollments_delete ON public.cadence_enrollments FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- cadence_step_runs ----------------------------------------------------------
DROP POLICY IF EXISTS cadence_step_runs_select ON public.cadence_step_runs;
CREATE POLICY cadence_step_runs_select ON public.cadence_step_runs FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cadence_step_runs_insert ON public.cadence_step_runs;
CREATE POLICY cadence_step_runs_insert ON public.cadence_step_runs FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cadence_step_runs_update ON public.cadence_step_runs;
CREATE POLICY cadence_step_runs_update ON public.cadence_step_runs FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cadence_step_runs_delete ON public.cadence_step_runs;
CREATE POLICY cadence_step_runs_delete ON public.cadence_step_runs FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- cold_lead_thresholds -------------------------------------------------------
DROP POLICY IF EXISTS cold_lead_thresholds_select ON public.cold_lead_thresholds;
CREATE POLICY cold_lead_thresholds_select ON public.cold_lead_thresholds FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cold_lead_thresholds_insert ON public.cold_lead_thresholds;
CREATE POLICY cold_lead_thresholds_insert ON public.cold_lead_thresholds FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cold_lead_thresholds_update ON public.cold_lead_thresholds;
CREATE POLICY cold_lead_thresholds_update ON public.cold_lead_thresholds FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cold_lead_thresholds_delete ON public.cold_lead_thresholds;
CREATE POLICY cold_lead_thresholds_delete ON public.cold_lead_thresholds FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- cold_lead_alerts -----------------------------------------------------------
DROP POLICY IF EXISTS cold_lead_alerts_select ON public.cold_lead_alerts;
CREATE POLICY cold_lead_alerts_select ON public.cold_lead_alerts FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cold_lead_alerts_insert ON public.cold_lead_alerts;
CREATE POLICY cold_lead_alerts_insert ON public.cold_lead_alerts FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cold_lead_alerts_update ON public.cold_lead_alerts;
CREATE POLICY cold_lead_alerts_update ON public.cold_lead_alerts FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS cold_lead_alerts_delete ON public.cold_lead_alerts;
CREATE POLICY cold_lead_alerts_delete ON public.cold_lead_alerts FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- ============================================================================
-- 7. Funções de seed
-- ============================================================================

-- 7.1 cold thresholds default (PRD §2.4) -------------------------------------
-- Defaults: 7d Novo, 14d Em Contato, 7d Proposta, 5d Negociação, 30d Global.
-- Idempotente via UNIQUE (workspace_id, stage_id) NULLS NOT DISTINCT.

CREATE OR REPLACE FUNCTION public.seed_default_cold_thresholds_for_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Por etapa: lookup pelo slug no pipeline default do workspace.
  INSERT INTO public.cold_lead_thresholds (workspace_id, stage_id, days_inactive)
  SELECT p_workspace_id, ps.id,
         CASE ps.slug
           WHEN 'novo'        THEN 7
           WHEN 'em_contato'  THEN 14
           WHEN 'proposta'    THEN 7
           WHEN 'negociacao'  THEN 5
         END
    FROM public.pipeline_stages ps
    JOIN public.pipelines p ON p.id = ps.pipeline_id
   WHERE p.workspace_id = p_workspace_id
     AND p.is_default   = true
     AND ps.slug IN ('novo', 'em_contato', 'proposta', 'negociacao')
  ON CONFLICT (workspace_id, stage_id) DO NOTHING;

  -- Global (stage_id NULL): 30d fallback.
  INSERT INTO public.cold_lead_thresholds (workspace_id, stage_id, days_inactive)
  VALUES (p_workspace_id, NULL, 30)
  ON CONFLICT (workspace_id, stage_id) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.seed_default_cold_thresholds_for_workspace(uuid) IS
  'Cria os 5 thresholds default do detector de lead frio pro workspace (PRD §2.4). Idempotente.';

-- 7.2 cadências template (PRD §2.2) ------------------------------------------
-- Cria 3 cadências template (Imobiliário, B2B, Alto Ticket) na etapa default
-- de cada uma. Steps replicam o conteúdo de
-- apps/web/lib/fixtures/cadence-templates.ts — SQL é a fonte de verdade do
-- conteúdo seedado; fixture TS é só preview na UI antes do save.
--
-- Idempotente via lookup por (workspace_id, template_key) — se a cadência já
-- existe (mesmo template_key + workspace), o INSERT é pulado.

CREATE OR REPLACE FUNCTION public.seed_default_cadences_for_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_imobiliario_stage uuid;
  v_b2b_stage         uuid;
  v_alto_ticket_stage uuid;
  v_cadence_id        uuid;
BEGIN
  -- Resolve stages pelo slug no pipeline default do workspace.
  SELECT ps.id INTO v_imobiliario_stage
    FROM public.pipeline_stages ps
    JOIN public.pipelines p ON p.id = ps.pipeline_id
   WHERE p.workspace_id = p_workspace_id AND p.is_default = true AND ps.slug = 'novo';

  SELECT ps.id INTO v_b2b_stage
    FROM public.pipeline_stages ps
    JOIN public.pipelines p ON p.id = ps.pipeline_id
   WHERE p.workspace_id = p_workspace_id AND p.is_default = true AND ps.slug = 'em_contato';

  SELECT ps.id INTO v_alto_ticket_stage
    FROM public.pipeline_stages ps
    JOIN public.pipelines p ON p.id = ps.pipeline_id
   WHERE p.workspace_id = p_workspace_id AND p.is_default = true AND ps.slug = 'proposta';

  -- Aborta silenciosamente se pipeline default ainda não foi seedado pro workspace.
  IF v_imobiliario_stage IS NULL OR v_b2b_stage IS NULL OR v_alto_ticket_stage IS NULL THEN
    RAISE NOTICE 'seed_default_cadences_for_workspace: pipeline default ausente em %, pulando seed', p_workspace_id;
    RETURN;
  END IF;

  -- ----- Imobiliário (6 steps) --------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.cadences
     WHERE workspace_id = p_workspace_id AND template_key = 'imobiliario'
  ) THEN
    INSERT INTO public.cadences (workspace_id, stage_id, name, description, template_key, status)
    VALUES (p_workspace_id, v_imobiliario_stage,
            'Imobiliário', 'Acompanha o lead do interesse à visita sem deixar esfriar.',
            'imobiliario', 'paused')
    RETURNING id INTO v_cadence_id;

    INSERT INTO public.cadence_steps (cadence_id, day_offset, channel, template_body, order_index) VALUES
      (v_cadence_id,  0, 'whatsapp', 'Olá {nome}, aqui é da {empresa}. Vi que você se interessou pelo {produto} e queria entender melhor o que está procurando — fala comigo o que faz mais sentido pra sua família?', 0),
      (v_cadence_id,  1, 'whatsapp', 'Bom dia, {nome}! Conseguiu pensar sobre o que conversamos? Se quiser, posso enviar mais fotos e a planta do {produto} pra você dar uma olhada com calma.', 0),
      (v_cadence_id,  3, 'email',    '{nome}, separei algumas opções parecidas com o {produto} pra você comparar lado a lado. Anexei o material aqui no email — qualquer dúvida me chama no WhatsApp que eu respondo rápido.', 0),
      (v_cadence_id,  7, 'whatsapp', 'Oi {nome}, faz uma semana que falamos sobre o {produto}. Posso agendar uma visita pra você ver pessoalmente? Tenho horários abertos essa semana e na próxima.', 0),
      (v_cadence_id, 14, 'whatsapp', '{nome}, passando aqui pra ver se posso ajudar em alguma coisa. Se mudou de ideia sobre o {produto} ou prefere outro tipo de imóvel, é só me avisar — tenho várias opções no portfólio.', 0),
      (v_cadence_id, 30, 'email',    '{nome}, voltei a falar porque chegaram novos imóveis no perfil que você procurava. Vale dar uma olhada quando puder — alguns saem rápido. Te respondo no WhatsApp também se preferir.', 0);
  END IF;

  -- ----- B2B Consultivo (5 steps) -----------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.cadences
     WHERE workspace_id = p_workspace_id AND template_key = 'b2b'
  ) THEN
    INSERT INTO public.cadences (workspace_id, stage_id, name, description, template_key, status)
    VALUES (p_workspace_id, v_b2b_stage,
            'B2B Consultivo', 'Qualifica e nutre decisores B2B com tom consultivo.',
            'b2b', 'paused')
    RETURNING id INTO v_cadence_id;

    INSERT INTO public.cadence_steps (cadence_id, day_offset, channel, template_body, order_index) VALUES
      (v_cadence_id,  0, 'email',    'Oi {nome}, vi que vocês da {empresa} entraram em contato. Sou consultivo, prefiro entender o cenário antes de mandar proposta — quando rola uma conversa de 15 min essa semana?', 0),
      (v_cadence_id,  1, 'whatsapp', 'Bom dia {nome}! Mandei email ontem mas o WhatsApp costuma ser mais ágil. Tem 15 min essa semana pra eu entender como vocês trabalham hoje na {empresa}?', 0),
      (v_cadence_id,  3, 'whatsapp', '{nome}, separei um case rápido de uma empresa parecida com a {empresa} que pode te dar contexto sobre o {produto}. Te envio? São 2 páginas, leitura de café.', 0),
      (v_cadence_id,  7, 'email',    'Oi {nome}, sei que a agenda aperta. Deixei aqui um material sobre como abordamos {produto} — leva 5 min de leitura. Quando voltar das corridas, fala comigo que a gente conversa.', 0),
      (v_cadence_id, 14, 'whatsapp', '{nome}, vou parar de insistir aqui, mas se mudar a prioridade na {empresa} é só me chamar — fico à disposição. Boa quinta!', 0);
  END IF;

  -- ----- Alto Ticket (6 steps) --------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.cadences
     WHERE workspace_id = p_workspace_id AND template_key = 'alto-ticket'
  ) THEN
    INSERT INTO public.cadences (workspace_id, stage_id, name, description, template_key, status)
    VALUES (p_workspace_id, v_alto_ticket_stage,
            'Alto Ticket', 'Cadência calma para decisões de alto valor e ciclo longo.',
            'alto-ticket', 'paused')
    RETURNING id INTO v_cadence_id;

    INSERT INTO public.cadence_steps (cadence_id, day_offset, channel, template_body, order_index) VALUES
      (v_cadence_id,  0, 'whatsapp', 'Boa tarde, {nome}. Sei que decisões desse porte sobre o {produto} merecem tempo. Estou aqui pra esclarecer o que precisar — sem pressa, sem pressão.', 0),
      (v_cadence_id,  1, 'whatsapp', '{nome}, dormiu bem com a ideia? Posso adiantar alguma dúvida específica antes de você bater o martelo? Conta comigo pra qualquer detalhe.', 0),
      (v_cadence_id,  3, 'whatsapp', 'Oi {nome}, separei dois casos de clientes que passaram por essa mesma decisão sobre {produto}. Se quiser, te conecto com um deles pra conversar diretamente — costuma ajudar bastante.', 0),
      (v_cadence_id,  7, 'whatsapp', '{nome}, faz uma semana. Imagino que esteja avaliando alternativas — totalmente normal. Se quiser que eu prepare uma comparação lado a lado com o {produto}, me avisa.', 0),
      (v_cadence_id, 14, 'whatsapp', 'Oi {nome}, sem cobrança. Só queria saber se está fazendo sentido continuarmos a conversa sobre o {produto} ou se prefere que eu volte a falar mais pra frente.', 0),
      (v_cadence_id, 30, 'whatsapp', '{nome}, voltei aqui um mês depois pra reabrir o canal. Se a janela voltar a fazer sentido na {empresa}, é só me chamar — vamos do seu jeito, no seu tempo.', 0);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.seed_default_cadences_for_workspace(uuid) IS
  'Cria as 3 cadências template (Imobiliário, B2B, Alto Ticket) pro workspace, paused por default — usuário ativa explicitamente. Idempotente.';

-- ============================================================================
-- 8. Backfill — roda seed pra todos os workspaces existentes
-- ============================================================================
-- Workspaces criados antes de M10#1 também ganham os defaults. As funções são
-- idempotentes, então rodar de novo em workspaces novos (via Server Action no
-- createWorkspaceAction) não duplica nada.

DO $$
DECLARE
  v_workspace_id uuid;
BEGIN
  FOR v_workspace_id IN SELECT id FROM public.workspaces LOOP
    PERFORM public.seed_default_cold_thresholds_for_workspace(v_workspace_id);
    PERFORM public.seed_default_cadences_for_workspace(v_workspace_id);
  END LOOP;
END $$;

-- ============================================================================
-- 9. Comments descritivos (introspect + Supabase Studio)
-- ============================================================================

COMMENT ON TABLE public.cadences IS
  'Cadência de follow-up automático por etapa do funil (PRD §2.2). Steps disparam em D+0/D+1/D+3/D+7/D+14/D+30.';
COMMENT ON TABLE public.cadence_steps IS
  'Passo de cadência com canal (WhatsApp/email) e corpo com placeholders {nome}/{empresa}/{produto}.';
COMMENT ON TABLE public.cadence_enrollments IS
  'Inscrição de um lead em uma cadência. Status active = motor processa; paused = motor ignora (cliente respondeu, manual, etc).';
COMMENT ON TABLE public.cadence_step_runs IS
  'Execução de step pra um enrollment. Unique (enrollment_id, step_id) garante idempotência mesmo se o runner rodar 2x.';
COMMENT ON TABLE public.cold_lead_thresholds IS
  'Limite de dias sem interação que dispara alerta de lead frio (PRD §2.4). stage_id NULL = threshold global do workspace.';
COMMENT ON TABLE public.cold_lead_alerts IS
  'Alerta de lead frio gerado pelo cold-lead-detector. Unique (lead_id, threshold_id) evita realertar em loop.';
