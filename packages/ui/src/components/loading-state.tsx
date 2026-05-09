import * as React from 'react';

import { Loader2 } from '../icons';
import { cn } from '../utils/cn';

interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Texto curto descrevendo o que está carregando. Default em pt-BR. */
  label?: string;
  /** `lg` para estados full-page; default `md` para seções. */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<LoadingStateProps['size']>, string> = {
  sm: 'gap-2 p-4 [&_svg]:size-4',
  md: 'gap-3 p-8 [&_svg]:size-6',
  lg: 'gap-4 p-12 [&_svg]:size-8',
};

/**
 * Estado de carregamento padrão. Usar quando a estrutura final ainda não é
 * conhecida (lista vai materializar com N itens variável). Para placeholder
 * estrutural (cabeçalho + 5 cards) prefira `Skeleton`.
 *
 * `role="status"` + `aria-live="polite"` faz o leitor de tela anunciar
 * "Carregando…" sem interromper, e a transição pra conteúdo ler o novo conteúdo.
 */
export function LoadingState({
  label = 'Carregando…',
  size = 'md',
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'text-muted-foreground flex flex-col items-center justify-center text-center',
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      <Loader2 className="text-primary animate-spin" aria-hidden />
      <p className="text-body">{label}</p>
    </div>
  );
}
