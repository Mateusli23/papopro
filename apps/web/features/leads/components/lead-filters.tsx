'use client';

import * as React from 'react';

import { Badge, Button, cn, Input, Popover, PopoverContent, PopoverTrigger } from '@papopro/ui';
import type { LeadTemperature } from '@papopro/ui';
import { ChevronDown, Filter, Search, X } from '@papopro/ui/icons';

import { ALL_TAGS } from '@/lib/fixtures/leads';
import { DEFAULT_STAGES } from '@/lib/fixtures/pipelines';
import { SALES_REPS } from '@/lib/fixtures/sales-reps';

import { LEAD_ORIGINS } from '../schemas';
import type { LeadOrigin } from '../types';

/**
 * Filtros combináveis em chips. Estado vive no componente pai (`LeadsView`)
 * via React state local — em M8, se "compartilhar link com filtro aplicado"
 * virar requisito, migra pra `useSearchParams` ou `nuqs` sem mudar a API
 * deste componente.
 *
 * Cada filtro é um Popover; selecionar adiciona um chip ativo. Múltiplos
 * valores no mesmo filtro = OR; entre filtros diferentes = AND.
 */

export interface LeadFilterState {
  search: string;
  stages: string[];
  reps: string[];
  origins: LeadOrigin[];
  tags: string[];
  temperatures: LeadTemperature[];
}

export const EMPTY_FILTERS: LeadFilterState = {
  search: '',
  stages: [],
  reps: [],
  origins: [],
  tags: [],
  temperatures: [],
};

export function isFilterActive(state: LeadFilterState): boolean {
  return Boolean(
    state.search ||
    state.stages.length ||
    state.reps.length ||
    state.origins.length ||
    state.tags.length ||
    state.temperatures.length,
  );
}

interface LeadFiltersProps {
  state: LeadFilterState;
  onChange: (next: LeadFilterState) => void;
  /** Total bruto antes do filtro — usado pro contador "X de Y leads". */
  totalCount: number;
  /** Total após o filtro — para mostrar "exibindo Z". */
  filteredCount: number;
}

export function LeadFilters({ state, onChange, totalCount, filteredCount }: LeadFiltersProps) {
  function toggle<T>(key: keyof LeadFilterState, value: T) {
    const current = state[key] as unknown as T[];
    const exists = current.includes(value);
    onChange({
      ...state,
      [key]: exists ? current.filter((v) => v !== value) : [...current, value],
    });
  }

  function clear() {
    onChange(EMPTY_FILTERS);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search
            className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={state.search}
            onChange={(e) => onChange({ ...state, search: e.target.value })}
            placeholder="Buscar por nome, telefone, email ou empresa… (atalho: /)"
            aria-label="Buscar leads"
            className="pl-9"
            data-shortcut-search
          />
        </div>

        <FilterPopover
          label="Etapa"
          values={state.stages}
          options={DEFAULT_STAGES.map((s) => ({ value: s.id, label: s.name }))}
          onToggle={(v) => toggle('stages', v)}
        />
        <FilterPopover
          label="Vendedor"
          values={state.reps}
          options={SALES_REPS.map((r) => ({ value: r.id, label: r.name }))}
          onToggle={(v) => toggle('reps', v)}
        />
        <FilterPopover
          label="Origem"
          values={state.origins}
          options={LEAD_ORIGINS.map((o) => ({ value: o.value, label: o.label }))}
          onToggle={(v) => toggle('origins', v as LeadOrigin)}
        />
        <FilterPopover
          label="Temperatura"
          values={state.temperatures}
          options={[
            { value: 'hot', label: 'Quente' },
            { value: 'warm', label: 'Morno' },
            { value: 'cold', label: 'Frio' },
          ]}
          onToggle={(v) => toggle('temperatures', v as LeadTemperature)}
        />
        <FilterPopover
          label="Tag"
          values={state.tags}
          options={ALL_TAGS.map((t) => ({ value: t, label: t }))}
          onToggle={(v) => toggle('tags', v)}
        />

        <span className="text-muted-foreground text-caption ml-auto">
          {filteredCount === totalCount
            ? `${totalCount} leads`
            : `${filteredCount} de ${totalCount}`}
        </span>
      </div>

      {isFilterActive(state) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {state.search && (
            <ActiveChip
              label={`"${state.search}"`}
              onRemove={() => onChange({ ...state, search: '' })}
            />
          )}
          {state.stages.map((s) => (
            <ActiveChip
              key={`stage-${s}`}
              label={`Etapa: ${DEFAULT_STAGES.find((st) => st.id === s)?.name ?? s}`}
              onRemove={() => toggle('stages', s)}
            />
          ))}
          {state.reps.map((r) => (
            <ActiveChip
              key={`rep-${r}`}
              label={`Vendedor: ${SALES_REPS.find((sr) => sr.id === r)?.name ?? r}`}
              onRemove={() => toggle('reps', r)}
            />
          ))}
          {state.origins.map((o) => (
            <ActiveChip
              key={`origin-${o}`}
              label={`Origem: ${LEAD_ORIGINS.find((or) => or.value === o)?.label ?? o}`}
              onRemove={() => toggle('origins', o)}
            />
          ))}
          {state.temperatures.map((t) => (
            <ActiveChip
              key={`temp-${t}`}
              label={`Temperatura: ${t === 'hot' ? 'Quente' : t === 'warm' ? 'Morno' : 'Frio'}`}
              onRemove={() => toggle('temperatures', t)}
            />
          ))}
          {state.tags.map((t) => (
            <ActiveChip key={`tag-${t}`} label={`#${t}`} onRemove={() => toggle('tags', t)} />
          ))}
          <Button variant="ghost" size="sm" onClick={clear} className="h-7 px-2">
            <X className="size-3" /> Limpar tudo
          </Button>
        </div>
      )}
    </div>
  );
}

interface FilterPopoverProps<T extends string> {
  label: string;
  values: T[];
  options: { value: T; label: string }[];
  onToggle: (v: T) => void;
}

function FilterPopover<T extends string>({
  label,
  values,
  options,
  onToggle,
}: FilterPopoverProps<T>) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-9 gap-1.5', values.length > 0 && 'border-primary/50 bg-primary/5')}
        >
          <Filter className="size-3.5" />
          {label}
          {values.length > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 font-semibold">
              {values.length}
            </Badge>
          )}
          <ChevronDown className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="flex max-h-72 flex-col overflow-y-auto">
          {options.map((opt) => {
            const checked = values.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggle(opt.value)}
                className={cn(
                  'text-body hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                  checked && 'bg-primary/5 text-primary',
                )}
              >
                <span
                  className={cn(
                    'border-input flex size-4 shrink-0 items-center justify-center rounded-sm border',
                    checked && 'border-primary bg-primary text-primary-foreground',
                  )}
                  aria-hidden
                >
                  {checked && (
                    <svg viewBox="0 0 16 16" className="size-3 fill-none stroke-current stroke-2">
                      <path d="M3 8.5l3 3 6-7" />
                    </svg>
                  )}
                </span>
                <span className="flex-1 truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="bg-primary/10 text-primary text-caption inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="hover:bg-primary/20 rounded-full p-0.5"
        aria-label={`Remover filtro ${label}`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
