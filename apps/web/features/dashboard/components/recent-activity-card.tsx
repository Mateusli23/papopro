'use client';

import * as React from 'react';

import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
} from '@papopro/ui';
import { Activity as ActivityIcon, PlusCircle, Trophy, X as XIcon } from '@papopro/ui/icons';

import { getRecentActivity } from '@/features/dashboard/transforms';
import type { ActivityItem } from '@/features/dashboard/types';
import { useDeals } from '@/features/deals/store';
import { getRep } from '@/lib/fixtures/sales-reps';
import { formatRelative } from '@/lib/utils/format';

/**
 * Timeline "Atividade recente" — top 6 eventos derivados das fixtures
 * (created / won / lost). Reage em real-time via `useDeals()`: criar ou
 * mover pra Ganho/Perdido em outra rota faz a entrada aparecer aqui.
 *
 * Cada linha:
 *  - Ícone redondo colorido por tipo (info/success/destructive)
 *  - "Mateus criou Apto 3 quartos"
 *  - "há 2 horas"
 *
 * Clica → `/leads/{leadId}`. Áreas de hover sutis pra indicar interação.
 *
 * Em M8 essa lista vira `useQuery(['activities', workspaceId])` lendo
 * a tabela `activities` Postgres — a shape `ActivityItem` permanece
 * (transforms.ts continua válido).
 */

const TYPE_STYLES: Record<
  ActivityItem['type'],
  { Icon: typeof PlusCircle; iconBg: string; verb: string }
> = {
  created: {
    Icon: PlusCircle,
    iconBg: 'bg-info/15 text-info',
    verb: 'criou',
  },
  won: {
    Icon: Trophy,
    iconBg: 'bg-success/15 text-success',
    verb: 'fechou',
  },
  lost: {
    Icon: XIcon,
    iconBg: 'bg-destructive/15 text-destructive',
    verb: 'perdeu',
  },
};

export function RecentActivityCard() {
  const deals = useDeals();
  const events = React.useMemo(() => getRecentActivity(deals, 6), [deals]);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-title">Atividade recente</CardTitle>
        <CardDescription>Últimos movimentos no pipeline</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {events.length === 0 ? (
          <EmptyState
            icon={ActivityIcon}
            title="Sem atividade"
            description="Quando criar ou fechar negócios, eles aparecem aqui."
          />
        ) : (
          <ol className="flex flex-col gap-2">
            {events.map((evt, i) => (
              <ActivityRow key={`${evt.dealId}-${evt.type}-${i}`} item={evt} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const style = TYPE_STYLES[item.type];
  const rep = getRep(item.ownerId);
  const repName = rep?.name.split(' ')[0] ?? 'Alguém';

  return (
    <li>
      <Link
        href={`/leads/${item.leadId}`}
        className="hover:bg-muted/40 -mx-2 flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors"
      >
        <span
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
            style.iconBg,
          )}
          aria-hidden
        >
          <style.Icon className="size-3" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-body text-foreground leading-snug">
            <span className="font-semibold">{repName}</span>{' '}
            <span className="text-muted-foreground">{style.verb}</span>{' '}
            <span className="font-medium">{item.dealTitle}</span>
          </p>
          <span className="text-caption text-muted-foreground/80">
            {formatRelative(item.timestamp)}
          </span>
        </div>
      </Link>
    </li>
  );
}
