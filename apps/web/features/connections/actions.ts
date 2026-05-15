'use server';

/**
 * Server Actions do feature Connections (M9#2 — uazapi connection lifecycle).
 *
 * Três operações cobrindo o ciclo de conexão WhatsApp:
 *  - `connectInstanceAction` — Owner/Admin gera QR Code (uazapi `/instance/connect`)
 *  - `getConnectionStatusAction` — qualquer membro sincroniza com provedor
 *  - `disconnectInstanceAction` — Owner/Admin encerra sessão
 *
 * **Estados:**
 *  - `disconnected`: estado inicial OU pós-disconnect explícito
 *  - `connecting`: QR gerado, aguardando scan do celular (TTL ~60s)
 *  - `connected`: webhook (M9#3) confirmou pareamento OU getInstanceStatus
 *    detectou transição via polling
 *
 * **Audit:**
 *  - `connectInstance` registra `WhatsappEvent type='qr_refreshed'` (não audit —
 *    só observability até a conexão se confirmar)
 *  - `getConnectionStatus` registra `whatsapp_connected` quando detecta
 *    transição `connecting → connected` (M9#3 também registra via webhook)
 *  - `disconnectInstance` registra `whatsapp_disconnected` (audit + event)
 *
 * **Padrão (espelha `features/leads/actions.ts`, M8#2):** Zod → requireRole →
 * defense-in-depth `where: { workspaceId }` → audit/event MESMA tx →
 * `revalidatePath`.
 */

import { revalidatePath } from 'next/cache';

import { type Prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { requireRole } from '@/lib/auth/require-role';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { getWhatsAppAdapter } from '@/lib/whatsapp/factory';

import { getWorkspaceConnection } from './queries';
import {
  connectInstanceSchema,
  disconnectInstanceSchema,
  getConnectionStatusSchema,
  type ConnectInstanceInput,
  type DisconnectInstanceInput,
  type GetConnectionStatusInput,
} from './schemas';
import type { ConnectionUI } from './types';

// =============================================================================
// connectInstanceAction — gera QR, salva no banco, retorna ConnectionUI
// =============================================================================

export type ConnectInstanceResult =
  | { ok: true; connection: ConnectionUI }
  | { ok: false; error: string };

export async function connectInstanceAction(
  input: ConnectInstanceInput = {},
): Promise<ConnectInstanceResult> {
  const parsed = connectInstanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem conectar o WhatsApp.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  // 1. Chama o provedor FORA da tx (latência externa não pode segurar lock).
  const adapter = getWhatsAppAdapter();
  let qr;
  try {
    qr = await adapter.connectInstance({ workspaceId });
  } catch (err) {
    reportNonFatal('connections.connect.adapter', err, { workspaceId, userId });
    return {
      ok: false,
      error:
        'Não foi possível conectar ao WhatsApp agora. Verifique a conexão com a uazapi e tente novamente.',
    };
  }

  // 2. Persiste estado: upsert account + upsert instance + WhatsappEvent.
  try {
    const connection = await withWorkspace(workspaceId, async (tx) => {
      const account = await tx.whatsappAccount.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          phoneNumber: '',
          provider: 'uazapi',
        },
        update: {},
        select: { id: true, phoneNumber: true, displayName: true },
      });

      const instance = await tx.whatsappInstance.upsert({
        where: { accountId: account.id },
        create: {
          workspaceId,
          accountId: account.id,
          externalInstanceId: qr.externalInstanceId,
          status: 'connecting',
          qrCode: qr.qrBase64,
          qrExpiresAt: qr.expiresAt,
        },
        update: {
          externalInstanceId: qr.externalInstanceId,
          status: 'connecting',
          qrCode: qr.qrBase64,
          qrExpiresAt: qr.expiresAt,
          disconnectedAt: null,
        },
        select: {
          id: true,
          externalInstanceId: true,
          status: true,
          healthScore: true,
          qrCode: true,
          qrExpiresAt: true,
          connectedAt: true,
          disconnectedAt: true,
          lastSeenAt: true,
          messagesSent24h: true,
          pausedUntil: true,
        },
      });

      // WhatsappEvent (observability — não vira audit ainda; só confirmação
      // de conexão dispara audit `whatsapp_connected`).
      await tx.whatsappEvent.create({
        data: {
          workspaceId,
          instanceId: instance.id,
          type: 'qr_refreshed',
          payload: {
            externalInstanceId: qr.externalInstanceId,
            expiresAt: qr.expiresAt.toISOString(),
            ipAddress,
            userAgent,
          } as Prisma.InputJsonValue,
        },
      });

      const { toConnectionUI } = await import('./transforms');
      return toConnectionUI(
        { id: account.id, phoneNumber: account.phoneNumber, displayName: account.displayName },
        instance,
      );
    });

    revalidatePath('/settings/connections');
    return { ok: true, connection };
  } catch (err) {
    reportNonFatal('connections.connect.tx', err, { workspaceId, userId });
    return {
      ok: false,
      error: 'Não foi possível registrar a sessão WhatsApp agora.',
    };
  }
}

// =============================================================================
// getConnectionStatusAction — sincroniza com provedor + detecta transição
// =============================================================================

export type GetConnectionStatusResult =
  | { ok: true; connection: ConnectionUI }
  | { ok: false; error: string };

/**
 * Lê estado persistido. Se houver `externalInstanceId` E status atual for
 * `connecting`, consulta o provedor e sincroniza. Quando detecta transição
 * `connecting → connected`, atualiza banco + insere `WhatsappEvent
 * type='connected'` + audit `whatsapp_connected`.
 *
 * Qualquer membro pode chamar — feature de read. Defense-in-depth filtra
 * `workspaceId` no `withWorkspace`.
 */
export async function getConnectionStatusAction(
  input: GetConnectionStatusInput = {},
): Promise<GetConnectionStatusResult> {
  const parsed = getConnectionStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin', 'Manager', 'Vendedor', 'Viewer'], {
    forbiddenMessage: 'Você não tem acesso a este workspace.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  // 1. Lê estado atual do banco
  let current: ConnectionUI;
  try {
    current = await getWorkspaceConnection(workspaceId);
  } catch (err) {
    reportNonFatal('connections.status.read', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível ler o estado da conexão agora.' };
  }

  // 2. Se não tem externalInstanceId ou já está disconnected/connected, retorna direto.
  //    (Polling do client só precisa de refresh quando `connecting`.)
  if (!current.externalInstanceId || current.status !== 'connecting') {
    return { ok: true, connection: current };
  }

  // 3. Consulta provedor fora da tx.
  const adapter = getWhatsAppAdapter();
  let providerStatus;
  try {
    providerStatus = await adapter.getInstanceStatus({
      workspaceId,
      externalInstanceId: current.externalInstanceId,
    });
  } catch (err) {
    reportNonFatal('connections.status.adapter', err, {
      workspaceId,
      userId,
      externalInstanceId: current.externalInstanceId,
    });
    // Falha do provedor não derruba a UI — retorna estado em cache.
    return { ok: true, connection: current };
  }

  // 4. Se status do provedor não mudou nada, retorna o cache.
  if (providerStatus.status === 'connecting') {
    return { ok: true, connection: current };
  }

  // 5. Transição detectada — persiste + audit + event.
  try {
    const synced = await withWorkspace(workspaceId, async (tx) => {
      const account = await tx.whatsappAccount.findUnique({
        where: { workspaceId },
        select: { id: true, phoneNumber: true, displayName: true },
      });
      if (!account) {
        throw new Error('whatsapp_account ausente ao sincronizar status');
      }

      const updateData: {
        status: string;
        connectedAt?: Date;
        disconnectedAt?: Date;
        lastSeenAt?: Date | null;
        qrCode?: string | null;
        qrExpiresAt?: Date | null;
        phoneNumber?: string;
      } = { status: providerStatus.status };

      if (providerStatus.status === 'connected') {
        updateData.connectedAt = new Date();
        updateData.lastSeenAt = providerStatus.lastSeenAt ?? new Date();
        updateData.qrCode = null;
        updateData.qrExpiresAt = null;
      } else if (providerStatus.status === 'disconnected') {
        updateData.disconnectedAt = new Date();
        updateData.qrCode = null;
        updateData.qrExpiresAt = null;
      }

      const instance = await tx.whatsappInstance.update({
        where: { accountId: account.id },
        data: updateData,
        select: {
          id: true,
          externalInstanceId: true,
          status: true,
          healthScore: true,
          qrCode: true,
          qrExpiresAt: true,
          connectedAt: true,
          disconnectedAt: true,
          lastSeenAt: true,
          messagesSent24h: true,
          pausedUntil: true,
        },
      });

      // Atualiza phoneNumber no account quando o provedor informar.
      if (providerStatus.status === 'connected' && providerStatus.phoneNumber) {
        await tx.whatsappAccount.update({
          where: { id: account.id },
          data: { phoneNumber: providerStatus.phoneNumber },
        });
        account.phoneNumber = providerStatus.phoneNumber;
      }

      await tx.whatsappEvent.create({
        data: {
          workspaceId,
          instanceId: instance.id,
          type: providerStatus.status,
          payload: {
            externalInstanceId: current.externalInstanceId,
            phoneNumber: providerStatus.phoneNumber ?? null,
            source: 'polling',
          } as Prisma.InputJsonValue,
        },
      });

      if (providerStatus.status === 'connected') {
        await tx.auditLog.create({
          data: {
            workspaceId,
            userId,
            action: 'whatsapp_connected',
            entityType: 'whatsapp_instance',
            entityId: instance.id,
            changes: {
              phoneNumber: providerStatus.phoneNumber ?? null,
              source: 'polling',
            } as Prisma.InputJsonValue,
            ipAddress,
            userAgent,
          },
        });
      }

      const { toConnectionUI } = await import('./transforms');
      return toConnectionUI(account, instance);
    });

    revalidatePath('/settings/connections');
    return { ok: true, connection: synced };
  } catch (err) {
    reportNonFatal('connections.status.sync', err, { workspaceId, userId });
    return { ok: true, connection: current };
  }
}

// =============================================================================
// disconnectInstanceAction — encerra sessão no provedor + banco
// =============================================================================

export type DisconnectInstanceResult =
  | { ok: true; connection: ConnectionUI }
  | { ok: false; error: string };

export async function disconnectInstanceAction(
  input: DisconnectInstanceInput = {},
): Promise<DisconnectInstanceResult> {
  const parsed = disconnectInstanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const auth = await requireRole(['Owner', 'Admin'], {
    forbiddenMessage: 'Apenas Owner e Admin podem desconectar o WhatsApp.',
  });
  if (!auth.ok) return { ok: false, error: auth.error };
  const { userId, workspaceId } = auth.ctx;
  const { ipAddress, userAgent } = getRequestAuditContext();

  // 1. Lê estado atual do banco
  let current: ConnectionUI;
  try {
    current = await getWorkspaceConnection(workspaceId);
  } catch (err) {
    reportNonFatal('connections.disconnect.read', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível ler o estado da conexão agora.' };
  }

  if (!current.accountExists || !current.externalInstanceId) {
    return { ok: false, error: 'Não há conexão WhatsApp ativa para desconectar.' };
  }

  // 2. Tenta desconectar no provedor (best-effort — se falhar, ainda marca local).
  const adapter = getWhatsAppAdapter();
  try {
    await adapter.disconnectInstance({
      workspaceId,
      externalInstanceId: current.externalInstanceId,
    });
  } catch (err) {
    // Provedor pode estar offline ou já ter desconectado — não bloqueia o
    // soft-disconnect local. O vendedor verá o WhatsApp desconectado no
    // celular dele de qualquer forma (uazapi/Whatsmeow não consegue forçar
    // logout retroativo se a sessão já caiu).
    reportNonFatal('connections.disconnect.adapter', err, {
      workspaceId,
      userId,
      externalInstanceId: current.externalInstanceId,
    });
  }

  // 3. Persiste local + audit + event.
  try {
    const connection = await withWorkspace(workspaceId, async (tx) => {
      const account = await tx.whatsappAccount.findUnique({
        where: { workspaceId },
        select: { id: true, phoneNumber: true, displayName: true },
      });
      if (!account) {
        throw new Error('whatsapp_account ausente ao desconectar');
      }

      const instance = await tx.whatsappInstance.update({
        where: { accountId: account.id },
        data: {
          status: 'disconnected',
          disconnectedAt: new Date(),
          qrCode: null,
          qrExpiresAt: null,
        },
        select: {
          id: true,
          externalInstanceId: true,
          status: true,
          healthScore: true,
          qrCode: true,
          qrExpiresAt: true,
          connectedAt: true,
          disconnectedAt: true,
          lastSeenAt: true,
          messagesSent24h: true,
          pausedUntil: true,
        },
      });

      await tx.whatsappEvent.create({
        data: {
          workspaceId,
          instanceId: instance.id,
          type: 'disconnected',
          payload: {
            externalInstanceId: current.externalInstanceId,
            source: 'manual',
          } as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: 'whatsapp_disconnected',
          entityType: 'whatsapp_instance',
          entityId: instance.id,
          changes: {
            externalInstanceId: current.externalInstanceId,
            source: 'manual',
          } as Prisma.InputJsonValue,
          ipAddress,
          userAgent,
        },
      });

      const { toConnectionUI } = await import('./transforms');
      return toConnectionUI(account, instance);
    });

    revalidatePath('/settings/connections');
    return { ok: true, connection };
  } catch (err) {
    reportNonFatal('connections.disconnect.tx', err, { workspaceId, userId });
    return { ok: false, error: 'Não foi possível registrar a desconexão agora.' };
  }
}
