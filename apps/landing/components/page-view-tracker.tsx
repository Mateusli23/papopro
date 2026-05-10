'use client';

import * as React from 'react';

import { trackEvent } from '@/lib/analytics';

/**
 * Componente "fantasma" que dispara o evento `landing_view` uma única vez
 * no mount. Server Components não conseguem chamar analytics (não tem
 * `window`), então isolamos isso num client minúsculo que não renderiza
 * nada visualmente (`return null`).
 *
 * Por que num componente próprio em vez de embutir em `cta-section.tsx`:
 *  - A landing pode mudar a ordem das seções no futuro (M13?), e o
 *    page-view view event não deve depender do CTA estar montado.
 *  - Mantém `cta-section.tsx` focado no formulário.
 *
 * `useRef` impede dispatch duplicado em modo strict do React (que monta o
 * componente duas vezes em dev). Em prod o efeito roda só uma vez.
 */
export function PageViewTracker() {
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent('landing_view');
  }, []);

  return null;
}
