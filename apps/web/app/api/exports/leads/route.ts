import { type NextRequest, NextResponse } from 'next/server';

import { exportLeadsAction } from '@/features/leads/actions';
import { exportLeadsSchema } from '@/features/leads/schemas';
import { checkRateLimit } from '@/lib/webhooks/rate-limit';

/**
 * `POST /api/exports/leads` (M8#7) — wrapper HTTP da `exportLeadsAction`.
 *
 * **Por que Route Handler em vez de Server Action direto:** o browser
 * precisa de um endpoint que devolva `Content-Disposition: attachment`
 * pra disparar o download. Server Actions retornam objetos JS (não
 * Response). O route handler é o "tradutor" — chama a action server-side
 * e envolve o resultado em Response com headers de download.
 *
 * **Auth/RBAC:** delegados pra `exportLeadsAction` via `requireRole`.
 * Sem sessão → 401 com mensagem propositiva.
 *
 * **Defense-in-depth:** ainda valida payload via Zod antes de chamar a
 * action (que valida de novo internamente). Mensagem do schema é a primeira
 * que o cliente vê — vale ter pt-BR claro.
 *
 * **Body é JSON** pra permitir filtros complexos (arrays de UUIDs, etc).
 * Cliente faz `fetch(..., { method: 'POST', body: JSON.stringify(filters) })`
 * → `response.blob()` → `URL.createObjectURL` → trigger download.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate-limit por IP — defense-in-depth contra exfiltração em massa via
  // sessão comprometida (Owner phishing). 30 export-requests/hora cobre o uso
  // legítimo (geração ad-hoc esporádica) com folga. RBAC ainda é validado na
  // Server Action; este gate adiciona um teto físico de chamadas.
  const ipKey =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const rl = checkRateLimit(`exports-leads:${ipKey}`, 30, 3600_000);
  if (!rl.ok) {
    const response = NextResponse.json(
      { ok: false, error: 'Muitas exportações — tente em alguns minutos.' },
      { status: 429 },
    );
    response.headers.set('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)));
    return response;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'JSON inválido no corpo da requisição.' },
      { status: 400 },
    );
  }

  const parsed = exportLeadsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Filtros inválidos.' },
      { status: 400 },
    );
  }

  const result = await exportLeadsAction(parsed.data);
  if (!result.ok) {
    const status = result.error.includes('permissão') ? 403 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  // String CSV vai direto no body. Headers controlam encoding/download.
  return new NextResponse(result.csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'X-Row-Count': String(result.rowCount),
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, error: 'Use POST com JSON body para exportar.' },
    { status: 405 },
  );
}
