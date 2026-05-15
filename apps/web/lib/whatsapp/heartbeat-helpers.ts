/**
 * Helpers puros do heartbeat WhatsApp (M9#5).
 *
 * Separados da Edge Function (`supabase/functions/whatsapp-heartbeat/index.ts`)
 * porque a Edge roda em Deno e não pode importar daqui — mas a regra de
 * health transition precisa ser **a mesma** em ambos. A Edge mantém uma
 * cópia inline (Deno) e o smoke testa esta versão como fonte canônica.
 *
 * **`computeNextHealth`** — política simples de 3 estados:
 *   - sucesso → healthy (recupera de qualquer estado anterior)
 *   - falha + healthy → degraded
 *   - falha + degraded → unhealthy
 *   - falha + unhealthy → mantém unhealthy (não tem como piorar)
 *
 * Conservador o bastante pra não marcar vermelho num flake de rede único,
 * mas escala pra unhealthy após 2 falhas consecutivas. Pausa de envios
 * pelo anti-ban (M9#3) já bloqueia outbound em `degraded`/`unhealthy`.
 */

export type HealthScore = 'healthy' | 'degraded' | 'unhealthy';

export function computeNextHealth(currentHealth: HealthScore, success: boolean): HealthScore {
  if (success) return 'healthy';
  if (currentHealth === 'healthy') return 'degraded';
  if (currentHealth === 'degraded') return 'unhealthy';
  return 'unhealthy';
}

/**
 * Resumo agregado de uma execução do heartbeat — payload de retorno da Edge
 * Function + payload de WhatsappEvent. Tipos compartilhados com o smoke.
 */
export interface HeartbeatSummary {
  checked: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  errors: number;
}

/**
 * Constrói o resumo a partir das transições. Usada pelo smoke pra testar
 * agregação independente da Edge.
 */
export function summarizeHeartbeat(
  outcomes: ReadonlyArray<{ next: HealthScore; errored: boolean }>,
): HeartbeatSummary {
  let healthy = 0;
  let degraded = 0;
  let unhealthy = 0;
  let errors = 0;
  for (const o of outcomes) {
    if (o.errored) errors += 1;
    if (o.next === 'healthy') healthy += 1;
    else if (o.next === 'degraded') degraded += 1;
    else if (o.next === 'unhealthy') unhealthy += 1;
  }
  return { checked: outcomes.length, healthy, degraded, unhealthy, errors };
}
