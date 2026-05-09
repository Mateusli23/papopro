/**
 * Filtragem in-memory dos leads. Em M8 isso vira query Postgres com índices
 * (`pg_trgm` pra busca, `b-tree` em `(workspace_id, stage_id)` etc).
 *
 * Mantemos a função pura: recebe `Lead[] + filtros`, devolve `Lead[]` filtrado.
 * Sem side-effects — fica trivial migrar pra `useQuery`/Server Action depois.
 */
import type { LeadFilterState } from './components/lead-filters';
import type { Lead } from './types';

export function applyLeadFilters(leads: Lead[], filters: LeadFilterState): Lead[] {
  const search = filters.search.trim().toLowerCase();

  return leads.filter((lead) => {
    if (search) {
      // Concatena os campos buscáveis e checa em uma única string — mais legível
      // que rodar 4 includes diferentes; e em volume baixo (50 leads) o custo é zero.
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
