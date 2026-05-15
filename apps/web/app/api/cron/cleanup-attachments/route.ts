import { timingSafeEqual } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { prisma } from '@papopro/db';

import { reportNonFatal } from '@/lib/observability/report';
import { deleteFromStorage } from '@/lib/storage/attachments';

/**
 * `POST /api/cron/cleanup-attachments` (M8#6) — apaga storage objects + rows
 * dos anexos com `deletedAt < NOW() - 30 days`.
 *
 * **Disparado por:** GitHub Action diário (`.github/workflows/cron-cleanup-attachments.yml`)
 * com `Authorization: Bearer ${CRON_SECRET}`. Pode também ser invocado
 * manualmente via `curl` em dev/incident response.
 *
 * **Por que Next route em vez de pg_cron + pg_net:** Edge Functions estão
 * desabilitadas em dev local nessa máquina (antivírus + TLS — memória
 * `dev-local-windows-antivirus-tls`). Next route + GitHub Action é portável,
 * testável local e tem mesma garantia operacional. Migração pra pg_cron fica
 * pra pós-MVP.
 *
 * **Defense-in-depth:**
 *  - `timingSafeEqual` impede timing attacks no compare do secret.
 *  - LIMIT 500 por execução evita loops longos com risco de timeout Vercel
 *    (5 min). Sobras vêm na execução do dia seguinte.
 *  - Mesmo se o storage delete falhar (404 / quota), a row é apagada — pra
 *    não ficar "presa" no estado pendente eternamente.
 *
 * **Sem RLS:** essa rota usa `prisma` direto (service role / postgres),
 * porque pg_cron equivalente também rodaria com privilégios elevados.
 * Workspace_id é filtrado via `deletedAt + 30 dias`, não via tenant.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

const BATCH_LIMIT = 500;
const RETENTION_DAYS = 30;

interface CleanupResult {
  processed: number;
  deleted: number;
  errors: number;
}

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const actual = authHeader.trim();

  // Comparação de strings de tamanho diferente vaza o tamanho. timingSafeEqual
  // exige buffers do mesmo length — padronizamos com Buffer.from(actual).
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(actual);

  if (expectedBuf.length !== actualBuf.length) return false;
  try {
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    const candidates = await prisma.attachment.findMany({
      where: {
        deletedAt: { not: null, lt: cutoff },
      },
      select: { id: true, path: true, bucket: true, workspaceId: true },
      orderBy: { deletedAt: 'asc' },
      take: BATCH_LIMIT,
    });

    if (candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        cutoff: cutoff.toISOString(),
        result: { processed: 0, deleted: 0, errors: 0 } satisfies CleanupResult,
      });
    }

    const paths = candidates.map((c) => c.path);
    const ids = candidates.map((c) => c.id);

    // Storage delete em batch — Supabase aceita até ~1000 paths.
    const storageResult = await deleteFromStorage(paths);
    if (!storageResult.ok) {
      reportNonFatal('attachments.cleanup.storage', new Error(storageResult.message ?? 'unknown'), {
        count: paths.length,
      });
    }

    // Apaga rows independente do resultado do storage — defense-in-depth pra
    // não ficar limbo. Storage órfão é recuperável manualmente; rows presas
    // viram lixo eterno.
    const dbResult = await prisma.attachment.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({
      ok: true,
      cutoff: cutoff.toISOString(),
      result: {
        processed: candidates.length,
        deleted: dbResult.count,
        errors: storageResult.ok ? 0 : paths.length,
      } satisfies CleanupResult,
    });
  } catch (err) {
    reportNonFatal('attachments.cleanup.fatal', err);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}

/**
 * GET retorna 405 explícito — só aceita POST.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
}
