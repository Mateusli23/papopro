'use client';

import * as React from 'react';

import Link from 'next/link';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
} from '@papopro/ui';
import { ThermometerSnowflake } from '@papopro/ui/icons';

import { useLeads } from '@/features/leads/store';
import { getCoolingLeads } from '@/features/reports/transforms';
import type { CoolingLead } from '@/features/reports/types';

/**
 * Card "Leads esfriando" — top 6 leads com `calcRotState() === 'rotten'`
 * ou `'warning'`, ordenados por criticidade (rotten primeiro, depois mais
 * dias parado).
 *
 * Reusa `calcRotState()` de `features/leads/rotting.ts` (mesma função
 * que pinta o card do Kanban) — coerência total entre as 2 telas: se um
 * lead aparece aqui, o card dele no Kanban também está com indicador
 * vermelho/amarelo.
 *
 * Cada linha clica pra `/leads/{id}` (mesmo padrão do `UpcomingDealsTable`).
 */

const ROT_STYLES: Record<
  CoolingLead['rotState'],
  { dot: string; label: string; badgeVariant: 'destructive' | 'warning' }
> = {
  rotten: {
    dot: 'bg-destructive',
    label: 'Atrasado',
    badgeVariant: 'destructive',
  },
  warning: {
    dot: 'bg-warning',
    label: 'Próximo do prazo',
    badgeVariant: 'warning',
  },
};

export function CoolingLeadsCard() {
  const leads = useLeads();
  const events = React.useMemo(() => getCoolingLeads(leads, 6), [leads]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-title">Leads esfriando</CardTitle>
        <CardDescription>Sem interação há mais tempo do que o ideal pra etapa.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {events.length === 0 ? (
          <EmptyState
            icon={ThermometerSnowflake}
            title="Tudo aquecido 🎉"
            description="Nenhum lead passou do prazo de interação por etapa. Bom trabalho."
          />
        ) : (
          <ol className="flex flex-col gap-1.5">
            {events.map((evt) => (
              <CoolingRow key={evt.lead.id} item={evt} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function CoolingRow({ item }: { item: CoolingLead }) {
  const tone = ROT_STYLES[item.rotState];
  const days = item.daysSinceLastInteraction;
  const daysLabel =
    days === 0
      ? 'hoje'
      : days >= 999
        ? 'sem interação'
        : `há ${days} ${days === 1 ? 'dia' : 'dias'}`;

  return (
    <li>
      <Link
        href={`/leads/${item.lead.id}`}
        className="hover:bg-muted/40 -mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors"
      >
        <span
          className={cn('mt-0.5 inline-block size-2 shrink-0 rounded-full', tone.dot)}
          aria-label={tone.label}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body text-foreground truncate font-medium">{item.lead.name}</span>
          <span className="text-caption text-muted-foreground/80 truncate">
            {item.stageName} · {daysLabel}
          </span>
        </div>
        <Badge variant={tone.badgeVariant} className="shrink-0">
          {tone.label}
        </Badge>
      </Link>
    </li>
  );
}
