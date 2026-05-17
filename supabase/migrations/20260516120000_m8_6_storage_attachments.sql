-- M8#6 — Storage Supabase pra anexos de lead.
--
-- 1. Estende enum `audit_action` com `attachment_uploaded` + `attachment_deleted`.
-- 2. Cria bucket privado `attachments` com whitelist de MIME types e size limit
--    10 MB (PRD §3.5). Decisão: bucket privado, signed URL 1h pra download.
-- 3. Policies RLS em `storage.objects` — workspace via prefixo de path
--    (`<workspaceId>/<leadId>/<uuid>-<filename>`).
--
-- Idempotente — replay seguro via `supabase db reset` (local) ou `supabase db
-- push` (cloud).
--
-- **Não** usa pg_cron — cleanup é via Next route + GitHub Action diário
-- (`/api/cron/cleanup-attachments`). Decisão técnica: portável + testável local
-- (memória `dev-local-windows-antivirus-tls` impede Edge Functions em dev).
-- Migração pra pg_cron + pg_net fica pra pós-MVP.

-- ============================================================================
-- 1. Estender enum audit_action
-- ============================================================================

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'attachment_uploaded';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'attachment_deleted';

-- ============================================================================
-- 2. Bucket `attachments` (privado, 10 MB, MIME whitelist)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  10485760, -- 10 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 3. Policies RLS em storage.objects
--    Path pattern: '<workspaceId>/<leadId>/<uuid>-<filename>'
--    split_part(name, '/', 1)::uuid extrai workspaceId
-- ============================================================================

DROP POLICY IF EXISTS attachments_storage_select ON storage.objects;
CREATE POLICY attachments_storage_select ON storage.objects
FOR SELECT
USING (
  bucket_id = 'attachments'
  AND split_part(name, '/', 1)::uuid IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS attachments_storage_insert ON storage.objects;
CREATE POLICY attachments_storage_insert ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'attachments'
  AND split_part(name, '/', 1)::uuid IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS attachments_storage_delete ON storage.objects;
CREATE POLICY attachments_storage_delete ON storage.objects
FOR DELETE
USING (
  bucket_id = 'attachments'
  AND split_part(name, '/', 1)::uuid IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- COMMENT ON POLICY em storage.objects exige ser owner da tabela. Em Supabase
-- cloud o role `postgres` tem permissão; em local Docker o user `postgres` do
-- container NÃO é owner de `storage.objects` (é `supabase_storage_admin`). Envolvemos
-- em DO block com EXCEPTION pra que rode em ambos sem quebrar — comments são
-- só metadata pro Studio, não afetam runtime.
DO $$
BEGIN
  EXECUTE 'COMMENT ON POLICY attachments_storage_select ON storage.objects IS ''M8#6 — usuário só vê objetos cujo path comece com workspace_id que ele é membro.''';
  EXECUTE 'COMMENT ON POLICY attachments_storage_insert ON storage.objects IS ''M8#6 — usuário só insere objetos com path começando com workspace_id que ele é membro. Server Actions usam service role (bypassa) mas a policy é defense-in-depth.''';
  EXECUTE 'COMMENT ON POLICY attachments_storage_delete ON storage.objects IS ''M8#6 — usuário só deleta objetos do próprio workspace. Cleanup job usa service role.''';
EXCEPTION WHEN insufficient_privilege THEN
  NULL; -- supabase local: pula silenciosamente
END $$;
