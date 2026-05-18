'use server';

/**
 * Server Actions do Cérebro da Empresa — upload + processing (M11#4).
 *
 * Completa M11#3: agora o admin pode subir PDF/TXT/MD pro Cérebro e o
 * conteúdo entra no RAG via `topKKnowledge` (M11#2). Processing **síncrono**
 * dentro da Server Action (MVP): upload → extract → chunk → embed → persist
 * → marca `processed`. Arquivos típicos (≤2MB texto) processam em <15s
 * dentro do timeout Next 14.
 *
 * **Tipos suportados:** pdf, txt, md. doc/docx fazem upload mas processing
 * retorna `failed` (lib `mammoth` entra em sub-PR follow-up).
 *
 * **RBAC:** Owner/Admin apenas — Cérebro afeta TODOS os agentes do
 * workspace, manager+ NÃO pode mudar.
 *
 * **Custo:** cada upload consome embeddings OpenAI (~\$0.02/1M tokens).
 * 50KB texto = ~\$0.0003. Trivial. `recordUsage(eventKind='embedding_call',
 * feature='kb_indexing')` em todo upload.
 *
 * **Re-indexação dos 5 campos estruturados:** `reindexStructuredField`
 * (helper exportado) é chamado pelo `updateKnowledgeBaseAction` (em
 * `actions.ts`) após upsert do campo. Delete chunks + re-chunk + re-embed.
 */

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import {
  KnowledgeDocKind,
  KnowledgeDocStatus,
  KnowledgeSourceKind,
  type Prisma,
  UsageEventKind,
} from '@papopro/db';

import { embedTexts, upsertChunkEmbedding } from '@/lib/ai/embeddings';
import { recordUsage } from '@/lib/ai/usage';
import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { chunkText } from '@/lib/knowledge/chunking';
import { extractText } from '@/lib/knowledge/extract';
import { reportNonFatal } from '@/lib/observability/report';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';

const BUCKET = 'knowledge-base';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — alinha com schema M11#1 + bucket policy

// MIME → enum `KnowledgeDocKind`. Lista fechada — uploads de outros MIME
// retornam erro propositivo (Server Action), além do bucket já rejeitar
// via `allowed_mime_types`.
const MIME_TO_KIND: Record<string, KnowledgeDocKind> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

// Extensão fallback quando MIME vem genérico (ex: `application/octet-stream`).
const EXT_TO_KIND: Record<string, KnowledgeDocKind> = {
  pdf: 'pdf',
  txt: 'txt',
  md: 'md',
  markdown: 'md',
  doc: 'doc',
  docx: 'docx',
};

const uploadInputSchema = z.object({
  /** Nome original do arquivo — sanitizado antes de virar storage path. */
  fileName: z.string().min(1).max(255),
  /** MIME type — vem do browser. */
  mimeType: z.string().min(1).max(127),
  /** Bytes — validamos size via `sizeBytes`. */
  sizeBytes: z.number().int().positive().max(MAX_BYTES, 'Arquivo muito grande (máx 10 MB)'),
});

export interface UploadKnowledgeResult {
  ok: true;
  documentId: string;
  /** `processed` (sucesso) ou `failed` (erro de extração — admin reupload). */
  status: 'processed' | 'failed';
  /** Quando `failed`, mensagem propositiva pra UI. */
  errorDetail?: string;
}

export type UploadKnowledgeResultOrError = UploadKnowledgeResult | { ok: false; error: string };

export type VoidResult = { ok: true } | { ok: false; error: string };

/**
 * Resolve `KnowledgeDocKind` a partir de MIME (preferido) ou extensão
 * (fallback). Retorna `null` quando não conseguimos discriminar.
 */
function resolveKind(mimeType: string, fileName: string): KnowledgeDocKind | null {
  const fromMime = MIME_TO_KIND[mimeType.toLowerCase()];
  if (fromMime) return fromMime;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_KIND[ext] ?? null;
}

/**
 * Sanitiza nome de arquivo pra path do Storage. Remove caracteres unsafe
 * pra Postgres + URL + filesystem. Preserva extensão.
 */
function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(0, 200);
  // Remove caracteres unsafe pra Postgres/URL/filesystem: separadores,
  // wildcards e control chars (códigos 0–31). Iteramos char-by-char em vez
  // de regex pra evitar warning `no-control-regex` do ESLint.
  let out = '';
  for (const ch of trimmed) {
    const code = ch.charCodeAt(0);
    if (code < 32 || '\\/<>:"|?*'.includes(ch)) {
      out += '_';
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Server Action principal. Recebe FormData com `file` + metadados extras.
 * Faz tudo (upload → processing → persistência) numa request.
 */
export async function uploadKnowledgeDocumentAction(
  formData: FormData,
): Promise<UploadKnowledgeResultOrError> {
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { ok: false, error: 'Nenhum arquivo recebido.' };
  }

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem subir documentos pro Cérebro.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  const parsed = uploadInputSchema.safeParse({
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Arquivo inválido.',
    };
  }

  const kind = resolveKind(parsed.data.mimeType, parsed.data.fileName);
  if (!kind) {
    return {
      ok: false,
      error: 'Tipo de arquivo não suportado. Aceita PDF, TXT, MD.',
    };
  }

  const sanitized = sanitizeFileName(parsed.data.fileName);
  const documentId = randomUUID();
  const storagePath = `${workspaceId}/${documentId}/${sanitized}`;

  // 1. Upload pro Storage. Antes de criar a row, pra que se o upload falhar
  // não temos lixo no DB.
  const admin = createSupabaseAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadResult = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: parsed.data.mimeType,
    upsert: false,
  });

  if (uploadResult.error) {
    reportNonFatal('knowledge.upload.storage', uploadResult.error, {
      workspaceId,
      userId,
    });
    return {
      ok: false,
      error: 'Não foi possível subir o arquivo. Tente novamente.',
    };
  }

  // 2. Cria row inicial em `knowledge_documents` (status='uploading' → 'processing').
  const ctx = getRequestAuditContext();
  try {
    await withWorkspace(workspaceId, async (tx) => {
      await tx.knowledgeDocument.create({
        data: {
          id: documentId,
          workspaceId,
          name: parsed.data.fileName,
          kind,
          sizeBytes: parsed.data.sizeBytes,
          status: KnowledgeDocStatus.processing,
          storageBucket: BUCKET,
          storagePath,
          uploadedById: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'knowledge_doc_uploaded',
          entityType: 'knowledge_document',
          entityId: documentId,
          changes: { name: parsed.data.fileName, kind, sizeBytes: parsed.data.sizeBytes },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });
    });
  } catch (err) {
    // Falha em criar row → remove arquivo do Storage pra evitar órfão.
    await admin.storage
      .from(BUCKET)
      .remove([storagePath])
      .catch(() => {
        // best-effort
      });
    reportNonFatal('knowledge.upload.createRow', err, { workspaceId, userId });
    return {
      ok: false,
      error: 'Não foi possível registrar o documento. Tente novamente.',
    };
  }

  // 3. Processing: extract → chunk → embed → persist.
  // Erros aqui marcam `failed` com `error_detail` mas NÃO removem o arquivo
  // do Storage — admin pode debugar e re-tentar manualmente. UI mostra
  // botão "Reprocessar" em V2 (M11.x).
  try {
    const extracted = await extractText({ buffer, kind });
    if (!extracted.text.trim()) {
      throw new Error('Arquivo sem texto extraível (PDF scanneado? Sem camada de texto).');
    }

    const chunks = chunkText(extracted.text);
    if (chunks.length === 0) {
      throw new Error('Texto extraído vazio após chunking.');
    }

    // Embedding em batch — `embedTexts` já cuida do batch (96 por chamada).
    const embedded = await embedTexts({
      workspaceId,
      texts: chunks.map((c) => c.content),
    });

    if (embedded.embeddings.length !== chunks.length) {
      throw new Error(
        `Embeddings retornaram tamanho diferente do esperado (${embedded.embeddings.length} vs ${chunks.length}).`,
      );
    }

    // Persist chunks + embeddings. Chunks em tx; embeddings via $executeRaw
    // (vector é Unsupported no Prisma). Persist sequencial pra preservar
    // ordem de chunk_index.
    await withWorkspace(workspaceId, async (tx) => {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk) continue;
        const created = await tx.knowledgeChunk.create({
          data: {
            workspaceId,
            documentId,
            source: KnowledgeSourceKind.document,
            content: chunk.content,
            tokens: chunk.tokens,
            chunkIndex: chunk.chunkIndex,
          },
        });
        const vec = embedded.embeddings[i];
        if (vec) {
          await upsertChunkEmbedding({
            workspaceId,
            chunkId: created.id,
            vector: vec,
            model: embedded.model,
          });
        }
      }

      // Status → processed + audit + processedAt.
      await tx.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: KnowledgeDocStatus.processed,
          processedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'knowledge_doc_processed',
          entityType: 'knowledge_document',
          entityId: documentId,
          changes: {
            chunks: chunks.length,
            tokens: embedded.usage.input,
            pageCount: extracted.pageCount,
          },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });
    });

    // recordUsage com try/catch — falha aqui não pode reverter o documento.
    await recordUsage({
      workspaceId,
      eventKind: UsageEventKind.embedding_call,
      feature: 'kb_indexing',
      model: embedded.model,
      usage: embedded.usage,
      entityKind: 'knowledge_document',
      entityId: documentId,
    }).catch((err) =>
      reportNonFatal('knowledge.upload.recordUsage', err, {
        workspaceId,
        userId,
        documentId,
      }),
    );

    revalidatePath('/agents');
    return { ok: true, documentId, status: 'processed' };
  } catch (err) {
    const message = (err as Error).message ?? 'Erro desconhecido na extração.';
    reportNonFatal('knowledge.upload.processing', err, {
      workspaceId,
      userId,
      documentId,
    });
    await withWorkspace(workspaceId, async (tx) => {
      await tx.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: KnowledgeDocStatus.failed,
          errorDetail: message.slice(0, 500),
        },
      });
    }).catch(() => {
      // best-effort
    });
    revalidatePath('/agents');
    return {
      ok: true,
      documentId,
      status: 'failed',
      errorDetail: message,
    };
  }
}

/**
 * Deleta documento + arquivo no Storage. Cascade hard-deleta chunks +
 * embeddings via FK do schema M11#1.
 */
export async function deleteKnowledgeDocumentAction(documentId: string): Promise<VoidResult> {
  if (!isUuid(documentId)) {
    return { ok: false, error: 'ID de documento inválido.' };
  }

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem remover documentos do Cérebro.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { workspaceId, userId } = auth.ctx;

  try {
    const storagePath = await withWorkspace(workspaceId, async (tx) => {
      const doc = await tx.knowledgeDocument.findFirst({
        where: { id: documentId, workspaceId, deletedAt: null },
      });
      if (!doc) return null;

      // Soft delete em knowledge_documents (mantém audit trail).
      await tx.knowledgeDocument.update({
        where: { id: documentId },
        data: { deletedAt: new Date() },
      });

      // Hard delete dos chunks (cascade limpa embeddings via FK).
      await tx.knowledgeChunk.deleteMany({
        where: { documentId, workspaceId },
      });

      return doc.storagePath;
    });

    if (!storagePath) {
      return { ok: false, error: 'Documento não encontrado.' };
    }

    // Remove arquivo do Storage — best-effort, não bloqueia em erro.
    const admin = createSupabaseAdminClient();
    await admin.storage
      .from(BUCKET)
      .remove([storagePath])
      .catch((err) =>
        reportNonFatal('knowledge.delete.storage', err, {
          workspaceId,
          userId,
          documentId,
        }),
      );

    revalidatePath('/agents');
    return { ok: true };
  } catch (err) {
    reportNonFatal('knowledge.delete', err, { workspaceId, userId, documentId });
    return { ok: false, error: 'Não foi possível remover o documento.' };
  }
}

/**
 * Re-chunkeia + re-embeda 1 dos 5 campos estruturados do Cérebro. Chamado
 * pelo `updateKnowledgeBaseAction` após upsert do campo. Exportado pra
 * compor; caller já é Server Action com workspace validado.
 *
 * **Idempotente:** delete + insert atômico via Prisma TX. Re-uploads ou
 * edições sucessivas substituem o conteúdo anterior sem deixar órfão.
 *
 * **Skip se conteúdo vazio:** apenas delete (não cria chunks novos).
 */
export async function reindexStructuredField(input: {
  workspaceId: string;
  field: 'about' | 'products' | 'faq' | 'scripts' | 'policy';
  content: string;
}): Promise<{ chunkCount: number }> {
  const { workspaceId, field, content } = input;

  // 1. Delete chunks antigos do campo (cascade limpa embeddings via FK).
  await withWorkspace(workspaceId, async (tx) => {
    await tx.knowledgeChunk.deleteMany({
      where: {
        workspaceId,
        source: KnowledgeSourceKind.structured_field,
        structuredField: field,
      },
    });
  });

  // 2. Se vazio, fica só com o delete (campo zerado = sem chunks).
  if (!content.trim()) {
    return { chunkCount: 0 };
  }

  // 3. Chunk + embed.
  const chunks = chunkText(content);
  if (chunks.length === 0) return { chunkCount: 0 };

  const embedded = await embedTexts({
    workspaceId,
    texts: chunks.map((c) => c.content),
  });

  // 4. Persist chunks + embeddings.
  await withWorkspace(workspaceId, async (tx) => {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;
      const created = await tx.knowledgeChunk.create({
        data: {
          workspaceId,
          source: KnowledgeSourceKind.structured_field,
          structuredField: field,
          content: chunk.content,
          tokens: chunk.tokens,
          chunkIndex: chunk.chunkIndex,
        },
      });
      const vec = embedded.embeddings[i];
      if (vec) {
        await upsertChunkEmbedding({
          workspaceId,
          chunkId: created.id,
          vector: vec,
          model: embedded.model,
        });
      }
    }
  });

  // 5. recordUsage (non-fatal).
  await recordUsage({
    workspaceId,
    eventKind: UsageEventKind.embedding_call,
    feature: 'kb_indexing',
    model: embedded.model,
    usage: embedded.usage,
    entityKind: 'structured_field',
    entityId: undefined, // campo estruturado não tem UUID dedicado
  }).catch((err) =>
    reportNonFatal('knowledge.reindexStructured.recordUsage', err, {
      workspaceId,
      field,
    }),
  );

  return { chunkCount: chunks.length };
}

// Re-export pra TS-only consumption.
export type { Prisma };
