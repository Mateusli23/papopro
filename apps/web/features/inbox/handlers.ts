/**
 * Handlers do webhook inbound WhatsApp (M9#3).
 *
 * Funções server-only chamadas pelo route `POST /api/webhooks/whatsapp` dentro
 * de uma `withWorkspace` tx. Cada handler processa um tipo de evento da uazapi:
 *
 *  - `handleMessageReceived` — mensagem do lead chegou. Cria lead novo se phone
 *    desconhecido (round-robin via `pickNextAssignee`), upsert da Conversation,
 *    insert Message + Activity, atualiza lead.lastInteractionAt, detecta opt-out.
 *  - `handleMessageStatus` — ACK de entrega (delivered/read/failed) do outbound.
 *    Busca Message por external_message_id, atualiza timestamps.
 *  - `handleInstanceStatus` — connected/disconnected/qr_refreshed da sessão.
 *    Sincroniza WhatsappInstance + audit.
 *
 * **Server-only.** Nunca importar em `'use client'`.
 */
import 'server-only';

import { type Prisma } from '@papopro/db';

import { findDuplicates } from '@/lib/leads/dedupe';
import { pickNextAssignee } from '@/lib/leads/pick-assignee';
import type {
  InstanceStatusPayload,
  MessageReceivedPayload,
  MessageStatusPayload,
} from '@/lib/whatsapp/webhook-schemas';

const OPT_OUT_REGEX = /^(pare|sair|cancelar)$/i;
const PREVIEW_LIMIT = 280;

function isOptOut(body: string | null | undefined): boolean {
  if (!body) return false;
  return OPT_OUT_REGEX.test(body.trim());
}

function buildPreview(body: string | null | undefined, type: string): string {
  if (body && body.trim()) {
    return body.trim().slice(0, PREVIEW_LIMIT);
  }
  // Mídia sem caption: preview placeholder
  switch (type) {
    case 'image':
      return '[Imagem]';
    case 'audio':
      return '[Áudio]';
    case 'document':
      return '[Documento]';
    default:
      return '';
  }
}

// ============================================================================
// handleMessageReceived
// ============================================================================

export interface MessageReceivedContext {
  workspaceId: string;
  instanceId: string;
  whatsappAccountId: string;
}

export async function handleMessageReceived(
  tx: Prisma.TransactionClient,
  ctx: MessageReceivedContext,
  payload: MessageReceivedPayload,
): Promise<{ skipped: boolean; messageId?: string; leadId?: string; optOut?: boolean }> {
  const { workspaceId, whatsappAccountId } = ctx;
  const { message } = payload;

  // 1. Idempotência por external_message_id (partial unique do M9#1).
  const existing = await tx.message.findFirst({
    where: { workspaceId, externalMessageId: message.id },
    select: { id: true },
  });
  if (existing) {
    return { skipped: true };
  }

  // 2. Dedupe por phone — usa findDuplicates do M8#5.
  const dups = await findDuplicates(tx, workspaceId, [{ phone: message.from, email: null }]);
  let lead = dups.get(message.from.trim());

  // 3. Lead desconhecido → cria com round-robin.
  if (!lead) {
    const pipeline = await tx.pipeline.findFirst({
      where: { workspaceId, isDefault: true, deletedAt: null },
      select: {
        id: true,
        stages: {
          orderBy: { order: 'asc' },
          take: 1,
          select: { id: true },
        },
      },
    });
    const firstStageId = pipeline?.stages[0]?.id;
    if (!firstStageId) {
      throw new Error('PIPELINE_NOT_FOUND');
    }

    const assigneeId = await pickNextAssignee(tx, workspaceId);
    if (!assigneeId) {
      throw new Error('NO_ASSIGNEE');
    }

    const created = await tx.lead.create({
      data: {
        workspaceId,
        name: message.from, // phone como nome inicial; vendedor edita depois
        phone: message.from.trim(),
        origin: 'whatsapp_inbound',
        status: 'ativo',
        stageId: firstStageId,
        assignedToId: assigneeId,
        valueCents: 0,
        lastInteractionAt: new Date(),
      },
      select: { id: true, name: true, assignedToId: true },
    });

    await tx.activity.create({
      data: {
        workspaceId,
        leadId: created.id,
        type: 'lead_created',
        authorId: assigneeId,
        meta: {
          via: 'whatsapp_inbound',
          source: 'webhook',
        } as Prisma.InputJsonValue,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        action: 'lead_created',
        entityType: 'lead',
        entityId: created.id,
        changes: {
          via: 'whatsapp_inbound',
        } as Prisma.InputJsonValue,
      },
    });

    lead = { id: created.id, name: created.name };
  }

  // 4. Upsert Conversation por (workspaceId, contactPhone).
  const previewText = buildPreview(message.text?.body, message.type);
  const conversation = await tx.conversation.upsert({
    where: {
      workspaceId_contactPhone: { workspaceId, contactPhone: message.from.trim() },
    },
    create: {
      workspaceId,
      leadId: lead.id,
      whatsappAccountId,
      contactPhone: message.from.trim(),
      status: 'responded',
      lastMessageAt: new Date(),
      lastMessagePreview: previewText,
      lastMessageDirection: 'in',
      unreadCount: 1,
    },
    update: {
      status: 'responded',
      lastMessageAt: new Date(),
      lastMessagePreview: previewText,
      lastMessageDirection: 'in',
      unreadCount: { increment: 1 },
      // Desarquivar se reativaram a conversa
      archivedAt: null,
    },
    select: { id: true },
  });

  // 5. Insert Message direction=in.
  // MVP: media types caem em kind='text' com body vazio (vendedor vê preview
  // "[Imagem]" no thread). Bucket whatsapp-media + persistência real fica pra
  // M9.x / M10. Body=null em mídia evita confundir consumer.
  const createdMessage = await tx.message.create({
    data: {
      workspaceId,
      conversationId: conversation.id,
      kind: message.type === 'text' ? 'text' : (message.type as 'image' | 'audio' | 'document'),
      direction: 'in',
      body: message.text?.body ?? null,
      authorId: null, // inbound não tem authorId — é o lead
      externalMessageId: message.id,
    },
    select: { id: true },
  });

  // 6. Atualiza lead.lastInteractionAt — segue padrão M8#4 (createNoteActivity).
  await tx.lead.update({
    where: { id: lead.id },
    data: { lastInteractionAt: new Date() },
  });

  // 7. Activity timeline `whatsapp_in`.
  await tx.activity.create({
    data: {
      workspaceId,
      leadId: lead.id,
      type: 'whatsapp_in',
      body: message.text?.body ?? null,
      authorId: null,
      meta: {
        messageId: createdMessage.id,
        conversationId: conversation.id,
        externalMessageId: message.id,
        mediaType: message.type !== 'text' ? message.type : undefined,
      } as Prisma.InputJsonValue,
    },
  });

  // 8. Opt-out detection (CLAUDE.md §7.5 LGPD).
  let optOut = false;
  if (isOptOut(message.text?.body)) {
    optOut = true;

    // Upsert BlackList (workspaceId+phone unique).
    await tx.blackList.upsert({
      where: {
        workspaceId_phone: { workspaceId, phone: message.from.trim() },
      },
      create: {
        workspaceId,
        phone: message.from.trim(),
        reason: 'opt_out',
      },
      update: {
        reason: 'opt_out',
      },
    });

    // Activity de aviso pra timeline do lead.
    await tx.activity.create({
      data: {
        workspaceId,
        leadId: lead.id,
        type: 'note',
        body: `Opt-out detectado: "${(message.text?.body ?? '').trim()}"`,
        authorId: null,
        meta: {
          optOut: true,
          originalMessage: message.text?.body ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        action: 'whatsapp_blocked_optout',
        entityType: 'lead',
        entityId: lead.id,
        changes: {
          phone: message.from.trim(),
          originalMessage: message.text?.body ?? null,
          source: 'webhook_inbound',
        } as Prisma.InputJsonValue,
      },
    });
  }

  return {
    skipped: false,
    messageId: createdMessage.id,
    leadId: lead.id,
    optOut,
  };
}

// ============================================================================
// handleMessageStatus
// ============================================================================

export async function handleMessageStatus(
  tx: Prisma.TransactionClient,
  ctx: { workspaceId: string; instanceId: string },
  payload: MessageStatusPayload,
): Promise<{ updated: boolean }> {
  const { workspaceId, instanceId } = ctx;
  const { message_id, status } = payload;

  const message = await tx.message.findFirst({
    where: { workspaceId, externalMessageId: message_id },
    select: { id: true, deliveredAt: true, readAt: true },
  });

  if (!message) {
    // ACK pra mensagem não rastreada — registra event mas não falha
    await tx.whatsappEvent.create({
      data: {
        workspaceId,
        instanceId,
        type: 'message_status_unknown',
        payload: { message_id, status } as Prisma.InputJsonValue,
      },
    });
    return { updated: false };
  }

  const now = new Date();

  if (status === 'delivered') {
    await tx.message.update({
      where: { id: message.id },
      data: { deliveredAt: message.deliveredAt ?? now },
    });
    return { updated: true };
  }

  if (status === 'read') {
    await tx.message.update({
      where: { id: message.id },
      data: {
        deliveredAt: message.deliveredAt ?? now,
        readAt: message.readAt ?? now,
      },
    });
    return { updated: true };
  }

  if (status === 'failed') {
    await tx.whatsappEvent.create({
      data: {
        workspaceId,
        instanceId,
        type: 'message_failed',
        payload: { message_id, messageRowId: message.id } as Prisma.InputJsonValue,
      },
    });
    return { updated: true };
  }

  // status === 'sent' → no-op (createdAt ≈ sent)
  return { updated: false };
}

// ============================================================================
// handleInstanceStatus
// ============================================================================

export async function handleInstanceStatus(
  tx: Prisma.TransactionClient,
  ctx: { workspaceId: string; instanceId: string; accountId: string },
  payload: InstanceStatusPayload,
): Promise<{ updated: boolean; transition?: 'connected' | 'disconnected' | 'qr_refreshed' }> {
  const { workspaceId, instanceId, accountId } = ctx;

  if (payload.status === 'qr_refreshed') {
    await tx.whatsappEvent.create({
      data: {
        workspaceId,
        instanceId,
        type: 'qr_refreshed',
        payload: { source: 'webhook' } as Prisma.InputJsonValue,
      },
    });
    return { updated: true, transition: 'qr_refreshed' };
  }

  if (payload.status === 'connected') {
    const now = new Date();
    await tx.whatsappInstance.update({
      where: { id: instanceId },
      data: {
        status: 'connected',
        connectedAt: now,
        lastSeenAt: now,
        qrCode: null,
        qrExpiresAt: null,
      },
    });

    if (payload.phone_number) {
      await tx.whatsappAccount.update({
        where: { id: accountId },
        data: { phoneNumber: payload.phone_number },
      });
    }

    await tx.whatsappEvent.create({
      data: {
        workspaceId,
        instanceId,
        type: 'connected',
        payload: {
          source: 'webhook',
          phoneNumber: payload.phone_number ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        action: 'whatsapp_connected',
        entityType: 'whatsapp_instance',
        entityId: instanceId,
        changes: {
          phoneNumber: payload.phone_number ?? null,
          source: 'webhook',
        } as Prisma.InputJsonValue,
      },
    });

    return { updated: true, transition: 'connected' };
  }

  // disconnected
  const now = new Date();
  await tx.whatsappInstance.update({
    where: { id: instanceId },
    data: {
      status: 'disconnected',
      disconnectedAt: now,
      qrCode: null,
      qrExpiresAt: null,
    },
  });

  await tx.whatsappEvent.create({
    data: {
      workspaceId,
      instanceId,
      type: 'disconnected',
      payload: { source: 'webhook' } as Prisma.InputJsonValue,
    },
  });

  await tx.auditLog.create({
    data: {
      workspaceId,
      action: 'whatsapp_disconnected',
      entityType: 'whatsapp_instance',
      entityId: instanceId,
      changes: { source: 'webhook' } as Prisma.InputJsonValue,
    },
  });

  return { updated: true, transition: 'disconnected' };
}
