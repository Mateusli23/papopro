'use client';

import * as React from 'react';

import { Card } from '@papopro/ui';
import { Clock, type LucideIcon, MessageCircle, ShieldCheck, Star } from '@papopro/ui/icons';

import type { Agent, AgentMetrics } from '../types';

/**
 * Painel de métricas do agente — 4 KPIs mockados que viram VIEW Postgres
 * em M11. Layout: 2x2 em sm+, stack em mobile.
 *
 * Visual idêntico ao `cadence-metrics-panel.tsx` — keep parity entre features
 * de M5 (vendedor reconhece o padrão).
 *
 * Quando agente em `'testing'` ou recém-criado, métricas zeradas viram "—"
 * (helper `formatNumber/formatRate`) pra não dar impressão de "sucesso 0%".
 */

interface AgentMetricsPanelProps {
  agent: Agent;
}

export function AgentMetricsPanel({ agent }: AgentMetricsPanelProps) {
  const m = agent.metrics;
  const isFresh = m.totalConversations === 0;

  return (
    <Card className="flex flex-col gap-2 p-4">
      <h3 className="text-body font-semibold">Métricas</h3>
      {isFresh && (
        <p className="text-caption text-muted-foreground/80">
          Métricas aparecem após as primeiras conversas atendidas.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Metric icon={MessageCircle} label="Conversas" value={formatNumber(m.totalConversations)} />
        <Metric
          icon={ShieldCheck}
          label="Resolução sem handoff"
          value={formatRate(m.resolutionRate)}
        />
        <Metric icon={Clock} label="Tempo médio" value={formatSeconds(m.avgResponseTimeSec)} />
        <Metric icon={Star} label="Satisfação" value={formatRate(m.inferredSatisfaction)} />
      </div>
    </Card>
  );
}

interface MetricProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

function Metric({ icon: Icon, label, value }: MetricProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption text-muted-foreground/80 inline-flex items-center gap-1">
        <Icon className="size-3" />
        {label}
      </span>
      <span className="text-foreground text-title font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n === 0) return '—';
  return n.toString();
}

function formatRate(rate: AgentMetrics['resolutionRate']): string {
  if (rate === 0) return '—';
  return `${Math.round(rate * 100)}%`;
}

function formatSeconds(s: number): string {
  if (s === 0) return '—';
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${min}min` : `${min}m ${rem}s`;
}
