-- ============================================================================
-- M11#2 — Schema de usage_events (metering cross-feature de custo IA)
-- ============================================================================
-- Tabela única pra todo evento de uso de IA do produto (Claude calls, OpenAI
-- embeddings, future Vertex/local). Append-only, RLS por workspace.
--
-- Por que tabela única (não uma por kind):
--   - `audit_logs`/`webhook_events` seguem o mesmo padrão (1 tabela + enum
--     `kind` discriminador) e funcionou — evita N migrations quando aparece
--     `summary_call`, `transcription_call`, etc.
--   - Agregação MRR/cost-per-workspace é mais simples num SUM single-table.
--   - Schema do payload se mantém estável: tokens + cost em todos os kinds.
--
-- `cost_micros` é USD × 10^6 (microdollars). Evita float drift em agregações
-- (SUM(input_tokens * 3 / 1_000_000) vira drift com >10M rows). bigint cobre
-- até ~9.2 × 10^18 microdollars = $9.2T, mais que suficiente.
--
-- RLS: SELECT por workspace (dashboard M12#6 lê), INSERT do servidor via
-- `withWorkspace(tx)`. Sem UPDATE/DELETE — append-only.
-- ============================================================================

-- ============================================================================
-- 1. Enum novo
-- ============================================================================

DO $$ BEGIN
  -- `agent_call`     → chamada Claude (messages.create) — agente IA respondendo
  -- `embedding_call` → chamada OpenAI embeddings — indexação do Cérebro
  -- `summary_call`   → chamada Claude pra atualizar lead_summary (background)
  CREATE TYPE public.usage_event_kind AS ENUM ('agent_call', 'embedding_call', 'summary_call');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. Tabela usage_events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_events (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                uuid                          NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_kind                  public.usage_event_kind       NOT NULL,
  -- `feature` é free-form pra não exigir migration ao surgir caso novo
  -- (`agent_chat`, `kb_indexing`, `lead_summary`, `kb_reindex`, ...).
  feature                     varchar(32)                   NOT NULL,
  model                       varchar(64)                   NOT NULL,
  input_tokens                integer                       NOT NULL DEFAULT 0,
  output_tokens               integer                       NOT NULL DEFAULT 0,
  cache_read_input_tokens     integer                       NOT NULL DEFAULT 0,
  cache_creation_input_tokens integer                       NOT NULL DEFAULT 0,
  -- USD × 10^6. bigint protege agregações grandes.
  cost_micros                 bigint                        NOT NULL DEFAULT 0,
  -- `entity_kind` discrimina o que `entity_id` aponta (sem FK declarada —
  -- evita cascade pesada e permite entity_kind novo sem migration).
  entity_kind                 varchar(32),
  entity_id                   uuid,
  created_at                  timestamptz                   NOT NULL DEFAULT NOW(),
  CONSTRAINT usage_events_tokens_non_negative CHECK (
    input_tokens >= 0 AND output_tokens >= 0 AND
    cache_read_input_tokens >= 0 AND cache_creation_input_tokens >= 0
  ),
  CONSTRAINT usage_events_cost_non_negative CHECK (cost_micros >= 0)
);

CREATE INDEX IF NOT EXISTS usage_events_workspace_created_idx
  ON public.usage_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_workspace_kind_idx
  ON public.usage_events (workspace_id, event_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_entity_idx
  ON public.usage_events (entity_kind, entity_id)
  WHERE entity_kind IS NOT NULL;

-- ============================================================================
-- 3. RLS
-- ============================================================================

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_events_select ON public.usage_events;
CREATE POLICY usage_events_select ON public.usage_events FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS usage_events_insert ON public.usage_events;
CREATE POLICY usage_events_insert ON public.usage_events FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

-- Sem UPDATE/DELETE — append-only (LGPD audit + integridade de billing).

-- ============================================================================
-- 4. Comments
-- ============================================================================

COMMENT ON TABLE public.usage_events IS
  'Metering cross-feature de uso de IA (Claude calls, OpenAI embeddings, summaries). Append-only, RLS por workspace. cost_micros = USD × 10^6.';
COMMENT ON COLUMN public.usage_events.feature IS
  'Free-form: agent_chat | kb_indexing | lead_summary | kb_reindex | ... Não vira enum pra evitar migration por caso novo.';
COMMENT ON COLUMN public.usage_events.cost_micros IS
  'Custo em microdollars (USD × 10^6). bigint pra agregações grandes sem float drift.';
