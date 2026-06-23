/**
 * Smoke test do Dashboard — valida as funções puras que alimentam a tela
 * `/dashboard` (KPIs com filtro de range + trends, donut Origem, funil
 * horizontal, hot leads, trend chart 30d, atividade recente, tabela).
 *
 * Existe pra dar confiança nas fórmulas antes de Vitest entrar em M7+,
 * e pra fixar contratos que vão virar Server Action em M8 (mesmas funções
 * puras consumidas, só muda a fonte dos dados — fixture → Postgres).
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/dashboard` →
 * `{summary, results}` JSON. HTTP 200 se `failed === 0`, 500 caso contrário.
 */
import { NextResponse } from 'next/server';

import { computeRangeBounds, DASHBOARD_NOW, parseDashboardRange } from '@/features/dashboard/range';
import {
  buildHorizontalFunnelData,
  buildOriginData,
  buildTrendData,
  computeDashboardKpis,
  computeTrend,
  getHotLeads,
  getRecentActivity,
  getUpcomingDeals,
} from '@/features/dashboard/transforms';
import { sumOpenPipelineCents } from '@/features/deals/transforms';
import { blockSmokeInProd } from '@/lib/dev/smoke-guard';
import { FAKE_DEALS } from '@/lib/fixtures/deals';
import { FAKE_LEADS } from '@/lib/fixtures/leads';
import { DEFAULT_STAGES } from '@/lib/fixtures/pipelines';
import { FAKE_TASKS } from '@/lib/fixtures/tasks';

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
  const blocked = blockSmokeInProd();
  if (blocked) return blocked;

  const results: CheckResult[] = [];

  // Range padrão pra cálculos legados — `month` cobre toda a janela das fixtures
  // sem ficar muito permissivo (`all` zeraria o trend).
  const monthBounds = computeRangeBounds('month', DASHBOARD_NOW);

  // ── Range bounds ────────────────────────────────────────────────────────
  let t = run('transforms-range', results);
  t('today: start === end no mesmo dia', () => {
    const b = computeRangeBounds('today', DASHBOARD_NOW);
    return (
      b.start.toDateString() === DASHBOARD_NOW.toDateString() &&
      b.end.toDateString() === DASHBOARD_NOW.toDateString()
    );
  });
  t('today tem previousStart/previousEnd em D-1', () => {
    const b = computeRangeBounds('today', DASHBOARD_NOW);
    return (
      !!b.previousStart &&
      !!b.previousEnd &&
      b.previousStart.getTime() < b.start.getTime() &&
      b.previousEnd.getTime() < b.end.getTime()
    );
  });
  t('week começa segunda-feira (weekStartsOn=1, locale pt-BR)', () => {
    const b = computeRangeBounds('week', DASHBOARD_NOW);
    return b.start.getDay() === 1 || `start.getDay()=${b.start.getDay()}`;
  });
  t('week tem previousStart 7 dias antes', () => {
    const b = computeRangeBounds('week', DASHBOARD_NOW);
    if (!b.previousStart) return 'previousStart undefined';
    const diffDays = Math.round((b.start.getTime() - b.previousStart.getTime()) / 86_400_000);
    return diffDays === 7 || `diffDays=${diffDays}`;
  });
  t('month: start é dia 1', () => {
    const b = computeRangeBounds('month', DASHBOARD_NOW);
    return b.start.getDate() === 1;
  });
  t('month: previousEnd cai antes de start', () => {
    const b = computeRangeBounds('month', DASHBOARD_NOW);
    return !!b.previousEnd && b.previousEnd.getTime() < b.start.getTime();
  });
  t('all: previousStart/previousEnd undefined (sem janela anterior)', () => {
    const b = computeRangeBounds('all', DASHBOARD_NOW);
    return b.previousStart === undefined && b.previousEnd === undefined;
  });
  t('custom com from/to gera range correto + previous simétrico', () => {
    const from = new Date('2026-05-01T00:00:00-03:00');
    const to = new Date('2026-05-07T23:59:59-03:00');
    const b = computeRangeBounds('custom', DASHBOARD_NOW, { start: from, end: to });
    return !!b.previousStart && !!b.previousEnd && b.label.includes('mai');
  });
  t('custom sem from/to cai no fallback "today"', () => {
    const b = computeRangeBounds('custom', DASHBOARD_NOW);
    return b.range === 'today';
  });
  t('parseDashboardRange aceita válidos e cai em "week" no resto (review M5p#2)', () => {
    return (
      parseDashboardRange('today') === 'today' &&
      parseDashboardRange('week') === 'week' &&
      parseDashboardRange('month') === 'month' &&
      parseDashboardRange('all') === 'all' &&
      parseDashboardRange('custom') === 'custom' &&
      parseDashboardRange('xxx') === 'week' &&
      parseDashboardRange(null) === 'week' &&
      parseDashboardRange(undefined) === 'week' &&
      parseDashboardRange('') === 'week'
    );
  });

  // ── Trend ───────────────────────────────────────────────────────────────
  t = run('transforms-trend', results);
  t('current > previous → up', () => {
    const r = computeTrend(100, 80);
    return r.direction === 'up' && r.pct === 25;
  });
  t('current < previous → down', () => {
    const r = computeTrend(80, 100);
    return r.direction === 'down' && r.pct === -20;
  });
  t('current === previous → flat', () => {
    const r = computeTrend(50, 50);
    return r.direction === 'flat' && r.pct === 0;
  });
  t('previous === 0 e current > 0 → up 100 (cap, sem Infinity)', () => {
    const r = computeTrend(50, 0);
    return r.direction === 'up' && r.pct === 100;
  });
  t('previous === 0 e current === 0 → flat 0', () => {
    const r = computeTrend(0, 0);
    return r.direction === 'flat' && r.pct === 0;
  });
  t('previous undefined → flat 0', () => {
    const r = computeTrend(50, undefined);
    return r.direction === 'flat' && r.pct === 0;
  });
  t('|pct| <= 1 → flat 0 (variação irrelevante absorvida)', () => {
    const r = computeTrend(101, 100);
    return r.direction === 'flat';
  });
  t('boundary: pct === 2 → up (não cai em flat — fixa contrato pra refator)', () => {
    const r = computeTrend(102, 100);
    return r.direction === 'up' && r.pct === 2;
  });

  // ── KPIs com range + trends ─────────────────────────────────────────────
  const kpis = computeDashboardKpis(FAKE_LEADS, FAKE_DEALS, FAKE_TASKS, monthBounds);
  t = run('transforms-kpis', results);

  t('newLeadsCount conta leads com createdAt no range', () => {
    const expected = FAKE_LEADS.filter((l) => {
      const d = new Date(l.createdAt);
      return d >= monthBounds.start && d <= monthBounds.end;
    }).length;
    return kpis.newLeadsCount === expected || `got ${kpis.newLeadsCount}, esperado ${expected}`;
  });
  t('pendingTasksCount conta só status=pending', () => {
    const expected = FAKE_TASKS.filter((task) => task.status === 'pending').length;
    return kpis.pendingTasksCount === expected;
  });
  t('openPipelineCents reusa sumOpenPipelineCents (fonte canônica)', () => {
    return kpis.openPipelineCents === sumOpenPipelineCents(FAKE_DEALS);
  });
  t('proposalsCents soma só deals abertos em proposta', () => {
    const expected = FAKE_DEALS.filter(
      (d) => d.status === 'open' && d.stageId === 'proposta',
    ).reduce((sum, d) => sum + d.valueCents, 0);
    return kpis.proposalsCents === expected;
  });
  t('conversionRatePct é inteiro em [0,100]', () => {
    return (
      Number.isInteger(kpis.conversionRatePct) &&
      kpis.conversionRatePct >= 0 &&
      kpis.conversionRatePct <= 100
    );
  });
  t('wonInRange + lostInRange === closedInRange (identidade)', () => {
    return kpis.wonInRange + kpis.lostInRange === kpis.closedInRange;
  });
  t('hotLeadsCount conta só temperature=hot', () => {
    return kpis.hotLeadsCount === FAKE_LEADS.filter((l) => l.temperature === 'hot').length;
  });
  t('newLeadsTrend tem shape válido', () => {
    return (
      ['up', 'down', 'flat'].includes(kpis.newLeadsTrend.direction) &&
      Number.isInteger(kpis.newLeadsTrend.pct)
    );
  });
  t('range=all → previousNewLeadsCount undefined', () => {
    const allBounds = computeRangeBounds('all', DASHBOARD_NOW);
    const k = computeDashboardKpis(FAKE_LEADS, FAKE_DEALS, FAKE_TASKS, allBounds);
    return k.previousNewLeadsCount === undefined && k.newLeadsTrend.direction === 'flat';
  });
  t('workspaces vazios não geram NaN', () => {
    const empty = computeDashboardKpis([], [], [], monthBounds);
    return empty.conversionRatePct === 0 && empty.openPipelineCents === 0;
  });

  // ── Origem (donut) ──────────────────────────────────────────────────────
  const allBounds = computeRangeBounds('all', DASHBOARD_NOW);
  const origin = buildOriginData(FAKE_LEADS, allBounds);
  t = run('transforms-origin', results);

  t('retorna 5 buckets (paid, whatsapp, referral, site, other)', () => {
    const buckets = origin.map((o) => o.bucket).sort();
    return (
      JSON.stringify(buckets) === JSON.stringify(['other', 'paid', 'referral', 'site', 'whatsapp'])
    );
  });
  t('soma de pcts === 100 (correção de arredondamento aplicada)', () => {
    const sum = origin.reduce((acc, o) => acc + o.pct, 0);
    return sum === 100 || `sum=${sum}`;
  });
  t('paid agrupa meta_ads + google_ads', () => {
    const paid = origin.find((o) => o.bucket === 'paid');
    return !!paid && paid.origins.includes('meta_ads') && paid.origins.includes('google_ads');
  });
  t('whatsapp tem só whatsapp_inbound', () => {
    const wa = origin.find((o) => o.bucket === 'whatsapp');
    return !!wa && wa.origins.length === 1 && wa.origins[0] === 'whatsapp_inbound';
  });
  t('counts somam total de leads no range', () => {
    const sum = origin.reduce((acc, o) => acc + o.count, 0);
    return sum === FAKE_LEADS.length;
  });
  t('com leads vazios, todos buckets ficam 0', () => {
    const empty = buildOriginData([], allBounds);
    return empty.every((o) => o.count === 0 && o.pct === 0);
  });
  t('todo bucket tem fill = hsl(var(--token))', () => {
    return origin.every((o) => o.fill.startsWith('hsl(var(--'));
  });
  t('lead com origin desconhecida cai em "other" (defesa pra origens novas)', () => {
    const baseLead = FAKE_LEADS[0]!;
    // Cast pra `Lead` propositalmente — o objetivo do assert é testar o
    // comportamento defensivo do transform quando uma origem nova (ex:
    // `tiktok_ads` em M8+) aparecer antes do mapa `BUCKET_OF_ORIGIN`
    // ser estendido.
    const unknownLead = { ...baseLead, id: 'lead_unknown_origin', origin: 'tiktok_ads' as never };
    const fakeLeads = [...FAKE_LEADS, unknownLead];
    const result = buildOriginData(fakeLeads, allBounds);
    const other = result.find((o) => o.bucket === 'other');
    return !!other && other.count >= 1;
  });

  // ── Funil horizontal ───────────────────────────────────────────────────
  const funnelH = buildHorizontalFunnelData(FAKE_DEALS);
  t = run('transforms-funnel-h', results);

  t('inclui TODAS as 6 etapas (4 ativas + ganho + perdido)', () => {
    return funnelH.length === DEFAULT_STAGES.length || `got ${funnelH.length}`;
  });
  t('mantém ordem natural do pipeline (não sort por count)', () => {
    const stageOrder = DEFAULT_STAGES.map((s) => s.id);
    const funnelOrder = funnelH.map((f) => f.stageId);
    return JSON.stringify(funnelOrder) === JSON.stringify(stageOrder);
  });
  t('etapa "ganho" conta deals com status=won', () => {
    const ganho = funnelH.find((f) => f.stageId === 'ganho');
    const expected = FAKE_DEALS.filter((d) => d.status === 'won').length;
    return !!ganho && ganho.count === expected;
  });
  t('etapa "perdido" conta deals com status=lost', () => {
    const perdido = funnelH.find((f) => f.stageId === 'perdido');
    const expected = FAKE_DEALS.filter((d) => d.status === 'lost').length;
    return !!perdido && perdido.count === expected;
  });
  t('etapas ativas contam só deals abertos no estágio', () => {
    for (const stage of DEFAULT_STAGES.filter((s) => !s.terminal)) {
      const row = funnelH.find((f) => f.stageId === stage.id);
      const expected = FAKE_DEALS.filter(
        (d) => d.status === 'open' && d.stageId === stage.id,
      ).length;
      if (!row || row.count !== expected)
        return `${stage.id}: got ${row?.count}, esperado ${expected}`;
    }
    return true;
  });
  t('toda etapa tem barClass tailwind definida', () => {
    return funnelH.every((f) => f.barClass.startsWith('bg-'));
  });
  t('terminalTone preservado pra ganho (success) e perdido (destructive)', () => {
    const ganho = funnelH.find((f) => f.stageId === 'ganho');
    const perdido = funnelH.find((f) => f.stageId === 'perdido');
    return ganho?.terminalTone === 'success' && perdido?.terminalTone === 'destructive';
  });

  // ── Hot leads ───────────────────────────────────────────────────────────
  const hot = getHotLeads(FAKE_LEADS);
  t = run('transforms-hot-leads', results);

  t('só leads com temperature=hot', () => {
    const hotIds = new Set(FAKE_LEADS.filter((l) => l.temperature === 'hot').map((l) => l.id));
    return hot.every((h) => hotIds.has(h.id));
  });
  t('respeita limit (default 10)', () => hot.length <= 10);
  t('ordenado desc por lastTouchedAt', () => {
    for (let i = 1; i < hot.length; i++) {
      const prev = hot[i - 1];
      const curr = hot[i];
      if (!prev || !curr) continue;
      if (prev.lastTouchedAt.localeCompare(curr.lastTouchedAt) < 0)
        return `desordem em [${i - 1},${i}]`;
    }
    return true;
  });
  t('limit configurável (limit=2 retorna ≤ 2)', () => getHotLeads(FAKE_LEADS, 2).length <= 2);
  t('com lista vazia retorna []', () => getHotLeads([]).length === 0);

  // ── Tabela "Próximos do prazo" ─────────────────────────────────────────
  const upcoming = getUpcomingDeals(FAKE_DEALS, FAKE_LEADS, 8);
  t = run('upcoming', results);

  t('respeita o limite (length <= 8)', () => upcoming.length <= 8 || `got ${upcoming.length}`);
  t('só status=open (sem won/lost)', () => upcoming.every((row) => row.deal.status === 'open'));
  t('todos têm dueAt definido (pré-condição)', () =>
    upcoming.every((row) => typeof row.deal.dueAt === 'string'),
  );
  t('ordenado asc por dueAt (atrasados primeiro)', () => {
    for (let i = 1; i < upcoming.length; i++) {
      const prev = upcoming[i - 1];
      const curr = upcoming[i];
      if (!prev || !curr) continue;
      if (prev.deal.dueAt!.localeCompare(curr.deal.dueAt!) > 0)
        return `desordem em [${i - 1},${i}]`;
    }
    return true;
  });
  t('lead populado pra todos (lookup deal→lead OK)', () => upcoming.every((row) => !!row.lead));
  t('limit configurável (limit=3 retorna 3)', () => {
    const top3 = getUpcomingDeals(FAKE_DEALS, FAKE_LEADS, 3);
    return top3.length === 3;
  });
  t('com lista vazia retorna [] (não quebra)', () => getUpcomingDeals([], [], 8).length === 0);

  // ── Trend data (LineChart 30 dias) ──────────────────────────────────────
  const trend = buildTrendData(FAKE_DEALS);
  t = run('trend', results);

  t('data.length === 30 (default 30 dias)', () => trend.length === 30 || `got ${trend.length}`);
  t('cada ponto tem date no formato yyyy-MM-dd', () =>
    trend.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date)),
  );
  t('cada ponto tem label não-vazio', () =>
    trend.every((p) => typeof p.label === 'string' && p.label.length > 0),
  );
  t('created e won são inteiros >= 0', () =>
    trend.every(
      (p) => Number.isInteger(p.created) && p.created >= 0 && Number.isInteger(p.won) && p.won >= 0,
    ),
  );
  t('ordem cronológica ascendente (mais antigo → hoje)', () => {
    for (let i = 1; i < trend.length; i++) {
      const prev = trend[i - 1];
      const curr = trend[i];
      if (!prev || !curr) continue;
      if (prev.date.localeCompare(curr.date) >= 0) return `desordem em [${i - 1},${i}]`;
    }
    return true;
  });
  t('granularidade configurável (days=7 retorna 7 pontos)', () => {
    const t7 = buildTrendData(FAKE_DEALS, undefined, 7);
    return t7.length === 7;
  });
  t('com lista vazia ainda gera 30 pontos zerados (linha não pula)', () => {
    const empty = buildTrendData([]);
    return empty.length === 30 && empty.every((p) => p.created === 0 && p.won === 0);
  });
  t('contém alguma atividade nos últimos 30 dias (sanity das fixtures)', () => {
    const total = trend.reduce((acc, p) => acc + p.created + p.won, 0);
    return total > 0 || `total=${total}`;
  });

  // ── Recent activity (timeline) ──────────────────────────────────────────
  const activity = getRecentActivity(FAKE_DEALS, 6);
  t = run('activity', results);

  t('respeita o limite (length <= 6)', () => activity.length <= 6 || `got ${activity.length}`);
  t('todos os tipos são created|won|lost', () =>
    activity.every((a) => a.type === 'created' || a.type === 'won' || a.type === 'lost'),
  );
  t('ordenado por timestamp descendente (mais recentes primeiro)', () => {
    for (let i = 1; i < activity.length; i++) {
      const prev = activity[i - 1];
      const curr = activity[i];
      if (!prev || !curr) continue;
      if (prev.timestamp.localeCompare(curr.timestamp) < 0) return `desordem em [${i - 1},${i}]`;
    }
    return true;
  });
  t('todos têm dealId, dealTitle, leadId, ownerId não-vazios', () =>
    activity.every(
      (a) =>
        typeof a.dealId === 'string' &&
        a.dealId.length > 0 &&
        typeof a.dealTitle === 'string' &&
        a.dealTitle.length > 0 &&
        typeof a.leadId === 'string' &&
        a.leadId.length > 0 &&
        typeof a.ownerId === 'string' &&
        a.ownerId.length > 0,
    ),
  );
  t('limit configurável (limit=3 retorna 3)', () => getRecentActivity(FAKE_DEALS, 3).length === 3);
  t('com lista vazia retorna [] (não quebra)', () => getRecentActivity([], 6).length === 0);
  t('inclui pelo menos 1 evento de cada tipo (sanity das fixtures)', () => {
    const all = getRecentActivity(FAKE_DEALS, FAKE_DEALS.length * 2);
    const types = new Set(all.map((a) => a.type));
    return (
      (types.has('created') && types.has('won') && types.has('lost')) ||
      `tipos encontrados: ${Array.from(types).join(',')}`
    );
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const allOk = failed === 0;

  return NextResponse.json(
    {
      summary: {
        total: results.length,
        passed,
        failed,
        allOk,
        groups: Array.from(new Set(results.map((r) => r.group))).map((g) => ({
          group: g,
          passed: results.filter((r) => r.group === g && r.ok).length,
          failed: results.filter((r) => r.group === g && !r.ok).length,
        })),
      },
      results,
    },
    { status: allOk ? 200 : 500 },
  );
}
