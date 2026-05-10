'use client';

import * as React from 'react';

/**
 * Captura sequências e atalhos globais. Atalhos suportados:
 *
 *  - `Ctrl/⌘ + K` ou sequência `g + n` → abre Cmd+K palette (`onOpenCmdK`)
 *  - `g + l` → navega pra `/leads` (`onGoLeads`)
 *  - `g + k` → navega pra `/kanban` (`onGoKanban`)
 *  - `g + c` → navega pra `/cadences` (`onGoCadences`)
 *  - `n` → abre modal "Adicionar lead" (`onCreateLead`) — só na rota Leads/Kanban
 *  - `/` → foca elemento com `data-shortcut-search` (`onFocusSearch`) — atualmente
 *    o input de busca da `LeadFilters`; nenhum efeito noutras rotas
 *  - `Esc` em modal/sheet/detalhe → tratado pelo Radix; este hook não captura
 *
 * Regras importantes:
 *  - Ignora quando o foco está em `<input>`/`<textarea>`/`[contenteditable]` —
 *    caso contrário "n" virava texto no campo.
 *  - `data-shortcut-ignore` em containers customizados opta por ignorar
 *    (ex: o próprio Cmd+K palette quando aberto).
 *  - Callbacks são opcionais — passe só os que importam pra rota atual.
 */

interface UseGlobalShortcutsOptions {
  onOpenCmdK?: () => void;
  onGoLeads?: () => void;
  onGoKanban?: () => void;
  onGoCadences?: () => void;
  onCreateLead?: () => void;
  onFocusSearch?: () => void;
}

const SEQUENCE_WINDOW_MS = 1500;

export function useGlobalShortcuts(opts: UseGlobalShortcutsOptions) {
  const lastGRef = React.useRef<number | null>(null);
  const optsRef = React.useRef(opts);

  React.useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  React.useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.closest('[data-shortcut-ignore]')) return true;
      return false;
    }

    function focusSearch() {
      const cb = optsRef.current.onFocusSearch;
      if (cb) {
        cb();
        return true;
      }
      // Fallback genérico — qualquer input com `data-shortcut-search` funciona.
      const el = document.querySelector<HTMLElement>('[data-shortcut-search]');
      if (el) {
        el.focus();
        return true;
      }
      return false;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;

      // Ctrl+K / ⌘+K → palette
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        if (optsRef.current.onOpenCmdK) {
          event.preventDefault();
          optsRef.current.onOpenCmdK();
        }
        return;
      }

      // Sequência g+x — só trata teclas "puras" (sem modifier).
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const now = Date.now();

      // Atalhos simples (não-sequência)
      if (event.key === 'n') {
        if (lastGRef.current && now - lastGRef.current <= SEQUENCE_WINDOW_MS) {
          // g + n → palette (mantém compat com M3). Só consome o evento se
          // ESTE hook tem o callback — caso contrário, deixa fluir pra outro
          // listener (ex: o `CmdKPalette` no shell).
          lastGRef.current = null;
          if (optsRef.current.onOpenCmdK) {
            event.preventDefault();
            optsRef.current.onOpenCmdK();
          }
          return;
        }
        if (optsRef.current.onCreateLead) {
          event.preventDefault();
          optsRef.current.onCreateLead();
          return;
        }
      }

      if (event.key === '/') {
        if (focusSearch()) {
          event.preventDefault();
        }
        return;
      }

      // Sequência g + ?
      if (event.key === 'g') {
        lastGRef.current = now;
        return;
      }
      if (lastGRef.current && now - lastGRef.current <= SEQUENCE_WINDOW_MS) {
        // Como em `g+n`: só "consome" se este hook tem o callback. Caso
        // contrário deixa fluir — outro listener pode resolver.
        if (event.key === 'l' && optsRef.current.onGoLeads) {
          event.preventDefault();
          lastGRef.current = null;
          optsRef.current.onGoLeads();
          return;
        }
        if (event.key === 'k' && optsRef.current.onGoKanban) {
          event.preventDefault();
          lastGRef.current = null;
          optsRef.current.onGoKanban();
          return;
        }
        if (event.key === 'c' && optsRef.current.onGoCadences) {
          event.preventDefault();
          lastGRef.current = null;
          optsRef.current.onGoCadences();
          return;
        }
      }
      // Tecla diferente após `g` → reseta (não atrapalha a chance dos
      // outros listeners ainda lerem o `lastGRef` deles próprios).
      if (lastGRef.current && event.key !== 'g') lastGRef.current = null;
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
