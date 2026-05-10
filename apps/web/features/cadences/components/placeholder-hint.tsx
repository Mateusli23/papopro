'use client';

import * as React from 'react';

import { cn } from '@papopro/ui';

/**
 * Chips clicáveis que inserem placeholders na posição do cursor de um
 * `<textarea>` controlado. O `textareaRef` é compartilhado pelo dialog
 * pra que o chip saiba onde injetar.
 *
 * Funcionamento:
 *  1. captura `selectionStart`/`selectionEnd` do textarea
 *  2. monta novo valor `before + token + after`
 *  3. dispara `onChange` (controlled) e re-foca textarea com cursor
 *     posicionado depois do token inserido
 *
 * Em M10 placeholders viram resolver real contra dados do lead. A UI
 * permanece — só vira preview do resultado em vez de string literal.
 */

export const KNOWN_PLACEHOLDERS = ['{nome}', '{empresa}', '{produto}'] as const;

interface PlaceholderHintProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (next: string) => void;
}

export function PlaceholderHint({ textareaRef, value, onChange }: PlaceholderHintProps) {
  function insert(token: string) {
    const ta = textareaRef.current;
    if (!ta) {
      // Fallback: append no fim com espaço.
      onChange(
        value.endsWith(' ') || value.length === 0 ? `${value}${token}` : `${value} ${token}`,
      );
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const next = `${before}${token}${after}`;
    onChange(next);
    // Reposiciona cursor depois do token na próxima frame de render.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const cursor = start + token.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-caption text-muted-foreground/80">Inserir:</span>
      {KNOWN_PLACEHOLDERS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => insert(p)}
          className={cn(
            'text-caption bg-muted text-muted-foreground rounded-md border px-2 py-0.5 font-mono transition',
            'hover:border-primary/40 hover:bg-primary/10 hover:text-primary',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
