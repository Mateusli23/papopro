'use client';

import * as React from 'react';

/**
 * Roda axe-core em dev (somente client) emitindo warnings no console quando
 * encontra violações sérias de acessibilidade. Carrega a dependência de
 * forma dinâmica pra não entrar no bundle de produção.
 *
 * Como ler o output:
 *  - Issues vermelhas/laranjas no DevTools = trabalho a fazer.
 *  - Issues amarelas = revisar caso a caso.
 *  - Sem output = nenhuma violação detectada nas regras do axe nessa rota.
 *
 * Atualiza no client a cada mudança de DOM (debounce do próprio axe). Em rota
 * estática (SSR) o componente só ativa após hydration.
 */
export function AxeDevtools() {
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof window === 'undefined') return;
    ranRef.current = true;

    void (async () => {
      const [{ default: axe }, ReactDOM, React] = await Promise.all([
        import('@axe-core/react'),
        import('react-dom'),
        import('react'),
      ]);
      // 1000ms = debounce mínimo recomendado para evitar ruído em re-renders.
      axe(React, ReactDOM, 1000);
    })();
  }, []);

  return null;
}
