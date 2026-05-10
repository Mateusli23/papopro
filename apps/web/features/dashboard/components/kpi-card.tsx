'use client';

import * as React from 'react';

import { cn } from '@papopro/ui';
import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from '@papopro/ui/icons';

import type { KpiTrend } from '../types';

/**
 * Card primitivo de KPI — primeira surface da tela. Extraído do `<KpiGrid>`
 * em M5p (Dashboard refresh) pra ser reutilizável em `/reports` no futuro.
 *
 * Decisões:
 *  - **Tone semântico** (`info`/`warning`/`success`/`destructive`) define a
 *    cor do ícone E do número principal. Cor do hint é sempre muted.
 *  - **Trend** é opcional. Quando presente:
 *      - `up` → `text-success` + ArrowUp
 *      - `down` → `text-destructive` + ArrowDown
 *      - `flat` → `text-muted-foreground` + ArrowRight (`→ 0%`)
 *    Renderiza como `↑ 56%` ao lado do hint, mantendo o card compacto.
 *  - **Children/hint**: aceitam `string` ou `ReactNode` — pra hints com
 *    formatação rica (`<>{won} ganhos · {lost} perdidos</>`).
 *
 * Em M11 quando virar Server Component lendo Server Action, o card fica
 * idêntico — só muda quem prepara o `value` e o `trend`.
 */

export type KpiTone = 'info' | 'warning' | 'success' | 'destructive';

export interface KpiCardProps {
  label: string;
  value: string;
  hint?: React.ReactNode;
  Icon: LucideIcon;
  tone: KpiTone;
  trend?: KpiTrend;
}

const TONE_STYLES: Record<KpiTone, { bg: string; text: string; ring: string; iconBg: string }> = {
  info: {
    bg: 'bg-info/[0.06]',
    text: 'text-info',
    ring: 'ring-info/20',
    iconBg: 'bg-info/15 text-info',
  },
  warning: {
    bg: 'bg-warning/[0.08]',
    text: 'text-warning',
    ring: 'ring-warning/20',
    iconBg: 'bg-warning/20 text-warning',
  },
  success: {
    bg: 'bg-success/[0.06]',
    text: 'text-success',
    ring: 'ring-success/20',
    iconBg: 'bg-success/15 text-success',
  },
  destructive: {
    bg: 'bg-destructive/[0.06]',
    text: 'text-destructive',
    ring: 'ring-destructive/20',
    iconBg: 'bg-destructive/15 text-destructive',
  },
};

export function KpiCard({ label, value, hint, Icon, tone, trend }: KpiCardProps) {
  const t = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        'border-border flex items-start gap-3 rounded-xl border p-3 ring-1',
        t.bg,
        t.ring,
      )}
    >
      <span
        className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', t.iconBg)}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-caption text-muted-foreground font-medium">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className={cn('text-title font-semibold tabular-nums', t.text)}>{value}</span>
          {trend && <TrendIndicator trend={trend} />}
        </div>
        {hint && <span className="text-caption text-muted-foreground/80">{hint}</span>}
      </div>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: KpiTrend }) {
  const Icon =
    trend.direction === 'up' ? ArrowUp : trend.direction === 'down' ? ArrowDown : ArrowRight;
  const colorClass =
    trend.direction === 'up'
      ? 'text-success'
      : trend.direction === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground';
  const label =
    trend.direction === 'flat'
      ? '→ 0%'
      : `${trend.direction === 'up' ? '↑' : '↓'} ${Math.abs(trend.pct)}%`;

  return (
    <span
      className={cn('text-caption inline-flex items-center gap-0.5 font-medium', colorClass)}
      aria-label={`Variação: ${label}`}
    >
      <Icon className="size-3" />
      <span className="tabular-nums">{Math.abs(trend.pct)}%</span>
    </span>
  );
}
