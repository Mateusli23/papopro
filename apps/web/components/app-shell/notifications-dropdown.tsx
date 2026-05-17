'use client';

import * as React from 'react';

import Link from 'next/link';

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
          {alert.stageName} · sem interação há {alert.daysInactive}{' '}
          {alert.daysInactive === 1 ? 'dia' : 'dias'}
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
 * existentes embaixo. Full migração in-app pra `notifications` table fica
 * pra M13 (comentário em `notifications-button.tsx` antecipa).
 */
export function NotificationsDropdown({ initialColdAlerts }: NotificationsDropdownProps) {
  // Optimistic: lista local descontada de alerts acked. Server revalidatePath
  // refetcha quando o usuário recarrega — mas mantém a UX rápida no drawer
  // aberto.
  const [coldAlerts, setColdAlerts] = React.useState<ColdAlertUI[]>(initialColdAlerts);

  // Hidrata quando a prop muda (revalidatePath do action faz Next refetchar).
  React.useEffect(() => {
    setColdAlerts(initialColdAlerts);
  }, [initialColdAlerts]);

  function handleAcked(alertId: string) {
    setColdAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }

  const fakeUnread = FAKE_NOTIFICATIONS.filter((n) => !n.read).length;
  const totalUnread = coldAlerts.length + fakeUnread;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notificações (${totalUnread} não lidas)`}
        >
          <Bell className="size-4" />
          {totalUnread > 0 && (
            <span
              aria-hidden
              className="bg-destructive text-destructive-foreground absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold"
            >
              {totalUnread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-3 normal-case tracking-normal">
          <span className="text-title text-foreground">Notificações</span>
          <Badge variant="secondary">
            <Zap className="size-3" />
            {totalUnread} novas
          </Badge>
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
