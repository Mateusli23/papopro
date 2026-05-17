-- ============================================================================
-- M11#1 — Schema de Agentes IA + Cérebro da Empresa (pgvector)
-- ============================================================================
-- Cria a base persistente do motor de IA (PRD §3.9, CLAUDE.md §6 Memória IA):
--
--   Agentes:
--     - ai_agents: persona configurável (prompt + tom + status + roteamento)
--     - agent_versions: snapshots imutáveis do trio prompt+persona+tone
--     - agent_routing_rules: regras de roteamento (match no primeiro hit)
--     - agent_sessions: sessão de conversa atendida por um agente (production
--       ou simulation — simulation NÃO toca leads/conversations reais)
--     - agent_messages: mensagens da sessão IA + contabilização de tokens
--
--   Memória 3 camadas (CLAUDE.md §6):
--     - agent_messages = camada SESSÃO (isolada por agente, mesmo lead pode
--       falar com 2 agentes em sessões separadas)
--     - lead_summaries = camada LEAD (resumo compartilhado entre agentes do
--       workspace; atualizado por job após interação)
--     - knowledge_base_fields + knowledge_documents + knowledge_chunks +
--       knowledge_embeddings = camada EMPRESA ("Cérebro da Empresa", pgvector
--       top-K recuperado antes do prompt; compartilhado por todos os agentes)
--
-- A UI mockada de M5 (apps/web/features/agents/) já define o contrato via
-- types.ts — essas tabelas espelham o shape esperado. Em M11#3 a UI conecta
-- via Server Actions; M11#1 entrega só o schema + RLS + smoke.
--
-- Extensão `vector` (pgvector) já está habilitada (M7#1 — `extensions =
-- [pgcrypto, pg_trgm, vector, citext]` no schema.prisma).
--
-- RLS segue o padrão M7–M10/M12: `public.current_workspace_id()` é a fonte da
-- verdade (lida do `app.workspace_id` que `withWorkspace` seta na transação).
-- Toda query também filtra `workspace_id` no código (defense in depth — CLAUDE.md §7.2).
-- ============================================================================

-- ============================================================================
-- 1. Enums novos
-- ============================================================================

DO $$ BEGIN
  -- Espelha apps/web/features/agents/types.ts:AgentStatus.
  -- `testing` é default ao criar — força revisão antes de soltar o agente real.
  CREATE TYPE public.agent_status AS ENUM ('testing', 'active', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Lista fechada (4 buckets). Espelha AgentTone do types.ts.
  CREATE TYPE public.agent_tone AS ENUM ('consultivo', 'amigavel', 'direto', 'formal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Match no primeiro hit (ordenado por priority asc). Espelha RouteKind do types.ts.
  CREATE TYPE public.agent_route_kind AS ENUM ('stage', 'tag', 'whatsapp_number', 'keyword');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- `production` = atende lead real; `simulation` = chat de teste no editor
  -- (sem efeito colateral, não conta em métricas, não dispara handoff).
  CREATE TYPE public.agent_session_kind AS ENUM ('production', 'simulation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Discriminador de chunk: vem dos 5 campos estruturados (about/products/etc)
  -- ou de um documento uploadado (PDF/DOC/...).
  CREATE TYPE public.knowledge_source_kind AS ENUM ('structured_field', 'document');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Status do processing pipeline do documento.
  -- `uploading` = arquivo no Storage mas extração ainda não rodou.
  -- `processing` = extração+chunking+embedding em execução.
  -- `processed` = chunks+embeddings persistidos, RAG pode usar.
  -- `failed` = erro fatal (vide error_detail).
  CREATE TYPE public.knowledge_doc_status AS ENUM ('uploading', 'processing', 'processed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Espelha KnowledgeFile.kind do types.ts (M5 só suporta 3, M11 expande pra 5).
  CREATE TYPE public.knowledge_doc_kind AS ENUM ('pdf', 'doc', 'docx', 'txt', 'md');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. Estende audit_action com eventos do motor de IA
-- ============================================================================

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'agent_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'agent_version_saved';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'agent_activated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'agent_paused';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'agent_deleted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'handoff_triggered';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'knowledge_doc_uploaded';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'knowledge_doc_processed';

-- ============================================================================
-- 3. Tabelas — Agentes
-- ============================================================================

-- 3.1 ai_agents --------------------------------------------------------------
-- Persona configurável do agente. `prompt`/`persona`/`tone` representam o
-- DRAFT atual (a versão editada no editor que ainda não foi salva como versão
-- imutável). `active_version_id` aponta pra versão "em produção" (a que o
-- runtime usa ao iniciar uma sessão real). Restore de versão antiga = copia
-- prompt+persona+tone de volta pro draft e re-aponta `active_version_id`.
--
-- `handoff_config` JSONB carrega o estado dos 6 gatilhos de handoff (manual,
-- keyword, commercial_intent, stage_negotiation, outside_business_hours,
-- agent_to_agent). Shape validado por Zod no Server Action (M11#3) — não
-- precisa de tabela separada porque os 6 são fixos e sempre presentes (M5
-- types.ts já documenta).
--
-- `template_key` é soft (varchar, não enum) — alinhado com o lookup de M5
-- (`AgentTemplateKey: 'qualification' | 'attendance' | 'recovery' | 'blank'`)
-- e permite o template virar configuração de runtime sem migration.
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid                  NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name              varchar(80)           NOT NULL,
  status            public.agent_status   NOT NULL DEFAULT 'testing',
  persona           varchar(280)          NOT NULL DEFAULT '',
  tone              public.agent_tone     NOT NULL DEFAULT 'consultivo',
  avatar_emoji      varchar(8),
  template_key      varchar(32),
  prompt            text                  NOT NULL DEFAULT '',
  active_version_id uuid,
  handoff_config    jsonb                 NOT NULL DEFAULT '{}'::jsonb,
  created_by_id     uuid                           REFERENCES public.users(id)      ON DELETE SET NULL,
  created_at        timestamptz           NOT NULL DEFAULT NOW(),
  updated_at        timestamptz           NOT NULL DEFAULT NOW(),
  deleted_at        timestamptz,
  CONSTRAINT ai_agents_name_length CHECK (char_length(name) BETWEEN 2 AND 80)
);
CREATE INDEX IF NOT EXISTS ai_agents_workspace_id_idx       ON public.ai_agents (workspace_id);
CREATE INDEX IF NOT EXISTS ai_agents_workspace_status_idx   ON public.ai_agents (workspace_id, status);
CREATE INDEX IF NOT EXISTS ai_agents_workspace_deleted_idx  ON public.ai_agents (workspace_id, deleted_at);

-- 3.2 agent_versions ---------------------------------------------------------
-- Snapshot imutável do trio (prompt + persona + tone) — uma row por save de
-- versão. Roteamento e handoff_config NÃO entram na versão (mudanças neles
-- são instantâneas + não-versionadas; paridade com como cadências tratam
-- status e métricas).
--
-- Restore de versão = copia o trio pra `ai_agents.prompt/persona/tone` e
-- atualiza `active_version_id`. Não cria row nova aqui.
CREATE TABLE IF NOT EXISTS public.agent_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       uuid                  NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  version_number integer               NOT NULL,
  prompt         text                  NOT NULL,
  persona        varchar(280)          NOT NULL DEFAULT '',
  tone           public.agent_tone     NOT NULL,
  notes          varchar(280),
  created_by_id  uuid                           REFERENCES public.users(id)     ON DELETE SET NULL,
  created_at     timestamptz           NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_versions_version_positive CHECK (version_number > 0),
  CONSTRAINT agent_versions_unique_per_agent UNIQUE (agent_id, version_number)
);
CREATE INDEX IF NOT EXISTS agent_versions_agent_id_idx
  ON public.agent_versions (agent_id, version_number DESC);

-- FK ai_agents.active_version_id → agent_versions.id (resolve circularidade).
-- ON DELETE SET NULL: deletar versão (não cascade) deixa o agente sem versão
-- ativa — Server Action de delete deve reapontar antes de deletar.
ALTER TABLE public.ai_agents
  DROP CONSTRAINT IF EXISTS ai_agents_active_version_fk;
ALTER TABLE public.ai_agents
  ADD CONSTRAINT ai_agents_active_version_fk
  FOREIGN KEY (active_version_id) REFERENCES public.agent_versions(id) ON DELETE SET NULL;

-- 3.3 agent_routing_rules ----------------------------------------------------
-- Regras de roteamento. Match no PRIMEIRO HIT, ordenado por `priority` asc.
-- UI controla `priority` via drag-and-drop (M11#3). Sem UNIQUE em (agent_id,
-- kind, value) — o mesmo agente pode ter 2 regras `tag=vip` (acidente do
-- usuário; UI deduplica no save, mas o schema não impõe).
CREATE TABLE IF NOT EXISTS public.agent_routing_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   uuid                       NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  kind       public.agent_route_kind    NOT NULL,
  value      varchar(120)               NOT NULL,
  priority   integer                    NOT NULL DEFAULT 0,
  created_at timestamptz                NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_routing_rules_value_length CHECK (char_length(value) BETWEEN 1 AND 120)
);
CREATE INDEX IF NOT EXISTS agent_routing_rules_agent_priority_idx
  ON public.agent_routing_rules (agent_id, priority);
CREATE INDEX IF NOT EXISTS agent_routing_rules_kind_value_idx
  ON public.agent_routing_rules (kind, value);

-- 3.4 agent_sessions ---------------------------------------------------------
-- Uma "sessão" = janela de conversa em que um agente está atendendo. Lead
-- pode ter múltiplas sessões ao longo do tempo (uma com agente A em maio,
-- outra com agente B em junho); um agente atende várias sessões em paralelo
-- (1 por conversation_id ativo).
--
-- `kind`:
--   - `production` → conversation_id + lead_id NOT NULL, persiste em
--     agent_messages, alimenta métricas e dispara handoff
--   - `simulation` → chat de teste do editor; conversation_id + lead_id NULL,
--     persiste em agent_messages mas não dispara nada externo
--
-- `version_id` registra qual versão do agente atendeu essa sessão — útil
-- pra debug ("essa resposta saiu na v3 ou na v4?").
--
-- `ended_at` NULL = sessão ativa. `ended_reason` discrimina o motivo do
-- encerramento (handoff_human, handoff_agent, completed, simulation_closed,
-- conversation_archived, etc.) — string livre por simplicidade.
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid                        NOT NULL REFERENCES public.workspaces(id)    ON DELETE CASCADE,
  agent_id        uuid                        NOT NULL REFERENCES public.ai_agents(id)     ON DELETE CASCADE,
  version_id      uuid                                 REFERENCES public.agent_versions(id) ON DELETE SET NULL,
  conversation_id uuid                                 REFERENCES public.conversations(id) ON DELETE CASCADE,
  lead_id         uuid                                 REFERENCES public.leads(id)         ON DELETE CASCADE,
  kind            public.agent_session_kind   NOT NULL DEFAULT 'production',
  started_at      timestamptz                 NOT NULL DEFAULT NOW(),
  ended_at        timestamptz,
  ended_reason    varchar(64),
  created_at      timestamptz                 NOT NULL DEFAULT NOW(),
  updated_at      timestamptz                 NOT NULL DEFAULT NOW(),
  -- Production session exige conversation_id + lead_id (sessão real).
  -- Simulation session NÃO pode ter conversation_id nem lead_id (chat de teste).
  CONSTRAINT agent_sessions_production_has_target CHECK (
    (kind = 'production'  AND conversation_id IS NOT NULL AND lead_id IS NOT NULL) OR
    (kind = 'simulation'  AND conversation_id IS NULL     AND lead_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS agent_sessions_workspace_agent_idx
  ON public.agent_sessions (workspace_id, agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_sessions_conversation_idx
  ON public.agent_sessions (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS agent_sessions_active_idx
  ON public.agent_sessions (workspace_id, agent_id) WHERE ended_at IS NULL;

-- 3.5 agent_messages ---------------------------------------------------------
-- Mensagens da sessão IA. SEPARADO de `messages` (M9) porque:
--   - `messages` é o registro WhatsApp (1 row por entrega real ao número),
--     compartilhado entre vendedor humano e agente
--   - `agent_messages` é o log interno do diálogo IA (inclui mensagens do
--     simulation que não vão pro WhatsApp, e contabiliza tokens Claude)
--
-- Em production, a resposta gerada pelo agente passa por aqui PRIMEIRO
-- (auditoria + tokens) e depois vira `messages.body` no envio efetivo.
--
-- Tokens: 4 campos refletem o que a Anthropic API retorna por chamada.
-- `cache_read_input_tokens` ≠ 0 indica que prompt caching foi efetivo
-- (CLAUDE.md §6 — caching obrigatório no system+base estável).
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                uuid                         NOT NULL REFERENCES public.workspaces(id)     ON DELETE CASCADE,
  session_id                  uuid                         NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  direction                   public.message_direction     NOT NULL,
  body                        text                         NOT NULL,
  model                       varchar(64),
  input_tokens                integer,
  output_tokens               integer,
  cache_read_input_tokens     integer,
  cache_creation_input_tokens integer,
  created_at                  timestamptz                  NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_messages_body_length CHECK (char_length(body) BETWEEN 1 AND 16000)
);
CREATE INDEX IF NOT EXISTS agent_messages_session_idx
  ON public.agent_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS agent_messages_workspace_created_idx
  ON public.agent_messages (workspace_id, created_at DESC);

-- ============================================================================
-- 4. Tabelas — Memória Lead (camada 2)
-- ============================================================================

-- 4.1 lead_summaries ---------------------------------------------------------
-- Resumo do lead consolidado a partir das interações com qualquer agente do
-- workspace. CLAUDE.md §6: camada lead é COMPARTILHADA entre agentes (lead
-- atende com agente A, resumo é visto pelo agente B na próxima sessão).
--
-- Atualizado por job (M11#2 background) após cada interação que avança o
-- entendimento do lead. Persistência leve (text) pra evitar embedding redundante.
--
-- `updated_by_agent_id` registra qual agente disparou a última atualização
-- (audit + debug). UNIQUE em `lead_id` garante 1 resumo por lead.
CREATE TABLE IF NOT EXISTS public.lead_summaries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id             uuid        NOT NULL REFERENCES public.leads(id)      ON DELETE CASCADE,
  summary             text        NOT NULL DEFAULT '',
  updated_by_agent_id uuid                 REFERENCES public.ai_agents(id)  ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT lead_summaries_lead_unique UNIQUE (lead_id)
);
CREATE INDEX IF NOT EXISTS lead_summaries_workspace_idx ON public.lead_summaries (workspace_id);

-- ============================================================================
-- 5. Tabelas — Cérebro da Empresa (camada 3, pgvector)
-- ============================================================================

-- 5.1 knowledge_base_fields --------------------------------------------------
-- 5 campos estruturados (PRD §3.9). UNIQUE em workspace_id porque é singleton
-- por workspace — UI atualiza via UPSERT.
--
-- Mudança em campo aqui re-gera chunks de tipo `structured_field` (M11#4 job).
CREATE TABLE IF NOT EXISTS public.knowledge_base_fields (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  about        text        NOT NULL DEFAULT '',
  products     text        NOT NULL DEFAULT '',
  faq          text        NOT NULL DEFAULT '',
  scripts      text        NOT NULL DEFAULT '',
  policy       text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT knowledge_base_fields_workspace_unique UNIQUE (workspace_id)
);

-- 5.2 knowledge_documents ----------------------------------------------------
-- Documento uploadado pelo workspace (PDF/DOC/DOCX/TXT/MD). Arquivo vive em
-- Supabase Storage (`storage_bucket`/`storage_path`); aqui só metadata +
-- status do pipeline.
--
-- `status` lifecycle: uploading → processing → processed | failed.
-- `processed_at` marca conclusão; `error_detail` populado em failed.
-- Soft-delete via `deleted_at` (chunks/embeddings cascateiam só no hard delete;
-- soft-delete só esconde da UI — cleanup de órfãos via pg_cron em M13).
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid                        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name            varchar(255)                NOT NULL,
  kind            public.knowledge_doc_kind   NOT NULL,
  size_bytes      integer                     NOT NULL,
  status          public.knowledge_doc_status NOT NULL DEFAULT 'uploading',
  storage_bucket  varchar(64)                 NOT NULL DEFAULT 'knowledge-base',
  storage_path    text                        NOT NULL,
  error_detail    text,
  uploaded_by_id  uuid                                 REFERENCES public.users(id)      ON DELETE SET NULL,
  processed_at    timestamptz,
  created_at      timestamptz                 NOT NULL DEFAULT NOW(),
  updated_at      timestamptz                 NOT NULL DEFAULT NOW(),
  deleted_at      timestamptz,
  CONSTRAINT knowledge_documents_size_positive CHECK (size_bytes > 0),
  CONSTRAINT knowledge_documents_size_under_10mb CHECK (size_bytes <= 10485760)
);
CREATE INDEX IF NOT EXISTS knowledge_documents_workspace_idx
  ON public.knowledge_documents (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_documents_workspace_status_idx
  ON public.knowledge_documents (workspace_id, status);
CREATE INDEX IF NOT EXISTS knowledge_documents_workspace_deleted_idx
  ON public.knowledge_documents (workspace_id, deleted_at);

-- 5.3 knowledge_chunks -------------------------------------------------------
-- Pedaço de texto pra busca semântica. Dois discriminados via `source`:
--   - `structured_field` → vem dos 5 campos do knowledge_base_fields
--     (document_id NULL, structured_field='about'/'products'/etc)
--   - `document` → vem de chunking de um knowledge_document
--     (document_id NOT NULL, structured_field NULL)
--
-- `tokens` é a contagem de tokens estimada (usado pra controlar custo da
-- chamada de embedding). `chunk_index` é a ordem dentro do source (0-based).
--
-- SEM unique constraint — re-chunking gera rows novas (delete-and-insert em
-- transação no M11#4 job).
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid                            NOT NULL REFERENCES public.workspaces(id)          ON DELETE CASCADE,
  document_id      uuid                                     REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  source           public.knowledge_source_kind    NOT NULL,
  structured_field varchar(32),
  content          text                            NOT NULL,
  tokens           integer                         NOT NULL DEFAULT 0,
  chunk_index      integer                         NOT NULL DEFAULT 0,
  created_at       timestamptz                     NOT NULL DEFAULT NOW(),
  CONSTRAINT knowledge_chunks_source_target CHECK (
    (source = 'document'         AND document_id IS NOT NULL AND structured_field IS NULL) OR
    (source = 'structured_field' AND document_id IS NULL     AND structured_field IS NOT NULL)
  ),
  CONSTRAINT knowledge_chunks_content_length CHECK (char_length(content) BETWEEN 1 AND 8000)
);
CREATE INDEX IF NOT EXISTS knowledge_chunks_workspace_idx ON public.knowledge_chunks (workspace_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_document_idx  ON public.knowledge_chunks (document_id) WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_chunks_workspace_structured_idx
  ON public.knowledge_chunks (workspace_id, structured_field) WHERE source = 'structured_field';

-- 5.4 knowledge_embeddings ---------------------------------------------------
-- Embeddings vetoriais separados dos chunks pra:
--   1. Permitir re-embed (mudou de modelo) sem rewrite dos chunks
--   2. Isolar HNSW index numa tabela menor (chunks tem text grande;
--      embeddings tem só vector(1536))
--
-- `workspace_id` duplicado pra que a query top-K possa filtrar antes do
-- ORDER BY (HNSW + WHERE workspace_id é mais eficiente que JOIN com chunks).
--
-- Dimensão 1536 = text-embedding-3-small da OpenAI (decisão de stack
-- CLAUDE.md §2). Mudança de modelo exige migration nova + re-embed.
CREATE TABLE IF NOT EXISTS public.knowledge_embeddings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id     uuid          NOT NULL REFERENCES public.knowledge_chunks(id) ON DELETE CASCADE,
  workspace_id uuid          NOT NULL REFERENCES public.workspaces(id)       ON DELETE CASCADE,
  embedding    vector(1536)  NOT NULL,
  model        varchar(64)   NOT NULL DEFAULT 'text-embedding-3-small',
  created_at   timestamptz   NOT NULL DEFAULT NOW(),
  CONSTRAINT knowledge_embeddings_chunk_unique UNIQUE (chunk_id)
);
CREATE INDEX IF NOT EXISTS knowledge_embeddings_workspace_idx ON public.knowledge_embeddings (workspace_id);

-- HNSW index pra busca top-K cosine (operador `<=>` em pgvector).
-- Parâmetros default (m=16, ef_construction=64) são suficientes pra volumes
-- MVP; tunar em M11.x se a recuperação ficar lenta com workspaces grandes.
CREATE INDEX IF NOT EXISTS knowledge_embeddings_hnsw_idx
  ON public.knowledge_embeddings USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- 6. Triggers — touch_updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS touch_updated_at ON public.ai_agents;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.agent_sessions;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.agent_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.lead_summaries;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.lead_summaries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.knowledge_base_fields;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.knowledge_base_fields
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.knowledge_documents;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 7. RLS — todas as 10 tabelas filtram por current_workspace_id()
-- ============================================================================

ALTER TABLE public.ai_agents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_versions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_routing_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_summaries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_embeddings  ENABLE ROW LEVEL SECURITY;

-- ai_agents ------------------------------------------------------------------
DROP POLICY IF EXISTS ai_agents_select ON public.ai_agents;
CREATE POLICY ai_agents_select ON public.ai_agents FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS ai_agents_insert ON public.ai_agents;
CREATE POLICY ai_agents_insert ON public.ai_agents FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS ai_agents_update ON public.ai_agents;
CREATE POLICY ai_agents_update ON public.ai_agents FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS ai_agents_delete ON public.ai_agents;
CREATE POLICY ai_agents_delete ON public.ai_agents FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- agent_versions — herda via agent_id (subquery), padrão cadence_steps/pipeline_stages
DROP POLICY IF EXISTS agent_versions_select ON public.agent_versions;
CREATE POLICY agent_versions_select ON public.agent_versions FOR SELECT
USING (agent_id IN (SELECT id FROM public.ai_agents WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS agent_versions_insert ON public.agent_versions;
CREATE POLICY agent_versions_insert ON public.agent_versions FOR INSERT
WITH CHECK (agent_id IN (SELECT id FROM public.ai_agents WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS agent_versions_update ON public.agent_versions;
CREATE POLICY agent_versions_update ON public.agent_versions FOR UPDATE
USING (agent_id IN (SELECT id FROM public.ai_agents WHERE workspace_id = public.current_workspace_id()))
WITH CHECK (agent_id IN (SELECT id FROM public.ai_agents WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS agent_versions_delete ON public.agent_versions;
CREATE POLICY agent_versions_delete ON public.agent_versions FOR DELETE
USING (agent_id IN (SELECT id FROM public.ai_agents WHERE workspace_id = public.current_workspace_id()));

-- agent_routing_rules — herda via agent_id
DROP POLICY IF EXISTS agent_routing_rules_select ON public.agent_routing_rules;
CREATE POLICY agent_routing_rules_select ON public.agent_routing_rules FOR SELECT
USING (agent_id IN (SELECT id FROM public.ai_agents WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS agent_routing_rules_insert ON public.agent_routing_rules;
CREATE POLICY agent_routing_rules_insert ON public.agent_routing_rules FOR INSERT
WITH CHECK (agent_id IN (SELECT id FROM public.ai_agents WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS agent_routing_rules_update ON public.agent_routing_rules;
CREATE POLICY agent_routing_rules_update ON public.agent_routing_rules FOR UPDATE
USING (agent_id IN (SELECT id FROM public.ai_agents WHERE workspace_id = public.current_workspace_id()))
WITH CHECK (agent_id IN (SELECT id FROM public.ai_agents WHERE workspace_id = public.current_workspace_id()));

DROP POLICY IF EXISTS agent_routing_rules_delete ON public.agent_routing_rules;
CREATE POLICY agent_routing_rules_delete ON public.agent_routing_rules FOR DELETE
USING (agent_id IN (SELECT id FROM public.ai_agents WHERE workspace_id = public.current_workspace_id()));

-- agent_sessions -------------------------------------------------------------
DROP POLICY IF EXISTS agent_sessions_select ON public.agent_sessions;
CREATE POLICY agent_sessions_select ON public.agent_sessions FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS agent_sessions_insert ON public.agent_sessions;
CREATE POLICY agent_sessions_insert ON public.agent_sessions FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS agent_sessions_update ON public.agent_sessions;
CREATE POLICY agent_sessions_update ON public.agent_sessions FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS agent_sessions_delete ON public.agent_sessions;
CREATE POLICY agent_sessions_delete ON public.agent_sessions FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- agent_messages — herda via workspace_id direto
DROP POLICY IF EXISTS agent_messages_select ON public.agent_messages;
CREATE POLICY agent_messages_select ON public.agent_messages FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS agent_messages_insert ON public.agent_messages;
CREATE POLICY agent_messages_insert ON public.agent_messages FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

-- agent_messages é append-only (sem UPDATE/DELETE policy).

-- lead_summaries -------------------------------------------------------------
DROP POLICY IF EXISTS lead_summaries_select ON public.lead_summaries;
CREATE POLICY lead_summaries_select ON public.lead_summaries FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS lead_summaries_insert ON public.lead_summaries;
CREATE POLICY lead_summaries_insert ON public.lead_summaries FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS lead_summaries_update ON public.lead_summaries;
CREATE POLICY lead_summaries_update ON public.lead_summaries FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS lead_summaries_delete ON public.lead_summaries;
CREATE POLICY lead_summaries_delete ON public.lead_summaries FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- knowledge_base_fields ------------------------------------------------------
DROP POLICY IF EXISTS knowledge_base_fields_select ON public.knowledge_base_fields;
CREATE POLICY knowledge_base_fields_select ON public.knowledge_base_fields FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS knowledge_base_fields_insert ON public.knowledge_base_fields;
CREATE POLICY knowledge_base_fields_insert ON public.knowledge_base_fields FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS knowledge_base_fields_update ON public.knowledge_base_fields;
CREATE POLICY knowledge_base_fields_update ON public.knowledge_base_fields FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

-- knowledge_base_fields delete via cascade do workspace (singleton).

-- knowledge_documents --------------------------------------------------------
DROP POLICY IF EXISTS knowledge_documents_select ON public.knowledge_documents;
CREATE POLICY knowledge_documents_select ON public.knowledge_documents FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS knowledge_documents_insert ON public.knowledge_documents;
CREATE POLICY knowledge_documents_insert ON public.knowledge_documents FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS knowledge_documents_update ON public.knowledge_documents;
CREATE POLICY knowledge_documents_update ON public.knowledge_documents FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS knowledge_documents_delete ON public.knowledge_documents;
CREATE POLICY knowledge_documents_delete ON public.knowledge_documents FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- knowledge_chunks -----------------------------------------------------------
DROP POLICY IF EXISTS knowledge_chunks_select ON public.knowledge_chunks;
CREATE POLICY knowledge_chunks_select ON public.knowledge_chunks FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS knowledge_chunks_insert ON public.knowledge_chunks;
CREATE POLICY knowledge_chunks_insert ON public.knowledge_chunks FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS knowledge_chunks_update ON public.knowledge_chunks;
CREATE POLICY knowledge_chunks_update ON public.knowledge_chunks FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS knowledge_chunks_delete ON public.knowledge_chunks;
CREATE POLICY knowledge_chunks_delete ON public.knowledge_chunks FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- knowledge_embeddings -------------------------------------------------------
DROP POLICY IF EXISTS knowledge_embeddings_select ON public.knowledge_embeddings;
CREATE POLICY knowledge_embeddings_select ON public.knowledge_embeddings FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS knowledge_embeddings_insert ON public.knowledge_embeddings;
CREATE POLICY knowledge_embeddings_insert ON public.knowledge_embeddings FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS knowledge_embeddings_update ON public.knowledge_embeddings;
CREATE POLICY knowledge_embeddings_update ON public.knowledge_embeddings FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS knowledge_embeddings_delete ON public.knowledge_embeddings;
CREATE POLICY knowledge_embeddings_delete ON public.knowledge_embeddings FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- ============================================================================
-- 8. Comments descritivos (introspect + Supabase Studio)
-- ============================================================================

COMMENT ON TABLE public.ai_agents IS
  'Agente IA configurável do workspace (PRD §3.9). Até 3 ativos no Pro IA (enforcement em M11#7). Prompt/persona/tone = draft atual; active_version_id aponta pra versão "em produção".';
COMMENT ON TABLE public.agent_versions IS
  'Snapshot imutável do trio (prompt+persona+tone) por save. Restore = copia trio pra draft + reaponta active_version_id (não cria row).';
COMMENT ON TABLE public.agent_routing_rules IS
  'Regras de roteamento — match no PRIMEIRO HIT ordenado por priority asc. UI controla priority via drag-and-drop.';
COMMENT ON TABLE public.agent_sessions IS
  'Sessão de conversa atendida por um agente. kind=production toca leads/conversations reais; kind=simulation é chat de teste sem efeito colateral.';
COMMENT ON TABLE public.agent_messages IS
  'Log interno do diálogo IA (camada SESSÃO da memória 3 camadas — CLAUDE.md §6). Append-only. Tokens registrados pra contabilização de custo Claude.';
COMMENT ON TABLE public.lead_summaries IS
  'Resumo persistente do lead (camada LEAD da memória 3 camadas — CLAUDE.md §6). Compartilhado entre agentes do workspace. Atualizado por job pós-interação.';
COMMENT ON TABLE public.knowledge_base_fields IS
  '5 campos estruturados do "Cérebro da Empresa" (PRD §3.9). Singleton por workspace. Mudança re-gera chunks structured_field.';
COMMENT ON TABLE public.knowledge_documents IS
  'Documento uploadado pro Cérebro (PDF/DOC/DOCX/TXT/MD ≤ 10MB). Pipeline: uploading → processing → processed | failed.';
COMMENT ON TABLE public.knowledge_chunks IS
  'Pedaço de texto do Cérebro pra busca semântica. source=structured_field (vem dos 5 campos) ou source=document (chunking de arquivo).';
COMMENT ON TABLE public.knowledge_embeddings IS
  'Embedding vetorial 1536-dim (text-embedding-3-small) por chunk. Separado pra permitir re-embed sem rewrite + isolar HNSW index. Camada EMPRESA da memória 3 camadas.';
