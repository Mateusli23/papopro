/**
 * `POST /api/webhooks/whatsapp` — webhook inbound da uazapi (M9#3).
 *
 * **Sequência:**
 *  1. Lê raw body (não consome JSON ainda — HMAC precisa do bytes exatos)
 *  2. Verifica `X-Uazapi-Signature: sha256=<hex>` via HMAC-SHA256(rawBody, secret).
 *     Dev sem secret → skipped. Inválida → 401.
 *  3. Parse JSON + Zod discriminated union (`uazapiWebhookSchema`)
 *  4. Rate limit por `instance_id` (200 req/min — margem maior que webhook leads)
 *  5. Lookup `WhatsappInstance.externalInstanceId` SEM workspace context (cross-tenant
 *     allowed por design — select só workspaceId/id/accountId; defense-in-depth
 *     entra depois quando abrimos a tx com workspaceId)
 *  6. Idempotência via `WebhookEvent (source='whatsapp_inbound', externalId=hash)`
 *  7. `withWorkspace` tx → dispatch handler → marca processedAt
 *  8. Sempre 200 OK (provedor não retenta em sucesso; idempotência protege)
 *
 * **Defense-in-depth (CLAUDE.md §7.2):** lookup cross-tenant é `findFirst` com
 * select estreito; toda mutação subsequente passa por `withWorkspace` (RLS).
 *
 * GET → 405 explícito.
 */
import { createHash } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { prisma, type Prisma } from '@papopro/db';

import {
  handleInstanceStatus,
  handleMessageReceived,
  handleMessageStatus,
} from '@/features/inbox/handlers';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { checkRateLimit } from '@/lib/webhooks/rate-limit';
import { normalizeUazapiWebhook } from '@/lib/whatsapp/webhook-schemas';
import { verifyUazapiSignature } from '@/lib/whatsapp/webhook-verify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// M11#5: bump 30→90s pra cobrir jitter anti-ban 30-50s + Claude ~5s +
// adapter ~3s + margem quando o agente IA é despachado. Idempotência via
// WebhookEvent (sha256 do raw body) absorve retry de uazapi se ocorrer.
export const maxDuration = 90;

interface ErrorBody {
  ok: false;
  code: string;
  message: string;
}

interface SuccessBody {
  ok: true;
  idempotent?: boolean;
  skipped?: boolean;
}

function ok(body: SuccessBody, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function err(code: string, message: string, status: number): NextResponse {
  const body: ErrorBody = { ok: false, code, message };
  return NextResponse.json(body, { status });
}

function webhookSecret(): string {
  const secret = process.env.UAZAPI_WEBHOOK_SECRET ?? '';
  if (process.env.NODE_ENV === 'production' && !secret.trim()) {
    throw new Error('UAZAPI_WEBHOOK_SECRET é obrigatório em produção/preview');
  }
  return secret;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Raw body (antes de JSON.parse — HMAC precisa dos bytes literais)
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return err('invalid_body', 'Não foi possível ler o corpo da requisição.', 400);
  }

  // 2. HMAC verify
  let secret: string;
  try {
    secret = webhookSecret();
  } catch (e) {
    reportNonFatal('whatsapp.webhook.secret_missing', e, {});
    return err('webhook_secret_missing', 'Webhook WhatsApp sem secret configurado.', 500);
  }
  const verify = verifyUazapiSignature(secret, rawBody, request.headers.get('x-uazapi-signature'));
  if (!verify.ok) {
    return err('signature_invalid', 'Assinatura inválida.', 401);
  }

  // 3. Parse JSON + Zod
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return err('invalid_json', 'JSON inválido no corpo da requisição.', 400);
  }
  const event = normalizeUazapiWebhook(payload);
  if (!event) {
    return err('invalid_payload', 'Payload WhatsApp inválido ou evento ignorado.', 422);
  }

  // 4. Rate limit por instance_id (chave dedicada `whatsapp:` pra não colidir
  //    com keys do leads webhook em produção compartilhando o mesmo Map).
  const rl = checkRateLimit(`whatsapp:${event.instance_id}`, 200, 60_000);
  if (!rl.ok) {
    const response = err('rate_limited', 'Muitos pedidos — aguarde um pouco.', 429);
    response.headers.set('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)));
    return response;
  }

  // 5. Lookup instance (cross-tenant — select estreito).
  const instance = await prisma.whatsappInstance.findFirst({
    where: { externalInstanceId: event.instance_id },
    select: { id: true, workspaceId: true, accountId: true },
  });
  if (!instance) {
    return err('instance_not_found', 'Instância WhatsApp não cadastrada.', 404);
  }

  // 6. Idempotência via WebhookEvent unique (source, externalId).
  //    externalId = sha256(rawBody) — entrega exata, dedupe perfeita.
  const externalId = createHash('sha256').update(rawBody).digest('hex');

  // 7. Tx (RLS via withWorkspace).
  try {
    const result = await withWorkspace(instance.workspaceId, async (tx) => {
      // Tenta criar WebhookEvent; se (source, externalId) já existe, busca o
      // existente. Decidir entre `upsert` vs `create+catch` — `upsert` exige
      // unique composta nomeada no Prisma client, que é `source_externalId`.
      const existing = await tx.webhookEvent.findUnique({
        where: { source_externalId: { source: 'whatsapp_inbound', externalId } },
        select: { id: true, processedAt: true },
      });

      let eventId: string;
      if (existing) {
        if (existing.processedAt) {
          return { idempotent: true };
        }
        eventId = existing.id;
      } else {
        const created = await tx.webhookEvent.create({
          data: {
            workspaceId: instance.workspaceId,
            source: 'whatsapp_inbound',
            externalId,
            payload: event as Prisma.InputJsonValue,
            signatureValid: verify.ok && !verify.skipped,
          },
          select: { id: true },
        });
        eventId = created.id;
      }

      // Dispatch. `messageReceived` é capturado pra dispatch do agente IA
      // (M11#5) FORA da tx — chamada Claude + jitter 30-50s + adapter não
      // podem segurar uma transação aberta.
      let messageReceived: Awaited<ReturnType<typeof handleMessageReceived>> | undefined;

      switch (event.event) {
        case 'message.received':
          messageReceived = await handleMessageReceived(
            tx,
            {
              workspaceId: instance.workspaceId,
              instanceId: instance.id,
              whatsappAccountId: instance.accountId,
            },
            event,
          );
          break;
        case 'message.status':
          await handleMessageStatus(
            tx,
            { workspaceId: instance.workspaceId, instanceId: instance.id },
            event,
          );
          break;
        case 'instance.status':
          await handleInstanceStatus(
            tx,
            {
              workspaceId: instance.workspaceId,
              instanceId: instance.id,
              accountId: instance.accountId,
            },
            event,
          );
          break;
      }

      await tx.webhookEvent.update({
        where: { id: eventId },
        data: { processedAt: new Date() },
      });

      return { idempotent: false, messageReceived };
    });

    // ── Notificação inbound manual ──────────────────────────────────────
    // Escopo desta entrega: WhatsApp funcionando no PapoPro, sem agente IA.
    // Portanto o webhook salva mensagem/conversa/lead e notifica o vendedor,
    // mas NÃO despacha `runAgentForInboundMessage` automaticamente.
    if (
      event.event === 'message.received' &&
      !result.idempotent &&
      result.messageReceived &&
      !result.messageReceived.skipped &&
      !result.messageReceived.optOut &&
      result.messageReceived.leadId
    ) {
      // Notifica o vendedor responsável que o cliente respondeu (M13#2 —
      // evento `whatsapp_message_received`). Independe de o conteúdo ser
      // texto: mídia sem caption também conta como resposta do cliente.
      await notifyInboundMessage(
        instance.workspaceId,
        result.messageReceived.leadId,
        request.nextUrl.origin,
      );
    }

    return ok({ ok: true, idempotent: result.idempotent });
  } catch (e) {
    const message = (e as Error).message;
    if (message === 'PIPELINE_NOT_FOUND') {
      return err('no_default_pipeline', 'Funil padrão não encontrado no workspace.', 422);
    }
    if (message === 'NO_ASSIGNEE') {
      return err(
        'no_assignee',
        'Nenhum vendedor ativo no workspace para receber leads automaticamente.',
        422,
      );
    }
    reportNonFatal('whatsapp.webhook.tx', e, {
      workspaceId: instance.workspaceId,
      instanceId: instance.id,
      event: event.event,
    });
    return err('internal', 'Não foi possível processar agora. Tente em instantes.', 500);
  }
}

/**
 * Dispara a notificação `whatsapp_message_received` pro vendedor responsável
 * pelo lead. O assignee é obrigatório no schema (`LeadAssignee` onDelete:
 * Restrict), então sempre há um destinatário. Best-effort — `dispatchNotification`
 * nunca lança, e a query é embrulhada pra não tocar o 200 do webhook.
 */
async function notifyInboundMessage(
  workspaceId: string,
  leadId: string,
  appBaseUrl: string,
): Promise<void> {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { name: true, assignedTo: { select: { userId: true } } },
    });
    if (!lead) return;
    await dispatchNotification({
      workspaceId,
      event: 'whatsapp_message_received',
      recipientUserIds: [lead.assignedTo.userId],
      title: 'Nova mensagem no WhatsApp',
      body: `${lead.name} respondeu — veja na caixa de entrada.`,
      url: '/inbox',
      appBaseUrl,
    });
  } catch (err) {
    reportNonFatal('whatsapp.webhook.notify_inbound', err, { workspaceId, leadId });
  }
}

export async function GET(): Promise<NextResponse> {
  return err('method_not_allowed', 'Use POST para enviar eventos uazapi.', 405);
}
