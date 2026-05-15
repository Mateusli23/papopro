-- M9#1 — Schema WhatsApp (adapter + Inbox real + heartbeat).
--
-- Espelha `packages/db/prisma/schema.prisma` (source of truth). Tudo idempotente
-- — replay seguro local via `supabase db reset` e cloud via `supabase db push`.
-- Cobre o schema base; adapter, webhook, anti-ban, Inbox queries e heartbeat
-- entram em M9#2..M9#5 sobre essa base.
--
-- RLS segue o padrão M7#2/M8#1: `current_workspace_id()` é a fonte da verdade.
-- Defense-in-depth: o app continua filtrando `workspaceId` no código mesmo com
-- RLS (CLAUDE.md §7.2).
--
-- Decisões fechadas (não reabrir):
--   - 1 número por workspace (Workspace 1—1 WhatsappAccount).
--   - MVP entrega só `text` + `internal_note` em Message.kind. Mídia em M9.x/M10.
--   - Conversa unique por (workspace_id, contact_phone) — consequência direta de
--     1 número por workspace.
--   - `messages.external_message_id` tem UNIQUE PARCIAL (WHERE NOT NULL) — dedup
--     idempotente de inbound, mas outbound antes do ACK pode não ter ID ainda.

-- ============================================================================
-- 1. Estender `audit_action` com eventos WhatsApp (M9)
--    `ALTER TYPE ADD VALUE IF NOT EXISTS` roda ANTES de qualquer CREATE TABLE
--    que use os valores (Postgres 12+ exige isso — `ADD VALUE` é não-transacional
--    e não pode ser usado na mesma tx onde é referenciado).
-- ============================================================================

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'whatsapp_connected';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'whatsapp_disconnected';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'whatsapp_message_sent';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'whatsapp_blocked_optout';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'quick_reply_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'quick_reply_deleted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'conversation_archived';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'conversation_transferred';

-- ============================================================================
-- 2. Enums novos
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.message_direction AS ENUM ('in','out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_kind AS ENUM ('text','image','audio','document','internal_note');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.conversation_status AS ENUM ('awaiting','responded','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.health_score AS ENUM ('healthy','degraded','unhealthy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 3. Tabelas
-- ============================================================================

-- whatsapp_accounts — 1:1 com workspace
CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid         NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone_number varchar(32)  NOT NULL DEFAULT '',
  display_name varchar(120),
  provider     varchar(32)  NOT NULL DEFAULT 'uazapi',
  created_at   timestamptz  NOT NULL DEFAULT NOW(),
  updated_at   timestamptz  NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_accounts_workspace_key UNIQUE (workspace_id)
);

-- whatsapp_instances — sessão atual da conta (estado dinâmico)
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid                NOT NULL REFERENCES public.workspaces(id)         ON DELETE CASCADE,
  account_id            uuid                NOT NULL REFERENCES public.whatsapp_accounts(id)  ON DELETE CASCADE,
  external_instance_id  varchar(128),
  status                varchar(24)         NOT NULL DEFAULT 'disconnected',
  health_score          public.health_score NOT NULL DEFAULT 'healthy',
  qr_code               text,
  qr_expires_at         timestamptz,
  last_seen_at          timestamptz,
  connected_at          timestamptz,
  disconnected_at       timestamptz,
  messages_sent_24h     integer             NOT NULL DEFAULT 0,
  paused_until          timestamptz,
  created_at            timestamptz         NOT NULL DEFAULT NOW(),
  updated_at            timestamptz         NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_instances_account_key UNIQUE (account_id)
);
CREATE INDEX IF NOT EXISTS whatsapp_instances_workspace_idx        ON public.whatsapp_instances (workspace_id);
CREATE INDEX IF NOT EXISTS whatsapp_instances_workspace_status_idx ON public.whatsapp_instances (workspace_id, status);
CREATE INDEX IF NOT EXISTS whatsapp_instances_last_seen_idx        ON public.whatsapp_instances (last_seen_at);

-- conversations — espelha features/inbox/types.ts:Conversation
CREATE TABLE IF NOT EXISTS public.conversations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid                       NOT NULL REFERENCES public.workspaces(id)         ON DELETE CASCADE,
  lead_id                uuid                       NOT NULL REFERENCES public.leads(id)              ON DELETE CASCADE,
  vendor_id              uuid                                REFERENCES public.workspace_members(id)  ON DELETE SET NULL,
  whatsapp_account_id    uuid                       NOT NULL REFERENCES public.whatsapp_accounts(id)  ON DELETE CASCADE,
  contact_phone          varchar(32)                NOT NULL,
  status                 public.conversation_status NOT NULL DEFAULT 'awaiting',
  last_message_at        timestamptz,
  last_message_preview   varchar(280),
  last_message_direction public.message_direction,
  unread_count           integer                    NOT NULL DEFAULT 0,
  archived_at            timestamptz,
  created_at             timestamptz                NOT NULL DEFAULT NOW(),
  updated_at             timestamptz                NOT NULL DEFAULT NOW(),
  CONSTRAINT conversations_workspace_phone_key UNIQUE (workspace_id, contact_phone)
);
CREATE INDEX IF NOT EXISTS conversations_workspace_status_last_msg_idx ON public.conversations (workspace_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_workspace_vendor_idx          ON public.conversations (workspace_id, vendor_id);
CREATE INDEX IF NOT EXISTS conversations_lead_idx                       ON public.conversations (lead_id);

-- messages — append-only (body/kind/direction imutáveis após criação)
CREATE TABLE IF NOT EXISTS public.messages (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid                     NOT NULL REFERENCES public.workspaces(id)         ON DELETE CASCADE,
  conversation_id         uuid                     NOT NULL REFERENCES public.conversations(id)      ON DELETE CASCADE,
  kind                    public.message_kind      NOT NULL,
  direction               public.message_direction NOT NULL,
  body                    text,
  author_id               uuid                              REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  external_message_id     varchar(128),
  delivered_at            timestamptz,
  read_at                 timestamptz,
  media_name              varchar(255),
  media_size_kb           integer,
  media_duration_seconds  integer,
  created_at              timestamptz              NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_workspace_conversation_created_idx ON public.messages (workspace_id, conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx           ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_workspace_external_idx             ON public.messages (workspace_id, external_message_id);

-- UNIQUE PARCIAL — dedup idempotente do webhook inbound (M9#3) sem bloquear
-- outbound antes do ACK do provedor (que pode chegar sem external_message_id).
-- Prisma 5 não suporta WHERE em @@unique, então é declarado aqui no SQL.
CREATE UNIQUE INDEX IF NOT EXISTS messages_workspace_external_unique
  ON public.messages (workspace_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

-- quick_replies
CREATE TABLE IF NOT EXISTS public.quick_replies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label         varchar(80) NOT NULL,
  body          text        NOT NULL,
  "order"       integer     NOT NULL DEFAULT 0,
  created_by_id uuid,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT quick_replies_workspace_label_key UNIQUE (workspace_id, label)
);
CREATE INDEX IF NOT EXISTS quick_replies_workspace_order_idx ON public.quick_replies (workspace_id, "order");

-- blacklist — opt-out LGPD (CLAUDE.md §7.5)
CREATE TABLE IF NOT EXISTS public.blacklist (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone        varchar(32) NOT NULL,
  reason       varchar(32) NOT NULL DEFAULT 'opt_out',
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT blacklist_workspace_phone_key UNIQUE (workspace_id, phone)
);
CREATE INDEX IF NOT EXISTS blacklist_workspace_idx ON public.blacklist (workspace_id);

-- whatsapp_events — ciclo de vida da conexão (append-only)
CREATE TABLE IF NOT EXISTS public.whatsapp_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  instance_id  uuid                 REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  type         varchar(32) NOT NULL,
  payload      jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS whatsapp_events_workspace_created_idx ON public.whatsapp_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_events_instance_type_idx     ON public.whatsapp_events (instance_id, type, created_at DESC);

-- ============================================================================
-- 4. Triggers touch_updated_at (reaproveita função de M7#2)
-- ============================================================================

DROP TRIGGER IF EXISTS touch_updated_at ON public.whatsapp_accounts;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.whatsapp_instances;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.conversations;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.quick_replies;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 5. RLS — habilita em todas + policies por (workspace_id = current_workspace_id())
--    Padrão de M7#2/M8#1. Defense-in-depth: app continua filtrando workspaceId.
--    `messages` e `whatsapp_events` são append-only (SELECT + INSERT apenas).
--    `messages` ganha UPDATE policy condicional pra liberar `read_at`/`delivered_at`.
-- ============================================================================

ALTER TABLE public.whatsapp_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blacklist          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_events    ENABLE ROW LEVEL SECURITY;

-- whatsapp_accounts
DROP POLICY IF EXISTS whatsapp_accounts_select ON public.whatsapp_accounts;
CREATE POLICY whatsapp_accounts_select ON public.whatsapp_accounts FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS whatsapp_accounts_insert ON public.whatsapp_accounts;
CREATE POLICY whatsapp_accounts_insert ON public.whatsapp_accounts FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS whatsapp_accounts_update ON public.whatsapp_accounts;
CREATE POLICY whatsapp_accounts_update ON public.whatsapp_accounts FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS whatsapp_accounts_delete ON public.whatsapp_accounts;
CREATE POLICY whatsapp_accounts_delete ON public.whatsapp_accounts FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- whatsapp_instances
DROP POLICY IF EXISTS whatsapp_instances_select ON public.whatsapp_instances;
CREATE POLICY whatsapp_instances_select ON public.whatsapp_instances FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS whatsapp_instances_insert ON public.whatsapp_instances;
CREATE POLICY whatsapp_instances_insert ON public.whatsapp_instances FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS whatsapp_instances_update ON public.whatsapp_instances;
CREATE POLICY whatsapp_instances_update ON public.whatsapp_instances FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS whatsapp_instances_delete ON public.whatsapp_instances;
CREATE POLICY whatsapp_instances_delete ON public.whatsapp_instances FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- conversations
DROP POLICY IF EXISTS conversations_select ON public.conversations;
CREATE POLICY conversations_select ON public.conversations FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS conversations_insert ON public.conversations;
CREATE POLICY conversations_insert ON public.conversations FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS conversations_update ON public.conversations;
CREATE POLICY conversations_update ON public.conversations FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS conversations_delete ON public.conversations;
CREATE POLICY conversations_delete ON public.conversations FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- messages — SELECT + INSERT sempre liberados ao workspace ativo
DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

-- messages — UPDATE permite só atualizar read_at/delivered_at preservando workspace.
-- Body/kind/direction são append-only mas Postgres RLS valida só o WITH CHECK final,
-- então o app garante que esses campos não mudam (defense-in-depth no Server Action).
DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

-- Sem DELETE em messages — append-only por design.

-- quick_replies
DROP POLICY IF EXISTS quick_replies_select ON public.quick_replies;
CREATE POLICY quick_replies_select ON public.quick_replies FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS quick_replies_insert ON public.quick_replies;
CREATE POLICY quick_replies_insert ON public.quick_replies FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS quick_replies_update ON public.quick_replies;
CREATE POLICY quick_replies_update ON public.quick_replies FOR UPDATE
USING (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS quick_replies_delete ON public.quick_replies;
CREATE POLICY quick_replies_delete ON public.quick_replies FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- blacklist
DROP POLICY IF EXISTS blacklist_select ON public.blacklist;
CREATE POLICY blacklist_select ON public.blacklist FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS blacklist_insert ON public.blacklist;
CREATE POLICY blacklist_insert ON public.blacklist FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS blacklist_delete ON public.blacklist;
CREATE POLICY blacklist_delete ON public.blacklist FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- whatsapp_events — append-only (SELECT + INSERT)
DROP POLICY IF EXISTS whatsapp_events_select ON public.whatsapp_events;
CREATE POLICY whatsapp_events_select ON public.whatsapp_events FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS whatsapp_events_insert ON public.whatsapp_events;
CREATE POLICY whatsapp_events_insert ON public.whatsapp_events FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

-- ============================================================================
-- 6. Comments (descritivos pra Studio + introspect)
-- ============================================================================

COMMENT ON TABLE public.whatsapp_accounts  IS 'Conta WhatsApp do workspace (1:1). Provedor uazapi no Standard; Cloud API Meta em V2.';
COMMENT ON TABLE public.whatsapp_instances IS 'Sessão atual da conta — status, QR, health, anti-ban. Status string pra evoluir sem migration.';
COMMENT ON TABLE public.conversations      IS 'Conversa entre número do workspace e contato. Unique por (workspace_id, contact_phone) — 1 número/WS.';
COMMENT ON TABLE public.messages           IS 'Append-only. UNIQUE PARCIAL em external_message_id pra dedup idempotente do webhook inbound.';
COMMENT ON TABLE public.quick_replies      IS 'Templates de resposta rápida do composer (PRD §3.8). Placeholders {nome}/{empresa} resolvidos no client.';
COMMENT ON TABLE public.blacklist          IS 'Opt-out LGPD (CLAUDE.md §7.5). Anti-ban consulta antes de qualquer envio.';
COMMENT ON TABLE public.whatsapp_events    IS 'Eventos da sessão (connected/disconnected/qr/heartbeat). Append-only — observability + debug.';
