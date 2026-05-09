'use client';

import * as React from 'react';

import Link from 'next/link';

import { Button, PageHeader } from '@papopro/ui';
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
import { useLeads } from '@/features/leads/store';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';

/**
 * Container client da rota `/leads` — junta filtros, tabela e modais
 * (Sub-PR B). Mantém o estado de filtros em React state local; em M8,
 * filtros mais complexos podem migrar pra `useSearchParams`/`nuqs` se
 * compartilhar via link virar requisito.
 */
export function LeadsView() {
  const leads = useLeads();
  const [filters, setFilters] = React.useState<LeadFilterState>(EMPTY_FILTERS);
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
