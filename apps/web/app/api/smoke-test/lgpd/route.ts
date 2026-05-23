/**
 * Smoke test de LGPD (M13#3).
 *
 * Valida o que é testável sem browser nem banco: helpers de retenção, o mapa
 * de rótulos da auditoria e os transforms. A UI de exportação/exclusão de
 * lead, o viewer de auditoria e o banner de cookies são validados manualmente
 * / no E2E (M13#5).
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/lgpd` → JSON. HTTP 200 se
 * `failed === 0`, 500 caso contrário.
 */
import { NextResponse } from 'next/server';

import {
  ALL_AUDIT_ACTIONS,
  AUDIT_ACTION_GROUPS,
  AUDIT_ACTION_LABELS,
  auditActionLabel,
} from '@/features/audit/labels';
import { summarizeChanges, toAuditLogUI } from '@/features/audit/transforms';
import {
  AUDIT_RETENTION_MONTHS,
  NOTIFICATION_RETENTION_DAYS,
  computeAuditCutoff,
  computeNotificationCutoff,
} from '@/lib/lgpd/retention';

interface CheckResult {
  group: string;
  name: string;
  ok: boolean;
  detail?: string;
}

function run(group: string, results: CheckResult[]) {
  return (name: string, fn: () => boolean | string) => {
    try {
      const r = fn();
      if (r === true) results.push({ group, name, ok: true });
      else
        results.push({
          group,
          name,
          ok: false,
          detail: typeof r === 'string' ? r : 'returned false',
        });
    } catch (err) {
      results.push({ group, name, ok: false, detail: (err as Error).message });
    }
  };
}

export const dynamic = 'force-dynamic';

export function GET() {
  const results: CheckResult[] = [];

  // ── retenção ────────────────────────────────────────────────────────────
  let t = run('retention-m13-3', results);
  t('AUDIT_RETENTION_MONTHS === 12', () => AUDIT_RETENTION_MONTHS === 12);
  t('NOTIFICATION_RETENTION_DAYS === 30', () => NOTIFICATION_RETENTION_DAYS === 30);
  t('computeAuditCutoff recua 12 meses', () => {
    const now = new Date('2026-05-20T12:00:00.000Z');
    const cutoff = computeAuditCutoff(now);
    return (
      cutoff.toISOString() === '2025-05-20T12:00:00.000Z' ||
      `esperava 2025-05-20, obteve ${cutoff.toISOString()}`
    );
  });
  t('computeNotificationCutoff recua 30 dias', () => {
    const now = new Date('2026-05-20T12:00:00.000Z');
    const cutoff = computeNotificationCutoff(now);
    return (
      cutoff.toISOString() === '2026-04-20T12:00:00.000Z' ||
      `esperava 2026-04-20, obteve ${cutoff.toISOString()}`
    );
  });
  t('cutoffs ficam no passado', () => {
    const now = new Date();
    return computeAuditCutoff(now) < now && computeNotificationCutoff(now) < now;
  });

  // ── rótulos de auditoria ────────────────────────────────────────────────
  t = run('audit-labels-m13-3', results);
  t('56 ações conhecidas (sincronizado com o enum audit_action)', () => {
    return (
      ALL_AUDIT_ACTIONS.length === 56 ||
      `enum audit_action mudou — ${ALL_AUDIT_ACTIONS.length} ações; atualize labels.ts`
    );
  });
  t('toda ação dos grupos tem rótulo', () => {
    const missing = ALL_AUDIT_ACTIONS.filter((a) => !AUDIT_ACTION_LABELS[a]);
    return missing.length === 0 || `sem rótulo: ${missing.join(', ')}`;
  });
  t('todo rótulo corresponde a uma ação conhecida', () => {
    const orphans = Object.keys(AUDIT_ACTION_LABELS).filter((k) => !ALL_AUDIT_ACTIONS.includes(k));
    return orphans.length === 0 || `rótulo órfão: ${orphans.join(', ')}`;
  });
  t('nenhuma ação duplicada entre grupos', () => {
    const seen = new Set<string>();
    for (const g of AUDIT_ACTION_GROUPS) {
      for (const a of g.actions) {
        if (seen.has(a)) return `duplicada: ${a}`;
        seen.add(a);
      }
    }
    return true;
  });
  t(
    'auditActionLabel traduz ação conhecida',
    () => auditActionLabel('lead_created') === 'Lead criado',
  );
  t('auditActionLabel faz fallback pra chave desconhecida', () => {
    return auditActionLabel('acao_inexistente_xyz') === 'acao_inexistente_xyz';
  });

  // ── transforms ──────────────────────────────────────────────────────────
  t = run('audit-transforms-m13-3', results);
  t('summarizeChanges(null) === null', () => summarizeChanges(null) === null);
  t('summarizeChanges({}) === null', () => summarizeChanges({}) === null);
  t('summarizeChanges serializa objeto', () => {
    const s = summarizeChanges({ scope: 'lgpd_erasure' });
    return (typeof s === 'string' && s.includes('scope')) || `obteve ${String(s)}`;
  });
  t('summarizeChanges trunca payload longo', () => {
    const big = { note: 'x'.repeat(500) };
    const s = summarizeChanges(big);
    return (
      (typeof s === 'string' && s.endsWith('…') && s.length <= 121) || `len ${String(s?.length)}`
    );
  });
  t('toAuditLogUI mapeia row + autor', () => {
    const ui = toAuditLogUI({
      id: 'a1',
      action: 'data_deleted',
      entityType: 'lead',
      entityId: 'lead-123',
      ipAddress: '200.1.2.3',
      changes: { scope: 'lgpd_erasure' },
      createdAt: new Date('2026-05-20T10:00:00.000Z'),
      user: { name: 'Ana Vendas', email: 'ana@empresa.com' },
    });
    return (
      (ui.actionLabel === 'Exclusão de dados (LGPD)' &&
        ui.actorName === 'Ana Vendas' &&
        ui.createdAt === '2026-05-20T10:00:00.000Z') ||
      `obteve ${JSON.stringify(ui)}`
    );
  });
  t('toAuditLogUI trata evento de sistema (sem autor)', () => {
    const ui = toAuditLogUI({
      id: 'a2',
      action: 'cadence_step_sent',
      entityType: null,
      entityId: null,
      ipAddress: null,
      changes: null,
      createdAt: new Date('2026-05-20T10:00:00.000Z'),
      user: null,
    });
    return ui.actorName === null && ui.actorEmail === null && ui.changesSummary === null;
  });

  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const failed = total - passed;
  return NextResponse.json(
    { summary: { total, passed, failed, allOk: failed === 0 }, results },
    { status: failed === 0 ? 200 : 500 },
  );
}
