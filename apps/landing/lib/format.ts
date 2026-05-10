/**
 * Formatação de moeda em pt-BR. Usa `Intl.NumberFormat` (nativo, zero deps)
 * com locale `pt-BR` e currency `BRL` — o output respeita as convenções
 * brasileiras: vírgula como decimal, ponto como milhar, "R$" antes do número.
 *
 * Padrão de uso:
 *   formatBRL(1234.5)  // "R$ 1.234,50"
 *   formatBRL(0)       // "R$ 0,00"
 *
 * Mantemos sempre 2 casas decimais — em landing/marketing, "R$ 1.234" parece
 * arredondado e desconfiável; "R$ 1.234,50" parece um cálculo real.
 */
const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(value: number): string {
  if (!Number.isFinite(value)) return BRL.format(0);
  return BRL.format(value);
}
