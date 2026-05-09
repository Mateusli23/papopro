import * as React from 'react';

import { AlertCircle } from '../icons';
import { cn } from '../utils/cn';

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Título curto e direto. Default em pt-BR. */
  title?: string;
  /**
   * Mensagem propositiva (CLAUDE.md §7.6) — descreve o que aconteceu E o que
   * o usuário pode fazer ("Tente recarregar a página ou volte em alguns
   * minutos"). Não usar "Erro 500" puro.
   */
  description?: string;
  /** Botão de ação (Recarregar, Tentar novamente, Voltar). */
  action?: React.ReactNode;
}

/**
 * Estado de erro padrão. Usado em boundaries de erro (`error.tsx` do Next),
 * em fallback de query falha (TanStack), e em telas de feature indisponível.
 *
 * `role="alert"` faz leitores de tela anunciarem o erro assim que renderiza.
 */
export function ErrorState({
  title = 'Algo deu errado',
  description = 'Não foi possível carregar essa parte agora. Tente recarregar — se persistir, fale com a gente.',
  action,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center',
        className,
      )}
      {...props}
    >
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <AlertCircle className="size-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-title text-foreground">{title}</h3>
        <p className="text-body text-muted-foreground max-w-sm">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
