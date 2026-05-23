'use client';

import { Button } from '@papopro/ui';

import { useCookieConsent } from '@/lib/consent';

/**
 * Banner de consentimento de cookies (M13#3 — LGPD).
 *
 * Aparece fixo no rodapé até o visitante decidir. Duas escolhas explícitas
 * e equivalentes (LGPD não admite "aceitar" destacado e "recusar" escondido):
 *  - **Aceitar todos** → libera analytics (`<AnalyticsGate>` carrega trackers).
 *  - **Apenas essenciais** → nenhum cookie de terceiro.
 *
 * Não renderiza no SSR nem antes do hook montar (`ready`) — evita flash.
 * Some assim que há decisão.
 */
export function CookieBanner() {
  const { ready, decided, acceptAll, acceptEssentialOnly } = useCookieConsent();

  if (!ready || decided) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed inset-x-0 bottom-0 z-50 p-4"
    >
      <div className="bg-card border-border mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border p-5 shadow-lg md:flex-row md:items-center md:gap-6">
        <p className="text-muted-foreground text-body flex-1">
          Usamos cookies essenciais para o site funcionar e, com sua autorização, cookies de análise
          para entender o uso e melhorar a experiência. Veja a{' '}
          <a
            href="/legal/cookies"
            className="text-primary font-medium underline underline-offset-2"
          >
            Política de Cookies
          </a>
          .
        </p>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={acceptEssentialOnly}>
            Apenas essenciais
          </Button>
          <Button size="sm" onClick={acceptAll}>
            Aceitar todos
          </Button>
        </div>
      </div>
    </div>
  );
}
