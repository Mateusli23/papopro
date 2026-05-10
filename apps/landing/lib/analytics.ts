/**
 * Analytics wrapper — uma única função `trackEvent` que se vira pra mandar
 * o evento pra **3 destinos** quando suas envs respectivas estão setadas:
 *
 *  1. **PostHog** (product analytics, shared com `apps/web` futuramente):
 *     `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST`.
 *  2. **Google Analytics 4** (gtag): `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
 *  3. **Meta Pixel** (fbq): `NEXT_PUBLIC_META_PIXEL_ID`.
 *
 * Princípios:
 *
 *  - **No-op silencioso** quando uma env não está setada — landing roda em
 *    dev sem disparar nada, e em prod só envia pros canais ativos. Zero
 *    `console.warn` ruído.
 *  - **Server-safe**: chama `typeof window !== 'undefined'` antes de tocar
 *    em globals — chamadas a partir de Server Components ou route handlers
 *    são silenciosamente ignoradas (em vez de quebrar build).
 *  - **Type-safe globals**: extendemos `Window` em `global.d.ts` (criado
 *    junto com esse arquivo) pra que `window.posthog`, `window.gtag` e
 *    `window.fbq` sejam tipados sem cast.
 *  - **Falha individual não cascateia**: se PostHog estiver carregando
 *    devagar e jogar erro, GA4 e Meta ainda recebem o evento. Cada
 *    chamada está num try/catch isolado.
 */

export interface AnalyticsProps {
  [key: string]: unknown;
}

/**
 * Eventos canônicos da landing. Catalogá-los aqui dá completion no editor e
 * impede que cada call site invente um nome diferente pro mesmo evento.
 */
export type LandingEvent =
  | 'landing_view'
  | 'cta_hero_click'
  | 'cta_pricing_click'
  | 'roi_calculated'
  | 'faq_opened'
  | 'signup_submitted'
  | 'demo_play_click'
  | 'whatsapp_fab_click';

export function trackEvent(name: LandingEvent, props?: AnalyticsProps): void {
  if (typeof window === 'undefined') return;

  // PostHog
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY && window.posthog) {
    try {
      window.posthog.capture(name, props);
    } catch {
      /* silent — landing não para se um destino falhar */
    }
  }

  // GA4
  if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && window.gtag) {
    try {
      window.gtag('event', name, props);
    } catch {
      /* silent */
    }
  }

  // Meta Pixel
  if (process.env.NEXT_PUBLIC_META_PIXEL_ID && window.fbq) {
    try {
      window.fbq('trackCustom', name, props);
    } catch {
      /* silent */
    }
  }
}
