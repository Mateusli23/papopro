'use client';

import * as React from 'react';

/**
 * Captura sequências e atalhos globais. Hoje (M3) atende:
 *  - `g` seguido de `n` (em até 1.5s) → callback `onOpenCmdK`
 *  - `Ctrl/⌘ + K` → mesmo callback
 *
 * Em M5+ esse hook ganha mais combos (`/` foca busca, `n` adiciona lead,
 * `Esc` fecha modal/detalhe — PLAN.md M4) seguindo o padrão Linear/Notion.
 *
 * Regras importantes:
 *  - Ignora quando o foco está em `<input>`, `<textarea>` ou `[contenteditable]`
 *    — caso contrário o "g" virava insert no campo.
 *  - `data-shortcut-ignore` pode ser usado em containers customizados que
 *    queiram opt-out (ex: o próprio Cmd+K palette quando aberto).
 */

interface UseGlobalShortcutsOptions {
  onOpenCmdK: () => void;
}

const SEQUENCE_WINDOW_MS = 1500;

export function useGlobalShortcuts({ onOpenCmdK }: UseGlobalShortcutsOptions) {
  // `lastG` guarda o timestamp da última tecla `g` — se a próxima tecla `n`
  // chegar antes de `SEQUENCE_WINDOW_MS`, dispara. Usamos ref pra não
  // re-criar o listener a cada render.
  const lastGRef = React.useRef<number | null>(null);
  const cbRef = React.useRef(onOpenCmdK);

  // Mantém o callback fresh sem re-anexar listeners a cada render.
  React.useEffect(() => {
    cbRef.current = onOpenCmdK;
  }, [onOpenCmdK]);

  React.useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.closest('[data-shortcut-ignore]')) return true;
      return false;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;

      // Ctrl+K / ⌘+K
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        cbRef.current();
        return;
      }

      // Sequência g+n — só trata teclas "puras" (sem modifier).
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const now = Date.now();
      if (event.key === 'g') {
        lastGRef.current = now;
        return;
      }
      if (event.key === 'n' && lastGRef.current !== null) {
        if (now - lastGRef.current <= SEQUENCE_WINDOW_MS) {
          event.preventDefault();
          lastGRef.current = null;
          cbRef.current();
          return;
        }
        lastGRef.current = null;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
