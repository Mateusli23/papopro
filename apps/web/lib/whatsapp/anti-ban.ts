/**
 * Anti-ban (M9#3) — proteção contra bloqueio do número WhatsApp.
 *
 * **Toda chamada outbound** passa por `assertCanSend` antes de tocar o adapter
 * (CLAUDE.md §7.3). O check é estritamente em ordem porque a `reason` retornada
 * vira mensagem pra UI + audit log:
 *
 *   1. `blacklisted` — opt-out LGPD tem prioridade absoluta. Mesmo número
 *      desconectado + janela aberta + saudável → bloqueia se está em opt-out.
 *   2. `instance_disconnected` — WhatsApp caiu (status != 'connected'). Vendedor
 *      precisa reconectar via QR (`/settings/connections`).
 *   3. `instance_unhealthy` — health score vermelho. Heartbeat (M9#5) detectou
 *      ban temporário ou rede instável — pausa preventiva.
 *   4. `instance_paused` — `pausedUntil` futuro. Burst pause após 50 envios
 *      consecutivos, OU pausa manual.
 *   5. `outside_business_hours` — fora da janela 9h-21h timezone-aware
 *      (workspace.timezone). Evita envios em horários que sinalizam bot.
 *   6. `rate_limit_24h` — `messagesSent24h >= 1000`. Conservador no MVP —
 *      uazapi/Whatsmeow começa a marcar contas com volume desproporcional.
 *
 * **Jitter 30-50s** antes de cada envio (não 30-90s — cap em 50s pra caber
 * em Vercel Server Action default `maxDuration=60s`). Fila assíncrona real
 * fica pra M10 junto com o motor de cadência.
 *
 * **`recordSent`** incrementa `messagesSent24h` (rolling 24h logicamente — no
 * MVP sem reset automático; M10 limpa via cron). Se atingir 50 envios
 * consecutivos, seta `pausedUntil = now + 30min`.
 *
 * **Server-only.** Lê DB; nunca importar em `'use client'`.
 */
import 'server-only';

import type { Prisma } from '@papopro/db';

// ─── Constantes (CLAUDE.md §6 + PRD §3.4) ───────────────────────────────────

export const OUTBOUND_LIMIT_24H = 1000;
export const JITTER_MIN_MS = 30_000;
export const JITTER_MAX_MS = 50_000;
export const BURST_PAUSE_THRESHOLD = 50;
export const BURST_PAUSE_MS = 30 * 60 * 1_000;
export const BUSINESS_HOUR_START = 9;
export const BUSINESS_HOUR_END = 21;
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type AntiBanReason =
  | 'blacklisted'
  | 'instance_disconnected'
  | 'instance_unhealthy'
  | 'instance_paused'
  | 'outside_business_hours'
  | 'rate_limit_24h';

export interface InstanceSnapshot {
  status: string;
  healthScore: 'healthy' | 'degraded' | 'unhealthy';
  pausedUntil: Date | null;
  messagesSent24h: number;
  externalInstanceId: string | null;
}

export interface AssertCanSendInput {
  workspaceTimezone: string;
  toPhone: string;
  instance: InstanceSnapshot;
  blacklisted: boolean;
  now: Date;
}

export type AssertCanSendResult =
  | { ok: true }
  | { ok: false; reason: AntiBanReason; message: string };

// ─── Helpers de janela horária ──────────────────────────────────────────────

/**
 * Lê a hora local (0-23) na timezone do workspace. Usa `Intl.DateTimeFormat`.
 * Fallback `America/Sao_Paulo` em timezone inválido (defense-in-depth — o
 * schema permite qualquer string).
 */
export function getHourInTimezone(now: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const hour = Number(formatter.format(now));
    return Number.isFinite(hour) ? hour : 12;
  } catch {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: DEFAULT_TIMEZONE,
      hour: 'numeric',
      hour12: false,
    });
    return Number(formatter.format(now));
  }
}

export function isWithinBusinessHours(now: Date, timezone: string): boolean {
  const hour = getHourInTimezone(now, timezone);
  return hour >= BUSINESS_HOUR_START && hour < BUSINESS_HOUR_END;
}

// ─── Verificação pura ───────────────────────────────────────────────────────

/**
 * Versão pura — sem tocar DB. Caller faz lookup BlackList antes e passa
 * `blacklisted` boolean. Order da verificação importa pra audit/UX.
 */
export function assertCanSendPure(input: AssertCanSendInput): AssertCanSendResult {
  if (input.blacklisted) {
    return {
      ok: false,
      reason: 'blacklisted',
      message: 'Este número solicitou opt-out — não é possível enviar mensagens.',
    };
  }

  if (input.instance.status !== 'connected' || !input.instance.externalInstanceId) {
    return {
      ok: false,
      reason: 'instance_disconnected',
      message: 'WhatsApp desconectado — conecte em Configurações → Conexões.',
    };
  }

  if (input.instance.healthScore === 'unhealthy') {
    return {
      ok: false,
      reason: 'instance_unhealthy',
      message: 'Conexão instável — envios pausados até a saúde do número normalizar.',
    };
  }

  if (input.instance.pausedUntil && input.instance.pausedUntil.getTime() > input.now.getTime()) {
    const minutes = Math.ceil(
      (input.instance.pausedUntil.getTime() - input.now.getTime()) / 60_000,
    );
    return {
      ok: false,
      reason: 'instance_paused',
      message: `Envios pausados pelo anti-ban — tente em ${minutes} min.`,
    };
  }

  if (!isWithinBusinessHours(input.now, input.workspaceTimezone)) {
    return {
      ok: false,
      reason: 'outside_business_hours',
      message: `Fora do horário comercial (${BUSINESS_HOUR_START}h–${BUSINESS_HOUR_END}h). Envio liberado quando voltar à janela.`,
    };
  }

  if (input.instance.messagesSent24h >= OUTBOUND_LIMIT_24H) {
    return {
      ok: false,
      reason: 'rate_limit_24h',
      message: `Limite diário de mensagens atingido (${OUTBOUND_LIMIT_24H}). Aguarde a janela 24h reiniciar.`,
    };
  }

  return { ok: true };
}

// ─── Wrapper que faz lookup BlackList ──────────────────────────────────────

export async function assertCanSend(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  workspaceTimezone: string,
  toPhone: string,
  instance: InstanceSnapshot,
  now: Date = new Date(),
): Promise<AssertCanSendResult> {
  const blacklisted = await tx.blackList.findUnique({
    where: { workspaceId_phone: { workspaceId, phone: toPhone } },
    select: { id: true },
  });

  return assertCanSendPure({
    workspaceTimezone,
    toPhone,
    instance,
    blacklisted: blacklisted !== null,
    now,
  });
}

// ─── Jitter ─────────────────────────────────────────────────────────────────

/**
 * Sleep aleatório entre JITTER_MIN_MS e JITTER_MAX_MS. `randomFn` e `sleepFn`
 * injetáveis pra testes determinísticos no smoke (evita travar o request 30s).
 */
export async function applyJitter(
  randomFn: () => number = Math.random,
  sleepFn: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<number> {
  const range = JITTER_MAX_MS - JITTER_MIN_MS;
  const delay = JITTER_MIN_MS + Math.floor(randomFn() * range);
  await sleepFn(delay);
  return delay;
}

// ─── Recording de envio + burst pause ───────────────────────────────────────

/**
 * Incrementa `messagesSent24h` e seta `pausedUntil` se atingir o threshold de
 * burst (50 envios consecutivos). Roda SEMPRE dentro da tx do action — se a tx
 * der rollback (adapter falhou), o contador não incrementa (correto).
 */
export async function recordSent(
  tx: Prisma.TransactionClient,
  instanceId: string,
  now: Date = new Date(),
): Promise<void> {
  const instance = await tx.whatsappInstance.findUnique({
    where: { id: instanceId },
    select: { messagesSent24h: true },
  });
  if (!instance) return;

  const nextCount = instance.messagesSent24h + 1;
  const shouldPause = nextCount > 0 && nextCount % BURST_PAUSE_THRESHOLD === 0;

  await tx.whatsappInstance.update({
    where: { id: instanceId },
    data: {
      messagesSent24h: nextCount,
      ...(shouldPause ? { pausedUntil: new Date(now.getTime() + BURST_PAUSE_MS) } : {}),
    },
  });
}
