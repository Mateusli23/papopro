'use client';

import * as React from 'react';

/**
 * Consentimento de cookies da landing (M13#3 — LGPD).
 *
 * A landing carrega trackers de terceiros (PostHog, GA4, Meta Pixel via
 * `AnalyticsScripts`). A LGPD exige consentimento explícito antes de cookies
 * não-essenciais. Este módulo guarda a escolha do visitante e expõe um hook
 * pros componentes reagirem.
 *
 * **Onde fica:** `localStorage` (não cookie) — a escolha é por dispositivo,
 * não precisa ir ao servidor, e assim a própria preferência não cria cookie.
 *
 * **Essenciais sempre ligados:** o que controlamos aqui é só `analytics`.
 * Cookies estritamente necessários (sessão, tema) não passam por consentimento
 * — sem eles o site não funciona.
 *
 * **Sincronização:** `writeConsent` dispara um evento custom + a mudança
 * também chega via `storage` event (outra aba). O hook escuta os dois, então
 * aceitar o banner liga o analytics na hora, sem reload.
 */

export interface CookieConsent {
  /** Cookies de analytics/marketing autorizados? */
  analytics: boolean;
  /** ISO 8601 — quando o visitante decidiu. */
  decidedAt: string;
}

const STORAGE_KEY = 'papopro:cookie-consent';
const CONSENT_EVENT = 'papopro:consent-changed';

/** Lê a decisão salva. `null` = visitante ainda não decidiu (mostra banner). */
export function readConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (typeof parsed.analytics !== 'boolean' || typeof parsed.decidedAt !== 'string') {
      return null;
    }
    return { analytics: parsed.analytics, decidedAt: parsed.decidedAt };
  } catch {
    return null;
  }
}

/** Grava a decisão e notifica os componentes (mesma aba + outras abas). */
export function writeConsent(analytics: boolean): CookieConsent {
  const consent: CookieConsent = { analytics, decidedAt: new Date().toISOString() };
  if (typeof window === 'undefined') return consent;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
  } catch {
    /* localStorage indisponível (modo privado restrito) — segue sem persistir */
  }
  return consent;
}

interface UseCookieConsent {
  /** `null` enquanto não montou ou o visitante não decidiu. */
  consent: CookieConsent | null;
  /** `false` até o efeito de mount rodar — evita flash de banner no SSR. */
  ready: boolean;
  /** Decisão tomada? (consent !== null após mount) */
  decided: boolean;
  acceptAll: () => void;
  acceptEssentialOnly: () => void;
}

/**
 * Hook canônico de consentimento. Usado pelo `<CookieBanner>` (decide) e pelo
 * `<AnalyticsGate>` (lê pra carregar ou não os trackers).
 */
export function useCookieConsent(): UseCookieConsent {
  const [consent, setConsent] = React.useState<CookieConsent | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setConsent(readConsent());
    setReady(true);

    const sync = () => setConsent(readConsent());
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return {
    consent,
    ready,
    decided: consent !== null,
    acceptAll: () => setConsent(writeConsent(true)),
    acceptEssentialOnly: () => setConsent(writeConsent(false)),
  };
}
