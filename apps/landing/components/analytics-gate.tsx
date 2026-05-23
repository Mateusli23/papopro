'use client';

import { useCookieConsent } from '@/lib/consent';

import { AnalyticsScripts } from './analytics-scripts';

/**
 * Portão de consentimento dos trackers (M13#3 — LGPD).
 *
 * `AnalyticsScripts` injeta PostHog/GA4/Meta Pixel — cookies não-essenciais
 * que a LGPD exige consentir antes de carregar. Este gate só renderiza os
 * scripts depois que o visitante aceitou analytics no `<CookieBanner>`.
 *
 * Enquanto não há decisão (ou o visitante escolheu "apenas essenciais"),
 * nada é injetado — zero cookie de terceiro. Aceitar o banner liga os
 * scripts na hora (o hook reage ao evento), sem reload.
 */
export function AnalyticsGate() {
  const { consent } = useCookieConsent();
  if (!consent?.analytics) return null;
  return <AnalyticsScripts />;
}
