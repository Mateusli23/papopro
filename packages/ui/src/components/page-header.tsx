import * as React from 'react';

import { cn } from '../utils/cn';

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  /** Ações alinhadas à direita do título (botões, badges). */
  actions?: React.ReactNode;
}

/**
 * Cabeçalho padrão de página: título grande + descrição opcional + slot de ações.
 * Usado em todas as rotas de produto (Leads, Kanban, Inbox, etc).
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn('flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between', className)}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-title-lg text-foreground">{title}</h1>
        {description && <p className="text-body text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
