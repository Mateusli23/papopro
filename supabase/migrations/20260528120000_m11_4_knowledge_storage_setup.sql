-- ============================================================================
-- M11#4 — Storage bucket pra Cérebro da Empresa + helper de re-chunking
-- ============================================================================
-- Cria bucket privado `knowledge-base` pros documentos do Cérebro (PRD §3.9):
-- PDFs, TXT e MD por enquanto (DOC/DOCX em sub-PR follow-up). Path pattern
-- `<workspaceId>/<documentId>/<filename>` espelha o de attachments (M8#6) —
-- workspace_id no prefix permite policies RLS em storage.objects.
--
-- Bucket privado (não-público) — texto extraído já vive em `knowledge_chunks`
-- (M11#1) que é a fonte pra RAG; admin não precisa baixar o arquivo
-- depois do upload. Cleanup de arquivos órfãos: hard delete imediato no
-- `deleteKnowledgeDocumentAction` (M11#4), sem soft-delete window.
--
-- Idempotente — replay seguro via `supabase db reset` (local) ou apply
-- repetido no remote.
-- ============================================================================

-- ============================================================================
-- 1. Bucket `knowledge-base` (privado, 10 MB, MIME whitelist)
-- ============================================================================
-- 10 MB alinha com CHECK constraint de `knowledge_documents.size_bytes`
-- (M11#1). MIME whitelist cobre os 3 tipos suportados em M11#4 (pdf/txt/md)
-- + 2 reservados pra follow-up (doc/docx). Upload de doc/docx vai funcionar
-- no Storage; processing retorna `failed` com `error_detail` propositivo
-- até a lib de extração entrar.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-base',
  'knowledge-base',
  false,
  10485760, -- 10 MB
  ARRAY[
    'application/pdf',
    'text/plain',
    'text/markdown',
    -- Reservados — upload funciona mas processing retorna failed em M11#4:
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 2. Policies RLS em storage.objects
-- ============================================================================
-- Mesma estratégia de attachments (M8#6): membro do workspace pode ler/inserir/
-- deletar objetos cujo path comece com `<workspaceId>/`. Server Actions usam
-- service role (bypassa); a policy é defense-in-depth caso anon key vaze.

DROP POLICY IF EXISTS knowledge_base_storage_select ON storage.objects;
CREATE POLICY knowledge_base_storage_select ON storage.objects
FOR SELECT
USING (
  bucket_id = 'knowledge-base'
  AND split_part(name, '/', 1)::uuid IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS knowledge_base_storage_insert ON storage.objects;
CREATE POLICY knowledge_base_storage_insert ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'knowledge-base'
  AND split_part(name, '/', 1)::uuid IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS knowledge_base_storage_delete ON storage.objects;
CREATE POLICY knowledge_base_storage_delete ON storage.objects
FOR DELETE
USING (
  bucket_id = 'knowledge-base'
  AND split_part(name, '/', 1)::uuid IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Comments (toleram falha em local Docker — owner é supabase_storage_admin lá).
DO $$
BEGIN
  EXECUTE 'COMMENT ON POLICY knowledge_base_storage_select ON storage.objects IS ''M11#4 — membro do workspace só lê objetos cujo path começa com workspace_id que ele é membro.''';
  EXECUTE 'COMMENT ON POLICY knowledge_base_storage_insert ON storage.objects IS ''M11#4 — membro só insere objetos com path começando com workspace_id que ele é membro.''';
  EXECUTE 'COMMENT ON POLICY knowledge_base_storage_delete ON storage.objects IS ''M11#4 — membro só deleta objetos do próprio workspace.''';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;

-- ============================================================================
-- 3. Helper RPC: delete chunks de campo estruturado
-- ============================================================================
-- Quando admin edita um dos 5 campos do Cérebro (`about`/`products`/`faq`/
-- `scripts`/`policy`), Server Action precisa re-chunkear: delete chunks
-- antigos desse campo + insert novos chunks + insert embeddings. RPC abaixo
-- isola o delete (parte mais simples) — insert é feito via Prisma TX no
-- caller. `ON DELETE CASCADE` em `knowledge_embeddings.chunk_id` (M11#1)
-- cuida da limpeza dos vetores associados.
--
-- SECURITY DEFINER pra atravessar RLS (Server Action já validou workspace).

CREATE OR REPLACE FUNCTION public.delete_structured_field_chunks(
  p_workspace_id uuid,
  p_field varchar(32)
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.knowledge_chunks
   WHERE workspace_id = p_workspace_id
     AND source = 'structured_field'::public.knowledge_source_kind
     AND structured_field = p_field;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.delete_structured_field_chunks(uuid, varchar) IS
  'M11#4 — Limpa chunks (+embeddings via cascade) de um campo estruturado do Cérebro antes de re-chunkear. Chamado pelo Server Action updateKnowledgeBaseAction.';
