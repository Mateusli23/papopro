/**
 * Helpers puros pra calcular bounds de cada `DashboardRange`. Mantidos fora
 * do hook (`use-dashboard-range.ts`) pra que o smoke test possa testar
 * sem montar React.
 *
 * Decisões de produto:
 *  - Semana começa **segunda-feira** (locale pt-BR via `weekStartsOn: 1`).
 *  - "Período anterior igual" = janela de mesmo tamanho imediatamente
 *    anterior. Pra `today`, é "ontem"; pra `week`, é "semana passada"; pra
 *    `month`, é "mês passado" (com mesma quantidade de dias, não mês
 *    calendário — evita comparar fevereiro com março direto).
 *  - `range='all'` não tem período anterior — `previousStart`/`previousEnd`
 *    ficam undefined e o trend vai pra `flat 0` automaticamente.
 *  - `range='custom'` recebe os bounds explícitos via `customRange` arg.
 */
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format as fmtDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { capitalize } from '@/lib/utils/format';

import type { DashboardRange, RangeBounds } from './types';

/**
 * Janela fixa de "agora" usada quando o caller não passa `now`. Espelha
 * a constante de `transforms.ts` — fixtures foram seedadas em torno desse
 * momento, então usar `new Date()` real faria os dados de demo sumirem.
 */
export const DASHBOARD_NOW = new Date('2026-05-09T14:00:00-03:00');

const LABEL_OF: Record<DashboardRange, string> = {
  today: 'Hoje',
  week: 'Esta semana',
  month: 'Este mês',
  all: 'Máximo',
  custom: 'Personalizado',
};

/**
 * Calcula bounds do range corrente + bounds do "período anterior igual".
 *
 * Pra ranges custom o caller passa `{ start, end }` em `customRange` —
 * o helper computa o período anterior simétrico (mesmo número de dias
 * imediatamente antes do `start`).
 */
export function computeRangeBounds(
  range: DashboardRange,
  now: Date = DASHBOARD_NOW,
  customRange?: { start: Date; end: Date },
): RangeBounds {
  const today = startOfDay(now);
  const todayEnd = endOfDay(now);

  switch (range) {
    case 'today': {
      const previousStart = startOfDay(subDays(now, 1));
      const previousEnd = endOfDay(subDays(now, 1));
      return {
        range,
        start: today,
        end: todayEnd,
        previousStart,
        previousEnd,
        label: LABEL_OF.today,
      };
    }

    case 'week': {
      const start = startOfWeek(now, { weekStartsOn: 1, locale: ptBR });
      const end = endOfWeek(now, { weekStartsOn: 1, locale: ptBR });
      const previousStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1, locale: ptBR });
      const previousEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1, locale: ptBR });
      return {
        range,
        start,
        end,
        previousStart,
        previousEnd,
        label: LABEL_OF.week,
      };
    }

    case 'month': {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      const previousStart = startOfMonth(subMonths(now, 1));
      const previousEnd = endOfMonth(subMonths(now, 1));
      return {
        range,
        start,
        end,
        previousStart,
        previousEnd,
        label: LABEL_OF.month,
      };
    }

    case 'all': {
      // "Desde sempre" — sem período anterior. Em fixtures, o limite inferior
      // é arbitrariamente longe (data Unix epoch). O hook usa o range como
      // "no filter", o transform também trata desse jeito.
      return {
        range,
        start: new Date(0),
        end: todayEnd,
        previousStart: undefined,
        previousEnd: undefined,
        label: LABEL_OF.all,
      };
    }

    case 'custom': {
      if (!customRange) {
        // Fallback defensivo — sem custom range definido, comporta como `today`.
        return computeRangeBounds('today', now);
      }
      const start = startOfDay(customRange.start);
      const end = endOfDay(customRange.end);
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
      const previousEnd = endOfDay(subDays(start, 1));
      const previousStart = startOfDay(subDays(start, days));
      const label = `${fmtDate(start, "d 'de' MMM", { locale: ptBR })} – ${fmtDate(end, "d 'de' MMM", { locale: ptBR })}`;
      return {
        range,
        start,
        end,
        previousStart,
        previousEnd,
        label,
      };
    }
  }
}

/**
 * Saudação com data por extenso, primeira letra em maiúscula.
 * Ex: `"Domingo, 10 de maio"`.
 */
export function formatHeaderDate(now: Date = DASHBOARD_NOW): string {
  const raw = fmtDate(now, "EEEE, d 'de' MMMM", { locale: ptBR });
  return capitalize(raw);
}

/**
 * Lê e valida o param `?range=` da URL. Aceita só os 5 valores conhecidos;
 * qualquer outro vira `'week'` (default). Sem zod aqui pra evitar import
 * em cada render — o conjunto é fechado e pequeno.
 */
const VALID_RANGES = new Set<DashboardRange>(['today', 'week', 'month', 'all', 'custom']);

export function parseDashboardRange(raw: string | null | undefined): DashboardRange {
  if (raw && VALID_RANGES.has(raw as DashboardRange)) {
    return raw as DashboardRange;
  }
  return 'week';
}
