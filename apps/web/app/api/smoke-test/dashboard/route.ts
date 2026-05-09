/**
 * Smoke test do Dashboard — valida as 3 famílias de cálculo (KPIs,
 * FunnelData, UpcomingDeals) que alimentam a tela `/dashboard`.
 *
 * Existe pra dar confiança nas fórmulas antes de Vitest entrar em M7+,
 * e pra fixar contratos que vão virar Server Action em M8 (mesmas funções
 * puras consumidas, só muda a fonte dos dados — fixture → Postgres).
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/dashboard` →
 * `{summary, results}` JSON. HTTP 200 se `failed === 0`, 500 caso contrário.
 */
import { NextResponse } from 'next/server';

import {
  buildFunnelData,
  computeDashboardKpis,
  getUpcomingDeals,
} from '@/features/dashboard/transforms';
import { sumOpenPipelineCents } from '@/features/deals/transforms';
import { FAKE_DEALS } from '@/lib/fixtures/deals';
import { FAKE_LEADS } from '@/lib/fixtures/leads';
import { ACTIVE_STAGES } from '@/lib/fixtures/pipelines';

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

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = computeDashboardKpis(FAKE_LEADS, FAKE_DEALS);
  let t = run('kpis', results);

  t(
    'totalLeads === FAKE_LEADS.length',
    () => kpis.totalLeads === FAKE_LEADS.length || `got ${kpis.totalLeads}`,
  );
  t('openDealsCount casa com filter(open)', () => {
    const expected = FAKE_DEALS.filter((d) => d.status === 'open').length;
    return kpis.openDealsCount === expected || `got ${kpis.openDealsCount}, esperado ${expected}`;
  });
  t('openPipelineCents reusa sumOpenPipelineCents (fonte canônica)', () => {
    const expected = sumOpenPipelineCents(FAKE_DEALS);
    return (
      kpis.openPipelineCents === expected || `got ${kpis.openPipelineCents}, esperado ${expected}`
    );
  });
  t('openPipelineCents > 0 (sanity — fixture tem deals abertos)', () => kpis.openPipelineCents > 0);
  t(
    '0 <= conversionRatePct <= 100 (range válido)',
    () =>
      (kpis.conversionRatePct >= 0 && kpis.conversionRatePct <= 100) ||
      `got ${kpis.conversionRatePct}`,
  );
  t('conversionRatePct é inteiro (Math.round aplicado)', () =>
    Number.isInteger(kpis.conversionRatePct),
  );
  t(
    'wonLast30d + lostLast30d === closedLast30d (identidade aritmética)',
    () => kpis.wonLast30d + kpis.lostLast30d === kpis.closedLast30d,
  );
  t(
    'hotLeadsCount conta só temperature=hot',
    () => kpis.hotLeadsCount === FAKE_LEADS.filter((l) => l.temperature === 'hot').length,
  );

  // ── Edge cases dos KPIs ─────────────────────────────────────────────────
  t = run('kpis-edge', results);
  t('workspaces vazios não geram NaN (divisão por zero defensiva)', () => {
    const empty = computeDashboardKpis([], []);
    return empty.conversionRatePct === 0 && empty.openPipelineCents === 0;
  });
  t('só leads, sem deals → openDealsCount = 0', () => {
    const k = computeDashboardKpis(FAKE_LEADS, []);
    return k.openDealsCount === 0 && k.openPipelineCents === 0;
  });

  // ── Funnel data ─────────────────────────────────────────────────────────
  const funnel = buildFunnelData(FAKE_DEALS);
  t = run('funnel', results);

  t(
    'data.length === 4 (só etapas ativas — Novo, Em contato, Proposta, Negociação)',
    () => funnel.length === 4 || `got ${funnel.length}`,
  );
  t('só inclui ACTIVE_STAGES (sem Ganho/Perdido)', () => {
    const activeIds = ACTIVE_STAGES.map((s) => s.id);
    return funnel.every((f) => activeIds.includes(f.stageId));
  });
  t('soma dos counts === total de deals abertos nas etapas ativas (invariante crítico)', () => {
    const expected = FAKE_DEALS.filter(
      (d) => d.status === 'open' && ACTIVE_STAGES.some((s) => s.id === d.stageId),
    ).length;
    const actual = funnel.reduce((acc, f) => acc + f.value, 0);
    return actual === expected || `got ${actual}, esperado ${expected}`;
  });
  t('ordenado em ordem decrescente por value (Recharts requer)', () => {
    for (let i = 1; i < funnel.length; i++) {
      const prev = funnel[i - 1];
      const curr = funnel[i];
      if (!prev || !curr) continue;
      if (prev.value < curr.value) return `inversão em [${i - 1},${i}]`;
    }
    return true;
  });
  t('toda etapa tem fill definido (senão renderiza preto)', () =>
    funnel.every((f) => typeof f.fill === 'string' && f.fill.length > 0),
  );
  t('fill usa hsl(var(--token)) — não hex hardcoded', () =>
    funnel.every((f) => f.fill.startsWith('hsl(var(--'))
      ? true
      : `fill inválido: ${funnel.map((f) => f.fill).join(', ')}`,
  );
  t('labelRight bem formado (count + valor compactado)', () =>
    funnel.every((f) => f.labelRight.includes('·')),
  );
  t('labelCenter vazio se value === 0 (não polui gráfico)', () =>
    funnel.every((f) => (f.value === 0 ? f.labelCenter === '' : f.labelCenter === f.name)),
  );

  // ── Upcoming deals (tabela) ─────────────────────────────────────────────
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
      },
      results,
    },
    { status: allOk ? 200 : 500 },
  );
}
