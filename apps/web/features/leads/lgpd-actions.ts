'use server';

/**
 * Server Actions de LGPD do feature `leads` (M13#3).
 *
 * Cobre os dois direitos do titular que a LGPD (Art. 18) garante e que o
 * PapoPro precisa expor antes do trial público (CLAUDE.md §7.5):
 *
 *  - `exportLeadDataAction` — **portabilidade**: dump completo e estruturado
 *    de TUDO que o workspace guarda sobre um lead (ficha + negócios + tarefas
 *    + timeline + conversas/mensagens + anexos + cadências + resumo de IA +
 *    trilha de auditoria). Retorna JSON; o Route Handler
 *    `/api/exports/leads/[id]/lgpd` envolve em `Content-Disposition`.
 *
 *  - `eraseLeadDataAction` — **eliminação**: apagamento real (hard delete) do
 *    lead e de todo o dado pessoal vinculado. Diferente de `archiveLeadAction`
 *    (soft-archive reversível): aqui a linha some e o cascade leva negócios,
 *    tarefas, atividades, conversas+mensagens, anexos, cadências, resumo de
 *    IA, sessões de agente. O `audit_logs` **sobrevive** (sem FK pro lead;
 *    `entityId` é texto) — é o tombstone de compliance. O registro
 *    `data_deleted` NÃO grava PII (nome/email/telefone) — só contagens.
 *
 * **RBAC.** Export: Owner/Admin (vetor de vazamento — Manager/Vendedor não
 * baixam dump completo). Erasure: **Owner only** — operação irreversível.
 *
 * **Padrão** espelha `features/leads/actions.ts`: Zod → `requireRole` →
 * `getRequestAuditContext` → `withWorkspace` (RLS + defense-in-depth) →
 * audit na mesma tx.
 */

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { reportNonFatal } from '@/lib/observability/report';
import { deleteFromStorage } from '@/lib/storage/attachments';
import { withWorkspace } from '@/lib/supabase/with-workspace';

// =============================================================================
// Schemas
// =============================================================================

const exportLeadDataSchema = z.object({
  leadId: z.string().uuid('Lead inválido.'),
});

const eraseLeadDataSchema = z.object({
  leadId: z.string().uuid('Lead inválido.'),
  /** Nome exato do lead, digitado pelo Owner pra confirmar a operação. */
  confirmName: z.string().min(1, 'Confirme digitando o nome do lead.'),
});

export type ExportLeadDataInput = z.infer<typeof exportLeadDataSchema>;
export type EraseLeadDataInput = z.infer<typeof eraseLeadDataSchema>;

// =============================================================================
// exportLeadDataAction
// =============================================================================

/**
 * Payload de exportação LGPD de um lead. Shape estável — é o que o titular
 * (ou a autoridade) recebe. JSON em vez de CSV porque o dado é aninhado
 * (conversas têm mensagens, cadências têm steps) e CSV achataria mal.
 */
export interface LeadExportPayload {
  scope: 'lgpd_lead_export';
  exportedAt: string;
  workspace: { id: string; name: string };
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    company: string | null;
    position: string | null;
    origin: string;
    status: string;
    temperature: string;
    stage: string;
    assignedTo: string | null;
    valueCents: number;
    notes: string | null;
    tags: string[];
    customFields: Array<{ label: string; value: unknown }>;
    aiSummary: string | null;
    createdAt: string;
    updatedAt: string;
    lastInteractionAt: string | null;
    nextActionAt: string | null;
  };
  deals: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
  conversations: Array<Record<string, unknown>>;
  attachments: Array<Record<string, unknown>>;
  cadenceEnrollments: Array<Record<string, unknown>>;
  coldLeadAlerts: Array<Record<string, unknown>>;
  auditTrail: Array<Record<string, unknown>>;
}

export type ExportLeadDataResult =
  | { ok: true; payload: LeadExportPayload; fileName: string }
  | { ok: false; error: string };

export async function exportLeadDataAction(
  input: ExportLeadDataInput,
): Promise<ExportLeadDataResult> {
  const parsed = exportLeadDataSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem exportar os dados de um lead (LGPD).',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();
  const { leadId } = parsed.data;

  try {
    const payload = await withWorkspace<LeadExportPayload>(workspaceId, async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id: leadId, workspaceId },
        include: {
          stage: { select: { name: true } },
          assignedTo: { include: { user: { select: { name: true, email: true } } } },
          tags: { include: { tag: { select: { name: true } } } },
          customValues: { include: { customField: { select: { label: true } } } },
          summary: { select: { summary: true } },
          workspace: { select: { id: true, name: true } },
        },
      });
      if (!lead) throw new Error('LEAD_NOT_FOUND');

      // Relações 1:N — uma query por relação. Volume por lead é baixo, não
      // vale a complexidade de um `include` gigante aninhado.
      const [deals, tasks, activities, conversations, attachments, enrollments, coldAlerts, audit] =
        await Promise.all([
          tx.deal.findMany({ where: { leadId, workspaceId }, orderBy: { createdAt: 'asc' } }),
          tx.task.findMany({ where: { leadId, workspaceId }, orderBy: { createdAt: 'asc' } }),
          tx.activity.findMany({ where: { leadId, workspaceId }, orderBy: { createdAt: 'asc' } }),
          tx.conversation.findMany({
            where: { leadId, workspaceId },
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
                select: {
                  direction: true,
                  kind: true,
                  body: true,
                  createdAt: true,
                  deliveredAt: true,
                  readAt: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          }),
          tx.attachment.findMany({ where: { leadId, workspaceId }, orderBy: { createdAt: 'asc' } }),
          tx.cadenceEnrollment.findMany({
            where: { leadId, workspaceId },
            include: {
              cadence: { select: { name: true } },
              stepRuns: { orderBy: { createdAt: 'asc' } },
            },
            orderBy: { createdAt: 'asc' },
          }),
          tx.coldLeadAlert.findMany({ where: { leadId, workspaceId } }),
          // entityId é VarChar — auditoria que cita esse lead. Sobrevive ao
          // erase justamente por não ter FK.
          tx.auditLog.findMany({
            where: { workspaceId, entityType: 'lead', entityId: leadId },
            orderBy: { createdAt: 'asc' },
          }),
        ]);

      // **LGPD §3.4:** registra a exportação na MESMA tx do SELECT. Sem
      // registro de quem exportou dado pessoal de um titular, não sai dump.
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'export_started',
          entityType: 'lead',
          entityId: leadId,
          changes: {
            scope: 'lgpd_lead_export',
            counts: {
              deals: deals.length,
              tasks: tasks.length,
              activities: activities.length,
              conversations: conversations.length,
              attachments: attachments.length,
              cadenceEnrollments: enrollments.length,
            },
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return {
        scope: 'lgpd_lead_export',
        exportedAt: new Date().toISOString(),
        workspace: { id: lead.workspace.id, name: lead.workspace.name },
        lead: {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          position: lead.position,
          origin: lead.origin,
          status: lead.status,
          temperature: lead.temperature,
          stage: lead.stage.name,
          assignedTo: lead.assignedTo.user.name ?? lead.assignedTo.user.email,
          valueCents: lead.valueCents,
          notes: lead.notes,
          tags: lead.tags.map((t) => t.tag.name),
          customFields: lead.customValues.map((cv) => ({
            label: cv.customField.label,
            value: cv.value,
          })),
          aiSummary: lead.summary?.summary ?? null,
          createdAt: lead.createdAt.toISOString(),
          updatedAt: lead.updatedAt.toISOString(),
          lastInteractionAt: lead.lastInteractionAt?.toISOString() ?? null,
          nextActionAt: lead.nextActionAt?.toISOString() ?? null,
        },
        deals: deals as unknown as Array<Record<string, unknown>>,
        tasks: tasks as unknown as Array<Record<string, unknown>>,
        activities: activities as unknown as Array<Record<string, unknown>>,
        conversations: conversations as unknown as Array<Record<string, unknown>>,
        // Só metadata — o binário do anexo é entregue à parte se solicitado.
        attachments: attachments.map((a) => ({
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          createdAt: a.createdAt.toISOString(),
          deletedAt: a.deletedAt?.toISOString() ?? null,
        })),
        cadenceEnrollments: enrollments as unknown as Array<Record<string, unknown>>,
        coldLeadAlerts: coldAlerts as unknown as Array<Record<string, unknown>>,
        auditTrail: audit.map((a) => ({
          action: a.action,
          createdAt: a.createdAt.toISOString(),
          ipAddress: a.ipAddress,
          userAgent: a.userAgent,
          changes: a.changes,
        })),
      } satisfies LeadExportPayload;
    });

    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return {
      ok: true,
      payload,
      fileName: `lgpd-lead-${leadId.slice(0, 8)}-${ts}.json`,
    };
  } catch (err) {
    if (err instanceof Error && err.message === 'LEAD_NOT_FOUND') {
      return { ok: false, error: 'Lead não encontrado.' };
    }
    reportNonFatal('leads.lgpd-export.tx', err, { workspaceId, userId, leadId });
    return { ok: false, error: 'Não foi possível exportar os dados agora. Tente em instantes.' };
  }
}

// =============================================================================
// eraseLeadDataAction
// =============================================================================

export type EraseLeadDataResult =
  | { ok: true; storageWarning: boolean }
  | { ok: false; error: string };

/**
 * Apaga em definitivo o lead e todo o dado pessoal vinculado (LGPD Art. 18).
 *
 * **Ordem (storage-first).** Os anexos vivem em dois lugares: a row em
 * `attachments` (apagada pelo cascade do `lead.delete`) e o objeto no
 * Supabase Storage (NÃO transacional). Apagamos o Storage ANTES do delete no
 * banco — se o Storage falhar, abortamos e nada some no banco, então a
 * operação é re-executável. O contrário deixaria arquivo pessoal órfão sem
 * row pra o cron `cleanup-attachments` capturar.
 *
 * **`data_deleted` sem PII.** O audit é o tombstone — não pode re-vazar o
 * que acabamos de apagar. Grava só `leadId` + contagens.
 */
export async function eraseLeadDataAction(input: EraseLeadDataInput): Promise<EraseLeadDataResult> {
  const parsed = eraseLeadDataSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  // Owner only — operação irreversível.
  const auth = await requireRole(['Owner'], {
    forbiddenMessage: 'Apenas o Owner pode excluir definitivamente os dados de um lead (LGPD).',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();
  const { leadId, confirmName } = parsed.data;

  try {
    // 1. Leitura: confere existência + nome + coleta paths de Storage.
    const prep = await withWorkspace<{ name: string; storagePaths: string[] }>(
      workspaceId,
      async (tx) => {
        const lead = await tx.lead.findFirst({
          where: { id: leadId, workspaceId },
          select: { name: true },
        });
        if (!lead) throw new Error('LEAD_NOT_FOUND');

        const attachments = await tx.attachment.findMany({
          where: { leadId, workspaceId },
          select: { path: true },
        });
        return { name: lead.name, storagePaths: attachments.map((a) => a.path) };
      },
    );

    if (confirmName.trim() !== prep.name) {
      return {
        ok: false,
        error: 'O nome digitado não confere com o do lead. Exclusão cancelada.',
      };
    }

    // 2. Storage-first: apaga os arquivos antes de tocar o banco.
    let storageWarning = false;
    if (prep.storagePaths.length > 0) {
      const removed = await deleteFromStorage(prep.storagePaths);
      if (!removed.ok) {
        reportNonFatal('leads.lgpd-erase.storage', new Error(removed.message ?? 'unknown'), {
          workspaceId,
          leadId,
          count: prep.storagePaths.length,
        });
        return {
          ok: false,
          error: 'Não foi possível remover os arquivos anexados. Nada foi apagado — tente de novo.',
        };
      }
      storageWarning = removed.removed < prep.storagePaths.length;
    }

    // 3. Audit + hard delete na mesma tx. O `lead.delete` cascateia deals,
    // tarefas, atividades, conversas+mensagens, anexos, cadências, resumo,
    // sessões de agente (todos `onDelete: Cascade` no schema).
    await withWorkspace(workspaceId, async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id: leadId, workspaceId },
        select: { id: true },
      });
      if (!lead) throw new Error('LEAD_NOT_FOUND');

      const [deals, tasks, activities, conversations, messages, attachments, enrollments] =
        await Promise.all([
          tx.deal.count({ where: { leadId, workspaceId } }),
          tx.task.count({ where: { leadId, workspaceId } }),
          tx.activity.count({ where: { leadId, workspaceId } }),
          tx.conversation.count({ where: { leadId, workspaceId } }),
          tx.message.count({ where: { workspaceId, conversation: { leadId } } }),
          tx.attachment.count({ where: { leadId, workspaceId } }),
          tx.cadenceEnrollment.count({ where: { leadId, workspaceId } }),
        ]);

      // Audit ANTES do delete — entityId sobrevive (VarChar, sem FK). Sem PII.
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'data_deleted',
          entityType: 'lead',
          entityId: leadId,
          changes: {
            scope: 'lgpd_erasure',
            counts: { deals, tasks, activities, conversations, messages, attachments, enrollments },
            storagePathsRemoved: prep.storagePaths.length,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      await tx.lead.delete({ where: { id: leadId } });
    });

    revalidatePath('/leads');
    revalidatePath('/kanban');
    return { ok: true, storageWarning };
  } catch (err) {
    if (err instanceof Error && err.message === 'LEAD_NOT_FOUND') {
      return { ok: false, error: 'Lead não encontrado.' };
    }
    reportNonFatal('leads.lgpd-erase.tx', err, { workspaceId, userId, leadId });
    return { ok: false, error: 'Não foi possível excluir os dados agora. Tente em instantes.' };
  }
}
