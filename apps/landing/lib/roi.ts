/**
 * ROI estimator — claim conservador validado com o PO.
 *
 * `RECOVERY_RATE = 0.15` reflete o número que vendemos na landing
 * ("recupere ~15% dos leads que hoje esfriam sem follow-up"). É defensável
 * com qualquer baseline de SMB consultivo: 79% dos leads qualificados nunca
 * viram venda por falta de cadência (MarketingSherpa B2B Benchmark 2023);
 * resgatar 15% deles com cadência automática é conservador.
 *
 * Helper isolado (sem React) pra ser trivialmente testável e pra concentrar
 * o número num único lugar — quando o PO ajustar o claim, basta editar essa
 * constante e o copy da página acompanha via `(RECOVERY_RATE * 100)`.
 */
export const RECOVERY_RATE = 0.15;

/**
 * Estima a receita recuperada por mês.
 *
 * Retorna `0` para inputs inválidos (NaN, negativo, zero) pra que a UI possa
 * exibir "R$ 0" como estado neutro em vez de "NaN" / "Infinity" quando o
 * usuário ainda não digitou nada.
 */
export function estimateRecoveredRevenue(leadsMes: number, ticketMedio: number): number {
  if (!Number.isFinite(leadsMes) || !Number.isFinite(ticketMedio)) return 0;
  if (leadsMes <= 0 || ticketMedio <= 0) return 0;
  return leadsMes * ticketMedio * RECOVERY_RATE;
}
