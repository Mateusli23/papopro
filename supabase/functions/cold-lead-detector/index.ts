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

interface InsertedAlert {
  workspace_id: string;
  lead_id: string;
  threshold_id: string;
  days_inactive: number;
  idle_since: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
  if (!expected || !provided || provided !== expected) {
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

  // ─── 2. Insert idempotente em cold_lead_alerts (ON CONFLICT DO NOTHING) ──
  // UNIQUE (lead_id, threshold_id) do M10#1 garante 1 alert por dupla. Se o
  // alert já existir (re-execução do cron antes do trigger limpar), skip.
  //
  // Concorrência cap=10 — INSERTs leves, não há fanout externo. Mantém Edge
  // dentro dos limites Supabase (150s default).
  const inserted: InsertedAlert[] = [];
  const errors: Array<{ lead_id: string; error: string }> = [];

  for (let i = 0; i < picked.length; i += INSERT_CONCURRENCY) {
    const batch = picked.slice(i, i + INSERT_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (c) => {
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
          // 23505 = unique violation = alert já existia. Esperado em re-execução.
          const code = (insErr as any).code;
          if (code === '23505') return null;
          throw new Error(insErr.message);
        }
        return row?.id ? c : null;
      }),
    );

    results.forEach((r, idx) => {
      const c = batch[idx];
      if (!c) return;
      if (r.status === 'fulfilled' && r.value) {
        inserted.push(r.value);
      } else if (r.status === 'rejected') {
        errors.push({
          lead_id: c.lead_id,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    });
  }

  // ─── 3. UPDATE leads + audit_logs em batch único pros leads alertados ────
  // Defesa-em-profundidade: se algo falhar aqui, o próximo tick re-detecta os
  // mesmos leads (cold_alerted_at ainda NULL) e tenta de novo. UNIQUE garante
  // que o alert da etapa 2 não duplique.
  if (inserted.length > 0) {
    const leadIds = inserted.map((c) => c.lead_id);

    const { error: updErr } = await admin
      .from('leads')
      .update({
        temperature: 'cold',
        cold_alerted_at: new Date().toISOString(),
      })
      .in('id', leadIds);

    if (updErr) {
      console.error(`update leads temperature: ${updErr.message}`);
      // Não retorna 500 — alerts já foram inseridos. Próximo tick conserta o
      // temperature; defense-in-depth.
    }

    // Audit logs em batch — 1 row por alert. acknowledged_by_id NULL no insert
    // significa "alertado pelo sistema, ainda sem ack humano".
    const auditRows = inserted.map((c) => ({
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
      // Idem: alerts já inseridos; audit é log secundário. Não retorna 500.
    }
  }

  const summary = {
    scanned: picked.length,
    alertedNew: inserted.length,
    alreadyAlerted: picked.length - inserted.length - errors.length,
    errors: errors.length,
  };

  return json({ ok: true, summary, errors });
});
