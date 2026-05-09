/**
 * Pipeline default seedado por workspace na criação (CLAUDE.md §9 — glossário).
 *
 * Em M8 essa estrutura vira `pipelines` + `pipeline_stages` no Postgres
 * (workspace pode editar, mas todo workspace nasce com esse default).
 *
 * Os limiares de "rotting" (em dias) ficam aqui porque alimentam tanto o
 * Kanban (indicador visual) quanto o detector de lead frio (M10).
 */
import type { Pipeline, PipelineStage } from '@/features/leads/types';

export const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'novo', name: 'Novo', order: 1, rotDays: 7 },
  { id: 'em_contato', name: 'Em contato', order: 2, rotDays: 14 },
  { id: 'proposta', name: 'Proposta', order: 3, rotDays: 7 },
  { id: 'negociacao', name: 'Negociação', order: 4, rotDays: 5 },
  { id: 'ganho', name: 'Ganho', order: 5, rotDays: 0, terminal: true, tone: 'success' },
  { id: 'perdido', name: 'Perdido', order: 6, rotDays: 0, terminal: true, tone: 'destructive' },
];

export const DEFAULT_PIPELINE: Pipeline = {
  id: 'pipeline_default',
  name: 'Funil padrão',
  isDefault: true,
  stages: DEFAULT_STAGES,
};

export function getStage(stageId: string): PipelineStage | undefined {
  return DEFAULT_STAGES.find((s) => s.id === stageId);
}

export function getStageName(stageId: string): string {
  return getStage(stageId)?.name ?? stageId;
}

/** Etapas não-terminais — usadas como colunas do Kanban e selects de criação. */
export const ACTIVE_STAGES: PipelineStage[] = DEFAULT_STAGES.filter((s) => !s.terminal);
