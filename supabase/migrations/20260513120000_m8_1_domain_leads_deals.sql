-- M8#1 — Backend de Domínio (Leads, Deals, Pipelines, Tasks, Activities, Tags, Attachments, Custom Fields).
--
-- Espelha `packages/db/prisma/schema.prisma` (source of truth dos modelos). Tudo
-- idempotente — replay seguro local via `supabase db reset` e cloud via
-- `supabase db push`. Não toca em tabelas de M7#2 a não ser pra estender o enum
-- `audit_action` (mais 8 valores de domínio).
--
-- RLS segue o padrão de M7#2: `current_workspace_id()` é a fonte da verdade
-- (lida do `app.workspace_id` que `withWorkspace` seta na transação). Inserts
-- de seed (default pipeline) usam o `createWorkspaceAction` (Server Action),
-- que roda como `postgres` (bypassa RLS por design — defense-in-depth filtra
-- workspaceId no código).

-- ============================================================================
-- 1. Enums novos
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.lead_origin AS ENUM (
    'site','meta_ads','google_ads','indicacao','whatsapp_inbound',
    'csv_import','manual','rd_station','hotmart'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('ativo','arquivado','perdido','ganho');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.deal_status AS ENUM ('open','won','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_kind AS ENUM ('call','whatsapp','email','meeting','follow_up','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('pending','done','snoozed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.activity_type AS ENUM (
    'whatsapp_in','whatsapp_out','call','email','meeting',
    'note','task','stage_change','attachment','lead_created'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stage_tone AS ENUM ('default','success','destructive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.custom_field_type AS ENUM ('text','number','date','enum');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. Estender `audit_action` com eventos de domínio M8
--    (`ALTER TYPE ADD VALUE IF NOT EXISTS` é idempotente nativo desde PG 9.6)
-- ============================================================================

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'lead_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'lead_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'lead_deleted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_stage_changed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'task_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'task_completed';

-- ============================================================================
-- 3. Tabelas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pipelines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         varchar(80) NOT NULL,
  is_default   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS pipelines_workspace_id_idx ON public.pipelines (workspace_id);
CREATE INDEX IF NOT EXISTS pipelines_workspace_default_idx ON public.pipelines (workspace_id, is_default);

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid              NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  slug        varchar(64)       NOT NULL,
  name        varchar(80)       NOT NULL,
  "order"     integer           NOT NULL,
  rot_days    integer           NOT NULL DEFAULT 0,
  terminal    boolean           NOT NULL DEFAULT false,
  tone        public.stage_tone NOT NULL DEFAULT 'default',
  created_at  timestamptz       NOT NULL DEFAULT NOW(),
  updated_at  timestamptz       NOT NULL DEFAULT NOW(),
  CONSTRAINT pipeline_stages_pipeline_slug_key UNIQUE (pipeline_id, slug),
  CONSTRAINT pipeline_stages_pipeline_order_key UNIQUE (pipeline_id, "order")
);
CREATE INDEX IF NOT EXISTS pipeline_stages_pipeline_order_idx ON public.pipeline_stages (pipeline_id, "order");

CREATE TABLE IF NOT EXISTS public.leads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid               NOT NULL REFERENCES public.workspaces(id)        ON DELETE CASCADE,
  name                  varchar(120)       NOT NULL,
  email                 citext,
  phone                 varchar(32)        NOT NULL,
  company               varchar(120),
  position              varchar(80),
  origin                public.lead_origin NOT NULL DEFAULT 'manual',
  status                public.lead_status NOT NULL DEFAULT 'ativo',
  stage_id              uuid               NOT NULL REFERENCES public.pipeline_stages(id)   ON DELETE RESTRICT,
  assigned_to_id        uuid               NOT NULL REFERENCES public.workspace_members(id) ON DELETE RESTRICT,
  value_cents           integer            NOT NULL DEFAULT 0,
  notes                 text,
  last_interaction_at   timestamptz,
  next_action_at        timestamptz,
  next_action_label     varchar(120),
  created_by_id         uuid                        REFERENCES public.users(id)             ON DELETE SET NULL,
  created_at            timestamptz        NOT NULL DEFAULT NOW(),
  updated_at            timestamptz        NOT NULL DEFAULT NOW(),
  deleted_at            timestamptz
);
CREATE INDEX IF NOT EXISTS leads_workspace_created_at_idx       ON public.leads (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_workspace_status_idx           ON public.leads (workspace_id, status);
CREATE INDEX IF NOT EXISTS leads_workspace_stage_id_idx         ON public.leads (workspace_id, stage_id);
CREATE INDEX IF NOT EXISTS leads_workspace_assigned_to_idx      ON public.leads (workspace_id, assigned_to_id);
CREATE INDEX IF NOT EXISTS leads_workspace_last_interaction_idx ON public.leads (workspace_id, last_interaction_at DESC);
CREATE INDEX IF NOT EXISTS leads_workspace_deleted_at_idx       ON public.leads (workspace_id, deleted_at);

CREATE TABLE IF NOT EXISTS public.deals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid               NOT NULL REFERENCES public.workspaces(id)        ON DELETE CASCADE,
  title           varchar(160)       NOT NULL,
  lead_id         uuid               NOT NULL REFERENCES public.leads(id)             ON DELETE CASCADE,
  stage_id        uuid               NOT NULL REFERENCES public.pipeline_stages(id)   ON DELETE RESTRICT,
  value_cents     integer            NOT NULL DEFAULT 0,
  owner_id        uuid               NOT NULL REFERENCES public.workspace_members(id) ON DELETE RESTRICT,
  probability     integer,
  due_at          timestamptz,
  description     text,
  status          public.deal_status NOT NULL DEFAULT 'open',
  lost_reason     text,
  order_in_stage  integer            NOT NULL DEFAULT 0,
  closed_at       timestamptz,
  created_by_id   uuid                        REFERENCES public.users(id)             ON DELETE SET NULL,
  created_at      timestamptz        NOT NULL DEFAULT NOW(),
  updated_at      timestamptz        NOT NULL DEFAULT NOW(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS deals_workspace_stage_order_idx ON public.deals (workspace_id, stage_id, order_in_stage);
CREATE INDEX IF NOT EXISTS deals_workspace_status_idx      ON public.deals (workspace_id, status);
CREATE INDEX IF NOT EXISTS deals_workspace_owner_idx       ON public.deals (workspace_id, owner_id);
CREATE INDEX IF NOT EXISTS deals_lead_id_idx               ON public.deals (lead_id);
CREATE INDEX IF NOT EXISTS deals_workspace_deleted_at_idx  ON public.deals (workspace_id, deleted_at);

CREATE TABLE IF NOT EXISTS public.tags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         citext      NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT tags_workspace_name_key UNIQUE (workspace_id, name)
);
CREATE INDEX IF NOT EXISTS tags_workspace_id_idx ON public.tags (workspace_id);

CREATE TABLE IF NOT EXISTS public.lead_tags (
  lead_id    uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id     uuid        NOT NULL REFERENCES public.tags(id)  ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lead_id, tag_id)
);
CREATE INDEX IF NOT EXISTS lead_tags_tag_id_idx ON public.lead_tags (tag_id);

CREATE TABLE IF NOT EXISTS public.tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid               NOT NULL REFERENCES public.workspaces(id)        ON DELETE CASCADE,
  lead_id         uuid               NOT NULL REFERENCES public.leads(id)             ON DELETE CASCADE,
  kind            public.task_kind   NOT NULL,
  title           varchar(160)       NOT NULL,
  notes           text,
  due_at          timestamptz        NOT NULL,
  status          public.task_status NOT NULL DEFAULT 'pending',
  assigned_to_id  uuid               NOT NULL REFERENCES public.workspace_members(id) ON DELETE RESTRICT,
  done_at         timestamptz,
  created_by_id   uuid                        REFERENCES public.users(id)             ON DELETE SET NULL,
  created_at      timestamptz        NOT NULL DEFAULT NOW(),
  updated_at      timestamptz        NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tasks_workspace_status_due_idx ON public.tasks (workspace_id, status, due_at);
CREATE INDEX IF NOT EXISTS tasks_workspace_assigned_idx   ON public.tasks (workspace_id, assigned_to_id);
CREATE INDEX IF NOT EXISTS tasks_lead_id_idx              ON public.tasks (lead_id);

CREATE TABLE IF NOT EXISTS public.activities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid                 NOT NULL REFERENCES public.workspaces(id)        ON DELETE CASCADE,
  lead_id      uuid                 NOT NULL REFERENCES public.leads(id)             ON DELETE CASCADE,
  type         public.activity_type NOT NULL,
  body         text,
  author_id    uuid                          REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  meta         jsonb,
  created_at   timestamptz          NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activities_workspace_lead_created_idx ON public.activities (workspace_id, lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_lead_created_idx           ON public.activities (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_workspace_type_idx         ON public.activities (workspace_id, type);

CREATE TABLE IF NOT EXISTS public.attachments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid         NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id        uuid         NOT NULL REFERENCES public.leads(id)      ON DELETE CASCADE,
  bucket         varchar(64)  NOT NULL DEFAULT 'attachments',
  path           text         NOT NULL,
  file_name      varchar(255) NOT NULL,
  mime_type      varchar(127) NOT NULL,
  size_bytes     integer      NOT NULL,
  uploaded_by_id uuid         NOT NULL REFERENCES public.users(id)      ON DELETE RESTRICT,
  created_at     timestamptz  NOT NULL DEFAULT NOW(),
  deleted_at     timestamptz
);
CREATE INDEX IF NOT EXISTS attachments_workspace_lead_created_idx ON public.attachments (workspace_id, lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attachments_workspace_deleted_at_idx   ON public.attachments (workspace_id, deleted_at);

CREATE TABLE IF NOT EXISTS public.custom_fields (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid                     NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key          varchar(64)              NOT NULL,
  label        varchar(120)             NOT NULL,
  type         public.custom_field_type NOT NULL,
  options      jsonb,
  "order"      integer                  NOT NULL DEFAULT 0,
  created_at   timestamptz              NOT NULL DEFAULT NOW(),
  updated_at   timestamptz              NOT NULL DEFAULT NOW(),
  CONSTRAINT custom_fields_workspace_key_key UNIQUE (workspace_id, key)
);
CREATE INDEX IF NOT EXISTS custom_fields_workspace_order_idx ON public.custom_fields (workspace_id, "order");

CREATE TABLE IF NOT EXISTS public.lead_custom_values (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid        NOT NULL REFERENCES public.leads(id)          ON DELETE CASCADE,
  custom_field_id uuid        NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value           jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT lead_custom_values_lead_field_key UNIQUE (lead_id, custom_field_id)
);
CREATE INDEX IF NOT EXISTS lead_custom_values_field_idx ON public.lead_custom_values (custom_field_id);

-- ============================================================================
-- 4. Triggers de touch_updated_at (reaproveita função criada em M7#2)
-- ============================================================================

DROP TRIGGER IF EXISTS touch_updated_at ON public.pipelines;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.pipeline_stages;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.leads;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.deals;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.tasks;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.custom_fields;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.lead_custom_values;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.lead_custom_values
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 5. RLS — habilita em todas + policies por (workspace_id = current_workspace_id())
--    Mesmo padrão de M7#2. Defense-in-depth: o app continua filtrando workspaceId.
-- ============================================================================

ALTER TABLE public.pipelines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_custom_values ENABLE ROW LEVEL SECURITY;

-- pipelines
DROP POLICY IF EXISTS pipelines_select ON public.pipelines;
CREATE POLICY pipelines_select ON public.pipelines FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS pipelines_insert ON public.pipelines;
CREATE POLICY pipelines_insert ON public.pipelines FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS pipelines_update ON public.pipelines;
CREATE POLICY pipelines_update ON public.pipelines FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS pipelines_delete ON public.pipelines;
CREATE POLICY pipelines_delete ON public.pipelines FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- pipeline_stages — herda do pipeline_id (subquery)
DROP POLICY IF EXISTS pipeline_stages_select ON public.pipeline_stages;
CREATE POLICY pipeline_stages_select ON public.pipeline_stages FOR SELECT
USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS pipeline_stages_insert ON public.pipeline_stages;
CREATE POLICY pipeline_stages_insert ON public.pipeline_stages FOR INSERT
WITH CHECK (pipeline_id IN (SELECT id FROM public.pipelines WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS pipeline_stages_update ON public.pipeline_stages;
CREATE POLICY pipeline_stages_update ON public.pipeline_stages FOR UPDATE
USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE workspace_id = public.current_workspace_id()))
WITH CHECK (pipeline_id IN (SELECT id FROM public.pipelines WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS pipeline_stages_delete ON public.pipeline_stages;
CREATE POLICY pipeline_stages_delete ON public.pipeline_stages FOR DELETE
USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE workspace_id = public.current_workspace_id()));

-- leads
DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select ON public.leads FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS leads_insert ON public.leads;
CREATE POLICY leads_insert ON public.leads FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update ON public.leads FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS leads_delete ON public.leads;
CREATE POLICY leads_delete ON public.leads FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- deals
DROP POLICY IF EXISTS deals_select ON public.deals;
CREATE POLICY deals_select ON public.deals FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS deals_insert ON public.deals;
CREATE POLICY deals_insert ON public.deals FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS deals_update ON public.deals;
CREATE POLICY deals_update ON public.deals FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS deals_delete ON public.deals;
CREATE POLICY deals_delete ON public.deals FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- tags
DROP POLICY IF EXISTS tags_select ON public.tags;
CREATE POLICY tags_select ON public.tags FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS tags_insert ON public.tags;
CREATE POLICY tags_insert ON public.tags FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS tags_update ON public.tags;
CREATE POLICY tags_update ON public.tags FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS tags_delete ON public.tags;
CREATE POLICY tags_delete ON public.tags FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- lead_tags — herda do lead_id
DROP POLICY IF EXISTS lead_tags_select ON public.lead_tags;
CREATE POLICY lead_tags_select ON public.lead_tags FOR SELECT
USING (lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS lead_tags_insert ON public.lead_tags;
CREATE POLICY lead_tags_insert ON public.lead_tags FOR INSERT
WITH CHECK (lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS lead_tags_delete ON public.lead_tags;
CREATE POLICY lead_tags_delete ON public.lead_tags FOR DELETE
USING (lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.current_workspace_id()));

-- tasks
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- activities — append-only (SELECT + INSERT, sem UPDATE/DELETE)
DROP POLICY IF EXISTS activities_select ON public.activities;
CREATE POLICY activities_select ON public.activities FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS activities_insert ON public.activities;
CREATE POLICY activities_insert ON public.activities FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

-- attachments
DROP POLICY IF EXISTS attachments_select ON public.attachments;
CREATE POLICY attachments_select ON public.attachments FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS attachments_insert ON public.attachments;
CREATE POLICY attachments_insert ON public.attachments FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS attachments_update ON public.attachments;
CREATE POLICY attachments_update ON public.attachments FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS attachments_delete ON public.attachments;
CREATE POLICY attachments_delete ON public.attachments FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- custom_fields
DROP POLICY IF EXISTS custom_fields_select ON public.custom_fields;
CREATE POLICY custom_fields_select ON public.custom_fields FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS custom_fields_insert ON public.custom_fields;
CREATE POLICY custom_fields_insert ON public.custom_fields FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS custom_fields_update ON public.custom_fields;
CREATE POLICY custom_fields_update ON public.custom_fields FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS custom_fields_delete ON public.custom_fields;
CREATE POLICY custom_fields_delete ON public.custom_fields FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- lead_custom_values — herda do lead_id
DROP POLICY IF EXISTS lead_custom_values_select ON public.lead_custom_values;
CREATE POLICY lead_custom_values_select ON public.lead_custom_values FOR SELECT
USING (lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS lead_custom_values_insert ON public.lead_custom_values;
CREATE POLICY lead_custom_values_insert ON public.lead_custom_values FOR INSERT
WITH CHECK (lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS lead_custom_values_update ON public.lead_custom_values;
CREATE POLICY lead_custom_values_update ON public.lead_custom_values FOR UPDATE
USING (lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.current_workspace_id()))
WITH CHECK (lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS lead_custom_values_delete ON public.lead_custom_values;
CREATE POLICY lead_custom_values_delete ON public.lead_custom_values FOR DELETE
USING (lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.current_workspace_id()));

-- ============================================================================
-- 6. Comments (descritivos pra Studio + introspect)
-- ============================================================================

COMMENT ON TABLE public.pipelines          IS 'Funil de vendas (1+ por workspace; isDefault=true é o padrão). Custom pipelines em M8#2+.';
COMMENT ON TABLE public.pipeline_stages    IS 'Etapas do funil ordenadas. terminal=true para Ganho/Perdido (não dispara cadência).';
COMMENT ON TABLE public.leads              IS 'Contato cru com potencial de virar oportunidade. lead.stageId = etapa principal; canônico vive em deals.';
COMMENT ON TABLE public.deals              IS 'Oportunidade comercial (lead × etapa × valor). Kanban lê desta tabela.';
COMMENT ON TABLE public.tags               IS 'Tag livre por workspace, unique case-insensitive.';
COMMENT ON TABLE public.lead_tags          IS 'Junction lead ↔ tag (m:n). Limite de 8 tags por lead enforced no app.';
COMMENT ON TABLE public.tasks              IS 'Tarefa vinculada a lead. status=snoozed adia até due_at novo.';
COMMENT ON TABLE public.activities         IS 'Timeline append-only do lead. Sem UPDATE/DELETE — eventos de domínio gravam aqui.';
COMMENT ON TABLE public.attachments        IS 'Anexo de lead — arquivo no Supabase Storage bucket attachments. Cleanup de órfãos via pg_cron em M8#6.';
COMMENT ON TABLE public.custom_fields      IS 'Campo customizado por workspace. options JSONB pra tipos enum.';
COMMENT ON TABLE public.lead_custom_values IS 'Valor do custom field pra um lead. value JSONB (text/number/date/enum).';
