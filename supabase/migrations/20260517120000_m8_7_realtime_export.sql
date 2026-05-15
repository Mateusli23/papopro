-- M8#7 — Realtime Kanban (publication `supabase_realtime`) + export CSV de leads.
--
-- 1. Adiciona `public.deals` à publication `supabase_realtime` — o canal
--    `workspace:<id>:deals` no browser passa a receber INSERT/UPDATE/DELETE
--    em tempo real. RLS aplicada automaticamente: cada client só recebe
--    rows do workspace ativo (filter `workspace_id=eq.<id>`).
--
-- 2. Nenhum enum novo: `export_started` já existe em `audit_action` desde
--    M7#2 e o export CSV reusa direto. M8#7 não introduz tabelas nem
--    colunas novas — só a publication.
--
-- Idempotente — replay seguro via `supabase db reset` (local) ou
-- `supabase db push` (cloud). `ADD TABLE` em publication é idempotente
-- via guard `EXISTS`.

-- ============================================================================
-- 1. Adicionar `deals` à publication `supabase_realtime`
-- ============================================================================
--
-- `supabase_realtime` é a publication padrão do Supabase Realtime. A imagem
-- Postgres já cria essa publication vazia; tabelas que queremos expor em
-- tempo real entram via `ALTER PUBLICATION ADD TABLE`.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'deals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
  END IF;
END $$;

-- ============================================================================
-- 2. Replica identity FULL pra deals
-- ============================================================================
--
-- `REPLICA IDENTITY FULL` faz o WAL incluir TODAS as colunas no payload de
-- UPDATE/DELETE — sem isso, o Realtime entrega só a PK e o cliente teria
-- que re-fetchar o resto. Pra um Kanban que precisa renderizar `stageId`,
-- `orderInStage`, `valueCents` instantaneamente, FULL é o que faz sentido.
--
-- Custo: payload de WAL um pouco maior. Aceitável pra ~50-500 deals/workspace.

ALTER TABLE public.deals REPLICA IDENTITY FULL;

COMMENT ON TABLE public.deals IS
  'M8#1 — Oportunidade comercial. M8#7 expôs em supabase_realtime publication com REPLICA IDENTITY FULL pra que UPDATE/DELETE entreguem payload completo no canal workspace:<id>:deals.';
