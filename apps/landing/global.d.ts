/**
 * Tipagem de globals adicionados pelos snippets de analytics
 * (PostHog, GA4 gtag, Meta Pixel fbq). Mantemos opcionais (`?`) porque os
 * snippets são condicionais a env — em dev ou quando uma chave não está
 * setada, `window.posthog` etc. simplesmente não existem, e o
 * `lib/analytics.ts` testa presença antes de chamar.
 *
 * Tipos minimalistas: só o que `trackEvent` toca. Se um futuro PR começar
 * a usar `posthog.identify()` ou `gtag('config', …)`, ampliar aqui.
 */
interface Window {
  /** PostHog client global, populado pelo snippet em <AnalyticsScripts>. */
  posthog?: {
    capture: (event: string, properties?: Record<string, unknown>) => void;
    identify?: (userId: string, properties?: Record<string, unknown>) => void;
  };
  /** GA4 helper global. Aceita formas variadas (event, config, set). */
  gtag?: (...args: unknown[]) => void;
  /** Buffer usado por gtag.js antes do snippet terminar de carregar. */
  dataLayer?: unknown[];
  /** Meta Pixel global (`fbq('track', ...)` e `fbq('trackCustom', ...)`). */
  fbq?: (...args: unknown[]) => void;
  /** Backing array usado pelo Meta Pixel pra fila de eventos. */
  _fbq?: unknown;
}
