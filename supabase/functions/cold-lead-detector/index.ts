/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// Runtime: Deno. ESLint do Node aqui é off porque os imports/globais
// (`Deno`, `https://esm.sh/...`) só existem no edge runtime — não há `package.json`
// nessa pasta. Os `@ts-ignore` viram silenciamentos efetivos só no Deno deploy.
// deno-lint-ignore-file no-explicit-any
/**
 * Edge Function `cold-lead-detector` (M10#4).
 *
 * Invocada a cada hora via `pg_cron` + `pg_net` (vide migration
 * `20260524120000_m10_4_cold_lead_detector.sql`). Pra cada lead que ultrapassou
 * o threshold de inatividade (RPC `cold_lead_detect_candidates`):
 *  1. INSERT em `cold_lead_alerts (workspace_id, lead_id, threshold_id)` ON
 *     CONFLICT DO NOTHING — UNIQUE M10#1 garante 1 alert por (lead, threshold)
 *  2. UPDATE `leads SET temperature='cold', cold_alerted_at=NOW()` pros leads
 *     que tiveram alert inserido (pra evitar re-alertar no próximo tick)
 *  3. INSERT em `audit_logs (action='cold_lead_alerted', entity=lead)`
 *
 * **Sem dispatch externo** (diferente do cadence-runner): o "envio" do alert
 * acontece in-app via query `listActiveColdAlerts` + badge sidebar +
 * NotificationsButton drawer. Push real adiado pra M13 (decisão fechada
 * M10#4).
 *
 * **Auto-ack quando lead responde ou muda de etapa** acontece via triggers
 * Postgres (`pause_cadence_on_inbound` estendido + `auto_ack_cold_on_stage_change`
 * novo) — não é responsabilidade desta Edge Function.
 *
 * **Autenticação:** header `x-cold-lead-detector-secret` validado contra env
 * `COLD_LEAD_DETECTOR_SECRET`. A função SQL `invoke_cold_lead_detector` lê o
 * mesmo valor de `current_setting('app.cold_lead_detector_secret')`.
 *
 * **Memória `dev-local-windows-antivirus-tls`:** deploy via MCP
 * `deploy_edge_function` — CLI `supabase functions deploy` quebra TLS na
 * minha máquina.
 */

// @ts-ignore — Deno-only import; resolvido em runtime na Edge Function.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const BATCH_LIMIT = 500;
const INSERT_CONCURRENCY = 10;

interface Candidate {
  workspace_id: string;
  lead_id: string;
  stage_id: string;
  threshold_id: string;
  days_inactive: number;
  idle_since: string;
}

interface ProcessedAlert extends Candidate {
  /** `true` quando este tick inseriu o alert (gera audit log); `false`
   *  significa que o alert já existia (23505) e estamos só fazendo catch-up
   *  do `leads.temperature` que pode ter ficado warm se tick anterior
   *  crashou entre o INSERT do alert e o UPDATE do lead. Audit não duplica. */
  isNew: boolean;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Comparação constant-time entre strings curtas (secrets de header) usando
 * `crypto.subtle.timingSafeEqual` está disponível no Deno mas a API é
 * verbosa pra Uint8Array. Reimplementação manual XOR + acumulador atinge o
 * mesmo objetivo (tempo independente de quantos bytes batem) sem deps.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Deno runtime entrypoint
// @ts-ignore — `Deno` global só existe em runtime
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // @ts-ignore Deno.env
  const expected = Deno.env.get('COLD_LEAD_DETECTOR_SECRET') ?? '';
  const provided = req.headers.get('x-cold-lead-detector-secret') ?? '';
  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  // @ts-ignore Deno.env
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  // @ts-ignore Deno.env
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: 'supabase env missing' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ─── 1. Seleciona candidatos via RPC (cross-tenant, Service Role) ────────
  const { data: candidates, error: pickErr } = await admin.rpc('cold_lead_detect_candidates', {
    p_limit: BATCH_LIMIT,
  });

  if (pickErr) {
    return json({ ok: false, error: `detect_candidates: ${pickErr.message}` }, 500);
  }

  const picked = (candidates as Candidate[] | null) ?? [];

  // Saturation warning: RPC LIMIT 500 → workspace gigante pode ter mais
  // candidatos não processados nesse tick. Hourly schedule resolve no
  // próximo ciclo, mas observabilidade precisa pegar isso.
  if (picked.length === BATCH_LIMIT) {
    console.warn(
      `cold-lead-detector: BATCH_LIMIT (${BATCH_LIMIT}) saturado — possíveis candidatos não processados neste tick`,
    );
  }

  // ─── 2. Insert idempotente em cold_lead_alerts ───────────────────────────
  // UNIQUE (lead_id, threshold_id) do M10#1 garante 1 alert por dupla. Se o
  // alert já existir (23505), AINDA propagamos via `caughtUp` pra que o
  // UPDATE leads (etapa 3) rode — defende contra loop quando tick anterior
  // crashou entre INSERT do alert e UPDATE do lead, deixando temperature='warm'
  // + cold_alerted_at=NULL e RPC re-detectando o mesmo lead toda hora.
  //
  // Concorrência cap=10 — INSERTs leves, sem fanout externo.
  const processed: ProcessedAlert[] = [];
  const errors: Array<{ lead_id: string; error: string }> = [];

  for (let i = 0; i < picked.length; i += INSERT_CONCURRENCY) {
    const batch = picked.slice(i, i + INSERT_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (c): Promise<ProcessedAlert | null> => {
        const { data: row, error: insErr } = await admin
          .from('cold_lead_alerts')
          .insert({
            workspace_id: c.workspace_id,
            lead_id: c.lead_id,
            threshold_id: c.threshold_id,
          })
          .select('id')
          .maybeSingle();

        if (insErr) {
          const code = (insErr as any).code;
          if (code === '23505') {
            // Alert existia. NÃO conta como novo (sem audit log duplicado),
            // mas ainda inclui no catch-up pra UPDATE leads (idempotency).
            return { ...c, isNew: false };
          }
          throw new Error(insErr.message);
        }
        return row?.id ? { ...c, isNew: true } : null;
      }),
    );

    results.forEach((r, idx) => {
      const c = batch[idx];
      if (!c) return;
      if (r.status === 'fulfilled' && r.value) {
        processed.push(r.value);
      } else if (r.status === 'rejected') {
        errors.push({
          lead_id: c.lead_id,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    });
  }

  // ─── 3. UPDATE leads (catch-up incluso) + audit só pros NEW ──────────────
  // Defense-in-depth (CLAUDE.md §7.2): mesmo Service Role bypassando RLS,
  // filtramos workspace_id explicitamente — agrupamos por workspace e
  // emitimos 1 UPDATE per tenant.
  const newAlerts = processed.filter((p) => p.isNew);

  if (processed.length > 0) {
    const nowIso = new Date().toISOString();

    // Agrupa leads por workspace pra UPDATE com workspace_id filter.
    const leadsByWorkspace = new Map<string, string[]>();
    for (const p of processed) {
      const arr = leadsByWorkspace.get(p.workspace_id) ?? [];
      arr.push(p.lead_id);
      leadsByWorkspace.set(p.workspace_id, arr);
    }

    for (const [wid, leadIds] of leadsByWorkspace.entries()) {
      const { error: updErr } = await admin
        .from('leads')
        .update({ temperature: 'cold', cold_alerted_at: nowIso })
        .in('id', leadIds)
        .eq('workspace_id', wid);

      if (updErr) {
        console.error(`update leads temperature (ws=${wid}): ${updErr.message}`);
        // Próximo tick re-tenta via catch-up. Defense-in-depth.
      }
    }
  }

  // Audit logs SÓ pros realmente novos. Catch-up de 23505 não gera audit
  // duplicado.
  if (newAlerts.length > 0) {
    const auditRows = newAlerts.map((c) => ({
      workspace_id: c.workspace_id,
      user_id: null,
      action: 'cold_lead_alerted',
      entity_type: 'lead',
      entity_id: c.lead_id,
      changes: {
        threshold_id: c.threshold_id,
        days_inactive: c.days_inactive,
        idle_since: c.idle_since,
      },
    }));

    const { error: auditErr } = await admin.from('audit_logs').insert(auditRows);

    if (auditErr) {
      console.error(`insert audit_logs: ${auditErr.message}`);
    }
  }

  const summary = {
    scanned: picked.length,
    alertedNew: newAlerts.length,
    caughtUp: processed.length - newAlerts.length,
    errors: errors.length,
  };

  return json({ ok: true, summary, errors });
});
