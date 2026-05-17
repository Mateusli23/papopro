import { describe, expect, it } from 'vitest';

import type { PipelineStage } from '@/features/leads/types';

import { cadenceCreateSchema } from './schemas';
import { groupCadencesByStage } from './transforms';
import type { Cadence } from './types';

/**
 * Regressões do M10 followup:
 *  - P1#1 stageId UUID vs fixture: cadências reais têm `stageId` UUID; o
 *    agrupamento e o schema antes usavam slugs do fixture (DEFAULT_STAGES)
 *    e perdiam todas as cadências reais ou rejeitavam o submit do dialog.
 *
 * São testes de função pura — não exercitam Prisma/Supabase/RBAC. O lifecycle
 * end-to-end (create cadence → enroll → dispatch) é coberto por smoke E2E
 * separado (M10#5).
 */

const STAGE_NOVO_ID = '11111111-2222-4333-8444-555555555551';
const STAGE_EM_CONTATO_ID = '11111111-2222-4333-8444-555555555552';
const STAGE_GANHO_ID = '11111111-2222-4333-8444-555555555553';

const REAL_PIPELINE_STAGES: PipelineStage[] = [
  { id: STAGE_NOVO_ID, slug: 'novo', name: 'Novo', order: 1, rotDays: 7 },
  { id: STAGE_EM_CONTATO_ID, slug: 'em_contato', name: 'Em contato', order: 2, rotDays: 14 },
  {
    id: STAGE_GANHO_ID,
    slug: 'ganho',
    name: 'Ganho',
    order: 3,
    rotDays: 0,
    terminal: true,
    tone: 'success',
  },
];

function makeCadence(id: string, stageId: string): Cadence {
  return {
    id,
    workspaceId: 'ws_test',
    name: `Cadência ${id}`,
    description: undefined,
    stageId,
    status: 'active',
    templateKey: 'blank',
    steps: [],
    metrics: {
      activeEnrollments: 0,
      totalDispatched: 0,
      responseRate: 0,
      stageAdvanceRate: 0,
    },
    createdAt: '2026-05-16T00:00:00.000Z',
    updatedAt: '2026-05-16T00:00:00.000Z',
  };
}

describe('groupCadencesByStage', () => {
  it('agrupa cadências cujo stageId é UUID real (regressão P1#1)', () => {
    const cadences = [
      makeCadence('cad-1', STAGE_NOVO_ID),
      makeCadence('cad-2', STAGE_NOVO_ID),
      makeCadence('cad-3', STAGE_EM_CONTATO_ID),
    ];

    const groups = groupCadencesByStage(cadences, REAL_PIPELINE_STAGES);

    const novo = groups.find((g) => g.stageId === STAGE_NOVO_ID);
    const emContato = groups.find((g) => g.stageId === STAGE_EM_CONTATO_ID);

    expect(novo?.cadences.map((c) => c.id)).toEqual(['cad-1', 'cad-2']);
    expect(emContato?.cadences.map((c) => c.id)).toEqual(['cad-3']);
  });

  it('exclui etapas terminais (ganho/perdido)', () => {
    const cadences = [makeCadence('cad-ganho', STAGE_GANHO_ID)];

    const groups = groupCadencesByStage(cadences, REAL_PIPELINE_STAGES);

    expect(groups.map((g) => g.stageId)).not.toContain(STAGE_GANHO_ID);
    // E a cadência órfã (apontando pra etapa terminal) não aparece em lugar
    // nenhum — bucket pra ela não existe; o caller cuida de avisar ou ignorar.
    const allCadenceIds = groups.flatMap((g) => g.cadences.map((c) => c.id));
    expect(allCadenceIds).not.toContain('cad-ganho');
  });

  it('preserva ordem do pipeline (order asc)', () => {
    const shuffled: PipelineStage[] = [
      { ...REAL_PIPELINE_STAGES[1]! },
      { ...REAL_PIPELINE_STAGES[0]! },
    ];

    const groups = groupCadencesByStage([], shuffled);

    expect(groups.map((g) => g.stageId)).toEqual([STAGE_NOVO_ID, STAGE_EM_CONTATO_ID]);
  });

  it('com lista de cadências vazia, devolve buckets vazios por etapa ativa', () => {
    const groups = groupCadencesByStage([], REAL_PIPELINE_STAGES);

    expect(groups.length).toBe(2);
    expect(groups.every((g) => g.cadences.length === 0)).toBe(true);
  });
});

describe('cadenceCreateSchema', () => {
  it('aceita stageId UUID (regressão P1#1: antes só aceitava slugs do fixture)', () => {
    const r = cadenceCreateSchema.safeParse({
      name: 'Cadência válida',
      stageId: STAGE_NOVO_ID,
      templateKey: 'blank',
    });

    expect(r.success).toBe(true);
  });

  it('rejeita stageId que não é UUID', () => {
    const r = cadenceCreateSchema.safeParse({
      name: 'Slug antigo',
      stageId: 'novo',
      templateKey: 'blank',
    });

    expect(r.success).toBe(false);
  });
});
