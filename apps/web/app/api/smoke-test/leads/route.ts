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

import {
  dealCreateSchema,
  moveDealStageSchema,
  updateDealOrderSchema,
} from '@/features/deals/schemas';
import {
  aggregateByStage,
  applyCreateDeal,
  applyMoveDeal,
  computeOrderBetween,
  defaultProbabilityFor,
  ORDER_STEP,
  statusForStage,
  sumOpenPipelineCents,
  toDealUI,
  type PrismaDealRow,
} from '@/features/deals/transforms';
import { applyLeadFilters } from '@/features/leads/filters';
import { calcRotState } from '@/features/leads/rotting';
import {
  archiveLeadSchema,
  assignLeadSchema,
  leadCreateSchema,
  moveStageSchema,
  updateLeadSchema,
} from '@/features/leads/schemas';
import {
  deriveLeadTemperature,
  flattenLeadTags,
  type PrismaLeadTagRow,
} from '@/features/leads/transforms';
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
  // M8#2: stageId e assignedTo viraram UUIDs (eram slugs em M4). Usar UUIDs
  // válidos quaisquer — schema só valida o formato, não o existência no banco.
  const baseValid = {
    name: 'Teste OK',
    phone: '+55 11 9 9999-0000',
    stageId: '11111111-1111-4111-9111-111111111111',
    assignedTo: '22222222-2222-4222-9222-222222222222',
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
  // M8#3: leadId, stageId, ownerId viraram .uuid() (eram .min(1) em M4 por
  // causa de slugs em fixture). Usar UUIDs válidos quaisquer — schema só
  // valida formato, FK real é checada na Server Action via Prisma.
  t = run('zod-deal', results);
  const UUID_A = '11111111-1111-4111-9111-111111111111';
  const UUID_B = '22222222-2222-4222-9222-222222222222';
  const UUID_C = '33333333-3333-4333-9333-333333333333';
  const baseValidDeal = {
    title: 'Demo deal de teste',
    leadId: UUID_A,
    stageId: UUID_B,
    valueCents: 500_000_00,
    ownerId: UUID_C,
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
    'leadId não-UUID é rejeitado',
    () => !dealCreateSchema.safeParse({ ...baseValidDeal, leadId: 'lead_001' }).success,
  );
  t(
    'stageId não-UUID é rejeitado',
    () => !dealCreateSchema.safeParse({ ...baseValidDeal, stageId: 'novo' }).success,
  );
  t(
    'ownerId não-UUID é rejeitado',
    () => !dealCreateSchema.safeParse({ ...baseValidDeal, ownerId: 'user_mateus' }).success,
  );
  t(
    'valueCents negativo é rejeitado',
    () => !dealCreateSchema.safeParse({ ...baseValidDeal, valueCents: -1 }).success,
  );

  // ── Drag-and-drop (lógica que alimenta o DnD do Kanban) ─────────────────
  t = run('drag-drop', results);

  t('mover deal pra outra etapa muda stageId + status open', () => {
    const open = FAKE_DEALS.find((d) => d.status === 'open' && d.stageId === 'novo');
    if (!open) return 'fixture: nenhum deal aberto em novo';
    const result = applyMoveDeal(FAKE_DEALS, open.id, 'em_contato');
    const moved = result.find((d) => d.id === open.id)!;
    return (
      moved.stageId === 'em_contato' &&
      moved.status === 'open' &&
      moved.closedAt === undefined &&
      moved.probability === defaultProbabilityFor('em_contato')
    );
  });

  t('mover deal pra Ganho marca status=won + closedAt + probability=100', () => {
    const open = FAKE_DEALS.find((d) => d.status === 'open');
    if (!open) return 'fixture: nenhum deal aberto';
    const result = applyMoveDeal(FAKE_DEALS, open.id, 'ganho');
    const moved = result.find((d) => d.id === open.id)!;
    return (
      moved.stageId === 'ganho' &&
      moved.status === 'won' &&
      typeof moved.closedAt === 'string' &&
      moved.probability === 100
    );
  });

  t('mover deal pra Perdido marca status=lost + closedAt + probability=0', () => {
    const open = FAKE_DEALS.find((d) => d.status === 'open');
    if (!open) return 'fixture: nenhum deal aberto';
    const result = applyMoveDeal(FAKE_DEALS, open.id, 'perdido');
    const moved = result.find((d) => d.id === open.id)!;
    return (
      moved.stageId === 'perdido' &&
      moved.status === 'lost' &&
      typeof moved.closedAt === 'string' &&
      moved.probability === 0
    );
  });

  t('reabrir deal won (mover de Ganho para Negociação) zera closedAt', () => {
    const won = FAKE_DEALS.find((d) => d.status === 'won');
    if (!won) return 'fixture: nenhum deal won';
    const result = applyMoveDeal(FAKE_DEALS, won.id, 'negociacao');
    const moved = result.find((d) => d.id === won.id)!;
    return (
      moved.stageId === 'negociacao' && moved.status === 'open' && moved.closedAt === undefined
    );
  });

  t('mover pra mesma etapa é no-op (referência preservada)', () => {
    const any = FAKE_DEALS[0]!;
    const result = applyMoveDeal(FAKE_DEALS, any.id, any.stageId);
    return result === FAKE_DEALS;
  });

  t('mover deal inexistente é no-op', () => {
    const result = applyMoveDeal(FAKE_DEALS, 'deal_inexistente_999', 'ganho');
    return result === FAKE_DEALS;
  });

  t('imutabilidade: applyMoveDeal não muta o array original', () => {
    const open = FAKE_DEALS.find((d) => d.status === 'open' && d.stageId === 'novo');
    if (!open) return 'fixture: setup';
    const before = JSON.stringify(open);
    applyMoveDeal(FAKE_DEALS, open.id, 'ganho');
    const after = JSON.stringify(FAKE_DEALS.find((d) => d.id === open.id));
    return (
      before === after || `mutou! before=${before.slice(0, 80)}... after=${after.slice(0, 80)}`
    );
  });

  // ── Totalizadores das colunas (header + KPIs) ───────────────────────────
  t = run('aggregations', results);

  const STAGE_IDS = ['novo', 'em_contato', 'proposta', 'negociacao', 'ganho', 'perdido'];

  t('aggregateByStage devolve as 6 etapas mesmo se vazias', () => {
    const aggs = aggregateByStage([], STAGE_IDS);
    return aggs.length === 6 && aggs.every((a) => a.count === 0 && a.totalCents === 0);
  });

  t('soma por etapa bate com soma manual da fixture', () => {
    const aggs = aggregateByStage(FAKE_DEALS, STAGE_IDS);
    for (const stageId of STAGE_IDS) {
      const expected = FAKE_DEALS.filter((d) => d.stageId === stageId);
      const expectedSum = expected.reduce((acc, d) => acc + d.valueCents, 0);
      const agg = aggs.find((a) => a.stageId === stageId)!;
      if (agg.count !== expected.length) return `count divergente em ${stageId}`;
      if (agg.totalCents !== expectedSum) return `soma divergente em ${stageId}`;
    }
    return true;
  });

  t('total do header de cada coluna nunca é negativo', () => {
    const aggs = aggregateByStage(FAKE_DEALS, STAGE_IDS);
    return aggs.every((a) => a.count >= 0 && a.totalCents >= 0);
  });

  t('mover deal atualiza totais (subtrai origem, soma destino)', () => {
    const deal = FAKE_DEALS.find((d) => d.stageId === 'novo' && d.valueCents > 0)!;
    const before = aggregateByStage(FAKE_DEALS, STAGE_IDS);
    const after = aggregateByStage(applyMoveDeal(FAKE_DEALS, deal.id, 'proposta'), STAGE_IDS);
    const novoBefore = before.find((a) => a.stageId === 'novo')!;
    const novoAfter = after.find((a) => a.stageId === 'novo')!;
    const propBefore = before.find((a) => a.stageId === 'proposta')!;
    const propAfter = after.find((a) => a.stageId === 'proposta')!;
    return (
      novoAfter.count === novoBefore.count - 1 &&
      novoAfter.totalCents === novoBefore.totalCents - deal.valueCents &&
      propAfter.count === propBefore.count + 1 &&
      propAfter.totalCents === propBefore.totalCents + deal.valueCents
    );
  });

  t('KPI Pipeline ativo = soma de todos status=open', () => {
    const expected = FAKE_DEALS.filter((d) => d.status === 'open').reduce(
      (a, d) => a + d.valueCents,
      0,
    );
    return sumOpenPipelineCents(FAKE_DEALS) === expected;
  });

  t('mover deal aberto pra Ganho diminui Pipeline ativo no valor do deal', () => {
    const open = FAKE_DEALS.find((d) => d.status === 'open' && d.valueCents > 0)!;
    const before = sumOpenPipelineCents(FAKE_DEALS);
    const after = sumOpenPipelineCents(applyMoveDeal(FAKE_DEALS, open.id, 'ganho'));
    return after === before - open.valueCents;
  });

  // ── Criar novo negócio (form submit) ────────────────────────────────────
  t = run('create-deal', results);

  function fakeIdGen() {
    let n = 999;
    return () => `deal_test_${++n}`;
  }

  t('createDeal adiciona o deal no topo da lista', () => {
    const { deals: newDeals, created } = applyCreateDeal(
      FAKE_DEALS,
      {
        title: 'Novo deal de teste',
        leadId: 'lead_001',
        stageId: 'novo',
        valueCents: 75_000_00,
        ownerId: 'user_mateus',
      },
      fakeIdGen(),
    );
    return (
      newDeals.length === FAKE_DEALS.length + 1 &&
      newDeals[0]?.id === created.id &&
      created.title === 'Novo deal de teste'
    );
  });

  t('deal criado em Novo nasce com status=open + probability=10', () => {
    const { created } = applyCreateDeal(
      FAKE_DEALS,
      {
        title: 'Demo',
        leadId: 'lead_001',
        stageId: 'novo',
        valueCents: 10000,
        ownerId: 'user_mateus',
      },
      fakeIdGen(),
    );
    return created.status === 'open' && created.probability === 10;
  });

  t('deal criado direto em Ganho nasce com status=won', () => {
    const { created } = applyCreateDeal(
      FAKE_DEALS,
      {
        title: 'Demo já fechado',
        leadId: 'lead_001',
        stageId: 'ganho',
        valueCents: 10000,
        ownerId: 'user_mateus',
      },
      fakeIdGen(),
    );
    return created.status === 'won' && created.probability === 100;
  });

  t('createDeal preserva imutabilidade (FAKE_DEALS não cresce)', () => {
    const sizeBefore = FAKE_DEALS.length;
    applyCreateDeal(
      FAKE_DEALS,
      {
        title: 'Demo',
        leadId: 'lead_001',
        stageId: 'novo',
        valueCents: 0,
        ownerId: 'user_mateus',
      },
      fakeIdGen(),
    );
    return FAKE_DEALS.length === sizeBefore;
  });

  t('statusForStage mapeia corretamente todas as 6 etapas', () => {
    return (
      statusForStage('novo') === 'open' &&
      statusForStage('em_contato') === 'open' &&
      statusForStage('proposta') === 'open' &&
      statusForStage('negociacao') === 'open' &&
      statusForStage('ganho') === 'won' &&
      statusForStage('perdido') === 'lost'
    );
  });

  t('deal criado aparece no aggregateByStage da etapa escolhida', () => {
    const { deals: newDeals, created } = applyCreateDeal(
      FAKE_DEALS,
      {
        title: 'Verifica agregação',
        leadId: 'lead_001',
        stageId: 'proposta',
        valueCents: 50_000_00,
        ownerId: 'user_mateus',
      },
      fakeIdGen(),
    );
    const before = aggregateByStage(FAKE_DEALS, STAGE_IDS).find((a) => a.stageId === 'proposta')!;
    const after = aggregateByStage(newDeals, STAGE_IDS).find((a) => a.stageId === 'proposta')!;
    return (
      after.count === before.count + 1 &&
      after.totalCents === before.totalCents + created.valueCents
    );
  });

  // ── M8#2 transforms (puro, sem banco) ──────────────────────────────────
  t = run('transforms-m8', results);

  const VALID_UUID = '11111111-1111-4111-9111-111111111111';
  const VALID_UUID_2 = '22222222-2222-4222-9222-222222222222';

  t('deriveLeadTemperature: <3 dias → hot', () => {
    const ref = new Date('2026-05-13T12:00:00-03:00');
    const lastInt = new Date('2026-05-12T12:00:00-03:00'); // 1 dia atrás
    return deriveLeadTemperature(lastInt, ref) === 'hot';
  });
  t('deriveLeadTemperature: 5 dias → warm', () => {
    const ref = new Date('2026-05-13T12:00:00-03:00');
    const lastInt = new Date('2026-05-08T12:00:00-03:00'); // 5 dias atrás
    return deriveLeadTemperature(lastInt, ref) === 'warm';
  });
  t('deriveLeadTemperature: >10 dias → cold', () => {
    const ref = new Date('2026-05-13T12:00:00-03:00');
    const lastInt = new Date('2026-04-20T12:00:00-03:00'); // 23 dias atrás
    return deriveLeadTemperature(lastInt, ref) === 'cold';
  });
  t('deriveLeadTemperature: null → cold', () => deriveLeadTemperature(null) === 'cold');

  t('flattenLeadTags: undefined → []', () => flattenLeadTags(undefined).length === 0);
  t('flattenLeadTags: vazio → []', () => flattenLeadTags([]).length === 0);
  t('flattenLeadTags: extrai tag.name', () => {
    const rows: PrismaLeadTagRow[] = [{ tag: { name: 'vip' } }, { tag: { name: 'imobiliário' } }];
    const out = flattenLeadTags(rows);
    return out.length === 2 && out[0] === 'vip' && out[1] === 'imobiliário';
  });

  // Schemas novos do M8#2
  t('moveStageSchema rejeita IDs não-UUID', () => {
    return !moveStageSchema.safeParse({ leadId: 'lead_001', stageId: 'novo' }).success;
  });
  t('moveStageSchema aceita UUIDs', () => {
    return moveStageSchema.safeParse({ leadId: VALID_UUID, stageId: VALID_UUID_2 }).success;
  });
  t('assignLeadSchema rejeita IDs não-UUID', () => {
    return !assignLeadSchema.safeParse({ leadId: 'lead_001', assignedToId: 'user_mateus' }).success;
  });
  t('assignLeadSchema aceita UUIDs', () => {
    return assignLeadSchema.safeParse({ leadId: VALID_UUID, assignedToId: VALID_UUID_2 }).success;
  });
  t('archiveLeadSchema rejeita leadId não-UUID', () => {
    return !archiveLeadSchema.safeParse({ leadId: 'lead_001' }).success;
  });
  t('archiveLeadSchema aceita UUID', () => {
    return archiveLeadSchema.safeParse({ leadId: VALID_UUID }).success;
  });
  t('updateLeadSchema: apenas leadId é OK (patch vazio)', () => {
    return updateLeadSchema.safeParse({ leadId: VALID_UUID }).success;
  });
  t('updateLeadSchema rejeita leadId não-UUID', () => {
    return !updateLeadSchema.safeParse({ leadId: 'not-uuid' }).success;
  });

  // ── M8#3 deals: ordering + transforms server-fed (puro, sem banco) ─────
  t = run('deals-m8', results);

  const UUID_D = '44444444-4444-4444-9444-444444444444';

  // Schemas
  t('moveDealStageSchema rejeita dealId não-UUID', () => {
    return !moveDealStageSchema.safeParse({ dealId: 'deal_001', stageId: UUID_B }).success;
  });
  t('moveDealStageSchema aceita UUIDs', () => {
    return moveDealStageSchema.safeParse({ dealId: UUID_A, stageId: UUID_B }).success;
  });
  t('moveDealStageSchema aceita beforeId/afterId opcionais', () => {
    return moveDealStageSchema.safeParse({
      dealId: UUID_A,
      stageId: UUID_B,
      beforeId: UUID_C,
      afterId: UUID_D,
    }).success;
  });
  t('updateDealOrderSchema aceita só dealId', () => {
    return updateDealOrderSchema.safeParse({ dealId: UUID_A }).success;
  });
  t('updateDealOrderSchema rejeita beforeId não-UUID', () => {
    return !updateDealOrderSchema.safeParse({ dealId: UUID_A, beforeId: 'deal_x' }).success;
  });

  // computeOrderBetween
  t('computeOrderBetween: ambos null → 0', () => computeOrderBetween(null, null) === 0);
  t('computeOrderBetween: só before (drop no fim) → before + ORDER_STEP', () => {
    return computeOrderBetween(2000, null) === 2000 + ORDER_STEP;
  });
  t('computeOrderBetween: só after (drop no início) → after - ORDER_STEP', () => {
    return computeOrderBetween(null, 5000) === 5000 - ORDER_STEP;
  });
  t('computeOrderBetween: midpoint entre 1000 e 3000 = 2000', () => {
    return computeOrderBetween(1000, 3000) === 2000;
  });
  t('computeOrderBetween: vizinhos colapsados (gap=1) retorna piso (sinal pra rebalance)', () => {
    // Math.floor((5 + 6) / 2) = 5 — caller detecta colisão (== beforeOrder)
    return computeOrderBetween(5, 6) === 5;
  });
  t('ORDER_STEP é múltiplo grande pra muitas inserções midpoint', () => ORDER_STEP >= 100);

  // toDealUI
  const sampleRow: PrismaDealRow = {
    id: UUID_A,
    title: 'Apartamento Vértice',
    leadId: UUID_B,
    stageId: UUID_C,
    valueCents: 1_500_000_00,
    ownerId: UUID_D,
    probability: 60,
    dueAt: new Date('2026-06-15T12:00:00-03:00'),
    description: 'Cliente em segunda visita',
    status: 'open',
    lostReason: null,
    orderInStage: 2000,
    closedAt: null,
    createdAt: new Date('2026-05-10T10:00:00-03:00'),
    updatedAt: new Date('2026-05-13T15:00:00-03:00'),
    stage: { slug: 'proposta', name: 'Proposta' },
    lead: { id: UUID_B, name: 'Mariana Souza', company: 'Construtora HX' },
  };
  t('toDealUI denormaliza stage.slug e lead.name', () => {
    const ui = toDealUI(sampleRow);
    return ui.stageSlug === 'proposta' && ui.leadName === 'Mariana Souza';
  });
  t('toDealUI preserva orderInStage', () => {
    const ui = toDealUI(sampleRow);
    return ui.orderInStage === 2000;
  });
  t('toDealUI converte Date → ISO string', () => {
    const ui = toDealUI(sampleRow);
    return ui.createdAt.includes('T') && ui.dueAt?.includes('T') === true;
  });
  t('toDealUI: closedAt=null vira undefined', () => {
    const ui = toDealUI(sampleRow);
    return ui.closedAt === undefined;
  });
  t('toDealUI: row won com closedAt definido', () => {
    const wonRow: PrismaDealRow = {
      ...sampleRow,
      status: 'won',
      closedAt: new Date('2026-05-14T10:00:00-03:00'),
      stage: { slug: 'ganho', name: 'Ganho' },
    };
    const ui = toDealUI(wonRow);
    return ui.status === 'won' && typeof ui.closedAt === 'string' && ui.stageSlug === 'ganho';
  });
  t('toDealUI: company null vira undefined', () => {
    const noCo: PrismaDealRow = { ...sampleRow, lead: { ...sampleRow.lead, company: null } };
    return toDealUI(noCo).leadCompany === undefined;
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  return NextResponse.json(
    { passed, failed, total: results.length, results },
    { status: failed === 0 ? 200 : 500 },
  );
}
