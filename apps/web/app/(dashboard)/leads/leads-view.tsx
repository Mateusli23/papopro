'use client';

import * as React from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Button, PageHeader } from '@papopro/ui';
import type { LeadTemperature } from '@papopro/ui';
import { KanbanSquare, PlusCircle, Upload } from '@papopro/ui/icons';

import { LeadCreateDialog } from '@/features/leads/components/lead-create-dialog';
import {
  EMPTY_FILTERS,
  isFilterActive,
  LeadFilters,
  type LeadFilterState,
} from '@/features/leads/components/lead-filters';
import { LeadImportSheet } from '@/features/leads/components/lead-import-sheet';
import { LeadsTable } from '@/features/leads/components/leads-table';
import { applyLeadFilters } from '@/features/leads/queries';
import { LEAD_ORIGINS } from '@/features/leads/schemas';
import { useLeads } from '@/features/leads/store';
import type { LeadOrigin } from '@/features/leads/types';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';

/**
 * Container client da rota `/leads` — junta filtros, tabela e modais.
 *
 * **Deep-link via URL params** (M5p#2): aceita `?origin=meta_ads` e
 * `?temperature=hot` na inicialização — usado pelos clicks no donut e
 * banner do dashboard. Lê uma vez na montagem; mudanças subsequentes
 * ficam em React state local sem sincronizar de volta na URL (pra que
 * filtros expandidos manualmente não poluam o histórico).
 *
 * Em M8, se virar requisito "compartilhar link com filtros", migra pra
 * `useSearchParams`/`nuqs` com sincronização bidirecional.
 */

const VALID_TEMPERATURES = new Set<LeadTemperature>(['hot', 'warm', 'cold']);
const VALID_ORIGINS = new Set<LeadOrigin>(LEAD_ORIGINS.map((o) => o.value));

function buildInitialFilters(params: URLSearchParams): LeadFilterState {
  const next: LeadFilterState = { ...EMPTY_FILTERS };
  const originParam = params.get('origin');
  if (originParam && VALID_ORIGINS.has(originParam as LeadOrigin)) {
    next.origins = [originParam as LeadOrigin];
  }
  const tempParam = params.get('temperature');
  if (tempParam && VALID_TEMPERATURES.has(tempParam as LeadTemperature)) {
    next.temperatures = [tempParam as LeadTemperature];
  }
  return next;
}

export function LeadsView() {
  const leads = useLeads();
  const searchParams = useSearchParams();
  // Lê URL params APENAS na primeira montagem — mudanças subsequentes
  // do filtro vivem em state local sem espelhar na URL.
  const [filters, setFilters] = React.useState<LeadFilterState>(() =>
    buildInitialFilters(new URLSearchParams(searchParams.toString())),
  );
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  const filtered = React.useMemo(() => applyLeadFilters(leads, filters), [leads, filters]);

  // Atalhos: `n` abre o "Adicionar lead"; `/` foca a busca (via
  // `data-shortcut-search` no `LeadFilters`).
  useGlobalShortcuts({ onCreateLead: () => setCreateOpen(true) });

  return (
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Leads"
        description="Lista densa do seu pipeline. Clique num lead para abrir, ou use os filtros pra fatiar."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/kanban">
                <KanbanSquare /> Ver no Kanban
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload /> Importar CSV
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusCircle /> Adicionar lead
            </Button>
          </>
        }
      />

      <LeadFilters
        state={filters}
        onChange={setFilters}
        totalCount={leads.length}
        filteredCount={filtered.length}
      />

      <LeadsTable
        leads={filtered}
        hasFiltersActive={isFilterActive(filters)}
        onClearFilters={() => setFilters(EMPTY_FILTERS)}
        onCreateLead={() => setCreateOpen(true)}
      />

      <LeadCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <LeadImportSheet open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
