/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// Runtime: Deno. ESLint do Node aqui é off porque os imports/globais
// (`Deno`, `https://esm.sh/...`) só existem no edge runtime — não há `package.json`
// nessa pasta. Os `@ts-ignore` viram silenciamentos efetivos só no Deno deploy.
// deno-lint-ignore-file no-explicit-any
/**
 * Edge Function `cadence-runner` (M10#2).
 *
 * Invocada a cada 5 minutos via `pg_cron` + `pg_net` (vide migration
 * `20260522120000_m10_2_cadence_runner_cron.sql`). Pra cada enrollment
 * `active` com `next_run_at <= NOW()`:
 *  1. Encontra o próximo step não-executado (via RPC `cadence_runner_pick_candidates`)
 *  2. Reivindica o slot via INSERT `cadence_step_runs (enrollment_id, step_id)`
 *     com `UNIQUE` do M10#1 — runner concorrente perde no conflict (idempotente)
 *  3. POSTa pra rota interna Next `/api/internal/cadence-dispatch` que:
 *     - executa anti-ban (M9#3)
 *     - aplica jitter 30-50s
 *     - chama uazapi adapter (M9#2)
 *     - persiste Conversation+Message+Activity+audit
 *     - avança/completa/cancela enrollment
 *
 * **Por que delegar pra Next route em vez de fazer tudo aqui:** o stack TS
 * de anti-ban + uazapi + Conversation/Message tem ~500 linhas + 33 smoke
 * checks no M9. Reimplementar em Deno duplicaria todo esse contrato. Edge
 * Function = scheduler; Next route = executor.
 *
 * **Autenticação:** header `x-cadence-runner-secret` validado contra env
 * `CADENCE_RUNNER_SECRET`. A função SQL `invoke_cadence_runner` lê o mesmo
 * valor de `current_setting('app.cadence_runner_secret')`.
 *
 * **Dispatch auth:** Edge POSTa pra rota Next com header `Authorization:
 * Bearer ${CADENCE_DISPATCH_SECRET}` — rota valida via `timingSafeEqual`.
 *
 * **Concorrência cap 5** com `Promise.allSettled` em batches — Edge Function
 * cap default Supabase é 150s, e cada dispatch pode demorar até 60s
 * (jitter + adapter). Batches de 5 = ~75s pra batch (vs ~300s sequencial).
 *
 * **Memória `dev-local-windows-antivirus-tls`:** deploy via MCP
 * `deploy_edge_function` — CLI `supabase functions deploy` quebra TLS na
 * minha máquina.
 */

// @ts-ignore — Deno-only import; resolvido em runtime na Edge Function.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const BATCH_LIMIT = 100;
const CONCURRENCY = 5;
const DISPATCH_TIMEOUT_MS = 60_000;

interface Candidate {
  enrollment_id: string;
  workspace_id: string;
  lead_id: string;
  cadence_id: string;
  step_id: string;
  scheduled_for: string;
}

interface ClaimedCandidate extends Candidate {
  step_run_id: string;
}

interface DispatchOutcome {
  enrollment_id: string;
  step_run_id: string;
  status: number;
  body: unknown;
}

interface DispatchError {
  enrollment_id: string;
  step_run_id: string;
  error: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function dispatchOne(
  appUrl: string,
  secret: string,
  candidate: ClaimedCandidate,
): Promise<DispatchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${appUrl.replace(/\/$/, '')}/api/internal/cadence-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        workspace_id: candidate.workspace_id,
        enrollment_id: candidate.enrollment_id,
        lead_id: candidate.lead_id,
        cadence_id: candidate.cadence_id,
        step_id: candidate.step_id,
        step_run_id: candidate.step_run_id,
        scheduled_for: candidate.scheduled_for,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const body = await resp.json().catch(() => null);
    return {
      enrollment_id: candidate.enrollment_id,
      step_run_id: candidate.step_run_id,
      status: resp.status,
      body,
    };
  } catch (err: any) {
    clearTimeout(timer);
    throw new Error(err?.name === 'AbortError' ? 'timeout' : String(err?.message ?? err));
  }
}

// Deno runtime entrypoint
// @ts-ignore — `Deno` global só existe em runtime
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // @ts-ignore Deno.env
  const expected = Deno.env.get('CADENCE_RUNNER_SECRET') ?? '';
  const provided = req.headers.get('x-cadence-runner-secret') ?? '';
  if (!expected || !provided || provided !== expected) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  // @ts-ignore Deno.env
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  // @ts-ignore Deno.env
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  // @ts-ignore Deno.env
  const appUrl = Deno.env.get('APP_URL') ?? '';
  // @ts-ignore Deno.env
  const dispatchSecret = Deno.env.get('CADENCE_DISPATCH_SECRET') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: 'supabase env missing' }, 500);
  }
  if (!appUrl || !dispatchSecret) {
    return json(
      { ok: false, error: 'dispatch env missing (APP_URL or CADENCE_DISPATCH_SECRET)' },
      500,
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ─── 1. Seleciona candidatos via RPC (cross-tenant, Service Role) ────────
  const { data: candidates, error: pickErr } = await admin.rpc('cadence_runner_pick_candidates', {
    p_limit: BATCH_LIMIT,
  });

  if (pickErr) {
    return json({ ok: false, error: `pick_candidates: ${pickErr.message}` }, 500);
  }

  const picked = (candidates as Candidate[] | null) ?? [];

  // ─── 2. Reivindica slot pra cada candidato (INSERT ON CONFLICT DO NOTHING)
  // O UNIQUE (enrollment_id, step_id) do M10#1 garante idempotência. Se duas
  // invocações concorrentes do cron tentarem o mesmo step, a segunda perde.
  const claimed: ClaimedCandidate[] = [];
  for (const c of picked) {
    const { data: row, error: insErr } = await admin
      .from('cadence_step_runs')
      .insert({
        workspace_id: c.workspace_id,
        enrollment_id: c.enrollment_id,
        step_id: c.step_id,
        status: 'pending',
        scheduled_for: c.scheduled_for,
      })
      .select('id')
      .maybeSingle();

    if (insErr) {
      // Postgres unique violation = 23505 — outro runner já claimou. Skip silenciosamente.
      const code = (insErr as any).code;
      if (code === '23505') continue;
      console.error(`claim ${c.enrollment_id}/${c.step_id}: ${insErr.message}`);
      continue;
    }
    if (row?.id) {
      claimed.push({ ...c, step_run_id: row.id });
    }
  }

  // ─── 3. Dispara para a rota Next com concorrência cap=5 ──────────────────
  const dispatched: DispatchOutcome[] = [];
  const errors: DispatchError[] = [];

  for (let i = 0; i < claimed.length; i += CONCURRENCY) {
    const batch = claimed.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((c) => dispatchOne(appUrl, dispatchSecret, c)),
    );
    results.forEach((r, idx) => {
      const c = batch[idx];
      if (!c) return;
      if (r.status === 'fulfilled') {
        dispatched.push(r.value);
      } else {
        errors.push({
          enrollment_id: c.enrollment_id,
          step_run_id: c.step_run_id,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    });
  }

  const summary = {
    picked: picked.length,
    claimed: claimed.length,
    dispatched: dispatched.length,
    errors: errors.length,
  };

  return json({ ok: true, summary, outcomes: dispatched, errors });
});
