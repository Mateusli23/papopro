import 'server-only';

import { randomUUID } from 'node:crypto';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Helpers de Storage Supabase pra anexos de lead (M8#6).
 *
 * Tudo aqui é server-only — usa Service Role pra ler/escrever no bucket
 * privado `attachments`. RLS em `storage.objects` segura caminhos diretos
 * via anon key (defense-in-depth), mas o fluxo canônico passa pelo Server
 * Action que valida RBAC antes de chamar essas funções.
 *
 * **Path pattern:** `<workspaceId>/<leadId>/<uuid>-<safeFileName>`. O
 * workspaceId no prefixo é o que permite a policy de `storage.objects`
 * extrair tenant via `split_part(name, '/', 1)::uuid`.
 *
 * **Whitelist + size limit** acordados em M8#5 (PRD §3.5):
 *  - 10 MB
 *  - PDF, PNG, JPEG, WebP, DOC, DOCX
 *
 * Validação acontece **duas vezes** — no Server Action antes do upload
 * (pra dar mensagem propositiva) e na config do bucket (`file_size_limit`
 * + `allowed_mime_types`). Defense-in-depth contra request malicioso que
 * pule o action.
 */

export const ATTACHMENTS_BUCKET = 'attachments';
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// =============================================================================
// Validação pura
// =============================================================================

export interface AttachmentValidationInput {
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}

export type AttachmentValidationResult =
  | { ok: true }
  | { ok: false; code: 'mime' | 'size' | 'name'; message: string };

/**
 * Valida MIME, tamanho e nome de arquivo antes do upload. Função pura
 * pra ser usada no Server Action e no smoke test.
 */
export function validateAttachmentInput(
  input: AttachmentValidationInput,
): AttachmentValidationResult {
  if (!input.fileName || input.fileName.trim().length === 0) {
    return { ok: false, code: 'name', message: 'Nome de arquivo vazio.' };
  }
  if (input.fileName.length > 255) {
    return { ok: false, code: 'name', message: 'Nome de arquivo muito longo (máx. 255).' };
  }
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    return {
      ok: false,
      code: 'mime',
      message: 'Tipo de arquivo não suportado. Aceitamos PDF, imagens (PNG/JPEG/WebP) e Word.',
    };
  }
  if (input.sizeBytes <= 0) {
    return { ok: false, code: 'size', message: 'Arquivo vazio.' };
  }
  if (input.sizeBytes > MAX_FILE_SIZE) {
    return {
      ok: false,
      code: 'size',
      message: `Arquivo muito grande (máx. ${formatFileSize(MAX_FILE_SIZE)}).`,
    };
  }
  return { ok: true };
}

// =============================================================================
// Path builder
// =============================================================================

/**
 * Normaliza um filename removendo acentos, espaços e caracteres especiais
 * problemáticos pra URL/storage. Mantém extensão.
 *
 * `proposta v3 (final).pdf` → `proposta-v3-final.pdf`
 * `cláusulas àbêcedárias.docx` → `clausulas-abecedarias.docx`
 */
export function sanitizeFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  const stem = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot > 0 ? fileName.slice(lastDot + 1).toLowerCase() : '';

  const cleanStem = stem
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]+/g, '-') // qualquer outro caractere vira hyphen
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  const cleanExt = ext.replace(/[^a-z0-9]/g, '');
  const safeStem = cleanStem.length > 0 ? cleanStem : 'arquivo';
  return cleanExt ? `${safeStem}.${cleanExt}` : safeStem;
}

/**
 * Monta o storage path completo. UUID prefixa o filename pra evitar colisão
 * entre 2 uploads simultâneos do mesmo arquivo (`upsert: false` no admin).
 */
export function buildStoragePath(
  workspaceId: string,
  leadId: string,
  fileName: string,
  idGen: () => string = randomUUID,
): string {
  return `${workspaceId}/${leadId}/${idGen()}-${sanitizeFileName(fileName)}`;
}

// =============================================================================
// Format file size (UI helper)
// =============================================================================

/**
 * Formata bytes pra exibição humanizada (1.2 KB, 487 KB, 1.4 MB, 2.0 GB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

// =============================================================================
// Storage I/O (Supabase admin client)
// =============================================================================

export interface UploadResult {
  ok: true;
  path: string;
}
export interface UploadError {
  ok: false;
  message: string;
}

/**
 * Sobe um File/Buffer pro bucket. Retorna o path canônico em caso de sucesso.
 *
 * `upsert: false` garante que dois uploads simultâneos com mesmo path
 * (improvável dado o UUID, mas defense-in-depth) não sobrescrevam.
 */
export async function uploadToStorage(
  path: string,
  body: Buffer | Blob | ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<UploadResult | UploadError> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(ATTACHMENTS_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, path };
}

/**
 * Remove uma lista de objetos. Idempotente — Supabase não erra em 404 ali.
 */
export async function deleteFromStorage(paths: string[]): Promise<{
  ok: boolean;
  removed: number;
  message?: string;
}> {
  if (paths.length === 0) return { ok: true, removed: 0 };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(ATTACHMENTS_BUCKET).remove(paths);
  if (error) {
    return { ok: false, removed: 0, message: error.message };
  }
  return { ok: true, removed: data?.length ?? 0 };
}

/**
 * Cria URL assinada com TTL pra download. Default 1h.
 */
export async function createSignedDownloadUrl(
  path: string,
  ttlSec = 3600,
): Promise<{ ok: true; url: string; expiresAt: Date } | { ok: false; message: string }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(path, ttlSec);
  if (error || !data?.signedUrl) {
    return { ok: false, message: error?.message ?? 'Não foi possível gerar a URL.' };
  }
  return {
    ok: true,
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + ttlSec * 1000),
  };
}
