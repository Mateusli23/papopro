'use client';

import * as React from 'react';

import Link from 'next/link';

import {
  Button,
  cn,
  EmptyState,
  TemperatureBadge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@papopro/ui';
import { Mail, Phone, PlusCircle, Tag, Users } from '@papopro/ui/icons';

import { formatCentsCompact, formatRelative } from '@/lib/utils/format';

import type { Lead, PipelineStage } from '../types';

import { RepAvatar } from './rep-avatar';
import { StagePill } from './stage-pill';

/**
 * Tabela densa estilo Attio — linhas de 44px, hover destacado, click → detalhe.
 *
 * Princípios:
 *  - **Densidade alta** (CLAUDE.md §8 — HubSpot × Attio): muitas colunas mas
 *    com hierarquia visual clara (nome em destaque, secundárias em muted).
 *  - **Acessível**: tabela semântica (`<table>` real, `<th scope>`); a linha
 *    inteira não é um link (caos de a11y) — usamos um link dentro do nome
 *    e linha clicável via `onClick` no `<tr>` que delega pro link.
 *  - **Sem cor hardcoded**: tons via tokens (`muted-foreground`, `primary`).
 *  - Mobile (<md): a tabela vira lista de cards (ver `LeadsMobileList`).
 */

interface LeadsTableProps {
  leads: Lead[];
  /**
   * Stages do pipeline ativo (M8#2+). Usado pra resolver `stageId` → nome/tom
   * na coluna "Etapa" sem cair no fallback que mostraria UUID literal.
   */
  stages?: PipelineStage[];
  /** Action a renderizar quando o filtro vazia o resultado. */
  onClearFilters?: () => void;
  /** Action quando a base inteira está vazia. */
  onCreateLead?: () => void;
  hasFiltersActive?: boolean;
}

export function LeadsTable({
  leads,
  stages,
  onClearFilters,
  onCreateLead,
  hasFiltersActive = false,
}: LeadsTableProps) {
  // Resolve `stageId` → stage uma vez por render. Volume MVP (<10 stages) torna
  // o Map redundante, mas mantém legibilidade quando lista cresce.
  const stageById = React.useMemo(() => {
    const map = new Map<string, PipelineStage>();
    for (const s of stages ?? []) map.set(s.id, s);
    return map;
  }, [stages]);
  if (leads.length === 0) {
    return (
      <EmptyState
        icon={hasFiltersActive ? Tag : Users}
        title={hasFiltersActive ? 'Nenhum lead encontrado' : 'Nenhum lead ainda'}
        description={
          hasFiltersActive
            ? 'Tente remover algum filtro ou ajustar a busca.'
            : 'Comece adicionando manualmente ou importando um CSV.'
        }
        action={
          hasFiltersActive ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Limpar filtros
            </Button>
          ) : (
            <Button size="sm" onClick={onCreateLead}>
              <PlusCircle /> Adicionar lead
            </Button>
          )
        }
      />
    );
  }

  return (
    <>
      <div className="border-border bg-card hidden overflow-hidden rounded-lg border md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/40 text-caption text-muted-foreground border-border border-b">
                <Th className="w-[28%]">Nome</Th>
                <Th className="w-[14%]">Etapa</Th>
                <Th className="w-[10%]">Vendedor</Th>
                <Th className="w-[8%]">Temperatura</Th>
                <Th className="w-[10%] text-right">Valor</Th>
                <Th className="w-[15%]">Última interação</Th>
                <Th className="w-[15%]">Próxima ação</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <LeadRow key={lead.id} lead={lead} stage={stageById.get(lead.stageId)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: cards empilhados */}
      <div className="md:hidden">
        <LeadsMobileList leads={leads} stageById={stageById} />
      </div>
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn('px-4 py-2 font-medium', className)}>
      {children}
    </th>
  );
}

function LeadRow({ lead, stage }: { lead: Lead; stage?: PipelineStage }) {
  return (
    <tr className="border-border hover:bg-muted/30 group border-b transition-colors last:border-0">
      <td className="px-4 py-2.5">
        <div className="flex flex-col">
          <Link
            href={`/leads/${lead.id}`}
            className="text-body text-foreground group-hover:text-primary truncate font-medium hover:underline"
          >
            {lead.name}
          </Link>
          <div className="text-caption text-muted-foreground flex items-center gap-2 truncate">
            {lead.company && <span className="truncate">{lead.company}</span>}
            {lead.company && lead.phone && <span aria-hidden>·</span>}
            <span className="inline-flex items-center gap-1 truncate">
              <Phone className="size-3 shrink-0" aria-hidden />
              {lead.phone}
            </span>
            {lead.email && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex shrink-0">
                    <Mail
                      className="text-muted-foreground/70 size-3"
                      aria-label={`Email: ${lead.email}`}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{lead.email}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <StagePill stage={stage} stageId={lead.stageId} />
      </td>
      <td className="px-4 py-2.5">
        <RepAvatar repId={lead.assignedTo} />
      </td>
      <td className="px-4 py-2.5">
        <TemperatureBadge temperature={lead.temperature} iconOnly />
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        <span className="text-body text-foreground font-medium">
          {formatCentsCompact(lead.valueCents)}
        </span>
      </td>
      <td className="text-muted-foreground px-4 py-2.5">
        <span className="text-caption">{formatRelative(lead.lastInteractionAt)}</span>
      </td>
      <td className="px-4 py-2.5">
        {lead.nextActionLabel ? (
          <div className="flex flex-col">
            <span className="text-body text-foreground truncate">{lead.nextActionLabel}</span>
            <span className="text-caption text-muted-foreground">
              {formatRelative(lead.nextActionAt)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-caption">—</span>
        )}
      </td>
    </tr>
  );
}

function LeadsMobileList({
  leads,
  stageById,
}: {
  leads: Lead[];
  stageById: Map<string, PipelineStage>;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {leads.map((lead) => (
        <li key={lead.id}>
          <Link
            href={`/leads/${lead.id}`}
            className="border-border bg-card hover:bg-muted/30 flex flex-col gap-2 rounded-lg border p-3 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-body text-foreground block truncate font-medium">
                  {lead.name}
                </span>
                {lead.company && (
                  <span className="text-caption text-muted-foreground block truncate">
                    {lead.company}
                  </span>
                )}
              </div>
              <TemperatureBadge temperature={lead.temperature} iconOnly />
            </div>
            <div className="flex items-center justify-between gap-2">
              <StagePill stage={stageById.get(lead.stageId)} stageId={lead.stageId} />
              <span className="text-body text-foreground font-medium tabular-nums">
                {formatCentsCompact(lead.valueCents)}
              </span>
            </div>
            <div className="text-caption text-muted-foreground flex items-center justify-between">
              <RepAvatar repId={lead.assignedTo} withName size="sm" />
              <span>{formatRelative(lead.lastInteractionAt)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
