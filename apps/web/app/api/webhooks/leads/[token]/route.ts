import { createHash } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { prisma, type Prisma } from '@papopro/db';

import { webhookLeadPayloadSchema, type WebhookLeadPayload } from '@/features/webhooks/schemas';
import { findDuplicates } from '@/lib/leads/dedupe';
import { pickNextAssignee } from '@/lib/leads/pick-assignee';
import { reportNonFatal } from '@/lib/observability/report';
import { withWorkspace } from '@/lib/supabase/with-workspace';
import { checkRateLimit } from '@/lib/webhooks/rate-limit';

/**
 * **`POST /api/webhooks/leads/[token]` — captura inbound genérica de leads (M8#5).**
 *
 * O token na URL identifica o workspace (`workspaces.webhook_token`, único,
 * regenerável por Owner/Admin em Settings → Connections). Payload genérico,
 * mapeável a partir do Zapier, Make, N8N ou formulários custom. Adapters
 * nativos pra Meta Lead Ads / RD Station / Hotmart (HMAC + OAuth) ficam pra V2.
 *
 * **Sequência:**
 *  1. Lookup workspace pelo token. Não acha → 404 (não vaza se token existe).
 *  2. Rate limit por token: 100 req/min (in-memory; promover pra Redis em V2).
 *     Excedeu → 429 + `Retry-After`.
 *  3. Parse + Zod do payload. Falha → 422.
 *  4. SHA256(token + payload) → idempotência via `webhook_events.(source, external_id)`.
 *     Já existe → 200 silencioso (sem criar lead novo).
 *  5. Tx via `withWorkspace`:
 *     a. Cria row em `webhook_events`.
 *     b. Dedup por phone/email — existe? atualiza `lastInteractionAt` +
 *        activity `lead_created` com `meta.duplicate=true, meta.via='webhook'`.
 *     c. Senão: cria lead com `origin` mapeado do `payload.source` (cai em
 *        `webhook_generico` se não casar enum); `assignedToId` via
 *        `pickNextAssignee`; activity `lead_created`; audit `lead_created`.
 *     d. Marca `webhook_events.processedAt = NOW()`.
 *  6. Resposta sempre JSON com `{ ok, ... }`.
 *
 * **Defense-in-depth (CLAUDE.md §7.2):** `withWorkspace` (RLS) +
 * `where: { workspaceId }` em todas as queries.
 *
 * **Resposta padrão:** JSON propositivo em pt-BR. Erros são acionáveis pra
 * quem vai integrar.
 */

export const dynamic = 'force-dynamic';

// `LeadOrigin` casa com `WEBHOOK_KNOWN_SOURCES` (ver `features/webhooks/schemas.ts`).
// `site`/`indicacao` no payload viram literal — `meta_ads`/`google_ads`/etc
// também. Fonte desconhecida cai em `webhook_generico`.
const SOURCE_TO_ORIGIN: Record<string, Prisma.LeadCreateInput['origin']> = {
  meta_ads: 'meta_ads',
  google_ads: 'google_ads',
  rd_station: 'rd_station',
  hotmart: 'hotmart',
  site: 'site',
  indicacao: 'indicacao',
};

interface SuccessResponse {
  ok: true;
  leadId?: string;
  duplicate?: boolean;
  idempotent?: boolean;
}

interface ErrorResponse {
  ok: false;
  code: string;
  message: string;
}

function ok(body: SuccessResponse, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function err(code: string, message: string, status: number): NextResponse {
  const body: ErrorResponse = { ok: false, code, message };
  return NextResponse.json(body, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
): Promise<NextResponse> {
  const { token } = params;

  // Sanity check antes de tocar o DB. Token é base64url 43 chars; rejeitar
  // claramente fora dessa faixa economiza queries.
  if (!token || token.length < 16 || token.length > 64) {
    return err('invalid_token', 'Token inválido.', 404);
  }

  // 1. Rate limit ANTES do lookup — se o atacante chuta tokens em massa, não
  //    queremos pagar uma query Postgres em cada.
  const rl = checkRateLimit(token, 100, 60_000);
  if (!rl.ok) {
    const response = err('rate_limited', 'Muitos pedidos — aguarde um pouco.', 429);
    response.headers.set('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)));
    return response;
  }

  // 2. Lookup workspace. `webhookToken` é unique + indexado.
  const workspace = await prisma.workspace.findUnique({
    where: { webhookToken: token },
    select: { id: true },
  });
  if (!workspace) {
    return err('invalid_token', 'Token inválido.', 404);
  }
  const workspaceId = workspace.id;

  // 3. Parse payload.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return err('invalid_json', 'JSON inválido no corpo da requisição.', 422);
  }

  const parsed = webhookLeadPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return err('invalid_payload', parsed.error.issues[0]?.message ?? 'Payload inválido.', 422);
  }
  const payload: WebhookLeadPayload = parsed.data;

  // 4. Idempotência — hash do payload + token. Mesma chamada repetida em ≤24h
  //    é no-op.
  const externalId = createHash('sha256')
    .update(`${token}:${JSON.stringify(payload)}`)
    .digest('hex');

  try {
    const existingEvent = await prisma.webhookEvent.findFirst({
      where: { source: 'generic_leads', externalId },
      select: { id: true, processedAt: true },
    });

    if (existingEvent?.processedAt) {
      return ok({ ok: true, idempotent: true });
    }

    // 5. Tx — RLS via setting.
    const result = await withWorkspace<{ leadId?: string; duplicate: boolean }>(
      workspaceId,
      async (tx) => {
        // 5a. Cria webhook_events (ou reusa se ficou pendente sem processedAt).
        let eventId: string;
        if (existingEvent) {
          eventId = existingEvent.id;
        } else {
          const e = await tx.webhookEvent.create({
            data: {
              workspaceId,
              source: 'generic_leads',
              externalId,
              payload: payload as Prisma.InputJsonValue,
              signatureValid: true,
            },
            select: { id: true },
          });
          eventId = e.id;
        }

        // 5b. Dedup por phone/email.
        const dups = await findDuplicates(tx, workspaceId, [
          { phone: payload.phone, email: payload.email ?? null },
        ]);
        const phoneKey = payload.phone.trim();
        const emailKey = payload.email?.toLowerCase().trim();
        const match = dups.get(phoneKey) ?? (emailKey ? dups.get(emailKey) : undefined);

        if (match) {
          // Lead já existe — registra activity e atualiza interação.
          await tx.lead.update({
            where: { id: match.id },
            data: { lastInteractionAt: new Date() },
          });

          await tx.activity.create({
            data: {
              workspaceId,
              leadId: match.id,
              type: 'lead_created',
              meta: {
                via: 'webhook',
                source: payload.source ?? 'unknown',
                duplicate: true,
                utm_campaign: payload.utm_campaign ?? null,
                utm_source: payload.utm_source ?? null,
                utm_medium: payload.utm_medium ?? null,
                customFields: payload.custom_fields ?? null,
              } as Prisma.InputJsonValue,
            },
          });

          await tx.webhookEvent.update({
            where: { id: eventId },
            data: { processedAt: new Date() },
          });

          return { leadId: match.id, duplicate: true };
        }

        // 5c. Cria lead novo.
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
        if (!firstStageId) throw new Error('PIPELINE_NOT_FOUND');

        const assigneeId = await pickNextAssignee(tx, workspaceId);
        if (!assigneeId) throw new Error('NO_ASSIGNEE');

        const origin: Prisma.LeadCreateInput['origin'] =
          (payload.source && SOURCE_TO_ORIGIN[payload.source]) ?? 'webhook_generico';

        const lead = await tx.lead.create({
          data: {
            workspaceId,
            name: payload.name.trim(),
            email: payload.email ?? null,
            phone: payload.phone.trim(),
            origin,
            status: 'ativo',
            stageId: firstStageId,
            assignedToId: assigneeId,
            valueCents: 0,
            lastInteractionAt: new Date(),
          },
          select: { id: true },
        });

        await tx.activity.create({
          data: {
            workspaceId,
            leadId: lead.id,
            type: 'lead_created',
            authorId: assigneeId,
            meta: {
              via: 'webhook',
              source: payload.source ?? null,
              utm_campaign: payload.utm_campaign ?? null,
              utm_source: payload.utm_source ?? null,
              utm_medium: payload.utm_medium ?? null,
              customFields: payload.custom_fields ?? null,
              webhookEventId: eventId,
            } as Prisma.InputJsonValue,
          },
        });

        await tx.auditLog.create({
          data: {
            workspaceId,
            action: 'lead_created',
            entityType: 'lead',
            entityId: lead.id,
            changes: {
              via: 'webhook',
              source: payload.source ?? null,
              webhookEventId: eventId,
            } as Prisma.InputJsonValue,
          },
        });

        await tx.webhookEvent.update({
          where: { id: eventId },
          data: { processedAt: new Date() },
        });

        return { leadId: lead.id, duplicate: false };
      },
    );

    return ok({ ok: true, leadId: result.leadId, duplicate: result.duplicate });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'PIPELINE_NOT_FOUND') {
        return err(
          'no_default_pipeline',
          'Funil padrão não encontrado no workspace. Configure antes de receber webhooks.',
          422,
        );
      }
      if (e.message === 'NO_ASSIGNEE') {
        return err(
          'no_assignee',
          'Nenhum vendedor ativo no workspace para receber leads automaticamente.',
          422,
        );
      }
    }
    reportNonFatal('webhooks.leads.post', e, { workspaceId });

    // Best-effort: registra falha no event pra debug futuro.
    try {
      await prisma.webhookEvent.create({
        data: {
          workspaceId,
          source: 'generic_leads',
          externalId: `${externalId}-err-${Date.now()}`,
          payload: payload as Prisma.InputJsonValue,
          signatureValid: true,
          error: (e as Error).message ?? 'unknown',
        },
      });
    } catch {
      // ignore — log já foi reportado acima
    }

    return err('internal', 'Não foi possível processar agora. Tente em instantes.', 500);
  }
}

/**
 * GET retorna 405 (Method Not Allowed) explícito — webhook só aceita POST.
 * Útil pra ferramentas que pingam o endpoint via browser (Zapier preview, etc).
 */
export async function GET(): Promise<NextResponse> {
  return err('method_not_allowed', 'Use POST para enviar leads.', 405);
}
