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

import * as https from 'node:https';
import * as tls from 'node:tls';

import Stripe from 'stripe';

let cached: Stripe | null = null;

/**
 * Cria HTTPS Agent com CA bundle do sistema operacional concatenado ao bundle
 * embutido do Node. Mitiga o caso Windows + antivírus interceptando TLS
 * (memória `dev-local-windows-antivirus-tls`): o antivírus injeta um root
 * cert no Windows trust store mas Node não consulta esse store por padrão,
 * então `api.stripe.com` falha com `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
 *
 * `tls.getCACertificates('system')` (Node 22.16+/24+) lê o trust store do OS.
 * Caso a API não exista ou falhe, retorna `undefined` e o Stripe SDK usa o
 * agent default do Node (= comportamento pré-fix, status quo).
 *
 * Produção (Vercel Linux) também se beneficia: `system` inclui o bundle
 * `ca-certificates` padrão, idêntico ao que Node embarca — no-op funcional.
 */
function createStripeHttpsAgent(): https.Agent | undefined {
  const getCACertificates = (
    tls as unknown as {
      getCACertificates?: (source: 'system' | 'bundled' | 'extra' | 'default') => string[];
    }
  ).getCACertificates;
  if (typeof getCACertificates !== 'function') return undefined;

  try {
    const systemCAs = getCACertificates('system');
    if (!systemCAs || systemCAs.length === 0) return undefined;
    return new https.Agent({
      ca: [...tls.rootCertificates, ...systemCAs],
      keepAlive: true,
    });
  } catch {
    return undefined;
  }
}

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

  const httpAgent = createStripeHttpsAgent();

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
    // System CA agent quando disponível (Node 24+) — fix antivírus Windows.
    ...(httpAgent ? { httpAgent } : {}),
  });

  return cached;
}
