/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// Runtime: Deno. ESLint do Node aqui é off porque os imports/globais
// (`Deno`, `https://esm.sh/...`) só existem no edge runtime — não há `package.json`
// nessa pasta. Os `@ts-ignore` viram silenciamentos efetivos só no Deno deploy.
// deno-lint-ignore-file no-explicit-any
/**
 * Edge Function `whatsapp-heartbeat` (M9#5).
 *
 * Invocada a cada 1 minuto via `pg_cron` + `pg_net` (vide migration
 * `20260520120000_m9_5_heartbeat_cron.sql`). Itera `whatsapp_instances` com
 * `status='connected'`, chama uazapi `getInstanceStatus` em cada uma, e
 * atualiza:
 *   - `health_score` segundo `computeNextHealth(currentHealth, success)`
 *   - `last_seen_at = now()` quando sucesso
 *   - Insere `whatsapp_events type='heartbeat_ok'|'heartbeat_fail'`
 *
 * **Por que Edge Function (Deno) e não Next route:** heartbeat precisa de
 * janela 60s (PRD §6 / CLAUDE.md §6); GitHub Actions cron mínimo é 5min e
 * Vercel Cron 60s no Pro inclui mas trata o webhook como request HTTP normal,
 * o que aumenta cold-start em workloads bursty. Edge Function + pg_cron roda
 * dentro do próprio Supabase, ~30ms cold-start, sem depender da Vercel.
 *
 * **Autenticação:** header `x-heartbeat-secret` validado contra o env
 * `HEARTBEAT_SECRET` da Edge Function. A função SQL `invoke_whatsapp_heartbeat`
 * lê o mesmo valor de `current_setting('app.heartbeat_secret')` (operador
 * configura via `ALTER DATABASE postgres SET app.heartbeat_secret = '...'`).
 * **timingSafeEqual** evita timing attacks.
 *
 * **Push/email em queda de saúde fica pra M10** — heartbeat M9#5 só persiste
 * o estado; cadência (M10) consulta `health_score != 'healthy'` antes de
 * disparar mensagens e envia push pro vendedor responsável quando degrada.
 *
 * **Memória `dev-local-windows-antivirus-tls`:** deploy via MCP
 * `deploy_edge_function` — CLI `supabase functions deploy` quebra TLS na
 * minha máquina.
 *
 * Cópia inline de `computeNextHealth` mantida em sync com
 * `apps/web/lib/whatsapp/heartbeat-helpers.ts` — Edge é Deno e não pode
 * importar do app Next. Smoke valida a fonte canônica.
 */

// @ts-ignore — Deno-only import; resolvido em runtime na Edge Function.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

type HealthScore = 'healthy' | 'degraded' | 'unhealthy';

function computeNextHealth(currentHealth: HealthScore, success: boolean): HealthScore {
  if (success) return 'healthy';
  if (currentHealth === 'healthy') return 'degraded';
  if (currentHealth === 'degraded') return 'unhealthy';
  return 'unhealthy';
}

const UAZAPI_TIMEOUT_MS = 5_000;

interface InstanceRow {
  id: string;
  workspace_id: string;
  account_id: string;
  external_instance_id: string;
  health_score: HealthScore;
  status: string;
}

interface CheckOutcome {
  instance_id: string;
  workspace_id: string;
  success: boolean;
  previous: HealthScore;
  next: HealthScore;
  error?: string;
  phone_number?: string;
}

async function fetchUazapiStatus(
  baseUrl: string,
  apiKey: string,
  externalInstanceId: string,
): Promise<{ ok: true; status: string; phone_number?: string } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UAZAPI_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, '')}/instance/${encodeURIComponent(externalInstanceId)}/status`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const payload = await res.json();
    return {
      ok: true,
      status: payload?.data?.status ?? payload?.status ?? 'unknown',
      phone_number: payload?.data?.phone_number ?? payload?.phone_number,
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      return { ok: false, error: 'timeout' };
    }
    return { ok: false, error: String(err?.message ?? err) };
  }
}

// Deno runtime entrypoint
// @ts-ignore — `Deno` global só existe em runtime
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Auth: header `x-heartbeat-secret` contra env `HEARTBEAT_SECRET`.
  // @ts-ignore Deno.env
  const expected = Deno.env.get('HEARTBEAT_SECRET') ?? '';
  const provided = req.headers.get('x-heartbeat-secret') ?? '';
  if (!expected || !provided || provided !== expected) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // @ts-ignore Deno.env
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  // @ts-ignore Deno.env
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  // @ts-ignore Deno.env
  const uazapiBaseUrl = Deno.env.get('UAZAPI_BASE_URL') ?? '';
  // @ts-ignore Deno.env
  const uazapiApiKey = Deno.env.get('UAZAPI_API_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ ok: false, error: 'supabase env missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Lista instances connected — cross-tenant (service role bypassa RLS).
  // Defense-in-depth: select estreito + filter explícito por status.
  const { data: instances, error: listErr } = await admin
    .from('whatsapp_instances')
    .select('id, workspace_id, account_id, external_instance_id, health_score, status')
    .eq('status', 'connected')
    .not('external_instance_id', 'is', null);

  if (listErr) {
    return new Response(JSON.stringify({ ok: false, error: listErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const outcomes: CheckOutcome[] = [];

  // Se uazapi env faltando, ainda registra evento mas marca tudo como erro.
  // Permite ver no log que o heartbeat rodou mas o provedor está
  // desconfigurado — vendedor sabe que precisa setar secrets.
  const canCallProvider = Boolean(uazapiBaseUrl && uazapiApiKey);

  for (const row of (instances as InstanceRow[] | null) ?? []) {
    const previous = row.health_score;
    let success = false;
    let phoneNumber: string | undefined;
    let errorMsg: string | undefined;

    if (canCallProvider) {
      const result = await fetchUazapiStatus(uazapiBaseUrl, uazapiApiKey, row.external_instance_id);
      if (result.ok && (result.status === 'connected' || result.status === 'online')) {
        success = true;
        phoneNumber = result.phone_number;
      } else if (result.ok) {
        success = false;
        errorMsg = `provider status=${result.status}`;
      } else {
        success = false;
        errorMsg = result.error;
      }
    } else {
      success = false;
      errorMsg = 'uazapi env missing';
    }

    const next = computeNextHealth(previous, success);
    outcomes.push({
      instance_id: row.id,
      workspace_id: row.workspace_id,
      success,
      previous,
      next,
      error: errorMsg,
      phone_number: phoneNumber,
    });

    // Update instance: health_score sempre; last_seen_at só em sucesso.
    const update: Record<string, unknown> = { health_score: next };
    if (success) update.last_seen_at = new Date().toISOString();

    const { error: upErr } = await admin.from('whatsapp_instances').update(update).eq('id', row.id);

    if (upErr) {
      // log e segue — não bloqueia outras instances
      console.error(`heartbeat update ${row.id}: ${upErr.message}`);
      continue;
    }

    // Insert WhatsappEvent (append-only).
    await admin.from('whatsapp_events').insert({
      workspace_id: row.workspace_id,
      instance_id: row.id,
      type: success ? 'heartbeat_ok' : 'heartbeat_fail',
      payload: {
        previous,
        next,
        error: errorMsg ?? null,
        phone_number: phoneNumber ?? null,
        source: 'edge_function',
      },
    });
  }

  const summary = {
    checked: outcomes.length,
    healthy: outcomes.filter((o) => o.next === 'healthy').length,
    degraded: outcomes.filter((o) => o.next === 'degraded').length,
    unhealthy: outcomes.filter((o) => o.next === 'unhealthy').length,
    errors: outcomes.filter((o) => !o.success).length,
  };

  return new Response(JSON.stringify({ ok: true, summary, outcomes }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
