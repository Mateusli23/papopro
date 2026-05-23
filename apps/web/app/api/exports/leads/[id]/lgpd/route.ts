import { type NextRequest, NextResponse } from 'next/server';

import { exportLeadDataAction } from '@/features/leads/lgpd-actions';
import { checkRateLimit } from '@/lib/webhooks/rate-limit';

/**
 * `POST /api/exports/leads/[id]/lgpd` (M13#3) — wrapper HTTP da
 * `exportLeadDataAction`. Devolve o dump LGPD completo de um lead como JSON
 * com `Content-Disposition: attachment` pra disparar o download no browser.
 *
 * **Por que POST e não GET:** a exportação grava `audit_logs` (LGPD §3.4 —
 * toda exportação de dado pessoal é registrada). GET seria disparável por
 * prefetch/crawler/preview, inflando a auditoria com exportações fantasma.
 * POST exige ação deliberada do cliente (botão → `fetch`).
 *
 * **Auth/RBAC:** delegados pra `exportLeadDataAction` via `requireRole`
 * (Owner/Admin). Sem sessão / sem permissão → 401/403 com mensagem pt-BR.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  // Rate-limit por IP — exportação LGPD é cara (dump JSON completo + audit
  // log) e vetor óbvio de exfiltração se o Owner/Admin for comprometido.
  // 20/hora por IP cobre uso legítimo (titular pedindo dump ad-hoc); RBAC
  // continua validado na Server Action.
  const ipKey =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const rl = checkRateLimit(`exports-lgpd:${ipKey}`, 20, 3600_000);
  if (!rl.ok) {
    const response = NextResponse.json(
      { ok: false, error: 'Muitas exportações — tente em alguns minutos.' },
      { status: 429 },
    );
    response.headers.set('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)));
    return response;
  }

  const result = await exportLeadDataAction({ leadId: params.id });
  if (!result.ok) {
    const status = result.error.includes('permissão')
      ? 403
      : result.error.includes('não encontrado')
        ? 404
        : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  // `JSON.stringify` indentado — o arquivo é lido por humano (titular ou
  // autoridade), legibilidade vale o byte extra.
  return new NextResponse(JSON.stringify(result.payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, error: 'Use POST para exportar os dados do lead.' },
    { status: 405 },
  );
}
