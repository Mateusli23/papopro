'use client';

import * as React from 'react';

import Link from 'next/link';

import { differenceInDays, parseISO } from 'date-fns';
import { toast } from 'react-hot-toast';

import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ScrollArea,
} from '@papopro/ui';
import {
  AlertCircle,
  Bell,
  Clock,
  Flame,
  type LucideIcon,
  MessageCircle,
  Repeat,
  Snowflake,
  WifiOff,
  Zap,
} from '@papopro/ui/icons';

import { acknowledgeColdAlertAction } from '@/features/cadences/actions';
import type { ColdAlertUI } from '@/features/cadences/queries';
import {
  FAKE_NOTIFICATIONS,
  type FakeNotification,
  type NotificationKind,
} from '@/lib/fixtures/notifications';

const ICON_BY_KIND: Record<NotificationKind, { Icon: LucideIcon; tone: string }> = {
  whatsapp_down: { Icon: WifiOff, tone: 'bg-destructive/15 text-destructive' },
  lead_cold: { Icon: Flame, tone: 'bg-warning/20 text-warning' },
  cadence_paused: { Icon: Repeat, tone: 'bg-info/15 text-info' },
  new_message: { Icon: MessageCircle, tone: 'bg-primary/15 text-primary' },
  task_due: { Icon: Clock, tone: 'bg-muted text-muted-foreground' },
  trial_ending: { Icon: AlertCircle, tone: 'bg-warning/20 text-warning' },
};

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.round(hours / 24)}d`;
}

function FakeNotificationRow({ n }: { n: FakeNotification }) {
  const { Icon, tone } = ICON_BY_KIND[n.kind];
  return (
    <div
      className={cn(
        'hover:bg-muted/50 flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors',
        !n.read && 'bg-primary/[0.04]',
      )}
    >
      <span
        className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', tone)}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-body text-foreground truncate font-medium">{n.title}</span>
          <span className="text-caption text-muted-foreground shrink-0">
            {formatRelative(n.createdAt)}
          </span>
        </div>
        <p className="text-caption text-muted-foreground line-clamp-2">{n.description}</p>
      </div>
      {!n.read && (
        <span className="bg-primary mt-1 size-1.5 shrink-0 rounded-full" aria-label="Não lida" />
      )}
    </div>
  );
}

/**
 * Calcula dias de inatividade reais a partir de `lastInteractionAt`. Se
 * for `null` (lead pré-M9 sem registro), usa o `daysInactive` do threshold
 * como aproximação — pior caso é mostrar o mínimo configurado.
 */
function realDaysIdle(alert: ColdAlertUI): number {
  if (!alert.lastInteractionAt) return alert.daysInactive;
  return Math.max(0, differenceInDays(new Date(), parseISO(alert.lastInteractionAt)));
}

/**
 * Row de cold alert real (M10#4). Clicar leva pro lead onde tem o banner com
 * botão de ack explícito; "Visto" inline aqui dispara o ack direto sem sair
 * do drawer.
 *
 * Optimistic UI: marca como acked localmente antes da Server Action voltar.
 * Se falhar, restaura + mostra toast (raro — workspace/role já validado no
 * server quando o alert chegou).
 */
function ColdAlertRow({
  alert,
  onAcked,
}: {
  alert: ColdAlertUI;
  onAcked: (alertId: string) => void;
}) {
  const [pending, setPending] = React.useState(false);
  const daysIdle = realDaysIdle(alert);

  async function handleAck(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPending(true);
    const result = await acknowledgeColdAlertAction(alert.id);
    if (!result.ok) {
      setPending(false);
      toast.error(result.error);
      return;
    }
    onAcked(alert.id);
  }

  return (
    <Link
      href={`/leads/${alert.leadId}`}
      className="hover:bg-muted/50 bg-warning/[0.06] flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors"
    >
      <span className="bg-warning/20 text-warning mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
        <Snowflake className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-body text-foreground truncate font-medium">
            Lead frio: {alert.leadName}
          </span>
          <span className="text-caption text-muted-foreground shrink-0">
            {formatRelative(alert.triggeredAt)}
          </span>
        </div>
        <p className="text-caption text-muted-foreground line-clamp-2">
          {alert.stageName} · sem interação há {daysIdle} {daysIdle === 1 ? 'dia' : 'dias'}
        </p>
        <button
          type="button"
          onClick={handleAck}
          disabled={pending}
          className="text-caption text-primary hover:text-primary/80 mt-1 self-start font-medium underline-offset-2 hover:underline disabled:opacity-50"
        >
          {pending ? 'Marcando…' : 'Marcar como visto'}
        </button>
      </div>
    </Link>
  );
}

interface NotificationsDropdownProps {
  initialColdAlerts: ColdAlertUI[];
}

/**
 * Sino de notificações no topbar (Client child do Server wrapper
 * `NotificationsButton`). Drawer com até 30 dias (PRD §3.2).
 *
 * **M10#4:** cold alerts reais no topo (vindos via prop do Server) + fixtures
 * existentes embaixo. Badge do sino conta SÓ cold alerts reais — fixtures
 * ficam visíveis no drawer mas não inflam o badge (evita prometer "5 não
 * lidas" e nada mais zerar quando o usuário clica). Full migração in-app
 * pra `notifications` table fica pra M13 (comentário em
 * `notifications-button.tsx` antecipa).
 */
export function NotificationsDropdown({ initialColdAlerts }: NotificationsDropdownProps) {
  // Mantém Set persistente de alerts já acked nesta sessão. Quando server
  // revalidatePath traz a lista de novo (pode incluir um alert que o user
  // acabou de ack via banner em outra aba), filtramos por ackedIds pra não
  // "ressuscitar" o alert no sino.
  const [ackedIds, setAckedIds] = React.useState<Set<string>>(() => new Set());

  // Filtra cold alerts efetivamente visíveis: server snapshot menos os que
  // já marcamos como acked otimisticamente nesta sessão. Memoiza pra evitar
  // recomputar a cada render.
  const coldAlerts = React.useMemo(
    () => initialColdAlerts.filter((a) => !ackedIds.has(a.id)),
    [initialColdAlerts, ackedIds],
  );

  function handleAcked(alertId: string) {
    setAckedIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
  }

  const unreadCold = coldAlerts.length;
  const fakeUnread = FAKE_NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notificações: ${unreadCold} leads frios sem resposta`}
        >
          <Bell className="size-4" />
          {unreadCold > 0 && (
            <span
              aria-hidden
              className="bg-destructive text-destructive-foreground absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold"
            >
              {unreadCold}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-3 normal-case tracking-normal">
          <span className="text-title text-foreground">Notificações</span>
          {unreadCold + fakeUnread > 0 && (
            <Badge variant="secondary">
              <Zap className="size-3" />
              {unreadCold > 0 ? `${unreadCold} frios` : `${fakeUnread} novas`}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="max-h-96">
          <div className="flex flex-col p-2">
            {coldAlerts.map((a) => (
              <ColdAlertRow key={a.id} alert={a} onAcked={handleAcked} />
            ))}
            {FAKE_NOTIFICATIONS.map((n) => (
              <FakeNotificationRow key={n.id} n={n} />
            ))}
          </div>
        </ScrollArea>
        <DropdownMenuSeparator className="m-0" />
        <div className="flex items-center justify-between p-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Marcar todas como lidas
          </Button>
          <Button variant="link" size="sm" asChild>
            <a href="/settings/notifications">Preferências</a>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
