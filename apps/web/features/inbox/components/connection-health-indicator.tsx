'use client';

import { cn, StatusDot, type StatusTone } from '@papopro/ui';

import { useWhatsAppConnection } from '../store';
import type { WhatsAppHealth } from '../types';

/**
 * Pílula compacta no header da inbox mostrando saúde da conexão WhatsApp do
 * workspace (CLAUDE.md §9 — Health Score).
 *
 * Em M5 lê estado mockado fixo `connected`. Em M9 vem do Realtime canal
 * `workspace:<id>:whatsapp_connection` — alimentado pela Edge Function
 * `whatsapp-heartbeat` (60s).
 *
 * Quando vermelho (disconnected) o motor de envio pausa automaticamente
 * (CLAUDE.md §6 — WhatsApp Adapter Pattern); só mostramos o estado aqui.
 */
const TONE_BY_HEALTH: Record<WhatsAppHealth, StatusTone> = {
  connected: 'online',
  unstable: 'idle',
  disconnected: 'offline',
};

const LABEL_BY_HEALTH: Record<WhatsAppHealth, string> = {
  connected: 'Conectado',
  unstable: 'Instável',
  disconnected: 'Desconectado',
};

export function ConnectionHealthIndicator({ className }: { className?: string }) {
  const conn = useWhatsAppConnection();
  const tone = TONE_BY_HEALTH[conn.health];
  const label = LABEL_BY_HEALTH[conn.health];
  const pulse = conn.health === 'connected' || conn.health === 'unstable';

  return (
    <div
      className={cn(
        'border-border bg-card text-caption inline-flex items-center gap-2 rounded-full border px-3 py-1',
        className,
      )}
      aria-label={`WhatsApp ${label} no número ${conn.number}`}
    >
      <StatusDot tone={tone} pulse={pulse} />
      <span className="text-foreground font-medium">{label}</span>
      <span className="text-muted-foreground tabular-nums">· {conn.number}</span>
    </div>
  );
}
