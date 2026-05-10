'use client';

import * as React from 'react';

import { cn } from '@papopro/ui';

/**
 * Textarea que cresce com o conteúdo até `MAX_ROWS` e depois scrolla.
 * Usado no composer da Inbox — UX que vendedor espera de WhatsApp Web,
 * iMessage, Slack: input fica de 1 linha quando vazio, expande conforme
 * digita, máximo de 6 linhas pra não esconder a thread.
 *
 * **Por que não vai pro `@papopro/ui`?** Hoje só o composer precisa.
 * Promovemos quando Agentes IA (M5#5) ou outro feature pedir o mesmo
 * comportamento — manter o package shadcn enxuto.
 *
 * Implementação:
 *  - `useEffect([value])` reseta `height = 'auto'` (pra textarea encolher
 *    ao apagar) e seta `height = scrollHeight` clampado.
 *  - clamp via `MAX_ROWS * lineHeight` calculado uma vez no mount; usar
 *    `getComputedStyle` em todo render era ~200x mais lento sem ganho real
 *    porque a fonte do composer não muda em runtime.
 *  - `overflow-y-auto` ativa só quando cresceu além do max — sem isso,
 *    aparecia scrollbar fantasma em viewports baixos por 1px de borda.
 *
 * Estilos seguem [packages/ui/src/components/textarea.tsx](../../../../packages/ui/src/components/textarea.tsx)
 * (border, focus ring, aria-invalid) — visual idêntico ao Textarea da DS.
 */

const MIN_ROWS = 1;
const MAX_ROWS = 6;

export interface AutoResizeTextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'rows'
> {
  /** Quando `value` é controlled, passe pra acionar resize na mudança externa. */
  value?: string;
}

export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  function AutoResizeTextarea({ className, value, onChange, ...props }, ref) {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    const lineHeightRef = React.useRef<number | null>(null);

    // Combina o ref externo com o interno — padrão React 18 sem usar
    // `useImperativeHandle` (composer precisa do ref pra inserir tokens).
    const setRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      },
      [ref],
    );

    // Mede `lineHeight` uma vez por mount. Cobertura: light/dark já usam
    // mesma fonte; tema só muda cor. Se um dia mudarmos line-height por
    // tema, mudamos pra ResizeObserver.
    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      if (lineHeightRef.current == null) {
        const computed = window.getComputedStyle(el);
        const lh = parseFloat(computed.lineHeight);
        // Fallback: alguns browsers retornam "normal". Usa 1.5 * font-size.
        lineHeightRef.current = Number.isFinite(lh)
          ? lh
          : parseFloat(computed.fontSize || '14') * 1.5;
      }
      const lineHeight = lineHeightRef.current;
      const maxHeight = lineHeight * MAX_ROWS;
      // Reset pra que `scrollHeight` reflita o conteúdo real, não a altura
      // anterior cravada inline.
      el.style.height = 'auto';
      const next = Math.min(el.scrollHeight, maxHeight);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, []);

    // Re-mede quando o valor externo muda (controlled) e no mount inicial
    // (placeholder pode estar com altura diferente do conteúdo).
    React.useEffect(() => {
      resize();
    }, [resize, value]);

    function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
      onChange?.(event);
      resize();
    }

    return (
      <textarea
        ref={setRef}
        rows={MIN_ROWS}
        value={value}
        onChange={handleChange}
        className={cn(
          'border-input bg-background text-body flex w-full resize-none rounded-md border px-3 py-2',
          'placeholder:text-muted-foreground',
          'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
          className,
        )}
        {...props}
      />
    );
  },
);
