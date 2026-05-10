'use client';

import * as React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@papopro/ui';

import { useSubscription } from '../store';
import { computeUsageRatios } from '../transforms';

/**
 * Barras de uso por dimensão do plano. Cores semânticas:
 *  - < 70% → success
 *  - 70–95% → warning
 *  - ≥ 95% → destructive
 *
 * Em M5 mostra usage da fixture; em M12 lê de uma view materializada
 * `workspace_usage` atualizada por Edge Function diária.
 */
export function UsageLimitsCard() {
  const sub = useSubscription();
  const ratios = React.useMemo(() => computeUsageRatios(sub), [sub]);

  const items: Array<{
    label: string;
    used: number;
    total: number;
    ratio: number;
    suffix?: string;
  }> = [
    {
      label: 'Usuários',
      used: sub.usage.users,
      total: sub.limits.users,
      ratio: ratios.users,
    },
    {
      label: 'Leads ativos',
      used: sub.usage.leads,
      total: sub.limits.leads,
      ratio: ratios.leads,
    },
    {
      label: 'Disparos no mês',
      used: sub.usage.outboundMonth,
      total: sub.limits.outboundMonth,
      ratio: ratios.outbound,
    },
    {
      label: 'Números WhatsApp',
      used: sub.usage.whatsappNumbers,
      total: sub.limits.whatsappNumbers,
      ratio: ratios.whatsappNumbers,
    },
    {
      label: 'Agentes IA ativos',
      used: sub.usage.agents,
      total: sub.limits.agents,
      ratio: ratios.agents,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uso do plano</CardTitle>
        <CardDescription>
          Limites baseados no plano Pro IA. Vendedor extra ou número adicional viram cobrança por
          excedente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.map((item) => (
          <UsageBar key={item.label} {...item} />
        ))}
      </CardContent>
    </Card>
  );
}

interface UsageBarProps {
  label: string;
  used: number;
  total: number;
  ratio: number;
}

function UsageBar({ label, used, total, ratio }: UsageBarProps) {
  const pct = Math.min(1, ratio);
  const tone = ratio >= 0.95 ? 'destructive' : ratio >= 0.7 ? 'warning' : 'success';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-body text-foreground">{label}</span>
        <span className="text-body text-muted-foreground tabular-nums">
          {formatNumber(used)} / {formatNumber(total)}
        </span>
      </div>
      <div
        className="bg-muted h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all',
            tone === 'success' && 'bg-success',
            tone === 'warning' && 'bg-warning',
            tone === 'destructive' && 'bg-destructive',
          )}
          style={{ width: `${(pct * 100).toFixed(1)}%` }}
        />
      </div>
    </div>
  );
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('pt-BR').format(n);
}
