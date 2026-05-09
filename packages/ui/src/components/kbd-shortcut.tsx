import * as React from 'react';

import { cn } from '../utils/cn';

interface KbdShortcutProps extends React.HTMLAttributes<HTMLElement> {
  /** Sequência de teclas (ex: ['G', 'N'] ou ['⌘', 'K']). */
  keys: string[];
  /** Separador renderizado entre teclas (default: "+"). */
  separator?: string;
}

/**
 * Mostra atalho de teclado em estilo "kbd". Usado no Cmd+K, em tooltips e na
 * legenda da Inbox.
 */
export function KbdShortcut({ keys, separator = '+', className, ...props }: KbdShortcutProps) {
  return (
    <kbd
      className={cn('text-muted-foreground text-caption inline-flex items-center gap-1', className)}
      {...props}
    >
      {keys.map((key, i) => (
        <React.Fragment key={`${key}-${i}`}>
          <span
            className={cn(
              'border-border bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-medium',
            )}
          >
            {key}
          </span>
          {i < keys.length - 1 && <span className="opacity-60">{separator}</span>}
        </React.Fragment>
      ))}
    </kbd>
  );
}
