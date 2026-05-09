import * as React from 'react';

import { cn } from '../utils/cn';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Textarea primitivo. Mesma linguagem visual do `Input` (border, focus ring,
 * disabled), com altura mínima e resize vertical-only — evita usuário esticar
 * em diagonal e quebrar layouts densos (Inbox, ficha de lead).
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'border-input bg-background text-body flex min-h-[80px] w-full resize-y rounded-md border px-3 py-2',
        'placeholder:text-muted-foreground',
        'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
        className,
      )}
      {...props}
    />
  );
});
