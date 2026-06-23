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

import { createNoteSchema } from '@/features/activities/schemas';
import {
  enrichStageChangeMeta,
  toActivityUI,
  type PrismaActivityRow,
} from '@/features/activities/transforms';
import {
  deleteAttachmentSchema,
  signedUrlSchema,
  uploadAttachmentMetadataSchema,
} from '@/features/attachments/schemas';
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
  CSV_IMPORT_MAX_ROWS,
  EXPORT_MAX_ROWS,
  exportLeadsSchema,
  importLeadsSchema,
  leadCreateSchema,
  leadImportRowSchema,
  moveStageSchema,
  previewImportSchema,
  updateLeadSchema,
} from '@/features/leads/schemas';
import {
  deriveLeadTemperature,
  flattenLeadTags,
  type PrismaLeadTagRow,
} from '@/features/leads/transforms';
import {
  completeTaskSchema,
  deleteTaskSchema,
  reopenTaskSchema,
  taskCreateSchema,
  updateTaskSchema,
} from '@/features/tasks/schemas';
import {
  computeNextActionFromTasks,
  toTaskUI,
  type PrismaTaskRow,
} from '@/features/tasks/transforms';
import { webhookLeadPayloadSchema } from '@/features/webhooks/schemas';
import { blockSmokeInProd } from '@/lib/dev/smoke-guard';
import {
  escapeCsvValue,
  serializeCsvRow,
  serializeLeadsCsv,
  UTF8_BOM,
  type LeadCsvRow,
} from '@/lib/exports/csv';
import { FAKE_DEALS } from '@/lib/fixtures/deals';
import { ALL_TAGS, FAKE_LEADS } from '@/lib/fixtures/leads';
import { findDuplicatesPure, type ExistingLeadRef } from '@/lib/leads/dedupe';
import { pickNextAssigneePure, type LoadCount, type MemberRef } from '@/lib/leads/pick-assignee';
import {
  ALLOWED_MIME_TYPES,
  buildStoragePath,
  formatFileSize,
  MAX_FILE_SIZE,
  sanitizeFileName,
  validateAttachmentInput,
} from '@/lib/storage/attachments';
import { checkRateLimitPure } from '@/lib/webhooks/rate-limit';

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
  const blocked = blockSmokeInProd();
  if (blocked) return blocked;

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

  // ── M8#4 tasks: schemas + transforms (puro, sem banco) ──────────────────
  t = run('tasks-m8', results);

  const UUID_T = '55555555-5555-4555-9555-555555555555';
  const UUID_U = '66666666-6666-4666-9666-666666666666';

  // Schemas Zod
  t('taskCreateSchema aceita input mínimo válido', () => {
    return taskCreateSchema.safeParse({
      leadId: VALID_UUID,
      kind: 'follow_up',
      title: 'Ligar pra confirmar',
      assignedTo: VALID_UUID_2,
      dueAt: new Date().toISOString(),
    }).success;
  });
  t('taskCreateSchema rejeita leadId não-UUID', () => {
    return !taskCreateSchema.safeParse({
      leadId: 'lead_001',
      kind: 'follow_up',
      title: 'X',
      assignedTo: VALID_UUID,
      dueAt: new Date().toISOString(),
    }).success;
  });
  t('taskCreateSchema rejeita kind inválido', () => {
    return !taskCreateSchema.safeParse({
      leadId: VALID_UUID,
      kind: 'jamaica' as never,
      title: 'X',
      assignedTo: VALID_UUID_2,
      dueAt: new Date().toISOString(),
    }).success;
  });
  t('updateTaskSchema aceita só taskId (patch vazio)', () => {
    return updateTaskSchema.safeParse({ taskId: VALID_UUID }).success;
  });
  t('completeTaskSchema rejeita taskId não-UUID', () => {
    return !completeTaskSchema.safeParse({ taskId: 'task_x' }).success;
  });
  t('reopenTaskSchema aceita UUID', () => {
    return reopenTaskSchema.safeParse({ taskId: VALID_UUID }).success;
  });
  t('deleteTaskSchema rejeita taskId não-UUID', () => {
    return !deleteTaskSchema.safeParse({ taskId: 'x' }).success;
  });

  // computeNextActionFromTasks
  t('computeNextActionFromTasks: array vazio → null', () => {
    return computeNextActionFromTasks([]) === null;
  });
  t('computeNextActionFromTasks: só done → null', () => {
    return (
      computeNextActionFromTasks([
        {
          status: 'done',
          dueAt: '2026-05-10T09:00:00Z',
          title: 'X',
          createdAt: '2026-05-01T00:00:00Z',
        },
      ]) === null
    );
  });
  t('computeNextActionFromTasks: pega o pending de dueAt mais cedo', () => {
    const next = computeNextActionFromTasks([
      {
        status: 'pending',
        dueAt: '2026-05-20T09:00:00Z',
        title: 'Tarde',
        createdAt: '2026-05-01T00:00:00Z',
      },
      {
        status: 'pending',
        dueAt: '2026-05-15T09:00:00Z',
        title: 'Cedo',
        createdAt: '2026-05-02T00:00:00Z',
      },
      {
        status: 'done',
        dueAt: '2026-05-10T09:00:00Z',
        title: 'Já feito',
        createdAt: '2026-05-01T00:00:00Z',
      },
    ]);
    return next?.title === 'Cedo';
  });
  t('computeNextActionFromTasks: desempate por createdAt mais antigo', () => {
    const sameDue = '2026-05-15T09:00:00Z';
    const next = computeNextActionFromTasks([
      { status: 'pending', dueAt: sameDue, title: 'Nova', createdAt: '2026-05-03T00:00:00Z' },
      { status: 'pending', dueAt: sameDue, title: 'Antiga', createdAt: '2026-05-01T00:00:00Z' },
    ]);
    return next?.title === 'Antiga';
  });

  // toTaskUI
  const sampleTaskRow: PrismaTaskRow = {
    id: UUID_T,
    leadId: VALID_UUID,
    kind: 'call',
    title: 'Ligar pra Mariana',
    notes: null,
    dueAt: new Date('2026-05-20T09:00:00-03:00'),
    status: 'pending',
    assignedToId: VALID_UUID_2,
    doneAt: null,
    createdAt: new Date('2026-05-10T10:00:00-03:00'),
    lead: { id: VALID_UUID, name: 'Mariana Souza', company: 'Construtora HX' },
  };
  t('toTaskUI converte Date → ISO + denormaliza lead.name', () => {
    const ui = toTaskUI(sampleTaskRow);
    return (
      ui.leadName === 'Mariana Souza' &&
      ui.leadCompany === 'Construtora HX' &&
      ui.dueAt.includes('T') &&
      ui.notes === undefined
    );
  });
  t('toTaskUI: doneAt null vira undefined', () => {
    const ui = toTaskUI(sampleTaskRow);
    return ui.doneAt === undefined;
  });
  t('toTaskUI: task done preserva doneAt como ISO', () => {
    const done: PrismaTaskRow = {
      ...sampleTaskRow,
      status: 'done',
      doneAt: new Date('2026-05-14T18:00:00-03:00'),
    };
    const ui = toTaskUI(done);
    return ui.status === 'done' && typeof ui.doneAt === 'string';
  });

  // ── M8#4 activities: schemas + transforms (puro, sem banco) ─────────────
  t = run('activities-m8', results);

  // Schema
  t('createNoteSchema aceita body válido', () => {
    return createNoteSchema.safeParse({ leadId: VALID_UUID, body: 'Cliente pediu desconto' })
      .success;
  });
  t('createNoteSchema rejeita body vazio', () => {
    return !createNoteSchema.safeParse({ leadId: VALID_UUID, body: '' }).success;
  });
  t('createNoteSchema rejeita leadId não-UUID', () => {
    return !createNoteSchema.safeParse({ leadId: 'lead_x', body: 'X' }).success;
  });

  // toActivityUI
  const sampleActivityRow: PrismaActivityRow = {
    id: UUID_U,
    leadId: VALID_UUID,
    type: 'note',
    body: 'Cliente pediu desconto',
    authorId: VALID_UUID_2,
    meta: null,
    createdAt: new Date('2026-05-14T10:00:00-03:00'),
    author: {
      id: VALID_UUID_2,
      user: { name: 'Mateus', email: 'mateus@x.com' },
    },
  };
  t('toActivityUI converte row + resolve authorName', () => {
    const ui = toActivityUI(sampleActivityRow);
    return (
      ui.authorName === 'Mateus' &&
      ui.body === 'Cliente pediu desconto' &&
      ui.createdAt.includes('T')
    );
  });
  t('toActivityUI: author null → authorName undefined + authorId "system"', () => {
    const noAuthor: PrismaActivityRow = { ...sampleActivityRow, author: null, authorId: null };
    const ui = toActivityUI(noAuthor);
    return ui.authorName === undefined && ui.authorId === 'system';
  });
  t('toActivityUI: author sem name usa fallback email', () => {
    const fallback: PrismaActivityRow = {
      ...sampleActivityRow,
      author: { id: VALID_UUID_2, user: { name: null, email: 'maria@x.com' } },
    };
    const ui = toActivityUI(fallback);
    return ui.authorName === 'maria';
  });

  // enrichStageChangeMeta
  const FAKE_STAGES = [
    { id: 'aaa', slug: 'em_contato', name: 'Em contato', order: 1, rotDays: 14 },
    { id: 'bbb', slug: 'proposta', name: 'Proposta', order: 2, rotDays: 7 },
  ];
  t('enrichStageChangeMeta resolve from/to em nomes', () => {
    const enriched = enrichStageChangeMeta({ fromStageId: 'aaa', toStageId: 'bbb' }, FAKE_STAGES);
    return enriched?.fromStageName === 'Em contato' && enriched?.toStageName === 'Proposta';
  });
  t('enrichStageChangeMeta: stage desconhecida cai em "?"', () => {
    const enriched = enrichStageChangeMeta({ fromStageId: 'aaa', toStageId: 'ccc' }, FAKE_STAGES);
    return enriched?.toStageName === '?';
  });
  t('enrichStageChangeMeta: meta vazio → null', () => {
    return enrichStageChangeMeta(undefined, FAKE_STAGES) === null;
  });

  // ── M8#5 CSV import (schemas, dedupe, round-robin) ──────────────────────
  t = run('csv-import-m8', results);

  t('CSV_IMPORT_MAX_ROWS é 1000', () => CSV_IMPORT_MAX_ROWS === 1000);

  // leadImportRowSchema
  t('leadImportRowSchema aceita linha mínima válida', () => {
    return leadImportRowSchema.safeParse({
      line: 2,
      name: 'João',
      phone: '+55 11 9 9999-0000',
    }).success;
  });
  t('leadImportRowSchema rejeita name vazio', () => {
    return !leadImportRowSchema.safeParse({ line: 2, name: '', phone: '+55 11 9 9999-0000' })
      .success;
  });
  t('leadImportRowSchema rejeita phone com letras', () => {
    return !leadImportRowSchema.safeParse({ line: 2, name: 'A', phone: 'abc' }).success;
  });

  // previewImportSchema / importLeadsSchema
  const validRow = { line: 2, name: 'João', phone: '+55 11 9 9999-0000' };
  t('previewImportSchema aceita rows array', () => {
    return previewImportSchema.safeParse({ rows: [validRow] }).success;
  });
  t('importLeadsSchema rejeita consentConfirmed=false', () => {
    return !importLeadsSchema.safeParse({ rows: [validRow], consentConfirmed: false }).success;
  });
  t('importLeadsSchema rejeita consentConfirmed omitido', () => {
    return !importLeadsSchema.safeParse({ rows: [validRow] }).success;
  });
  t('importLeadsSchema rejeita >1000 linhas', () => {
    const rows = Array.from({ length: CSV_IMPORT_MAX_ROWS + 1 }, (_, i) => ({
      ...validRow,
      line: i + 2,
    }));
    return !importLeadsSchema.safeParse({ rows, consentConfirmed: true }).success;
  });
  t('importLeadsSchema aceita ≤1000 + consent true', () => {
    const rows = Array.from({ length: CSV_IMPORT_MAX_ROWS }, (_, i) => ({
      ...validRow,
      line: i + 2,
    }));
    return importLeadsSchema.safeParse({ rows, consentConfirmed: true }).success;
  });

  // findDuplicatesPure
  const existingLeads: ExistingLeadRef[] = [
    { id: 'L1', name: 'Ana', phone: '+55 11 99999-1111', email: 'ana@x.com' },
    { id: 'L2', name: 'Bruno', phone: '+55 11 99999-2222', email: null },
  ];
  t('findDuplicates: match por phone', () => {
    const dups = findDuplicatesPure(existingLeads, [{ phone: '+55 11 99999-1111', email: null }]);
    return dups.get('+55 11 99999-1111')?.id === 'L1';
  });
  t('findDuplicates: match por email (case-insensitive)', () => {
    const dups = findDuplicatesPure(existingLeads, [{ phone: null, email: 'ANA@X.com' }]);
    return dups.get('ana@x.com')?.id === 'L1';
  });
  t('findDuplicates: sem match → Map vazio', () => {
    const dups = findDuplicatesPure(existingLeads, [
      { phone: '+55 11 00000-0000', email: 'novo@x.com' },
    ]);
    return dups.size === 0;
  });

  // pickNextAssigneePure (round-robin)
  const REF_DATE = new Date('2026-01-01T00:00:00Z');
  const members: MemberRef[] = [
    { id: 'V1', role: 'Vendedor', createdAt: new Date(REF_DATE.getTime()) },
    { id: 'V2', role: 'Vendedor', createdAt: new Date(REF_DATE.getTime() + 86_400_000) },
    { id: 'V3', role: 'Manager', createdAt: new Date(REF_DATE.getTime() + 2 * 86_400_000) },
    { id: 'O1', role: 'Owner', createdAt: new Date(REF_DATE.getTime() - 86_400_000) },
  ];
  t('pickNextAssignee: menor count vence', () => {
    const loads: LoadCount[] = [
      { memberId: 'V1', count: 10 },
      { memberId: 'V2', count: 5 },
      { memberId: 'V3', count: 7 },
    ];
    return pickNextAssigneePure(members, loads) === 'V2';
  });
  t('pickNextAssignee: tie por count → createdAt ASC desempata', () => {
    const loads: LoadCount[] = [
      { memberId: 'V1', count: 5 },
      { memberId: 'V2', count: 5 },
      { memberId: 'V3', count: 5 },
    ];
    return pickNextAssigneePure(members, loads) === 'V1';
  });
  t('pickNextAssignee: fallback Owner se não houver Vendedor/Manager', () => {
    const ownerOnly: MemberRef[] = members.filter((m) => m.role === 'Owner');
    return pickNextAssigneePure(ownerOnly, []) === 'O1';
  });
  t('pickNextAssignee: sem ninguém → null', () => {
    return pickNextAssigneePure([], []) === null;
  });
  t('pickNextAssignee: Vendedor sem leads vence Manager com leads', () => {
    const loads: LoadCount[] = [
      { memberId: 'V1', count: 3 },
      { memberId: 'V2', count: 3 },
      { memberId: 'V3', count: 0 },
    ];
    return pickNextAssigneePure(members, loads) === 'V3';
  });

  // ── M8#5 Webhook (payload schema + rate limit) ──────────────────────────
  t = run('webhook-leads-m8', results);

  t('webhookLeadPayloadSchema aceita name + phone', () => {
    return webhookLeadPayloadSchema.safeParse({
      name: 'Carlos',
      phone: '+55 11 99999-0000',
    }).success;
  });
  t('webhookLeadPayloadSchema aceita name + phone + email + source', () => {
    return webhookLeadPayloadSchema.safeParse({
      name: 'Carlos',
      phone: '+55 11 99999-0000',
      email: 'c@x.com',
      source: 'meta_ads',
    }).success;
  });
  t('webhookLeadPayloadSchema rejeita sem name', () => {
    return !webhookLeadPayloadSchema.safeParse({ phone: '+55 11 99999-0000' }).success;
  });
  t('webhookLeadPayloadSchema rejeita sem phone', () => {
    return !webhookLeadPayloadSchema.safeParse({ name: 'X', email: 'x@x.com' }).success;
  });
  t('webhookLeadPayloadSchema rejeita source fora do enum', () => {
    return !webhookLeadPayloadSchema.safeParse({
      name: 'X',
      phone: '+55 11 99999-0000',
      source: 'jamaica',
    }).success;
  });
  t('webhookLeadPayloadSchema rejeita >8 tags', () => {
    const tags = Array.from({ length: 9 }, (_, i) => `tag${i}`);
    return !webhookLeadPayloadSchema.safeParse({
      name: 'X',
      phone: '+55 11 99999-0000',
      tags,
    }).success;
  });
  t('webhookLeadPayloadSchema aceita custom_fields como record<string,string>', () => {
    return webhookLeadPayloadSchema.safeParse({
      name: 'X',
      phone: '+55 11 99999-0000',
      custom_fields: { metragem: '120', andar: '7' },
    }).success;
  });

  // Rate limit puro
  t('rate limit: dentro do limite → ok', () => {
    const store = new Map();
    return checkRateLimitPure(store, 'tok1', 0, 100, 60_000).ok === true;
  });
  t('rate limit: excedeu limite → ok=false + retryAfterMs', () => {
    const store = new Map();
    for (let i = 0; i < 100; i++) checkRateLimitPure(store, 'tok2', 0, 100, 60_000);
    const result = checkRateLimitPure(store, 'tok2', 0, 100, 60_000);
    return result.ok === false && result.retryAfterMs > 0;
  });
  t('rate limit: janela expirada → reseta', () => {
    const store = new Map();
    for (let i = 0; i < 100; i++) checkRateLimitPure(store, 'tok3', 0, 100, 60_000);
    // Avança 70s, fora da janela
    return checkRateLimitPure(store, 'tok3', 70_000, 100, 60_000).ok === true;
  });
  t('rate limit: cada chave tem bucket separado', () => {
    const store = new Map();
    for (let i = 0; i < 100; i++) checkRateLimitPure(store, 'A', 0, 100, 60_000);
    return checkRateLimitPure(store, 'B', 0, 100, 60_000).ok === true;
  });

  // ── M8#6 Attachments (validação + helpers de storage) ───────────────────
  t = run('attachments-m8', results);

  t('MAX_FILE_SIZE = 10 MB', () => MAX_FILE_SIZE === 10 * 1024 * 1024);
  t('ALLOWED_MIME_TYPES contém PDF + PNG + JPEG + DOCX', () => {
    return (
      ALLOWED_MIME_TYPES.has('application/pdf') &&
      ALLOWED_MIME_TYPES.has('image/png') &&
      ALLOWED_MIME_TYPES.has('image/jpeg') &&
      ALLOWED_MIME_TYPES.has(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
    );
  });

  // validateAttachmentInput
  t('validateAttachmentInput aceita PDF 1MB', () => {
    return validateAttachmentInput({
      mimeType: 'application/pdf',
      sizeBytes: 1024 * 1024,
      fileName: 'proposta.pdf',
    }).ok;
  });
  t('validateAttachmentInput rejeita ZIP', () => {
    const r = validateAttachmentInput({
      mimeType: 'application/zip',
      sizeBytes: 1024,
      fileName: 'a.zip',
    });
    return !r.ok && r.code === 'mime';
  });
  t('validateAttachmentInput rejeita >10MB', () => {
    const r = validateAttachmentInput({
      mimeType: 'application/pdf',
      sizeBytes: 11 * 1024 * 1024,
      fileName: 'grande.pdf',
    });
    return !r.ok && r.code === 'size';
  });
  t('validateAttachmentInput rejeita nome vazio', () => {
    const r = validateAttachmentInput({
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      fileName: '',
    });
    return !r.ok && r.code === 'name';
  });
  t('validateAttachmentInput rejeita tamanho 0', () => {
    const r = validateAttachmentInput({
      mimeType: 'application/pdf',
      sizeBytes: 0,
      fileName: 'vazio.pdf',
    });
    return !r.ok && r.code === 'size';
  });

  // sanitizeFileName
  t('sanitizeFileName remove acentos + espaços', () => {
    return sanitizeFileName('Proposta v3 (final).pdf') === 'proposta-v3-final.pdf';
  });
  t('sanitizeFileName mantém extensão', () => {
    return sanitizeFileName('Cláusulas àbêcedárias.docx') === 'clausulas-abecedarias.docx';
  });
  t('sanitizeFileName retorna "arquivo" para nome inválido', () => {
    return sanitizeFileName('!!!.pdf') === 'arquivo.pdf';
  });

  // buildStoragePath
  t('buildStoragePath gera <wid>/<lid>/<uuid>-<filename>', () => {
    const wid = '11111111-1111-4111-9111-111111111111';
    const lid = '22222222-2222-4222-9222-222222222222';
    const path = buildStoragePath(wid, lid, 'doc.pdf', () => 'fixed-uuid');
    return path === `${wid}/${lid}/fixed-uuid-doc.pdf`;
  });

  // formatFileSize
  t('formatFileSize: 1024 → "1.0 KB"', () => formatFileSize(1024) === '1.0 KB');
  t('formatFileSize: 1500000 → "1.4 MB"', () => formatFileSize(1500000) === '1.4 MB');
  t('formatFileSize: 500 → "500 B"', () => formatFileSize(500) === '500 B');

  // Schemas Zod
  t('uploadAttachmentMetadataSchema rejeita leadId não-UUID', () => {
    return !uploadAttachmentMetadataSchema.safeParse({
      leadId: 'lead_x',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    }).success;
  });
  t('uploadAttachmentMetadataSchema rejeita mimeType fora da whitelist', () => {
    return !uploadAttachmentMetadataSchema.safeParse({
      leadId: '11111111-1111-4111-9111-111111111111',
      fileName: 'a.zip',
      mimeType: 'application/zip',
      sizeBytes: 1024,
    }).success;
  });
  t('uploadAttachmentMetadataSchema rejeita sizeBytes >10MB', () => {
    return !uploadAttachmentMetadataSchema.safeParse({
      leadId: '11111111-1111-4111-9111-111111111111',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 11 * 1024 * 1024,
    }).success;
  });
  t('uploadAttachmentMetadataSchema aceita input válido', () => {
    return uploadAttachmentMetadataSchema.safeParse({
      leadId: '11111111-1111-4111-9111-111111111111',
      fileName: 'proposta.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024 * 1024,
    }).success;
  });
  t('deleteAttachmentSchema rejeita attachmentId não-UUID', () => {
    return !deleteAttachmentSchema.safeParse({ attachmentId: 'x' }).success;
  });
  t('signedUrlSchema rejeita attachmentId não-UUID', () => {
    return !signedUrlSchema.safeParse({ attachmentId: 'x' }).success;
  });

  // ── M8#7 Export CSV ─────────────────────────────────────────────────────
  t = run('exports-m8', results);

  t('EXPORT_MAX_ROWS = 5000', () => EXPORT_MAX_ROWS === 5000);

  // escapeCsvValue
  t('escapeCsvValue: string simples sem mudança', () => escapeCsvValue('João') === 'João');
  t('escapeCsvValue: vírgula → envolve em aspas', () => {
    return escapeCsvValue('Silva, João') === '"Silva, João"';
  });
  t('escapeCsvValue: aspas → duplica + envolve', () => {
    return escapeCsvValue('he said "hi"') === '"he said ""hi"""';
  });
  t('escapeCsvValue: newline → envolve em aspas', () => {
    return escapeCsvValue('linha1\nlinha2') === '"linha1\nlinha2"';
  });
  t('escapeCsvValue: null → string vazia', () => escapeCsvValue(null) === '');
  t('escapeCsvValue: undefined → string vazia', () => escapeCsvValue(undefined) === '');
  t('escapeCsvValue: number → string', () => escapeCsvValue(42) === '42');

  // serializeCsvRow
  t('serializeCsvRow joina células com vírgula', () => {
    return serializeCsvRow(['a', 'b', 'c']) === 'a,b,c';
  });
  t('serializeCsvRow escapa célula com vírgula', () => {
    return serializeCsvRow(['Silva, J.', 'OK']) === '"Silva, J.",OK';
  });

  // serializeLeadsCsv (smoke completo do contrato)
  const sampleLeadCsv: LeadCsvRow = {
    name: 'João Silva',
    email: 'joao@x.com',
    phone: '+55 11 99999-0000',
    company: 'Acme Ltda.',
    position: null,
    origin: 'manual',
    status: 'ativo',
    stageName: 'Em contato',
    assignedToName: 'Maria',
    valueCents: 150000,
    tags: ['imobiliário', 'quente'],
    notes: null,
    lastInteractionAt: null,
    nextActionAt: null,
    createdAt: new Date('2026-05-15T14:23:00Z'),
  };
  t('serializeLeadsCsv começa com BOM UTF-8', () => {
    const csv = serializeLeadsCsv([sampleLeadCsv]);
    return csv.startsWith(UTF8_BOM);
  });
  t('serializeLeadsCsv tem header em pt-BR', () => {
    const csv = serializeLeadsCsv([sampleLeadCsv]);
    return csv.includes('Nome,Email,Telefone,Empresa');
  });
  t('serializeLeadsCsv formata valueCents com vírgula decimal', () => {
    const csv = serializeLeadsCsv([sampleLeadCsv]);
    return csv.includes('"1500,00"') || csv.includes('1500,00');
  });
  t('serializeLeadsCsv joina tags com semicolon', () => {
    const csv = serializeLeadsCsv([sampleLeadCsv]);
    return csv.includes('imobiliário; quente');
  });
  t('serializeLeadsCsv usa CRLF entre linhas', () => {
    const csv = serializeLeadsCsv([sampleLeadCsv]);
    return csv.includes('\r\n');
  });

  // exportLeadsSchema
  t('exportLeadsSchema aceita payload vazio', () => {
    return exportLeadsSchema.safeParse({}).success;
  });
  t('exportLeadsSchema rejeita stageId não-UUID', () => {
    return !exportLeadsSchema.safeParse({ stageIds: ['x'] }).success;
  });
  t('exportLeadsSchema rejeita origin fora do enum', () => {
    return !exportLeadsSchema.safeParse({ origins: ['jamaica'] as never }).success;
  });
  t('exportLeadsSchema aceita filtros válidos', () => {
    return exportLeadsSchema.safeParse({
      search: 'maria',
      stageIds: ['11111111-1111-4111-9111-111111111111'],
      origins: ['meta_ads'],
      tagNames: ['imobiliário'],
    }).success;
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  return NextResponse.json(
    { passed, failed, total: results.length, results },
    { status: failed === 0 ? 200 : 500 },
  );
}
