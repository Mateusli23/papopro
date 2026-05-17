/**
 * Helpers puros do bloco "Cadências" em `/reports` (M10#5).
 *
 * Sem `'server-only'` nem dependência de Prisma — podem ser importados em
 * smoke endpoint, vitest e qualquer componente. Toda a lógica que precisa
 * de runtime Server (queries, RLS) vive em `queries.ts`.
 */

/**
 * Taxa de resposta segura contra divisão por zero. Retorna 0 quando não há
 * enrollment no período (evita `NaN` ou `Infinity` viajando até o UI).
 *
 * Intervalo: [0, 1]. Quem formata pra `%` é `formatRate`.
 */
export function computeResponseRate(replied: number, enrolled: number): number {
  if (!Number.isFinite(replied) || !Number.isFinite(enrolled)) return 0;
  if (enrolled <= 0) return 0;
  const r = replied / enrolled;
  if (r < 0) return 0;
  if (r > 1) return 1;
  return r;
}

/**
 * Formata uma taxa [0,1] como percentual pt-BR ("12%" / "12,5%"). `fraction`
 * controla casas decimais. Default 0 — relatórios preferem números limpos.
 *
 * Não usa `Intl.NumberFormat` com `style:'percent'` pra evitar locale do
 * runtime divergir entre Vercel (en-US default) e dev local (pt-BR default).
 */
export function formatRate(rate: number, fraction = 0): string {
  if (!Number.isFinite(rate)) return '0%';
  const clamped = rate < 0 ? 0 : rate > 1 ? 1 : rate;
  const pct = clamped * 100;
  const rounded = pct.toFixed(fraction);
  return `${rounded.replace('.', ',')}%`;
}

/**
 * Razões de skip que indicam **bloqueio anti-ban** (rate limit, instância
 * insalubre, fora do horário comercial). Não inclui `email_stub`/`blacklist`/
 * `no_phone`/`lead_deleted` — esses são "skip por configuração do lead",
 * não pressão da camada anti-ban.
 *
 * Usado pra coluna "Bloqueios anti-ban 30d" da tabela de performance.
 */
export const ANTI_BAN_SKIP_REASONS = ['rate_limit', 'unhealthy', 'outside_business_hours'] as const;
export type AntiBanSkipReason = (typeof ANTI_BAN_SKIP_REASONS)[number];

/**
 * Ordena linhas da tabela "Performance por cadência" por `dispatched30d` desc,
 * com tiebreak alfabético em `name` pra estabilidade (mesmo render entre
 * refreshes).
 */
export function sortCadenceReportRows<T extends { dispatched30d: number; name: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (b.dispatched30d !== a.dispatched30d) return b.dispatched30d - a.dispatched30d;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

/**
 * Remove etapas com `coldCount === 0` antes de renderizar a BarChart.
 * Mantém pelo menos 1 row pra UI decidir entre "tudo zerado" e "etapa X só".
 *
 * Decisão: filtramos no transform (não na query) pra que a query continue
 * estável caso o produto resolva mostrar todas as etapas em outro contexto.
 */
export function filterColdRowsForChart<T extends { coldCount: number }>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.coldCount > 0);
}
