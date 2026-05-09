import * as React from 'react';

import { cn } from '../utils/cn';

/**
 * Placeholder de loading. Usar quando a estrutura final já é conhecida —
 * mostrar o esqueleto preserva a percepção de continuidade (CLAUDE.md §8:
 * "performance percebida > performance real"). Para spinner único use
 * `LoadingState`; para erro com retry, `ErrorState`.
 *
 * `aria-hidden` evita anúncio repetido pelos leitores de tela. Quem precisar
 * comunicar carregamento explícito faz com `role="status" aria-busy` no
 * container que envolve os skeletons.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden className={cn('bg-muted/70 animate-pulse rounded-md', className)} {...props} />
  );
}
