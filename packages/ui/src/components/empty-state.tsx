import * as React from 'react';

import type { LucideIcon } from '../icons';
import { cn } from '../utils/cn';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  /** Mensagem propositiva — sempre orientar próximo passo (CLAUDE.md §8). */
  description?: string;
  /** CTA primário (criar, conectar, importar). */
  action?: React.ReactNode;
}

/**
 * Estado vazio padrão. Princípio do produto: nunca tela em branco — sempre
 * sinaliza o que o usuário deve fazer em seguida.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'border-border bg-card flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center',
        className,
      )}
      {...props}
    >
      {Icon && (
        <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h3 className="text-title text-foreground">{title}</h3>
        {description && <p className="text-body text-muted-foreground max-w-sm">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
