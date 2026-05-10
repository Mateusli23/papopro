'use client';

import * as React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent } from '@papopro/ui';
import { Send, TrendingUp, Users } from '@papopro/ui/icons';

import { getRepName } from '@/lib/fixtures/sales-reps';
import { FAKE_USER } from '@/lib/fixtures/user';

import type { Cadence } from '../types';

/**
 * Painel lateral direito do editor — 4 KPIs mockados.
 *
 * Em M10 esses números viram VIEW Postgres calculada de
 * `cadence_enrollments` + `cadence_step_runs`. Aqui são fixos da fixture,
 * o que basta pra demonstrar a UI e validar layout em ambos os temas.
 *
 * Layout de 1 coluna empilhada — funciona em mobile (timeline empilha em
 * cima) e em desktop quando colapsado.
 *
 * **Hydration**: `formatDistanceToNow` compara o `updatedAt` ISO com
 * `Date.now()` interno — não-determinístico entre SSR e cliente. Por isso
 * os strings relativos só são calculados depois do hidrate (`useEffect`),
 * exibindo "—" inicial. Evita warning de mismatch sem custo perceptível.
 */

interface CadenceMetricsPanelProps {
  cadence: Cadence;
  /** Quem editou pela última vez. Em M5 sempre FAKE_USER. */
  lastEditorId?: string;
}

export function CadenceMetricsPanel({
  cadence,
  lastEditorId = FAKE_USER.id,
}: CadenceMetricsPanelProps) {
  const [relativeLabels, setRelativeLabels] = React.useState<{
    lastEdit: string;
    created: string;
  } | null>(null);

  React.useEffect(() => {
    setRelativeLabels({
      lastEdit: formatDistanceToNow(new Date(cadence.updatedAt), {
        addSuffix: true,
        locale: ptBR,
      }),
      created: formatDistanceToNow(new Date(cadence.createdAt), {
        addSuffix: true,
        locale: ptBR,
      }),
    });
  }, [cadence.updatedAt, cadence.createdAt]);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <Metric
            icon={<Users className="size-4" />}
            label="Leads ativos"
            value={cadence.metrics.activeEnrollments.toString()}
            tone="info"
          />
          <Metric
            icon={<Send className="size-4" />}
            label="Total disparado"
            value={cadence.metrics.totalDispatched.toLocaleString('pt-BR')}
            tone="muted"
          />
          <Metric
            icon={<TrendingUp className="size-4" />}
            label="Taxa de resposta"
            value={formatRate(cadence.metrics.responseRate)}
            tone="success"
          />
          <Metric
            icon={<TrendingUp className="size-4" />}
            label="Avanço de etapa"
            value={formatRate(cadence.metrics.stageAdvanceRate)}
            tone="success"
          />
        </CardContent>
      </Card>

      <div className="text-caption text-muted-foreground/80 flex flex-col gap-0.5 px-1">
        <span>
          Última edição {relativeLabels?.lastEdit ?? '—'}{' '}
          {lastEditorId && `por ${getRepName(lastEditorId)}`}
        </span>
        <span>Criada {relativeLabels?.created ?? '—'}</span>
      </div>
    </div>
  );
}

interface MetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'info' | 'success' | 'warning' | 'muted';
}

function Metric({ icon, label, value, tone }: MetricProps) {
  const toneClasses: Record<MetricProps['tone'], string> = {
    info: 'text-info bg-info/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    muted: 'text-muted-foreground bg-muted',
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}
      >
        {icon}
      </div>
      <div className="flex flex-1 flex-col">
        <span className="text-caption text-muted-foreground">{label}</span>
        <span className="text-title font-semibold tabular-nums">{value}</span>
      </div>
    </div>
  );
}

function formatRate(rate: number): string {
  if (rate === 0) return '—';
  return `${Math.round(rate * 100)}%`;
}
