import * as React from 'react';

import { cn } from '../utils/cn';

export type StatusTone = 'online' | 'idle' | 'offline' | 'neutral';

const TONE_CLASS: Record<StatusTone, string> = {
  online: 'bg-success',
  idle: 'bg-warning',
  offline: 'bg-destructive',
  neutral: 'bg-muted-foreground',
};

const TONE_LABEL: Record<StatusTone, string> = {
  online: 'conectado',
  idle: 'instável',
  offline: 'desconectado',
  neutral: 'indeterminado',
};

interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  /** Quando true, anima o ponto com pulse — usar pra "online" ativo. */
  pulse?: boolean;
  /** Texto acessível. Se omitido, usa o label semântico do tom. */
  label?: string;
}

/**
 * Indicador visual de status (saúde de conexão WhatsApp, presença de usuário).
 * Cor é semântica — sempre acompanhada de label acessível.
 */
export function StatusDot({ tone, pulse = false, label, className, ...props }: StatusDotProps) {
  return (
    <span
      role="status"
      aria-label={label ?? TONE_LABEL[tone]}
      className={cn('relative inline-flex size-2.5 shrink-0', className)}
      {...props}
    >
      {pulse && (
        <span
          aria-hidden
          className={cn('absolute inset-0 animate-ping rounded-full opacity-75', TONE_CLASS[tone])}
        />
      )}
      <span aria-hidden className={cn('relative inline-flex size-2.5 rounded-full', TONE_CLASS[tone])} />
    </span>
  );
}
