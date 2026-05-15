/**
 * Smoke test do plumbing Supabase (M7#1 + M7#2).
 *
 * Valida em duas camadas:
 *
 * 1. **Plumbing de transação (M7#1)** — `with-workspace` aplica/isola/limpa o
 *    `app.workspace_id` corretamente. Roda via Prisma direto (role `postgres`,
 *    BYPASSRLS — não dispara policies).
 *
 * 2. **Policies RLS (M7#2)** — dentro de `withWorkspace`, com `SET LOCAL ROLE
 *    authenticated` para forçar o respeito às policies, valida que:
 *    - SELECT vê só linhas do workspace ativo (`rlsBlocksOutOfWorkspace`).
 *    - INSERT cross-tenant é negado pelo Postgres (`rlsDeniesWriteCrossTenant`).
 *
 * Seed e cleanup das fixtures são feitos via `createSupabaseAdminClient` (service
 * role JWT no PostgREST → bypassa RLS).
 *
 * Esperado (200 OK):
 *
 *     {
 *       "ok": true,
 *       "checks": {
 *         "supabaseClientCreated": { "ok": true },
 *         "setLocalApplied": { "ok": true, "value": "00000000-0000-0000-0000-000000000001" },
 *         "setLocalIsolated": { "ok": true, "value": "" },
 *         "rollbackResetsContext": { "ok": true, "value": "" },
 *         "rlsBlocksOutOfWorkspace": { "ok": true, "detail": "viu 1 linha de WS_A, zero de WS_B" },
 *         "rlsDeniesWriteCrossTenant": { "ok": true, "detail": "INSERT cross-tenant rejeitado" }
 *       }
 *     }
 *
 * Falha em qualquer check vira `ok: false` com `detail` explicando o porquê.
 *
 * **Removido em M7#6** quando Playwright E2E entrar.
 */
import { NextResponse } from 'next/server';

import { prisma } from '@papopro/db';

import { safeNextParam } from '@/lib/auth/safe-next-param';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withWorkspace } from '@/lib/supabase/with-workspace';

const TEST_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
const WS_A_ID = '00000000-0000-0000-0000-0000000000aa';
const WS_B_ID = '00000000-0000-0000-0000-0000000000bb';

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
    rlsBlocksOutOfWorkspace: { ok: false },
    rlsDeniesWriteCrossTenant: { ok: false },
    rlsBlocksWhatsappEventsCrossWorkspace: { ok: false },
    safeNextParamAcceptsConvitePath: { ok: false },
    safeNextParamRejectsProtocolRelative: { ok: false },
    safeNextParamRejectsControlChars: { ok: false },
    safeNextParamRejectsTooLong: { ok: false },
  };

  // ---------------------------------------------------------------------------
  // 1. createSupabaseServerClient() não crasha. Não chamamos `getUser()` —
  //    isso exigiria sessão válida, que não temos nesse smoke.
  // ---------------------------------------------------------------------------
  try {
    createSupabaseServerClient();
    checks.supabaseClientCreated = { ok: true };
  } catch (err) {
    checks.supabaseClientCreated = {
      ok: false,
      detail: (err as Error).message,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Dentro de withWorkspace, o setting está aplicado.
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 3. Fora de withWorkspace, o setting voltou a vazio (escopo local da
  //    transação). Query direta no pool.
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 4. Erro dentro do callback faz rollback — setting volta a vazio depois.
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 5/6. Testes de RLS — exige tabelas e policies de M7#2 aplicadas.
  // ---------------------------------------------------------------------------
  // Seed via admin client (PostgREST + service_role JWT, bypassa RLS).
  // Cleanup garantido no `finally`.
  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  try {
    admin = createSupabaseAdminClient();
  } catch (err) {
    // Sem SUPABASE_SERVICE_ROLE_KEY: pula 5/6/7 com detail explicativo.
    const detail = `service role indisponível: ${(err as Error).message}`;
    checks.rlsBlocksOutOfWorkspace = { ok: false, detail };
    checks.rlsDeniesWriteCrossTenant = { ok: false, detail };
    checks.rlsBlocksWhatsappEventsCrossWorkspace = { ok: false, detail };
  }

  if (admin) {
    try {
      // ---- Seed: 2 workspaces + 2 audit_logs ---------------------------------
      const seedWorkspaces = await admin
        .from('workspaces')
        .upsert(
          [
            { id: WS_A_ID, name: 'smoke ws A', slug: 'smoke-ws-a' },
            { id: WS_B_ID, name: 'smoke ws B', slug: 'smoke-ws-b' },
          ],
          { onConflict: 'id' },
        )
        .select('id');

      if (seedWorkspaces.error) {
        throw new Error(`seed workspaces: ${seedWorkspaces.error.message}`);
      }

      // Limpa audit_logs antigos do smoke antes de re-inserir (smoke é
      // idempotente — pode rodar várias vezes).
      await admin.from('audit_logs').delete().in('workspace_id', [WS_A_ID, WS_B_ID]);

      const seedAudit = await admin
        .from('audit_logs')
        .insert([
          { workspace_id: WS_A_ID, action: 'workspace_created', entity_type: 'smoke' },
          { workspace_id: WS_B_ID, action: 'workspace_created', entity_type: 'smoke' },
        ])
        .select('id');

      if (seedAudit.error) {
        throw new Error(`seed audit_logs: ${seedAudit.error.message}`);
      }

      // ---- Check 5: SELECT cross-tenant é bloqueado por RLS ------------------
      try {
        const rows: Array<{ workspace_id: string }> = await withWorkspace(WS_A_ID, async (tx) => {
          // Degrada o role da transação para `authenticated` — força RLS.
          // current_workspace_id() continua retornando WS_A_ID (GUC scope local).
          await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
          return tx.$queryRaw<Array<{ workspace_id: string }>>`
            SELECT workspace_id FROM public.audit_logs
             WHERE entity_type = 'smoke'
          `;
        });
        const onlyWsA = rows.every((r: { workspace_id: string }) => r.workspace_id === WS_A_ID);
        const sawAtLeastOne = rows.length >= 1;
        const sawWsBLeak = rows.some((r: { workspace_id: string }) => r.workspace_id === WS_B_ID);
        checks.rlsBlocksOutOfWorkspace = {
          ok: onlyWsA && sawAtLeastOne && !sawWsBLeak,
          detail: sawWsBLeak
            ? `VAZAMENTO: viu linha de WS_B (${rows.length} rows total)`
            : `viu ${rows.length} linha(s) só de WS_A`,
        };
      } catch (err) {
        checks.rlsBlocksOutOfWorkspace = { ok: false, detail: (err as Error).message };
      }

      // ---- Check 6: INSERT cross-tenant é negado por RLS ---------------------
      try {
        await withWorkspace(WS_A_ID, async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
          // Tenta inserir audit_log para WS_B enquanto o setting é WS_A.
          // WITH CHECK da policy audit_logs_insert deve rejeitar.
          await tx.$executeRaw`
            INSERT INTO public.audit_logs (workspace_id, action, entity_type)
            VALUES (${WS_B_ID}::uuid, 'workspace_created', 'smoke')
          `;
        });
        // Se chegou aqui sem erro, RLS está furada.
        checks.rlsDeniesWriteCrossTenant = {
          ok: false,
          detail: 'INSERT cross-tenant passou — policy WITH CHECK não está bloqueando',
        };
      } catch (err) {
        const message = (err as Error).message;
        // Postgres erro de RLS: "new row violates row-level security policy"
        const isRlsError =
          message.includes('row-level security') || message.includes('violates row-level');
        checks.rlsDeniesWriteCrossTenant = {
          ok: isRlsError,
          detail: isRlsError
            ? 'INSERT cross-tenant rejeitado por RLS'
            : `erro inesperado: ${message}`,
        };
      }
      // ---- Check 7 (M9#1): RLS em whatsapp_events bloqueia cross-tenant -----
      // Append-only — só SELECT + INSERT policies. Seed via admin, valida que
      // `withWorkspace(WS_A)` + role authenticated NÃO vê linhas de WS_B.
      try {
        await admin.from('whatsapp_events').delete().in('workspace_id', [WS_A_ID, WS_B_ID]);
        const seedWhatsapp = await admin
          .from('whatsapp_events')
          .insert([
            { workspace_id: WS_A_ID, type: 'smoke', payload: { tag: 'wa-smoke-a' } },
            { workspace_id: WS_B_ID, type: 'smoke', payload: { tag: 'wa-smoke-b' } },
          ])
          .select('id');
        if (seedWhatsapp.error) {
          throw new Error(`seed whatsapp_events: ${seedWhatsapp.error.message}`);
        }

        const rows: Array<{ workspace_id: string }> = await withWorkspace(WS_A_ID, async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
          return tx.$queryRaw<Array<{ workspace_id: string }>>`
            SELECT workspace_id FROM public.whatsapp_events
             WHERE type = 'smoke'
          `;
        });
        const onlyWsA = rows.every((r: { workspace_id: string }) => r.workspace_id === WS_A_ID);
        const sawAtLeastOne = rows.length >= 1;
        const sawWsBLeak = rows.some((r: { workspace_id: string }) => r.workspace_id === WS_B_ID);
        checks.rlsBlocksWhatsappEventsCrossWorkspace = {
          ok: onlyWsA && sawAtLeastOne && !sawWsBLeak,
          detail: sawWsBLeak
            ? `VAZAMENTO whatsapp_events: viu linha de WS_B (${rows.length} rows total)`
            : `whatsapp_events: viu ${rows.length} linha(s) só de WS_A`,
        };

        await admin.from('whatsapp_events').delete().in('workspace_id', [WS_A_ID, WS_B_ID]);
      } catch (err) {
        checks.rlsBlocksWhatsappEventsCrossWorkspace = {
          ok: false,
          detail: (err as Error).message,
        };
      }
    } catch (err) {
      const detail = (err as Error).message;
      if (!checks.rlsBlocksOutOfWorkspace?.ok) {
        checks.rlsBlocksOutOfWorkspace = { ok: false, detail };
      }
      if (!checks.rlsDeniesWriteCrossTenant?.ok) {
        checks.rlsDeniesWriteCrossTenant = { ok: false, detail };
      }
      if (!checks.rlsBlocksWhatsappEventsCrossWorkspace?.ok) {
        checks.rlsBlocksWhatsappEventsCrossWorkspace = { ok: false, detail };
      }
    } finally {
      // Cleanup: DELETE workspaces (CASCADE limpa audit_logs).
      try {
        await admin.from('workspaces').delete().in('id', [WS_A_ID, WS_B_ID]);
      } catch {
        // best-effort
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 7-10. safeNextParam — guard de open-redirect (M7#5 CRÍTICO #1).
  //
  // Fix do code review do PR #39: garantimos no smoke que `safeNextParam`
  // **aceita** a query-string codificada de convite (caso 95% legítimo),
  // **rejeita** open-redirects protocolo-relativos, CRLF smuggling e DoS de
  // URL gigante. Esses 4 vetores cobrem o que o guard precisa segurar em
  // produção; mudança em qualquer uma das regras quebra um destes asserts.
  // ---------------------------------------------------------------------------
  try {
    // Cenário real: `/signup?next=/invite/accept?token=…` chega no middleware
    // via `URLSearchParams.get('next')`, que já decodifica %2F → / e %3F → ?.
    // `safeNextParam` deve aceitar a string decodificada (path + query).
    const conviteNext = '/invite/accept?token=8b2c4ea4-9c2c-4f6f-8e1d-3b9c1c8ab123';
    const accepted = safeNextParam(conviteNext);
    checks.safeNextParamAcceptsConvitePath = {
      ok: accepted === conviteNext,
      detail:
        accepted === conviteNext
          ? `aceitou path de convite (${accepted.length} chars)`
          : `esperava string igual, recebeu ${JSON.stringify(accepted)}`,
    };
  } catch (err) {
    checks.safeNextParamAcceptsConvitePath = {
      ok: false,
      detail: (err as Error).message,
    };
  }

  try {
    // Protocolo-relativo (`//evil.com`) é open-redirect — browser interpreta
    // como URL absoluta com mesmo protocolo. `safeNextParam` deve retornar null.
    const rejected = safeNextParam('//evil.com/phishing');
    checks.safeNextParamRejectsProtocolRelative = {
      ok: rejected === null,
      detail:
        rejected === null
          ? 'rejeitou protocolo-relativo'
          : `VAZAMENTO: aceitou ${JSON.stringify(rejected)} (open-redirect)`,
    };
  } catch (err) {
    checks.safeNextParamRejectsProtocolRelative = {
      ok: false,
      detail: (err as Error).message,
    };
  }

  try {
    // Control chars (`\r\n`) em URL permitem CRLF smuggling no Set-Cookie /
    // Location header. `safeNextParam` deve rejeitar.
    const rejected = safeNextParam('/dashboard\r\nX-Injected: oops');
    checks.safeNextParamRejectsControlChars = {
      ok: rejected === null,
      detail: rejected === null ? 'rejeitou control chars' : `VAZAMENTO: aceitou string com CRLF`,
    };
  } catch (err) {
    checks.safeNextParamRejectsControlChars = {
      ok: false,
      detail: (err as Error).message,
    };
  }

  try {
    // DoS de URL gigante: > 512 chars deve ser rejeitado.
    const longPath = '/dashboard?x=' + 'a'.repeat(600);
    const rejected = safeNextParam(longPath);
    checks.safeNextParamRejectsTooLong = {
      ok: rejected === null,
      detail:
        rejected === null
          ? `rejeitou ${longPath.length} chars (limite 512)`
          : `VAZAMENTO: aceitou string com ${longPath.length} chars`,
    };
  } catch (err) {
    checks.safeNextParamRejectsTooLong = {
      ok: false,
      detail: (err as Error).message,
    };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok: allOk, checks }, { status: allOk ? 200 : 500 });
}
