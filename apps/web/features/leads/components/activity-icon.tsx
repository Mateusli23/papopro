import { cn } from '@papopro/ui';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  PlusCircle,
  Sparkles,
  type LucideIcon,
} from '@papopro/ui/icons';

import type { ActivityType } from '../types';

/**
 * Mapa central de ícone + cor por tipo de atividade. Usado pela timeline e,
 * eventualmente, pelos toasts de criação de evento.
 *
 * Cores via tokens semânticos (CLAUDE.md §5):
 *   - whatsapp: success (canal-chave)
 *   - call/meeting: primary (interação síncrona)
 *   - email: info (assíncrono formal)
 *   - note: accent (decoração interna, fundo amarelo)
 *   - task: warning (algo a fazer)
 *   - stage_change: muted (sistema)
 *   - attachment: info
 *   - lead_created: primary (sparkle de marca)
 */
type IconMeta = { Icon: LucideIcon; tone: string; label: string };

export const ACTIVITY_META: Record<ActivityType, IconMeta> = {
  whatsapp_in: {
    Icon: MessageCircle,
    tone: 'bg-success/15 text-success',
    label: 'WhatsApp recebido',
  },
  whatsapp_out: {
    Icon: MessageCircle,
    tone: 'bg-success/15 text-success',
    label: 'WhatsApp enviado',
  },
  call: { Icon: Phone, tone: 'bg-primary/15 text-primary', label: 'Ligação' },
  email: { Icon: Mail, tone: 'bg-info/15 text-info', label: 'Email' },
  meeting: { Icon: Calendar, tone: 'bg-primary/15 text-primary', label: 'Reunião' },
  note: { Icon: Sparkles, tone: 'bg-accent/20 text-foreground', label: 'Nota interna' },
  task: { Icon: CheckCircle2, tone: 'bg-warning/20 text-warning', label: 'Tarefa' },
  stage_change: {
    Icon: ArrowRight,
    tone: 'bg-muted text-muted-foreground',
    label: 'Mudança de etapa',
  },
  attachment: { Icon: Paperclip, tone: 'bg-info/15 text-info', label: 'Anexo' },
  lead_created: { Icon: PlusCircle, tone: 'bg-primary/15 text-primary', label: 'Lead criado' },
};

interface ActivityIconProps {
  type: ActivityType;
  className?: string;
}

export function ActivityIcon({ type, className }: ActivityIconProps) {
  const meta = ACTIVITY_META[type];
  const { Icon, tone } = meta;
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full',
        tone,
        className,
      )}
      aria-label={meta.label}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}
