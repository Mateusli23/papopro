/**
 * Transformações puras do domínio Cadências.
 *
 * Toda função aqui é pura: recebe `Cadence[]` (e parâmetros), devolve novo
 * `Cadence[]` ou agregação. Sem side-effects, sem React. O store
 * (`store.ts`) é wrapper fino que aplica essas transformações ao snapshot
 * e dispara listeners.
 *
 * Em M8 cada função vira core de Server Actions correspondentes
 * (`createCadence`, `updateCadence`, `addStep`, `pauseCadence`, …). Os
 * tipos e contratos de retorno permanecem.
 *
 * Decisões de produto codificadas aqui:
 *  - Etapas terminais (`ganho`/`perdido`) são filtradas em `groupCadencesByStage`
 *    porque cadência em negócio fechado não faz sentido (PRD §2.2).
 *  - `applyDuplicate` adiciona " (cópia)" no nome — convenção de UX consistente
 *    com `duplicateDeal` em `features/deals/transforms.ts`.
 *  - `applyAddStep` ordena o array final por `(dayOffset asc, order asc)`
 *    pra manter timeline coerente sem sort no componente.
 */
import { DEFAULT_STAGES } from '@/lib/fixtures/pipelines';

import type {
  CadenceCreateInput,
  CadenceUpdateInput,
  StepCreateInput,
  StepUpdateInput,
} from './schemas';
import type { Cadence, CadenceStep, CadenceTemplate } from './types';

// ─── Mutações puras ───────────────────────────────────────────────────────

/**
 * Cria nova cadência clonando steps do template. `idGen`/`stepIdGen`
 * separados pra permitir injetar contadores de testes determinísticos.
 */
export function applyCreateCadence(
  cadences: Cadence[],
  input: CadenceCreateInput,
  template: CadenceTemplate | undefined,
  idGen: () => string,
  stepIdGen: () => string,
  workspaceId: string,
  now: string = new Date().toISOString(),
): { cadences: Cadence[]; created: Cadence } {
  const id = idGen();
  const steps: CadenceStep[] = (template?.steps ?? []).map((s, idx) => ({
    id: stepIdGen(),
    cadenceId: id,
    dayOffset: s.dayOffset,
    channel: s.channel,
    templateBody: s.templateBody,
    order: s.order || idx,
    createdAt: now,
  }));

  const created: Cadence = {
    id,
    workspaceId,
    name: input.name,
    description: input.description,
    stageId: input.stageId,
    status: 'active',
    templateKey: input.templateKey,
    steps,
    metrics: {
      activeEnrollments: 0,
      totalDispatched: 0,
      responseRate: 0,
      stageAdvanceRate: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  return { cadences: [created, ...cadences], created };
}

export function applyUpdateCadence(
  cadences: Cadence[],
  id: string,
  patch: CadenceUpdateInput,
  now: string = new Date().toISOString(),
): Cadence[] {
  let changed = false;
  const next = cadences.map((c) => {
    if (c.id !== id) return c;
    changed = true;
    return {
      ...c,
      ...patch,
      // Garante que `description: undefined` não sobrescreve um valor existente
      // por acidente — caller usa patch parcial, não substituição.
      description: patch.description ?? c.description,
      updatedAt: now,
    };
  });
  return changed ? next : cadences;
}

/** Atalho: alterna `active`↔`paused` sem precisar montar o patch inteiro. */
export function applyToggleStatus(cadences: Cadence[], id: string, now?: string): Cadence[] {
  const c = cadences.find((x) => x.id === id);
  if (!c) return cadences;
  return applyUpdateCadence(
    cadences,
    id,
    { status: c.status === 'active' ? 'paused' : 'active' },
    now,
  );
}

/**
 * Duplica cadência mantendo nome+" (cópia)". Steps clonados com novos IDs;
 * métricas zeradas (cópia começa do zero); status sempre `paused` pra
 * forçar revisão antes de ativar.
 */
export function applyDuplicate(
  cadences: Cadence[],
  id: string,
  idGen: () => string,
  stepIdGen: () => string,
  now: string = new Date().toISOString(),
): { cadences: Cadence[]; created: Cadence | undefined } {
  const original = cadences.find((c) => c.id === id);
  if (!original) return { cadences, created: undefined };

  const newId = idGen();
  const cloned: Cadence = {
    ...original,
    id: newId,
    name: `${original.name} (cópia)`,
    status: 'paused',
    steps: original.steps.map((s) => ({
      ...s,
      id: stepIdGen(),
      cadenceId: newId,
      createdAt: now,
    })),
    metrics: {
      activeEnrollments: 0,
      totalDispatched: 0,
      responseRate: 0,
      stageAdvanceRate: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  return { cadences: [cloned, ...cadences], created: cloned };
}

export function applyDeleteCadence(cadences: Cadence[], id: string): Cadence[] {
  const next = cadences.filter((c) => c.id !== id);
  return next.length === cadences.length ? cadences : next;
}

// ─── Mutações em steps (operam dentro de uma cadência) ────────────────────

export function applyAddStep(
  cadences: Cadence[],
  cadenceId: string,
  input: StepCreateInput,
  stepIdGen: () => string,
  now: string = new Date().toISOString(),
): { cadences: Cadence[]; created: CadenceStep | undefined } {
  const cadence = cadences.find((c) => c.id === cadenceId);
  if (!cadence) return { cadences, created: undefined };

  // Próximo `order` dentro do mesmo dayOffset = max(order) + 1.
  // Se for o primeiro do dia, order = 0.
  const sameDayMax = cadence.steps
    .filter((s) => s.dayOffset === input.dayOffset)
    .reduce((max, s) => Math.max(max, s.order), -1);

  const created: CadenceStep = {
    id: stepIdGen(),
    cadenceId,
    dayOffset: input.dayOffset,
    channel: input.channel,
    templateBody: input.templateBody,
    order: sameDayMax + 1,
    createdAt: now,
  };

  const next = cadences.map((c) =>
    c.id !== cadenceId
      ? c
      : {
          ...c,
          steps: sortSteps([...c.steps, created]),
          updatedAt: now,
        },
  );
  return { cadences: next, created };
}

export function applyUpdateStep(
  cadences: Cadence[],
  cadenceId: string,
  stepId: string,
  patch: StepUpdateInput,
  now: string = new Date().toISOString(),
): Cadence[] {
  const cadence = cadences.find((c) => c.id === cadenceId);
  if (!cadence) return cadences;
  const target = cadence.steps.find((s) => s.id === stepId);
  if (!target) return cadences;

  // Quando o usuário muda o `dayOffset`, recalcula `order` dentro do novo
  // bucket pra evitar colisão com steps existentes no mesmo dia. Sem isso,
  // dois steps podem ficar com o mesmo `order` em D+N e a ordenação vira
  // ambígua (resolvida só por estabilidade do sort, frágil).
  const isMovingDay = patch.dayOffset !== undefined && patch.dayOffset !== target.dayOffset;
  let nextOrder = target.order;
  if (isMovingDay) {
    const sameDayMax = cadence.steps
      .filter((s) => s.id !== stepId && s.dayOffset === patch.dayOffset)
      .reduce((max, s) => Math.max(max, s.order), -1);
    nextOrder = sameDayMax + 1;
  }

  return cadences.map((c) =>
    c.id !== cadenceId
      ? c
      : {
          ...c,
          steps: sortSteps(
            c.steps.map((s) =>
              s.id !== stepId
                ? s
                : {
                    ...s,
                    ...patch,
                    order: nextOrder,
                  },
            ),
          ),
          updatedAt: now,
        },
  );
}

export function applyDeleteStep(
  cadences: Cadence[],
  cadenceId: string,
  stepId: string,
  now: string = new Date().toISOString(),
): Cadence[] {
  const cadence = cadences.find((c) => c.id === cadenceId);
  if (!cadence) return cadences;
  const exists = cadence.steps.some((s) => s.id === stepId);
  if (!exists) return cadences;

  return cadences.map((c) =>
    c.id !== cadenceId
      ? c
      : {
          ...c,
          steps: c.steps.filter((s) => s.id !== stepId),
          updatedAt: now,
        },
  );
}

// ─── Helpers internos ─────────────────────────────────────────────────────

/** Ordena steps por `(dayOffset asc, order asc)`. */
function sortSteps(steps: CadenceStep[]): CadenceStep[] {
  return [...steps].sort((a, b) => {
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
    return a.order - b.order;
  });
}

// ─── Filtros / queries puras ──────────────────────────────────────────────

export interface CadenceFilters {
  /** ID da etapa — `undefined` retorna todas. */
  stageId?: string;
  /** Status — `undefined` retorna todos. */
  status?: 'active' | 'paused';
  /** Busca em `name` e `description` (case-insensitive). */
  search?: string;
}

export function filterCadences(cadences: Cadence[], filters: CadenceFilters = {}): Cadence[] {
  const search = filters.search?.trim().toLowerCase();
  return cadences.filter((c) => {
    if (filters.stageId && c.stageId !== filters.stageId) return false;
    if (filters.status && c.status !== filters.status) return false;
    if (search) {
      const haystack = `${c.name} ${c.description ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

// ─── Agregações ───────────────────────────────────────────────────────────

/**
 * Agrupa cadências pelas **etapas ativas** (não-terminais), preservando a
 * ordem do pipeline. Etapas terminais (`ganho`/`perdido`) são omitidas
 * inteiramente — cadência ali não faz sentido (PRD §2.2). Etapa sem cadência
 * vira bucket vazio (UI usa pra mostrar EmptyState com CTA).
 */
export function groupCadencesByStage(cadences: Cadence[]): Array<{
  stageId: string;
  stageName: string;
  cadences: Cadence[];
}> {
  return DEFAULT_STAGES.filter((s) => !s.terminal).map((stage) => ({
    stageId: stage.id,
    stageName: stage.name,
    cadences: cadences.filter((c) => c.stageId === stage.id),
  }));
}

export interface CadenceCounts {
  total: number;
  active: number;
  paused: number;
  totalSteps: number;
  totalActiveEnrollments: number;
}

export function countCadences(cadences: Cadence[]): CadenceCounts {
  return {
    total: cadences.length,
    active: cadences.filter((c) => c.status === 'active').length,
    paused: cadences.filter((c) => c.status === 'paused').length,
    totalSteps: cadences.reduce((sum, c) => sum + c.steps.length, 0),
    totalActiveEnrollments: cadences.reduce((sum, c) => sum + c.metrics.activeEnrollments, 0),
  };
}

/** Soma de enrollments ativos — KPI agregado pro header da lista. */
export function sumActiveEnrollments(cadences: Cadence[]): number {
  return cadences.reduce((sum, c) => sum + c.metrics.activeEnrollments, 0);
}
