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
  loadActiveRoutingRules,
  loadConversationDispatchState,
  loadLeadContextForRouter,
  runAgentForInboundMessage,
} from '@/features/agents/runtime';
import {
  handleInstanceStatus,
  handleMessageReceived,
  handleMessageStatus,
} from '@/features/inbox/handlers';
import { pickAgentForInbound } from '@/lib/ai/router';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { checkRateLimit } from '@/lib/webhooks/rate-limit';
import { uazapiWebhookSchema } from '@/lib/whatsapp/webhook-schemas';
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Raw body (antes de JSON.parse — HMAC precisa dos bytes literais)
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return err('invalid_body', 'Não foi possível ler o corpo da requisição.', 400);
  }

  // 2. HMAC verify
  const secret = process.env.UAZAPI_WEBHOOK_SECRET ?? '';
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
  const parsed = uazapiWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    return err('invalid_payload', parsed.error.issues[0]?.message ?? 'Payload inválido.', 422);
  }
  const event = parsed.data;

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

    // ── Agente IA dispatch (M11#5) ──────────────────────────────────────
    // Roda DEPOIS da tx do webhook. Idempotência: se uazapi retry e o
    // event id (sha256 raw body) já foi marcado `processedAt`, o caminho
    // tx acima cai em `idempotent:true` e nem chega aqui — agente não
    // dispara duas vezes pro mesmo inbound.
    if (
      event.event === 'message.received' &&
      !result.idempotent &&
      result.messageReceived &&
      !result.messageReceived.skipped &&
      !result.messageReceived.optOut &&
      result.messageReceived.leadId
    ) {
      const messageBody = event.message.text?.body ?? null;
      // Mídia sem caption (body null) só pode disparar `kind=keyword` (que
      // exige texto) — pulamos o roteador inteiro pra evitar falso match.
      if (messageBody && messageBody.trim()) {
        await dispatchAgentForInbound({
          workspaceId: instance.workspaceId,
          leadId: result.messageReceived.leadId,
          leadPhone: event.message.from.trim(),
          conversationId: result.messageReceived.conversationId ?? '',
          instanceId: instance.id,
          whatsappAccountId: instance.accountId,
          messageBody,
        });
      }
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

interface DispatchAgentInput {
  workspaceId: string;
  leadId: string;
  leadPhone: string;
  conversationId: string;
  instanceId: string;
  whatsappAccountId: string;
  messageBody: string;
}

/**
 * Roteia + despacha agente IA pra mensagem inbound. Fora da tx do webhook —
 * pode rodar até ~80s (jitter 30-50s + Claude + adapter). Falhas são logadas
 * sem propagar pro webhook (provedor já recebeu 200 da persistência inbound;
 * agente é "best-effort").
 *
 * **Fluxo de resolução do agente (M11#6 — sessão sticky):**
 *   1. `ai_enabled=false` → handoff agente→humano ativo; não despacha.
 *   2. Sessão production aberta → continua com o agente dono dela (pula o
 *      roteador — garante que a conversa não troca de agente entre turnos e
 *      que regras `keyword` sigam respondendo após a 1ª mensagem).
 *   3. Sem sessão aberta → roda o roteador (M11#5) pra escolher o agente.
 *
 * **Não bloqueia o webhook em caminhos sem agente:** se nenhum agente ativo
 * casa, retorna imediatamente.
 */
async function dispatchAgentForInbound(input: DispatchAgentInput): Promise<void> {
  // Sem conversationId resolvido (raro — só se handleMessageReceived mudar
  // contrato), não dispara agente. Defense-in-depth.
  if (!input.conversationId) return;

  try {
    const dispatch = await loadConversationDispatchState(input.workspaceId, input.conversationId);
    // Conversa em mãos humanas (handoff agente→humano) — roteador pula.
    if (!dispatch.aiEnabled) return;

    let agentId: string;
    if (dispatch.stickyAgentId) {
      // Conversa já tem agente dono — continua com ele entre turnos.
      agentId = dispatch.stickyAgentId;
    } else {
      // Primeiro contato (sem sessão aberta) — roteador decide.
      const [rules, leadCtx] = await Promise.all([
        loadActiveRoutingRules(input.workspaceId),
        loadLeadContextForRouter(input.workspaceId, input.leadId),
      ]);
      if (rules.length === 0) return;

      const match = pickAgentForInbound(rules, {
        leadStageId: leadCtx?.leadStageId,
        leadTags: leadCtx?.leadTags ?? [],
        whatsappAccountId: input.whatsappAccountId,
        messageBody: input.messageBody,
      });
      if (!match) return;
      agentId = match.agentId;
    }

    await runAgentForInboundMessage({
      workspaceId: input.workspaceId,
      agentId,
      leadId: input.leadId,
      leadPhone: input.leadPhone,
      conversationId: input.conversationId,
      instanceId: input.instanceId,
      whatsappAccountId: input.whatsappAccountId,
      latestUserMessage: input.messageBody,
    });
  } catch (err) {
    reportNonFatal('whatsapp.webhook.agent_dispatch', err, {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      conversationId: input.conversationId,
    });
  }
}

export async function GET(): Promise<NextResponse> {
  return err('method_not_allowed', 'Use POST para enviar eventos uazapi.', 405);
}
