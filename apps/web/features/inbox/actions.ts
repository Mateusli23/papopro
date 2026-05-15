'use server';

/**
 * Server Actions do composer da Inbox (M9#3).
 *
 * Duas operações:
 *  - `sendTextMessageAction` — envia mensagem real pelo adapter WhatsApp.
 *    Passa por anti-ban (blacklist + health + janela + pausa + rate limit)
 *    antes de tocar o adapter. Jitter síncrono 30-50s pra evitar padrão.
 *  - `sendInternalNoteAction` — grava nota interna no banco. NÃO toca o
 *    adapter (não vai pro lead). Visível só ao time na thread.
 *
 * **Padrão (M8/M9 anatomia):** Zod → requireRole → pre-flight tx readonly →
 * anti-ban → adapter FORA da tx → tx final (Message + Activity + audit +
 * recordSent) → revalidatePath.
 *
 * **Conversation upsert na action:** se vendedor manda primeira mensagem pra
 * lead sem conversa, action cria automaticamente via `workspaceId+contactPhone`
 * unique. Uazapi/Whatsmeow não exige template aprovado pra outbound first-message.
 *
 * **`maxDuration = 60`** porque jitter pode dormir até 50s + adapter ~5s.
 *
 * **Composer continua chamando o store mock em M9#3** — M9#4 troca o composer
 * pra chamar essas actions. Mas as actions já são funcionais e cobertas por
 * smoke.
 */

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { isUuid } from '@/lib/utils/uuid';
import {
  applyJitter,
  assertCanSend,
  recordSent,
  type AntiBanReason,
  type InstanceSnapshot,
} from '@/lib/whatsapp/anti-ban';
import { getWhatsAppAdapter } from '@/lib/whatsapp/factory';

import { sendInternalNoteSchema, sendTextMessageSchema } from './schemas';

// Server Actions herdam `maxDuration` da rota que as chama (Vercel default 60s
// no plano Pro). Não exportamos `maxDuration` aqui — Next 14 só aceita async
// functions como named exports em arquivos `'use server'`.

const PREVIEW_LIMIT = 280;

function buildPreview(body: string): string {
  return body.trim().slice(0, PREVIEW_LIMIT);
}

// ============================================================================
// sendTextMessageAction
// ============================================================================

const sendTextActionSchema = sendTextMessageSchema.extend({
  leadId: z.string().uuid({ message: 'Lead inválido — recarregue a página.' }),
});

export type SendTextMessageInput = z.infer<typeof sendTextActionSchema>;

export type SendTextMessageResult =
  | { ok: true; messageId: string; conversationId: string }
  | { ok: false; error: string; reason?: AntiBanReason | 'adapter_failed' | 'not_connected' };

interface PreflightContext {
  leadId: string;
  leadPhone: string;
  workspaceTimezone: string;
  accountId: string;
  instanceId: string;
  instance: InstanceSnapshot;
  whatsappAccountId: string;
}

export async function sendTextMessageAction(
  input: SendTextMessageInput,
): Promise<SendTextMessageResult> {
  const parsed = sendTextActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const { leadId, body } = parsed.data;

  if (!isUuid(leadId)) {
    return { ok: false, error: 'Lead inválido — recarregue a página.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para enviar mensagens.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  // ─── Pre-flight (readonly): lead + workspace + account + instance ────────
  let preflight: PreflightContext;
  try {
    preflight = await withWorkspace(workspaceId, async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id: leadId, workspaceId, deletedAt: null },
        select: { id: true, phone: true },
      });
      if (!lead) throw new Error('LEAD_NOT_FOUND');

      const workspace = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { timezone: true },
      });

      const account = await tx.whatsappAccount.findUnique({
        where: { workspaceId },
        select: {
          id: true,
          instance: {
            select: {
              id: true,
              status: true,
              healthScore: true,
              pausedUntil: true,
              messagesSent24h: true,
              externalInstanceId: true,
            },
          },
        },
      });

      if (!account || !account.instance) {
        throw new Error('NOT_CONNECTED');
      }

      return {
        leadId: lead.id,
        leadPhone: lead.phone,
        workspaceTimezone: workspace?.timezone ?? 'America/Sao_Paulo',
        accountId: account.id,
        instanceId: account.instance.id,
        instance: {
          status: account.instance.status,
          healthScore: account.instance.healthScore,
          pausedUntil: account.instance.pausedUntil,
          messagesSent24h: account.instance.messagesSent24h,
          externalInstanceId: account.instance.externalInstanceId,
        },
        whatsappAccountId: account.id,
      };
    });
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'LEAD_NOT_FOUND') {
      return { ok: false, error: 'Lead não encontrado.' };
    }
    if (message === 'NOT_CONNECTED') {
      return {
        ok: false,
        reason: 'not_connected',
        error: 'Conecte o WhatsApp em Configurações → Conexões antes de enviar mensagens.',
      };
    }
    reportNonFatal('inbox.send.preflight', err, { workspaceId, userId, leadId });
    return { ok: false, error: 'Não foi possível validar o envio agora.' };
  }

  // ─── Anti-ban (consulta blacklist + checks) ──────────────────────────────
  let antiBanResult;
  try {
    antiBanResult = await withWorkspace(workspaceId, async (tx) =>
      assertCanSend(
        tx,
        workspaceId,
        preflight.workspaceTimezone,
        preflight.leadPhone,
        preflight.instance,
      ),
    );
  } catch (err) {
    reportNonFatal('inbox.send.antiban', err, { workspaceId, userId, leadId });
    return { ok: false, error: 'Falha ao validar regras de envio.' };
  }

  if (!antiBanResult.ok) {
    // Bloqueio por blacklist: registra audit `whatsapp_blocked_optout` na MESMA tx.
    if (antiBanResult.reason === 'blacklisted') {
      try {
        await withWorkspace(workspaceId, async (tx) => {
          await tx.auditLog.create({
            data: {
              workspaceId,
              userId,
              action: 'whatsapp_blocked_optout',
              entityType: 'lead',
              entityId: leadId,
              changes: {
                phone: preflight.leadPhone,
                source: 'outbound_blocked',
              } as Prisma.InputJsonValue,
              ipAddress,
              userAgent,
            },
          });
        });
      } catch (err) {
        reportNonFatal('inbox.send.audit_blocked', err, { workspaceId, userId, leadId });
      }
    }
    return { ok: false, reason: antiBanResult.reason, error: antiBanResult.message };
  }

  // ─── Jitter 30-50s ───────────────────────────────────────────────────────
  await applyJitter();

  // ─── Envio pelo adapter (FORA da tx) ─────────────────────────────────────
  const adapter = getWhatsAppAdapter();
  let sendResult;
  try {
    if (!preflight.instance.externalInstanceId) {
      throw new Error('NO_EXTERNAL_INSTANCE');
    }
    sendResult = await adapter.sendText({
      workspaceId,
      externalInstanceId: preflight.instance.externalInstanceId,
      to: preflight.leadPhone,
      body,
    });
  } catch (err) {
    reportNonFatal('inbox.send.adapter', err, {
      workspaceId,
      userId,
      leadId,
      externalInstanceId: preflight.instance.externalInstanceId,
    });
    return {
      ok: false,
      reason: 'adapter_failed',
      error: 'Falha ao enviar — tente novamente em alguns instantes.',
    };
  }

  // ─── Tx final: upsert Conversation + Message + Activity + audit + recordSent
  try {
    const persisted = await withWorkspace(workspaceId, async (tx) => {
      const preview = buildPreview(body);

      const conversation = await tx.conversation.upsert({
        where: {
          workspaceId_contactPhone: { workspaceId, contactPhone: preflight.leadPhone },
        },
        create: {
          workspaceId,
          leadId: preflight.leadId,
          vendorId: null,
          whatsappAccountId: preflight.whatsappAccountId,
          contactPhone: preflight.leadPhone,
          status: 'awaiting',
          lastMessageAt: sendResult.sentAt,
          lastMessagePreview: preview,
          lastMessageDirection: 'out',
          unreadCount: 0,
        },
        update: {
          status: 'awaiting',
          lastMessageAt: sendResult.sentAt,
          lastMessagePreview: preview,
          lastMessageDirection: 'out',
          archivedAt: null,
        },
        select: { id: true },
      });

      const member = await tx.workspaceMember.findFirst({
        where: { workspaceId, userId },
        select: { id: true },
      });

      const message = await tx.message.create({
        data: {
          workspaceId,
          conversationId: conversation.id,
          kind: 'text',
          direction: 'out',
          body,
          authorId: member?.id ?? null,
          externalMessageId: sendResult.externalMessageId,
        },
        select: { id: true },
      });

      await tx.lead.update({
        where: { id: preflight.leadId },
        data: { lastInteractionAt: sendResult.sentAt },
      });

      await tx.activity.create({
        data: {
          workspaceId,
          leadId: preflight.leadId,
          type: 'whatsapp_out',
          body,
          authorId: member?.id ?? null,
          meta: {
            messageId: message.id,
            conversationId: conversation.id,
            externalMessageId: sendResult.externalMessageId,
          } as Prisma.InputJsonValue,
        },
      });

      await recordSent(tx, preflight.instanceId, sendResult.sentAt);

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'whatsapp_message_sent',
          entityType: 'message',
          entityId: message.id,
          changes: {
            leadId: preflight.leadId,
            conversationId: conversation.id,
            externalMessageId: sendResult.externalMessageId,
            bodyLength: body.length,
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      return { conversationId: conversation.id, messageId: message.id };
    });

    revalidatePath('/inbox');
    revalidatePath(`/leads/${preflight.leadId}`);
    return { ok: true, ...persisted };
  } catch (err) {
    reportNonFatal('inbox.send.tx', err, { workspaceId, userId, leadId });
    return { ok: false, error: 'Mensagem enviada, mas falha ao registrar localmente.' };
  }
}

// ============================================================================
// sendInternalNoteAction
// ============================================================================

const sendInternalNoteActionSchema = sendInternalNoteSchema.extend({
  leadId: z.string().uuid({ message: 'Lead inválido — recarregue a página.' }),
});

export type SendInternalNoteInput = z.infer<typeof sendInternalNoteActionSchema>;

export type SendInternalNoteResult =
  | { ok: true; messageId: string; conversationId: string }
  | { ok: false; error: string };

export async function sendInternalNoteAction(
  input: SendInternalNoteInput,
): Promise<SendInternalNoteResult> {
  const parsed = sendInternalNoteActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const { leadId, body } = parsed.data;

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor'], {
    forbiddenMessage: 'Você não tem permissão para registrar notas.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;

  try {
    const result = await withWorkspace(workspaceId, async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id: leadId, workspaceId, deletedAt: null },
        select: { id: true, phone: true },
      });
      if (!lead) throw new Error('LEAD_NOT_FOUND');

      const account = await tx.whatsappAccount.findUnique({
        where: { workspaceId },
        select: { id: true },
      });
      if (!account) throw new Error('NOT_CONNECTED');

      const member = await tx.workspaceMember.findFirst({
        where: { workspaceId, userId },
        select: { id: true },
      });

      const conversation = await tx.conversation.upsert({
        where: {
          workspaceId_contactPhone: { workspaceId, contactPhone: lead.phone },
        },
        create: {
          workspaceId,
          leadId: lead.id,
          vendorId: member?.id ?? null,
          whatsappAccountId: account.id,
          contactPhone: lead.phone,
          status: 'awaiting',
        },
        update: {},
        select: { id: true },
      });

      const message = await tx.message.create({
        data: {
          workspaceId,
          conversationId: conversation.id,
          kind: 'internal_note',
          direction: 'out',
          body,
          authorId: member?.id ?? null,
          // sem externalMessageId — nota nunca vai pra uazapi
        },
        select: { id: true },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: { lastInteractionAt: new Date() },
      });

      await tx.activity.create({
        data: {
          workspaceId,
          leadId: lead.id,
          type: 'note',
          body,
          authorId: member?.id ?? null,
          meta: {
            internalNote: true,
            messageId: message.id,
            conversationId: conversation.id,
          } as Prisma.InputJsonValue,
        },
      });

      return { conversationId: conversation.id, messageId: message.id };
    });

    revalidatePath('/inbox');
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, ...result };
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'LEAD_NOT_FOUND') {
      return { ok: false, error: 'Lead não encontrado.' };
    }
    if (message === 'NOT_CONNECTED') {
      return {
        ok: false,
        error:
          'Conecte o WhatsApp em Configurações → Conexões antes de criar conversas neste lead.',
      };
    }
    reportNonFatal('inbox.note.tx', err, { workspaceId, userId, leadId });
    return { ok: false, error: 'Não foi possível salvar a nota agora.' };
  }
}
