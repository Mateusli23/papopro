'use client';

import * as React from 'react';

import Link from 'next/link';

import { Badge, Button, cn, TemperatureBadge } from '@papopro/ui';
import { ChevronDown } from '@papopro/ui/icons';

import { RepAvatar } from '@/features/leads/components/rep-avatar';
import { useLeads } from '@/features/leads/store';
import type { Lead } from '@/features/leads/types';
import { ACTIVE_STAGES } from '@/lib/fixtures/pipelines';
import { formatCentsCompact } from '@/lib/utils/format';

import { calcRotState, ROT_META } from '../rotting';

/**
 * Em telas <md, drag-and-drop é frustrante (gestos competem com scroll
 * vertical do navegador). A versão mobile vira lista colapsável por
 * etapa — vendedor abre a etapa que precisa, vê os leads, click vai
 * direto pro detalhe (mover etapa é pelo select dentro da ficha).
 *
 * Princípio CLAUDE.md §8 — mobile-first nas telas que vendedor usa em
 * campo: aqui priorizamos leitura rápida, não manipulação fina.
 */
export function KanbanMobile() {
  const leads = useLeads();
  const [open, setOpen] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(ACTIVE_STAGES.map((s) => [s.id, s.id === 'novo'])),
  );

  function toggle(stageId: string) {
    setOpen((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  }

  return (
    <div className="flex flex-col gap-2">
      {ACTIVE_STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => l.stageId === stage.id);
        const isOpen = open[stage.id];
        const totalCents = stageLeads.reduce((acc, l) => acc + (l.valueCents || 0), 0);
        return (
          <section
            key={stage.id}
            className="border-border bg-card overflow-hidden rounded-lg border"
          >
            <button
              type="button"
              onClick={() => toggle(stage.id)}
              className="hover:bg-muted/30 flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors"
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
                <span className="text-body text-foreground font-semibold">{stage.name}</span>
                <Badge variant="secondary" className="h-5 px-1.5">
                  {stageLeads.length}
                </Badge>
              </div>
              <span className="text-caption text-muted-foreground tabular-nums">
                {formatCentsCompact(totalCents)}
              </span>
            </button>
            {isOpen && (
              <ul className="border-border divide-border flex flex-col divide-y border-t">
                {stageLeads.length === 0 ? (
                  <li className="text-caption text-muted-foreground p-3">Sem leads aqui.</li>
                ) : (
                  stageLeads.map((lead) => <MobileCardRow key={lead.id} lead={lead} />)
                )}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MobileCardRow({ lead }: { lead: Lead }) {
  // calcRotState já trata etapas terminais retornando 'none'.
  const rot = calcRotState(lead);
  return (
    <li>
      <Link
        href={`/leads/${lead.id}`}
        className="hover:bg-muted/30 flex items-center gap-3 px-3 py-2 transition-colors"
      >
        <span
          className={cn('inline-block size-2 shrink-0 rounded-full', ROT_META[rot].color)}
          aria-label={ROT_META[rot].label}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body text-foreground truncate font-medium">{lead.name}</span>
          {lead.company && (
            <span className="text-caption text-muted-foreground truncate">{lead.company}</span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="text-caption tabular-nums" asChild>
          <span>{formatCentsCompact(lead.valueCents)}</span>
        </Button>
        <RepAvatar repId={lead.assignedTo} />
        <TemperatureBadge temperature={lead.temperature} iconOnly />
      </Link>
    </li>
  );
}
