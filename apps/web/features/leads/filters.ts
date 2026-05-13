/**
 * Filtragem in-memory + agregações puras dos leads.
 *
 * **M8#2:** `queries.ts` virou `server-only` (`listLeads`, `getLead`, etc.
 * via Prisma + RLS). As funções puras de filtragem que rodam no Client
 * Component (`LeadsView` mantém filtros locais até virarem URL searchParams
 * num polimento posterior) viraram desse módulo, importável de qualquer
 * lado. Volume MVP (~50-500 leads por workspace) torna filtragem client
 * imperceptível; em escala maior, migramos pra Postgres `where`.
 */
import type { LeadFilterState } from './components/lead-filters';
import type { Lead } from './types';

export function applyLeadFilters(leads: Lead[], filters: LeadFilterState): Lead[] {
  const search = filters.search.trim().toLowerCase();

  return leads.filter((lead) => {
    if (search) {
      // Concatena os campos buscáveis e checa em uma única string — mais legível
      // que rodar 4 includes diferentes; e em volume baixo o custo é zero.
      const haystack = [lead.name, lead.email ?? '', lead.phone, lead.company ?? '']
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.stages.length && !filters.stages.includes(lead.stageId)) return false;
    if (filters.reps.length && !filters.reps.includes(lead.assignedTo)) return false;
    if (filters.origins.length && !filters.origins.includes(lead.origin)) return false;
    if (filters.temperatures.length && !filters.temperatures.includes(lead.temperature))
      return false;
    if (filters.tags.length && !filters.tags.some((t) => lead.tags.includes(t))) return false;
    return true;
  });
}

/** Total de pipeline (em centavos) — alimentado pelo footer da tabela. */
export function sumPipelineValue(leads: Lead[]): number {
  return leads.reduce((acc, l) => acc + (l.valueCents || 0), 0);
}
