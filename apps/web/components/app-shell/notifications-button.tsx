'use client';

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
  WifiOff,
  Zap,
} from '@papopro/ui/icons';

import {
  FAKE_NOTIFICATIONS,
  type FakeNotification,
  type NotificationKind,
  unreadCount,
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

function NotificationRow({ n }: { n: FakeNotification }) {
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
 * Sino de notificações no topbar. Drawer com até 30 dias (PRD §3.2).
 *
 * Hoje lê fixtures; em M13 conecta no `notifications` real + push.
 */
export function NotificationsButton() {
  const unread = unreadCount();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notificações (${unread} não lidas)`}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span
              aria-hidden
              className="bg-destructive text-destructive-foreground absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold"
            >
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-3 normal-case tracking-normal">
          <span className="text-title text-foreground">Notificações</span>
          <Badge variant="secondary">
            <Zap className="size-3" />
            {unread} novas
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="max-h-96">
          <div className="flex flex-col p-2">
            {FAKE_NOTIFICATIONS.map((n) => (
              <NotificationRow key={n.id} n={n} />
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
