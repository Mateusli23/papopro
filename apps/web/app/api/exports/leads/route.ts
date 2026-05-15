import { type NextRequest, NextResponse } from 'next/server';

import { exportLeadsAction } from '@/features/leads/actions';
import { exportLeadsSchema } from '@/features/leads/schemas';

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
