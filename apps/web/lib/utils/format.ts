/**
 * Formatadores pt-BR usados em toda a UI de leads/kanban/inbox.
 *
 * Centralizar evita drift visual ("R$ 1.200" num lugar, "R$1200,00" em outro)
 * e prepara o terreno pra i18n futura — basta trocar a `Intl.NumberFormat`
 * por uma versão que respeita o locale do usuário.
 *
 * Datas usam `date-fns` com locale `pt-BR`; em qualquer lógica de negócio
 * sensível a fuso (M8+ — agendamentos, deal rotting), usar `America/Sao_Paulo`
 * via `date-fns-tz` (CLAUDE.md §5).
 */
import { formatDistanceToNow, format as fmtDate, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const BRL_PRECISE = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** R$ 850.000 — sem centavos, para tabela densa. */
export function formatCentsCompact(cents: number | undefined): string {
  if (!cents) return '—';
  return BRL.format(cents / 100);
}

/** R$ 850.000,00 — com centavos, para ficha de detalhe. */
export function formatCents(cents: number | undefined): string {
  if (!cents) return '—';
  return BRL_PRECISE.format(cents / 100);
}

/**
 * Converte entrada humana em BRL para centavos.
 *
 * Regra de produto: quando o usuário digita só números/separadores de milhar
 * (`800000`, `800.000`, `R$ 800.000`), o valor representa reais inteiros.
 * Só tratamos centavos quando há separador decimal claro no final
 * (`800.000,50` ou `800000.50`).
 */
export function parseCurrencyInputToCents(raw: string): number {
  const normalized = raw.trim();
  if (!normalized) return 0;

  const decimalMatch = normalized.match(/[,.](\d{1,2})\s*$/);
  const hasExplicitDecimal = Boolean(decimalMatch);
  const centsPart = hasExplicitDecimal ? decimalMatch?.[1]?.padEnd(2, '0') : undefined;
  const integerPart = hasExplicitDecimal
    ? normalized.slice(0, normalized.length - (decimalMatch?.[0]?.length ?? 0))
    : normalized;

  const reaisDigits = integerPart.replace(/\D/g, '');
  const reais = reaisDigits ? Number.parseInt(reaisDigits, 10) : 0;
  const cents = centsPart ? Number.parseInt(centsPart, 10) : 0;

  return reais * 100 + cents;
}

/** Valor inteiro em reais para preencher inputs editáveis sem `R$`. */
export function formatCentsForCurrencyInput(cents: number | undefined): string {
  if (!cents) return '';
  return String(Math.floor(cents / 100));
}

/** "há 2 horas", "há 3 dias" — preserva sentido sem precisar de data exata. */
export function formatRelative(iso: string | undefined): string {
  if (!iso) return '—';
  return formatDistanceToNow(parseISO(iso), { locale: ptBR, addSuffix: true });
}

/** "08/05/2026" — exato, para tooltip ou colunas onde o relativo confunde. */
export function formatDateShort(iso: string | undefined): string {
  if (!iso) return '—';
  return fmtDate(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR });
}

/** "08/05/2026 14:32" — exato com horário. */
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  return fmtDate(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/** "08 mai" — compacto pra cards de Kanban. */
export function formatDayMonth(iso: string | undefined): string {
  if (!iso) return '—';
  return fmtDate(parseISO(iso), 'dd MMM', { locale: ptBR });
}

/**
 * Telefone BR — entrada é livre (com/sem máscara). Saída padronizada
 * `+55 11 9 9999-0000`. Útil quando o usuário cola um número e a gente
 * normaliza na exibição.
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 5)} ${digits.slice(5, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

/** Iniciais a partir do nome — "Mariana Costa" → "MC". */
export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

/**
 * Primeira letra em maiúscula. date-fns formatos como "EEEE" devolvem
 * o nome do dia em minúsculas em pt-BR ("domingo, 10 de maio") e a UI
 * exibe sempre com inicial maiúscula.
 */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
