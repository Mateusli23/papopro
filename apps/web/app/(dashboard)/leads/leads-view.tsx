'use client';

import * as React from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { toast } from 'react-hot-toast';

import { Button, PageHeader } from '@papopro/ui';
import type { LeadTemperature } from '@papopro/ui';
import { Download, KanbanSquare, PlusCircle, Upload } from '@papopro/ui/icons';

import { LeadCreateDialog } from '@/features/leads/components/lead-create-dialog';
import {
  EMPTY_FILTERS,
  isFilterActive,
  LeadFilters,
  type LeadFilterState,
} from '@/features/leads/components/lead-filters';
import { LeadImportSheet } from '@/features/leads/components/lead-import-sheet';
import { LeadsTable } from '@/features/leads/components/leads-table';
import { applyLeadFilters } from '@/features/leads/filters';
import { LEAD_ORIGINS } from '@/features/leads/schemas';
import type { Lead, LeadOrigin, Pipeline, SalesRep } from '@/features/leads/types';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';

/**
 * Container client da rota `/leads` (M8#2). Server Component em `page.tsx`
 * carrega `initialLeads`, `salesReps`, `pipeline`, `tags` via Prisma + RLS
 * e passa como prop. Esse componente client roda filtragem local em-memória
 * (volume MVP, ~500 leads/workspace) e dispara Server Actions ao criar/
 * editar/mover/arquivar — `revalidatePath('/leads')` no servidor + dialog
 * chamando `router.refresh()` no sucesso fecham o loop sem hard reload.
 *
 * **Deep-link via URL params** (M5p#2): aceita `?origin=meta_ads` e
 * `?temperature=hot` na inicialização — usado pelos clicks no donut e
 * banner do dashboard. Lê uma vez na montagem; mudanças subsequentes
 * ficam em React state local sem sincronizar de volta na URL.
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

interface LeadsViewProps {
  initialLeads: Lead[];
  salesReps: SalesRep[];
  pipeline: Pipeline | null;
  /** Tags em uso no workspace, alphabetizadas — alimenta o autocomplete do filtro. */
  tags: string[];
  /** Papel do caller no workspace ativo (pra UI mostrar/esconder ações). */
  callerRole: 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer';
}

export function LeadsView({ initialLeads, salesReps, pipeline, callerRole }: LeadsViewProps) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = React.useState<LeadFilterState>(() =>
    buildInitialFilters(new URLSearchParams(searchParams.toString())),
  );
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const filtered = React.useMemo(
    () => applyLeadFilters(initialLeads, filters),
    [initialLeads, filters],
  );

  // Atalhos: `n` abre o "Adicionar lead"; `/` foca a busca (via
  // `data-shortcut-search` no `LeadFilters`).
  useGlobalShortcuts({ onCreateLead: () => setCreateOpen(true) });

  // Viewer não pode criar leads — esconde botões (defense-in-depth, RBAC
  // server-side também bloqueia se forjar request).
  const canCreate = callerRole !== 'Viewer';
  const canExport = callerRole === 'Owner' || callerRole === 'Admin' || callerRole === 'Manager';
  const activeStages = pipeline?.stages.filter((s) => !s.terminal) ?? [];

  async function handleExportCsv() {
    setExporting(true);
    try {
      // Envia filtros server-side (temperatura é client-only, ignorada no payload).
      const payload = {
        search: filters.search || undefined,
        stageIds: filters.stages.length > 0 ? filters.stages : undefined,
        assigneeIds: filters.reps.length > 0 ? filters.reps : undefined,
        origins: filters.origins.length > 0 ? filters.origins : undefined,
        tagNames: filters.tags.length > 0 ? filters.tags : undefined,
      };
      const response = await fetch('/api/exports/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(errorBody?.error ?? 'Não foi possível exportar agora.');
        return;
      }
      const rowCount = response.headers.get('X-Row-Count') ?? '?';
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Tenta extrair filename do Content-Disposition; fallback genérico.
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      a.download = fileNameMatch?.[1] ?? 'leads.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${rowCount} lead(s) exportados.`);
    } catch (err) {
      console.error('[handleExportCsv]', err);
      toast.error('Não foi possível exportar agora.');
    } finally {
      setExporting(false);
    }
  }

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
            {canExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={exporting || initialLeads.length === 0}
              >
                <Download /> {exporting ? 'Exportando…' : 'Exportar CSV'}
              </Button>
            )}
            {canCreate && (
              <>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload /> Importar CSV
                </Button>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <PlusCircle /> Adicionar lead
                </Button>
              </>
            )}
          </>
        }
      />

      <LeadFilters
        state={filters}
        onChange={setFilters}
        totalCount={initialLeads.length}
        filteredCount={filtered.length}
      />

      <LeadsTable
        leads={filtered}
        stages={pipeline?.stages}
        hasFiltersActive={isFilterActive(filters)}
        onClearFilters={() => setFilters(EMPTY_FILTERS)}
        onCreateLead={() => setCreateOpen(true)}
      />

      <LeadCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        salesReps={salesReps}
        activeStages={activeStages}
      />
      <LeadImportSheet open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
