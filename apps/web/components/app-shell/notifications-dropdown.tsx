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
  type LucideIcon,
  MessageCircle,
  Repeat,
  Snowflake,
  WifiOff,
  Zap,
} from '@papopro/ui/icons';

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/features/notifications/actions';
import type { NotificationItem } from '@/features/notifications/types';

/**
 * Sino de notificações no topbar (Client child do Server wrapper
 * `NotificationsButton`). Drawer com até 30 dias (PRD §3.2).
 *
 * **M13#2:** lê 100% da tabela `notifications` real. Clicar numa linha marca
 * como lida (UI otimista) e segue o deep-link; "Marcar todas" zera o badge.
 * O badge conta as não-lidas.
 */

interface EventVisual {
  Icon: LucideIcon;
  tone: string;
}

/** Ícone + tom por evento da matriz PRD §3.2. Evento novo cai no default. */
const EVENT_VISUALS: Record<string, EventVisual> = {
  new_lead_assigned: { Icon: Zap, tone: 'bg-primary/15 text-primary' },
  whatsapp_message_received: { Icon: MessageCircle, tone: 'bg-primary/15 text-primary' },
  lead_cooling: { Icon: Snowflake, tone: 'bg-warning/20 text-warning' },
  task_due: { Icon: Clock, tone: 'bg-muted text-muted-foreground' },
  whatsapp_connection_down: { Icon: WifiOff, tone: 'bg-destructive/15 text-destructive' },
  workspace_invite_received: { Icon: Bell, tone: 'bg-info/15 text-info' },
  trial_expiring: { Icon: AlertCircle, tone: 'bg-warning/20 text-warning' },
  payment_failed: { Icon: AlertCircle, tone: 'bg-destructive/15 text-destructive' },
  agent_handoff_to_human: { Icon: Repeat, tone: 'bg-info/15 text-info' },
  bulk_send_finished: { Icon: Zap, tone: 'bg-success/15 text-success' },
};

const DEFAULT_VISUAL: EventVisual = { Icon: Bell, tone: 'bg-muted text-muted-foreground' };

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.round(hours / 24)}d`;
}

interface NotificationRowProps {
  notification: NotificationItem;
  read: boolean;
  onRead: (id: string) => void;
}

function NotificationRow({ notification, read, onRead }: NotificationRowProps) {
  const { Icon, tone } = EVENT_VISUALS[notification.event] ?? DEFAULT_VISUAL;

  const inner = (
    <>
      <span
        className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', tone)}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-body text-foreground truncate font-medium">
            {notification.title}
          </span>
          <span className="text-caption text-muted-foreground shrink-0">
            {formatRelative(notification.createdAt)}
          </span>
        </div>
        <p className="text-caption text-muted-foreground line-clamp-2">{notification.body}</p>
      </div>
      {!read && (
        <span className="bg-primary mt-1 size-1.5 shrink-0 rounded-full" aria-label="Não lida" />
      )}
    </>
  );

  const className = cn(
    'hover:bg-muted/50 flex items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
    !read && 'bg-primary/[0.04]',
  );

  if (notification.url) {
    return (
      <Link href={notification.url} className={className} onClick={() => onRead(notification.id)}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={() => onRead(notification.id)}>
      {inner}
    </button>
  );
}

interface NotificationsDropdownProps {
  initialNotifications: NotificationItem[];
}

export function NotificationsDropdown({ initialNotifications }: NotificationsDropdownProps) {
  // Conjunto de ids marcados como lidos nesta sessão (UI otimista). Combinado
  // com `readAt` do servidor pra decidir o estado de cada linha.
  const [readIds, setReadIds] = React.useState<Set<string>>(() => new Set());

  const isRead = React.useCallback(
    (n: NotificationItem) => n.readAt !== null || readIds.has(n.id),
    [readIds],
  );

  const unreadCount = React.useMemo(
    () => initialNotifications.filter((n) => !isRead(n)).length,
    [initialNotifications, isRead],
  );

  function handleRead(id: string) {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    void markNotificationReadAction(id);
  }

  async function handleReadAll() {
    const unreadIds = initialNotifications.filter((n) => !isRead(n)).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setReadIds((prev) => new Set([...prev, ...unreadIds]));
    const result = await markAllNotificationsReadAction();
    if (!result.ok) toast.error(result.error);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notificações: ${unreadCount} não lidas`}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="bg-destructive text-destructive-foreground absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-3 normal-case tracking-normal">
          <span className="text-title text-foreground">Notificações</span>
          {unreadCount > 0 && (
            <Badge variant="secondary">
              <Zap className="size-3" />
              {unreadCount > 9 ? '9+' : unreadCount} novas
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="max-h-96">
          {initialNotifications.length > 0 ? (
            <div className="flex flex-col p-2">
              {initialNotifications.map((n) => (
                <NotificationRow key={n.id} notification={n} read={isRead(n)} onRead={handleRead} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 px-3 py-10 text-center">
              <Bell className="text-muted-foreground/50 size-6" aria-hidden />
              <span className="text-body text-foreground font-medium">Tudo em dia</span>
              <span className="text-caption text-muted-foreground">
                Suas notificações dos últimos 30 dias aparecem aqui.
              </span>
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator className="m-0" />
        <div className="flex items-center justify-between p-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleReadAll}
            disabled={unreadCount === 0}
          >
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
