/**
 * Endpoint interno de smoke test do M4. Não é exposto via UI; útil pra
 * curl manual e pra rodar no CI uma vez que o smoke server estiver de pé.
 *
 * Roda asserts contra as funções puras (filtro, schema Zod, deal rotting)
 * usando o mesmo bundle que serve a UI. Curl em `/api/smoke-test/leads`
 * devolve `{passed, failed, results}`.
 *
 * Não pretende substituir Vitest (que entra em M7+ junto com a stack de
 * testes); existe pra dar confiança no MVP e poder ser invocado em CI.
 */
import { NextResponse } from 'next/server';

import { dealCreateSchema } from '@/features/deals/schemas';
import { applyLeadFilters } from '@/features/leads/queries';
import { calcRotState } from '@/features/leads/rotting';
import { leadCreateSchema } from '@/features/leads/schemas';
import { FAKE_DEALS } from '@/lib/fixtures/deals';
import { ALL_TAGS, FAKE_LEADS } from '@/lib/fixtures/leads';

interface CheckResult {
  group: string;
  name: string;
  ok: boolean;
  detail?: string;
}

const EMPTY = {
  search: '',
  stages: [] as string[],
  reps: [] as string[],
  origins: [] as never[],
  tags: [] as string[],
  temperatures: [] as never[],
};

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

  // ── Fixtures ────────────────────────────────────────────────────────────
  let t = run('fixtures', results);
  t('50 leads carregados', () => FAKE_LEADS.length === 50 || `count=${FAKE_LEADS.length}`);
  t('IDs únicos', () => new Set(FAKE_LEADS.map((l) => l.id)).size === 50);
  t('Cobre as 6 etapas', () => {
    const stages = new Set(FAKE_LEADS.map((l) => l.stageId));
    return ['novo', 'em_contato', 'proposta', 'negociacao', 'ganho', 'perdido'].every((s) =>
      stages.has(s),
    );
  });
  t('Mix de temperaturas (hot/warm/cold)', () => {
    const temps = new Set(FAKE_LEADS.map((l) => l.temperature));
    return ['hot', 'warm', 'cold'].every((x) => temps.has(x as 'hot' | 'warm' | 'cold'));
  });
  t('ALL_TAGS contém tags reais', () => ALL_TAGS.length > 5 && ALL_TAGS.includes('imobiliário'));

  // ── Busca ───────────────────────────────────────────────────────────────
  t = run('busca', results);
  t('busca vazia devolve tudo', () => applyLeadFilters(FAKE_LEADS, EMPTY).length === 50);
  t('busca por nome (case-insensitive)', () => {
    const out = applyLeadFilters(FAKE_LEADS, { ...EMPTY, search: 'mariana' });
    return out.length >= 1 && out.every((l) => l.name.toLowerCase().includes('mariana'));
  });
  t('busca por telefone (substring)', () => {
    const out = applyLeadFilters(FAKE_LEADS, { ...EMPTY, search: '8765-4321' });
    return out.length === 1 && out[0]!.id === 'lead_001';
  });
  t('busca por email', () => {
    const out = applyLeadFilters(FAKE_LEADS, { ...EMPTY, search: 'grupohx' });
    return out.length === 1 && out[0]!.id === 'lead_002';
  });
  t('busca por empresa', () => {
    const out = applyLeadFilters(FAKE_LEADS, { ...EMPTY, search: 'Esteves' });
    return out.some((l) => l.id === 'lead_016');
  });
  t(
    'busca sem match → []',
    () => applyLeadFilters(FAKE_LEADS, { ...EMPTY, search: 'xyz_nada_aqui_999' }).length === 0,
  );

  // ── Filtros ─────────────────────────────────────────────────────────────
  t = run('filtros', results);
  t('filtro por etapa', () => {
    const out = applyLeadFilters(FAKE_LEADS, { ...EMPTY, stages: ['proposta'] });
    return out.length > 0 && out.every((l) => l.stageId === 'proposta');
  });
  t('múltiplas etapas (OR)', () => {
    const out = applyLeadFilters(FAKE_LEADS, { ...EMPTY, stages: ['ganho', 'perdido'] });
    return out.length > 0 && out.every((l) => ['ganho', 'perdido'].includes(l.stageId));
  });
  t('filtro por vendedor', () => {
    const out = applyLeadFilters(FAKE_LEADS, { ...EMPTY, reps: ['user_juliana'] });
    return out.length > 0 && out.every((l) => l.assignedTo === 'user_juliana');
  });
  t('filtro por temperatura quente', () => {
    const out = applyLeadFilters(FAKE_LEADS, { ...EMPTY, temperatures: ['hot'] });
    return out.length > 0 && out.every((l) => l.temperature === 'hot');
  });
  t('filtro por tag', () => {
    const out = applyLeadFilters(FAKE_LEADS, { ...EMPTY, tags: ['imobiliário'] });
    return out.length >= 3 && out.every((l) => l.tags.includes('imobiliário'));
  });
  t('etapa novo + temperatura cold (AND entre filtros)', () => {
    const out = applyLeadFilters(FAKE_LEADS, {
      ...EMPTY,
      stages: ['novo'],
      temperatures: ['cold'],
    });
    return out.every((l) => l.stageId === 'novo' && l.temperature === 'cold');
  });

  // ── Validação Zod ───────────────────────────────────────────────────────
  t = run('zod', results);
  const baseValid = {
    name: 'Teste OK',
    phone: '+55 11 9 9999-0000',
    stageId: 'novo',
    assignedTo: 'user_mateus',
    origin: 'manual' as const,
    valueCents: 0,
    tags: [],
  };
  t('input mínimo válido', () => leadCreateSchema.safeParse(baseValid).success);
  t(
    'nome vazio é rejeitado',
    () => !leadCreateSchema.safeParse({ ...baseValid, name: '' }).success,
  );
  t(
    'nome curto (<2) é rejeitado',
    () => !leadCreateSchema.safeParse({ ...baseValid, name: 'A' }).success,
  );
  t(
    'telefone com letras é rejeitado',
    () => !leadCreateSchema.safeParse({ ...baseValid, phone: 'abc' }).success,
  );
  t(
    'email inválido é rejeitado',
    () => !leadCreateSchema.safeParse({ ...baseValid, email: 'isso nao eh email' }).success,
  );
  t(
    'email vazio "" passa (vira undefined)',
    () => leadCreateSchema.safeParse({ ...baseValid, email: '' }).success,
  );
  t(
    'valueCents negativo é rejeitado',
    () => !leadCreateSchema.safeParse({ ...baseValid, valueCents: -1 }).success,
  );
  t(
    'origem fora do enum é rejeitada',
    () => !leadCreateSchema.safeParse({ ...baseValid, origin: 'jamaica' as never }).success,
  );
  t(
    'máximo de 8 tags',
    () =>
      !leadCreateSchema.safeParse({
        ...baseValid,
        tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
      }).success,
  );

  // ── Deal rotting ────────────────────────────────────────────────────────
  t = run('rotting', results);
  t('lead sem interação (lead_012) → rotten', () => {
    const lead = FAKE_LEADS.find((l) => l.id === 'lead_012')!;
    const state = calcRotState(lead);
    return state === 'rotten' || `recebi ${state} (esperado rotten)`;
  });
  t('lead 7d na etapa novo (rotDays=7) → warning', () => {
    const lead = FAKE_LEADS.find((l) => l.id === 'lead_010')!;
    const state = calcRotState(lead);
    return state === 'warning' || `recebi ${state} (esperado warning)`;
  });
  t('lead recém-criado (lead_005, 1h atrás) → fresh', () => {
    const lead = FAKE_LEADS.find((l) => l.id === 'lead_005')!;
    const state = calcRotState(lead);
    return state === 'fresh' || `recebi ${state} (esperado fresh)`;
  });
  t('lead ganho → none (etapa terminal)', () => {
    const lead = FAKE_LEADS.find((l) => l.stageId === 'ganho')!;
    return calcRotState(lead) === 'none';
  });
  t('lead perdido → none (etapa terminal)', () => {
    const lead = FAKE_LEADS.find((l) => l.stageId === 'perdido')!;
    return calcRotState(lead) === 'none';
  });

  // ── Deals (Pipeline Kanban) ─────────────────────────────────────────────
  t = run('deals', results);
  t('deals fixture > 50', () => FAKE_DEALS.length > 50 || `count=${FAKE_DEALS.length}`);
  t('IDs únicos', () => new Set(FAKE_DEALS.map((d) => d.id)).size === FAKE_DEALS.length);
  t('Cobre todas as 6 etapas no Kanban', () => {
    const stages = new Set(FAKE_DEALS.map((d) => d.stageId));
    return ['novo', 'em_contato', 'proposta', 'negociacao', 'ganho', 'perdido'].every((s) =>
      stages.has(s),
    );
  });
  t('Status terminais batem com etapa terminal', () => {
    return FAKE_DEALS.every((d) => {
      if (d.stageId === 'ganho') return d.status === 'won';
      if (d.stageId === 'perdido') return d.status === 'lost';
      return d.status === 'open';
    });
  });
  t('Deals abertos têm probability definida', () =>
    FAKE_DEALS.filter((d) => d.status === 'open').every((d) => typeof d.probability === 'number'),
  );
  t('Todo deal aponta pra um lead existente', () => {
    const leadIds = new Set(FAKE_LEADS.map((l) => l.id));
    return FAKE_DEALS.every((d) => leadIds.has(d.leadId));
  });

  // ── Validação Zod (dealCreateSchema) ────────────────────────────────────
  t = run('zod-deal', results);
  const baseValidDeal = {
    title: 'Demo deal de teste',
    leadId: 'lead_001',
    stageId: 'novo',
    valueCents: 500_000_00,
    ownerId: 'user_mateus',
  };
  t('input mínimo de deal válido', () => dealCreateSchema.safeParse(baseValidDeal).success);
  t(
    'título vazio é rejeitado',
    () => !dealCreateSchema.safeParse({ ...baseValidDeal, title: '' }).success,
  );
  t(
    'título com 2 chars é rejeitado (min 3)',
    () => !dealCreateSchema.safeParse({ ...baseValidDeal, title: 'AB' }).success,
  );
  t(
    'leadId vazio é rejeitado',
    () => !dealCreateSchema.safeParse({ ...baseValidDeal, leadId: '' }).success,
  );
  t(
    'stageId vazio é rejeitado',
    () => !dealCreateSchema.safeParse({ ...baseValidDeal, stageId: '' }).success,
  );
  t(
    'valueCents negativo é rejeitado',
    () => !dealCreateSchema.safeParse({ ...baseValidDeal, valueCents: -1 }).success,
  );

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  return NextResponse.json(
    { passed, failed, total: results.length, results },
    { status: failed === 0 ? 200 : 500 },
  );
}
