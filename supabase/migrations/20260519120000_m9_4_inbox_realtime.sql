-- M9#4 — Realtime Inbox: expor `messages`, `conversations` e `quick_replies`
-- na publication `supabase_realtime` + `REPLICA IDENTITY FULL`.
--
-- Espelha o padrão do M8#7 (deals). Com isso o hook `use-realtime-messages` no
-- client subscribe ao canal `workspace:<id>:messages` (e relacionados) e dispara
-- `router.refresh()` quando o webhook inbound persiste uma mensagem nova, o
-- Server Action de envio insere uma row outbound, ou um Server Action de
-- archive/transfer/markAsRead muda Conversation.
--
-- RLS automática: Supabase Realtime aplica policies SELECT — cliente só recebe
-- rows do `current_workspace_id()` dele (via JWT anon key). Filtro
-- `workspace_id=eq.<id>` no `.on('postgres_changes', ...)` é defense-in-depth.
--
-- Idempotente — replay seguro via `supabase db reset` (local) ou
-- `supabase db push` (cloud). `ADD TABLE` em publication é idempotente via
-- guard `EXISTS` (`pg_publication_tables`).

-- ============================================================================
-- 1. Adicionar `messages` à publication
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;

COMMENT ON TABLE public.messages IS
  'Append-only. UNIQUE PARCIAL em external_message_id pra dedup idempotente do webhook inbound. M9#4 expôs em supabase_realtime publication com REPLICA IDENTITY FULL pra que INSERT entreguem payload completo no canal workspace:<id>:messages.';

-- ============================================================================
-- 2. Adicionar `conversations` à publication
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;

ALTER TABLE public.conversations REPLICA IDENTITY FULL;

COMMENT ON TABLE public.conversations IS
  'Conversa entre número do workspace e contato. Unique por (workspace_id, contact_phone) — 1 número/WS. M9#4 expôs em supabase_realtime publication com REPLICA IDENTITY FULL pra UPDATE de status/lastMessage*/unreadCount entregarem payload completo.';

-- ============================================================================
-- 3. Adicionar `quick_replies` à publication
-- ============================================================================
--
-- Volume baixo (max ~20-30 por workspace) mas inclui pra que CRUD reflita em
-- todas as sessões abertas sem precisar refresh manual.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'quick_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_replies;
  END IF;
END $$;

ALTER TABLE public.quick_replies REPLICA IDENTITY FULL;
