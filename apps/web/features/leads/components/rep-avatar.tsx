import { Avatar, AvatarFallback, cn, Tooltip, TooltipContent, TooltipTrigger } from '@papopro/ui';

import { getRep } from '@/lib/fixtures/sales-reps';

/**
 * Avatar compacto de vendedor com tooltip identificando o nome — usado
 * em colunas de tabela densas onde mostrar o nome quebra o layout.
 *
 * Cores seguem o `accent` do `SalesRep` (token semântico, não hex).
 */
const ACCENT_CLASS: Record<string, string> = {
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-warning',
  info: 'bg-info/15 text-info',
  accent: 'bg-accent/20 text-foreground',
};

interface RepAvatarProps {
  repId: string;
  /** Mostra também o nome ao lado (false = só avatar). */
  withName?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function RepAvatar({ repId, withName = false, size = 'sm', className }: RepAvatarProps) {
  const rep = getRep(repId);
  const initials = rep?.initials ?? '??';
  const accent = rep?.accent ?? 'primary';
  const sizeClass = size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-caption';

  const avatar = (
    <Avatar className={cn(sizeClass)}>
      <AvatarFallback className={cn('font-semibold', ACCENT_CLASS[accent])}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  if (withName) {
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        {avatar}
        <span className="text-body text-foreground truncate">{rep?.name ?? 'Não atribuído'}</span>
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex', className)}>{avatar}</span>
      </TooltipTrigger>
      <TooltipContent>{rep?.name ?? 'Não atribuído'}</TooltipContent>
    </Tooltip>
  );
}
