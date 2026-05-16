/**
 * Cálculo puro do próximo `next_run_at` da enrollment (M10#2).
 *
 * Após um dispatch bem-sucedido (ou skip avançante), o `next_run_at` da
 * enrollment é movido pro horário absoluto do **próximo** `day_offset` da
 * cadência relativo a `enrolled_at`. Se não há próximo step, a enrollment
 * é marcada `completed`.
 *
 * **Por que absoluto e não +1 dia**: o schema M10#1 restringe `day_offset`
 * a {0, 1, 3, 7, 14, 30}. Calcular como `enrolled_at + day_offset` preserva
 * a intenção original mesmo que o runner atrase 1-2 ciclos (5 min cada).
 *
 * Backoff transiente (`outside_business_hours`/`rate_limit`/`unhealthy`)
 * usa `computeBackoffNextRunAt` — adia `next_run_at` por 30 min sem
 * avançar o step. ATENÇÃO: o LEFT JOIN da RPC SQL considera QUALQUER
 * `cadence_step_runs` row como "executada", então skip transiente também
 * avança o step. Retry do MESMO step exigiria DELETE do skipped row
 * antes do backoff — trade-off escolhido em M10#2: skip avança sempre.
 */
import { addDays, addMinutes } from 'date-fns';

export type DayOffset = 0 | 1 | 3 | 7 | 14 | 30;

export const DAY_OFFSETS: readonly DayOffset[] = [0, 1, 3, 7, 14, 30] as const;

export interface ComputeNextRunAtResult {
  /** Próximo timestamp absoluto, ou `null` se não há próximo step. */
  nextRunAt: Date | null;
  /** Se `true`, enrollment deve virar `completed`. */
  isComplete: boolean;
}

/**
 * Dado o `enrolled_at` e o `day_offset` do step que acabou de rodar,
 * retorna o próximo `next_run_at` baseado nos `day_offset`s restantes
 * da cadência.
 *
 * `availableDayOffsets` é a lista COMPLETA dos `day_offset` da cadência
 * (não só os "remaining"). A função filtra por `> currentStepDayOffset`.
 *
 * @example
 *   computeNextRunAt(new Date('2026-05-01'), 1, [0,1,3,7])
 *   // → { nextRunAt: 2026-05-04, isComplete: false }
 *
 * @example
 *   computeNextRunAt(new Date('2026-05-01'), 7, [0,1,3,7])
 *   // → { nextRunAt: null, isComplete: true }
 */
export function computeNextRunAt(
  enrolledAt: Date,
  currentStepDayOffset: DayOffset,
  availableDayOffsets: readonly number[],
): ComputeNextRunAtResult {
  const next = availableDayOffsets
    .filter((d): d is DayOffset => DAY_OFFSETS.includes(d as DayOffset))
    .sort((a, b) => a - b)
    .find((d) => d > currentStepDayOffset);

  if (next === undefined) {
    return { nextRunAt: null, isComplete: true };
  }
  return { nextRunAt: addDays(enrolledAt, next), isComplete: false };
}

/**
 * Backoff transiente — usado quando anti-ban retorna razão transiente
 * (fora de horário, burst pause, rate limit, instance unhealthy).
 * Adia `next_run_at` por N minutos (default 30) sem avançar o step.
 */
export function computeBackoffNextRunAt(now: Date, backoffMinutes = 30): Date {
  return addMinutes(now, backoffMinutes);
}
