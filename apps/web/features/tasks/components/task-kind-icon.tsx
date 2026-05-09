import { Calendar, Mail, MessageSquare, Phone, Sparkles, type LucideIcon } from '@papopro/ui/icons';

import type { Task } from '../types';

/**
 * Mapa central tipo de task → ícone + tom semântico.
 *
 * Mantemos junto com o tipo `Task` (em `features/leads/types.ts`) pra que
 * adicionar um novo `kind` exija atualizar este map (TS pega o erro
 * imediato na falta da chave).
 */
export const TASK_KIND_META: Record<
  Task['kind'],
  {
    Icon: LucideIcon;
    label: string;
    tone: 'info' | 'success' | 'warning' | 'destructive' | 'muted';
  }
> = {
  call: { Icon: Phone, label: 'Ligação', tone: 'info' },
  whatsapp: { Icon: MessageSquare, label: 'WhatsApp', tone: 'success' },
  email: { Icon: Mail, label: 'Email', tone: 'warning' },
  meeting: { Icon: Calendar, label: 'Reunião', tone: 'destructive' },
  follow_up: { Icon: Sparkles, label: 'Follow-up', tone: 'muted' },
  other: { Icon: Sparkles, label: 'Outro', tone: 'muted' },
};

const TONE_BG: Record<(typeof TASK_KIND_META)[Task['kind']]['tone'], string> = {
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
  muted: 'bg-muted text-muted-foreground',
};

interface TaskKindIconProps {
  kind: Task['kind'];
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Pequeno chip redondo com o ícone do tipo. Usado em TaskCard, calendar
 * grid e chips do tipo na lista de filtros.
 */
export function TaskKindIcon({ kind, size = 'sm', className }: TaskKindIconProps) {
  const meta = TASK_KIND_META[kind];
  const sz = size === 'sm' ? 'size-6' : 'size-8';
  const ic = size === 'sm' ? 'size-3' : 'size-4';

  return (
    <span
      className={`${sz} ${TONE_BG[meta.tone]} ${className ?? ''} flex shrink-0 items-center justify-center rounded-full`}
      aria-label={meta.label}
    >
      <meta.Icon className={ic} aria-hidden />
    </span>
  );
}
