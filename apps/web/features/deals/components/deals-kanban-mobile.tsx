'use client';

import * as React from 'react';

import Link from 'next/link';

import { Badge, cn, TemperatureBadge } from '@papopro/ui';
import { ChevronDown, Trophy, X as XIcon } from '@papopro/ui/icons';

import { useDeals } from '@/features/deals/store';
import { RepAvatar } from '@/features/leads/components/rep-avatar';
import { getLead } from '@/lib/fixtures/leads';
import { DEFAULT_STAGES } from '@/lib/fixtures/pipelines';
import { formatCentsCompact } from '@/lib/utils/format';

import { getStageStyle } from '../stage-style';
import type { Deal } from '../types';

import { DueDatePill } from './due-date-pill';

/**
 * Versão mobile (<md) do Pipeline Kanban — drag em mobile compete com
 * scroll vertical, então viramos lista colapsável por etapa. Mover deal
 * de etapa em mobile é via select dentro da ficha (a partir de M5).
 */
export function DealsKanbanMobile() {
  const deals = useDeals();
  const [open, setOpen] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(DEFAULT_STAGES.map((s) => [s.id, s.id === 'novo' || s.id === 'em_contato'])),
  );

  return (
    <div className="flex flex-col gap-2">
      {DEFAULT_STAGES.map((stage) => {
        const stageDeals = deals.filter((d) => d.stageId === stage.id);
        const isOpen = open[stage.id];
        const total = stageDeals.reduce((acc, d) => acc + d.valueCents, 0);
        const style = getStageStyle(stage.id);
        const HeaderIcon = stage.id === 'ganho' ? Trophy : stage.id === 'perdido' ? XIcon : null;

        return (
          <section
            key={stage.id}
            className="border-border bg-card overflow-hidden rounded-xl border"
          >
            <div className={cn('h-[3px] w-full', style.stripe)} aria-hidden />
            <button
              type="button"
              onClick={() => setOpen((p) => ({ ...p, [stage.id]: !p[stage.id] }))}
              className={cn(
                'hover:bg-muted/30 flex w-full items-center justify-between gap-2 px-3 py-3 text-left transition-colors',
                style.headerBg,
              )}
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  className={cn(
                    'text-muted-foreground size-4 transition-transform',
                    isOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
                {HeaderIcon && <HeaderIcon className={cn('size-4', style.headerText)} />}
                <span className={cn('text-body font-semibold', style.headerText)}>
                  {stage.name}
                </span>
                <Badge variant="secondary" className="h-5 px-1.5">
                  {stageDeals.length}
                </Badge>
              </div>
              <span className="text-caption text-muted-foreground tabular-nums">
                {formatCentsCompact(total)}
              </span>
            </button>
            {isOpen && (
              <ul className="divide-border divide-y">
                {stageDeals.length === 0 ? (
                  <li className="text-caption text-muted-foreground p-3">Sem deals nesta etapa.</li>
                ) : (
                  stageDeals.map((deal) => <MobileDealRow key={deal.id} deal={deal} />)
                )}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MobileDealRow({ deal }: { deal: Deal }) {
  const lead = getLead(deal.leadId);
  return (
    <li>
      <Link
        href={`/leads/${deal.leadId}`}
        className="hover:bg-muted/30 flex flex-col gap-1.5 px-3 py-2.5 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-body text-foreground line-clamp-1 font-semibold">{deal.title}</span>
          {lead && <TemperatureBadge temperature={lead.temperature} iconOnly />}
        </div>
        {lead && (
          <span className="text-caption text-muted-foreground line-clamp-1">{lead.name}</span>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-body text-foreground font-medium tabular-nums">
            {formatCentsCompact(deal.valueCents)}
          </span>
          <div className="flex items-center gap-2">
            <DueDatePill due={deal.dueAt} dense />
            <RepAvatar repId={deal.ownerId} />
          </div>
        </div>
      </Link>
    </li>
  );
}
