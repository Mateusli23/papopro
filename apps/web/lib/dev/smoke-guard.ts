import 'server-only';

import { timingSafeEqual } from 'node:crypto';

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Gate dos endpoints `/api/smoke-test/*` para impedir exposição em produção.
 *
 * **Por que:** os smokes são auto-checks de plumbing (RLS, schema, helpers
 * puros). Eles fazem `SELECT`/`INSERT`/`DELETE` com `service_role`, expõem
 * estado interno do schema e podem ser usados para fingerprint do deploy. O
 * matcher do middleware exclui `/api/*`, então sem este gate qualquer
 * visitante anônimo pode chamar `/api/smoke-test/supabase` em produção.
 *
 * **Modos:**
 *  1. `NODE_ENV !== 'production'` → libera (uso normal em dev/preview).
 *  2. `NODE_ENV === 'production'` + header `x-smoke-secret` válido (compara
 *     timing-safe contra `SMOKE_TEST_SECRET` ou, em fallback, `CRON_SECRET`)
 *     → libera (uso operacional via `curl` com bearer no header `x-smoke-secret`).
 *  3. Qualquer outro caso em produção → `404` (não vaza existência do endpoint).
 *
 * Devolve `null` quando o caller pode prosseguir, ou um `NextResponse` 404
 * quando o caller deve retornar imediatamente sem executar o corpo.
 */
export function blockSmokeInProd(): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null;

  const expected = process.env.SMOKE_TEST_SECRET ?? process.env.CRON_SECRET ?? '';
  if (!expected) {
    return notFound();
  }

  const provided = headers().get('x-smoke-secret') ?? '';
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return notFound();
  try {
    return timingSafeEqual(expectedBuf, providedBuf) ? null : notFound();
  } catch {
    return notFound();
  }
}

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}
