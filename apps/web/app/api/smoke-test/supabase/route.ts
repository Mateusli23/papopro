/**
 * Smoke test do plumbing Supabase (M7#1).
 *
 * Não testa schema nem auth — só valida que o `with-workspace` aplica e
 * isola o `app.workspace_id` corretamente, e que o client Supabase é
 * criado sem crashar. Segue o padrão do `/api/smoke-test/leads` de M4:
 * endpoint interno, JSON, runtime-only, fácil de invocar via `curl`.
 *
 * Esperado depois de `pnpm --filter @papopro/web dev` com `.env.local`
 * populado:
 *
 *     curl http://localhost:3000/api/smoke-test/supabase
 *     {
 *       "ok": true,
 *       "checks": {
 *         "supabaseClientCreated": { "ok": true },
 *         "setLocalApplied": { "ok": true, "value": "smoke-test-ws-id" },
 *         "setLocalIsolated": { "ok": true, "value": "" },
 *         "rollbackResetsContext": { "ok": true, "value": "" }
 *       }
 *     }
 *
 * Falha em qualquer check vira `ok: false` com `detail` explicando o
 * porquê. Quando o `.env.local` está incompleto, o primeiro check explica
 * exatamente qual variável falta — útil pra diagnosticar setup.
 *
 * **Removido em M7#3** quando a stack de testes (Vitest) entrar.
 */
import { NextResponse } from 'next/server';

import { prisma } from '@papopro/db';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withWorkspace } from '@/lib/supabase/with-workspace';

const TEST_WORKSPACE_ID = 'smoke-test-ws-id';

interface CheckResult {
  ok: boolean;
  detail?: string;
  value?: string;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, CheckResult> = {
    supabaseClientCreated: { ok: false },
    setLocalApplied: { ok: false },
    setLocalIsolated: { ok: false },
    rollbackResetsContext: { ok: false },
  };

  // 1. createSupabaseServerClient() não crasha. Não chamamos `getUser()` —
  //    isso exigiria sessão válida, que não temos nesse smoke.
  try {
    createSupabaseServerClient();
    checks.supabaseClientCreated = { ok: true };
  } catch (err) {
    checks.supabaseClientCreated = {
      ok: false,
      detail: (err as Error).message,
    };
  }

  // 2. Dentro de withWorkspace, o setting está aplicado.
  try {
    const value = await withWorkspace(TEST_WORKSPACE_ID, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ value: string }>>`
        SELECT current_setting('app.workspace_id', true) AS value
      `;
      return rows[0]?.value ?? '';
    });
    checks.setLocalApplied = {
      ok: value === TEST_WORKSPACE_ID,
      value,
      detail:
        value === TEST_WORKSPACE_ID ? undefined : `esperava ${TEST_WORKSPACE_ID}, recebeu ${value}`,
    };
  } catch (err) {
    checks.setLocalApplied = {
      ok: false,
      detail: (err as Error).message,
    };
  }

  // 3. Fora de withWorkspace, o setting voltou a vazio (escopo local da
  //    transação). Query direta no pool.
  try {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT current_setting('app.workspace_id', true) AS value
    `;
    const value = rows[0]?.value ?? '';
    checks.setLocalIsolated = {
      ok: value === '',
      value,
      detail: value === '' ? undefined : `vazou pro pool: setting ainda é "${value}"`,
    };
  } catch (err) {
    checks.setLocalIsolated = {
      ok: false,
      detail: (err as Error).message,
    };
  }

  // 4. Erro dentro do callback faz rollback — setting volta a vazio depois.
  try {
    await withWorkspace(TEST_WORKSPACE_ID, async () => {
      throw new Error('intentional rollback for smoke test');
    }).catch(() => {
      // engole o erro intencional
    });

    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT current_setting('app.workspace_id', true) AS value
    `;
    const value = rows[0]?.value ?? '';
    checks.rollbackResetsContext = {
      ok: value === '',
      value,
      detail: value === '' ? undefined : `rollback não limpou: setting ainda é "${value}"`,
    };
  } catch (err) {
    checks.rollbackResetsContext = {
      ok: false,
      detail: (err as Error).message,
    };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok: allOk, checks }, { status: allOk ? 200 : 500 });
}
