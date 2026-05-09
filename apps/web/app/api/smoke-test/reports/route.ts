/**
 * Smoke test de Relatórios — valida as 5 famílias de cálculo (KPIs,
 * ConversionFunnel, RepPerformance, StageAvgTime, CoolingLeads) que
 * alimentam a tela `/reports`.
 *
 * Existe pra dar confiança nas fórmulas antes de Vitest entrar em M7+,
 * e pra fixar contratos que vão virar Server Action `getReports()` em
 * M8 (mesmas funções puras consumidas, só muda a fonte dos dados —
 * fixture → Postgres com `where: { workspaceId }`).
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/reports` →
 * `{summary, results}` JSON. HTTP 200 se `failed === 0`, 500 caso contrário.
 */
import { NextResponse } from 'next/server';

import { sumOpenPipelineCents } from '@/features/deals/transforms';
import { calcRotState } from '@/features/leads/rotting';
import {
  buildConversionFunnel,
  computeReportsKpis,
  computeRepPerformance,
  computeStageAvgTime,
  getCoolingLeads,
} from '@/features/reports/transforms';
import { FAKE_DEALS } from '@/lib/fixtures/deals';
import { FAKE_LEADS } from '@/lib/fixtures/leads';
import { DEFAULT_STAGES } from '@/lib/fixtures/pipelines';
import { SALES_REPS } from '@/lib/fixtures/sales-reps';

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
  const kpis = computeReportsKpis(FAKE_LEADS, FAKE_DEALS);
  let t = run('kpis', results);

  t(
    'totalLeads === FAKE_LEADS.length',
    () => kpis.totalLeads === FAKE_LEADS.length || `got ${kpis.totalLeads}`,
  );
  t('openPipelineCents reusa sumOpenPipelineCents (fonte canônica)', () => {
    const expected = sumOpenPipelineCents(FAKE_DEALS);
    return (
      kpis.openPipelineCents === expected || `got ${kpis.openPipelineCents}, esperado ${expected}`
    );
  });
  t(
    '0 <= conversionRatePct <= 100 (range válido)',
    () =>
      (kpis.conversionRatePct >= 0 && kpis.conversionRatePct <= 100) ||
      `got ${kpis.conversionRatePct}`,
  );
  t('conversionRatePct é inteiro (Math.round aplicado)', () =>
    Number.isInteger(kpis.conversionRatePct),
  );
  t('avgCycleDays >= 0 (não NaN nem negativo)', () => kpis.avgCycleDays >= 0);
  t('avgCycleDays é inteiro', () => Number.isInteger(kpis.avgCycleDays));
  t('newLeadsLast7d >= 0', () => kpis.newLeadsLast7d >= 0);
  t(
    'wonLast30d <= closedLast30d (identidade aritmética)',
    () => kpis.wonLast30d <= kpis.closedLast30d,
  );
  t('openDealsCount casa com filter(open)', () => {
    const expected = FAKE_DEALS.filter((d) => d.status === 'open').length;
    return kpis.openDealsCount === expected || `got ${kpis.openDealsCount}, esperado ${expected}`;
  });

  // ── Edge cases dos KPIs ─────────────────────────────────────────────────
  t = run('kpis-edge', results);
  t('workspaces vazios não geram NaN (defesa)', () => {
    const empty = computeReportsKpis([], []);
    return empty.conversionRatePct === 0 && empty.avgCycleDays === 0 && empty.totalLeads === 0;
  });

  // ── Conversion funnel ───────────────────────────────────────────────────
  const funnel = buildConversionFunnel(FAKE_DEALS);
  t = run('funnel', results);

  t('data.length === 6 (todas etapas, incluindo terminais)', () => funnel.length === 6);
  t('inclui exatamente as 6 stageIds em ordem', () => {
    const expectedOrder = [...DEFAULT_STAGES].sort((a, b) => a.order - b.order).map((s) => s.id);
    const got = funnel.map((f) => f.stageId);
    return JSON.stringify(got) === JSON.stringify(expectedOrder) || `got ${got.join(',')}`;
  });
  t(
    'cumulative das etapas ativas é monotônico decrescente (Novo >= Em contato >= ... >= Negociação)',
    () => {
      const activeOrder = ['novo', 'em_contato', 'proposta', 'negociacao'];
      const cums = activeOrder.map((id) => funnel.find((f) => f.stageId === id)!.cumulative);
      for (let i = 1; i < cums.length; i++) {
        const prev = cums[i - 1];
        const curr = cums[i];
        if (prev === undefined || curr === undefined) continue;
        if (prev < curr)
          return `inversão em ${activeOrder[i - 1]}=${prev} < ${activeOrder[i]}=${curr}`;
      }
      return true;
    },
  );
  t('toda etapa tem fill via hsl(var(--token))', () =>
    funnel.every((f) => f.fill.startsWith('hsl(var(--'))
      ? true
      : `fill inválido: ${funnel.map((f) => f.fill).join(', ')}`,
  );
  t('advanceRatePct é null pra etapas terminais e Negociação→Ganho', () => {
    const negociacao = funnel.find((f) => f.stageId === 'negociacao')!;
    const ganho = funnel.find((f) => f.stageId === 'ganho')!;
    const perdido = funnel.find((f) => f.stageId === 'perdido')!;
    return (
      negociacao.advanceRatePct === null &&
      ganho.advanceRatePct === null &&
      perdido.advanceRatePct === null
    );
  });
  t('advanceRatePct ∈ [0,100] quando definido', () =>
    funnel.every(
      (f) => f.advanceRatePct === null || (f.advanceRatePct >= 0 && f.advanceRatePct <= 100),
    ),
  );
  t('totalCents >= 0 em todas as etapas', () => funnel.every((f) => f.totalCents >= 0));
  t('cumulative do Novo é o maior (topo do funil)', () => {
    const novo = funnel.find((f) => f.stageId === 'novo')!.cumulative;
    return (
      funnel.every((f) => f.cumulative <= novo) ||
      `Novo=${novo}, max=${Math.max(...funnel.map((f) => f.cumulative))}`
    );
  });

  // ── Rep performance ─────────────────────────────────────────────────────
  const performance = computeRepPerformance(FAKE_DEALS);
  t = run('performance', results);

  t(
    `length === ${SALES_REPS.length} (todos os reps das fixtures)`,
    () => performance.length === SALES_REPS.length || `got ${performance.length}`,
  );
  t('inclui todos repIds das SALES_REPS', () => {
    const repIds = new Set(performance.map((p) => p.repId));
    return SALES_REPS.every((r) => repIds.has(r.id));
  });
  t('ordenado por wonValueCents desc (com tiebreak)', () => {
    for (let i = 1; i < performance.length; i++) {
      const prev = performance[i - 1];
      const curr = performance[i];
      if (!prev || !curr) continue;
      if (prev.wonValueCents === 0 && curr.wonValueCents === 0) continue; // tiebreak área
      if (prev.wonValueCents < curr.wonValueCents) return `inversão em [${i - 1},${i}]`;
    }
    return true;
  });
  t('todos têm conversionRatePct ∈ [0,100]', () =>
    performance.every((p) => p.conversionRatePct >= 0 && p.conversionRatePct <= 100),
  );
  t('soma de activeDeals === total de deals abertos (cobertura completa)', () => {
    const sumActive = performance.reduce((acc, p) => acc + p.activeDeals, 0);
    const expected = FAKE_DEALS.filter((d) => d.status === 'open').length;
    return sumActive === expected || `got ${sumActive}, esperado ${expected}`;
  });

  // ── Stage average time ──────────────────────────────────────────────────
  const stageTime = computeStageAvgTime(FAKE_DEALS);
  t = run('stage-time', results);

  t(
    'length === 4 (apenas etapas ativas)',
    () => stageTime.length === 4 || `got ${stageTime.length}`,
  );
  t('exclui etapas terminais (Ganho/Perdido)', () =>
    stageTime.every((s) => s.stageId !== 'ganho' && s.stageId !== 'perdido'),
  );
  t('avgDays >= 0 (sem negativos)', () => stageTime.every((s) => s.avgDays >= 0));
  t('rotDays casa com pipelines.ts', () =>
    stageTime.every((s) => {
      const expected = DEFAULT_STAGES.find((p) => p.id === s.stageId)!.rotDays;
      return s.rotDays === expected;
    }),
  );
  t('status é healthy/warning/critical (sem valores inválidos)', () =>
    stageTime.every(
      (s) => s.status === 'healthy' || s.status === 'warning' || s.status === 'critical',
    ),
  );
  t('etapa vazia tem status healthy + count=0', () => {
    const empty = computeStageAvgTime([]);
    return empty.every((s) => s.avgDays === 0 && s.status === 'healthy' && s.count === 0);
  });

  // ── Cooling leads ───────────────────────────────────────────────────────
  const cooling = getCoolingLeads(FAKE_LEADS, 6);
  t = run('cooling', results);

  t('length <= 6 (limite respeitado)', () => cooling.length <= 6);
  t('todos têm rotState rotten ou warning', () =>
    cooling.every((c) => c.rotState === 'rotten' || c.rotState === 'warning'),
  );
  t('todos têm stageName não-vazio', () =>
    cooling.every((c) => typeof c.stageName === 'string' && c.stageName.length > 0),
  );
  t('rotten aparecem antes de warning', () => {
    let sawWarning = false;
    for (const c of cooling) {
      if (c.rotState === 'warning') sawWarning = true;
      if (c.rotState === 'rotten' && sawWarning) return 'rotten apareceu depois de warning';
    }
    return true;
  });
  t('rotState bate com calcRotState do lead', () =>
    cooling.every((c) => calcRotState(c.lead) === c.rotState),
  );
  t('limit configurável (limit=2 retorna ≤2)', () => {
    const top2 = getCoolingLeads(FAKE_LEADS, 2);
    return top2.length <= 2;
  });
  t('com lista vazia retorna [] (não quebra)', () => getCoolingLeads([], 6).length === 0);

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
