/**
 * Seletor puro de "próximo step não-executado" (M10#2).
 *
 * Espelho TypeScript da RPC SQL `cadence_runner_pick_candidates` (LATERAL
 * JOIN com LEFT JOIN cadence_step_runs). Usado em smoke pra validar a
 * lógica de ordenação SEM precisar de banco rodando.
 *
 * Ordenação: `day_offset` ascendente, depois `order_index` ascendente.
 * Step com row em `cadence_step_runs` (qualquer status — sent/skipped/
 * failed) é considerado executado e ignorado.
 */

export interface StepCandidate {
  id: string;
  day_offset: number;
  order_index: number;
  channel: 'whatsapp' | 'email';
  template_body: string;
}

export function pickNextStep(
  steps: readonly StepCandidate[],
  executedStepIds: ReadonlySet<string>,
): StepCandidate | null {
  const pending = steps.filter((s) => !executedStepIds.has(s.id));
  if (pending.length === 0) return null;
  return (
    [...pending].sort((a, b) => a.day_offset - b.day_offset || a.order_index - b.order_index)[0] ??
    null
  );
}
