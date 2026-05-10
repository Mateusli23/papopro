'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import { Badge, Switch, Tooltip, TooltipContent, TooltipTrigger } from '@papopro/ui';
import { Lock } from '@papopro/ui/icons';

import { NOTIFICATION_EVENTS } from '@/lib/fixtures/notification-prefs';

import { togglePref, useNotificationPrefs } from '../store';
import type { NotificationChannel, NotificationEventDef } from '../types';

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  inapp: 'In-app',
  push: 'Push',
  email: 'E-mail',
};

const ALL_CHANNELS: NotificationChannel[] = ['inapp', 'push', 'email'];

/**
 * Matriz de preferências (PRD §3.2). Em desktop renderiza como tabela
 * 10×3; em mobile vira lista de cards (cada evento é um card com 3 switches).
 *
 * Eventos administrativos (`isAdministrative: true`) ficam com switch
 * `disabled` + ícone de cadeado + tooltip explicativo. Tentativa de toggle
 * via teclado é capturada no transform e retorna `ok: false`.
 *
 * Toast com debounce 400ms — toggles rápidos não viram spam.
 */
export function NotificationMatrix() {
  const prefs = useNotificationPrefs();
  const lastToastAt = React.useRef(0);

  function handleToggle(event: NotificationEventDef, channel: NotificationChannel, next: boolean) {
    const r = togglePref({ event: event.key, channel, enabled: next });
    if (!r.ok) {
      toast.error(r.reason ?? 'Não foi possível atualizar agora');
      return;
    }
    const now = Date.now();
    if (now - lastToastAt.current > 400) {
      toast.success('Preferências salvas');
      lastToastAt.current = now;
    }
  }

  return (
    <>
      {/* Desktop: tabela */}
      <div className="border-border hidden overflow-hidden rounded-md border md:block">
        <table className="w-full text-left">
          <thead className="bg-muted/50">
            <tr className="text-caption text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Evento</th>
              {ALL_CHANNELS.map((c) => (
                <th key={c} className="w-24 px-4 py-3 text-center font-semibold" scope="col">
                  {CHANNEL_LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {NOTIFICATION_EVENTS.map((event) => (
              <tr key={event.key} className="text-body">
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-foreground flex items-center gap-2 font-medium">
                      {event.label}
                      {event.isAdministrative && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Lock className="size-3" /> Administrativo
                        </Badge>
                      )}
                    </span>
                    <span className="text-caption text-muted-foreground">{event.description}</span>
                  </div>
                </td>
                {ALL_CHANNELS.map((channel) => (
                  <td key={channel} className="px-4 py-3 text-center">
                    <ChannelSwitch
                      event={event}
                      channel={channel}
                      checked={prefs[event.key]?.[channel] ?? false}
                      onToggle={(next) => handleToggle(event, channel, next)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {NOTIFICATION_EVENTS.map((event) => (
          <div key={event.key} className="border-border flex flex-col gap-3 rounded-md border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-body text-foreground font-medium">{event.label}</span>
                <span className="text-caption text-muted-foreground">{event.description}</span>
              </div>
              {event.isAdministrative && (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Lock className="size-3" />
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {ALL_CHANNELS.map((channel) => (
                <div key={channel} className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">{CHANNEL_LABELS[channel]}</span>
                  <ChannelSwitch
                    event={event}
                    channel={channel}
                    checked={prefs[event.key]?.[channel] ?? false}
                    onToggle={(next) => handleToggle(event, channel, next)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

interface ChannelSwitchProps {
  event: NotificationEventDef;
  channel: NotificationChannel;
  checked: boolean;
  onToggle: (next: boolean) => void;
}

function ChannelSwitch({ event, channel, checked, onToggle }: ChannelSwitchProps) {
  const supported = event.channels.includes(channel);
  const disabled = !supported || event.isAdministrative;

  if (!supported) {
    return <span className="text-muted-foreground/60 text-caption">—</span>;
  }

  const sw = (
    <Switch
      checked={checked}
      onCheckedChange={onToggle}
      disabled={disabled}
      aria-label={`${event.label} — ${CHANNEL_LABELS[channel]}`}
    />
  );

  if (!event.isAdministrative) return sw;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{sw}</span>
      </TooltipTrigger>
      <TooltipContent>Evento administrativo — não pode ser desligado</TooltipContent>
    </Tooltip>
  );
}
