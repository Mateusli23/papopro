/**
 * Stripe Node SDK singleton (M12#1).
 *
 * **Server-only.** A secret key NUNCA pode vazar pro browser (CLAUDE.md §7.1).
 * `'server-only'` faz o Next bundler quebrar o build se algum Client Component
 * importar daqui por engano.
 *
 * **apiVersion pinned.** Sem pin, o Stripe usa a versão da conta — e mudanças
 * de schema da API podem quebrar nosso TS sem aviso. Pinning isola o impacto
 * em upgrades controlados (skill `stripe:upgrade-stripe`).
 *
 * **Lazy instantiation.** `Stripe` é instanciado na primeira chamada — não no
 * import. Build-time (Next collect page data) pode importar este módulo sem
 * `STRIPE_SECRET_KEY` setada e não queremos crash do build.
 */
import 'server-only';

import Stripe from 'stripe';

let cached: Stripe | null = null;

/**
 * Retorna o Stripe client. Lança em falta de `STRIPE_SECRET_KEY` — sem
 * fallback silencioso (nada pior que pagamento que parece funcionar e
 * grava em conta errada).
 */
export function getStripe(): Stripe {
  if (cached) return cached;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY ausente — configure em .env.local.');
  }

  cached = new Stripe(secretKey, {
    // Pin pra evitar surpresas — atualizar via skill `stripe:upgrade-stripe`.
    // Versão atual do SDK (stripe@22.x): 2026-04-22.dahlia.
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
    // Identificador de telemetria pra Stripe correlacionar nossa integração
    // (útil pra suporte).
    appInfo: {
      name: 'papopro',
      version: '0.1.0',
    },
  });

  return cached;
}
