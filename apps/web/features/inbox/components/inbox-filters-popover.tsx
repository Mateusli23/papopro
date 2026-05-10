'use client';

import * as React from 'react';

import {
  Badge,
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@papopro/ui';
import { Filter } from '@papopro/ui/icons';

import { ACTIVE_STAGES } from '@/lib/fixtures/pipelines';
import { SALES_REPS } from '@/lib/fixtures/sales-reps';

import { countActiveFilters } from '../transforms';
import type { ConversationStatus, InboxFilters } from '../types';

/**
 * Botão "Filtros" que abre um Popover com 4 grupos:
 *   1. Vendedor (Select)
 *   2. Status (3 chips toggle: aguardando / respondido / arquivado)
 *   3. Etapa do funil (Select — só etapas não-terminais)
 *   4. Sem resposta (chips fixos 1d / 3d / 7d / 14d)
 *
 * Os filtros aplicam **ao vivo** — qualquer mudança chama `onChange`. Não há
 * botão "Aplicar" porque a lista re-filtra com latência zero (transform é
 * função pura sobre 10 conversas) e isso evita o estado "filtro selecionado
 * mas não aplicado" que confunde.
 *
 * **Search NÃO mora aqui** — fica no input dedicado da `<ConversationList>`,
 * com seu próprio feedback visual. `countActiveFilters` propositadamente
 * ignora `search` pelo mesmo motivo.
 *
 * **Default oculta arquivadas**: `status === undefined` no transform
 * `filterConversations` esconde arquivadas. Pra ver, o usuário marca o chip
 * "Arquivadas" — esse chip é "ON quando status==='archived'", "OFF caso
 * contrário". Não é um toggle de 3 estados; é um switch entre "default
 * (oculta)" e "só arquivadas".
 */
interface InboxFiltersPopoverProps {
  filters: InboxFilters;
  onChange: (filters: InboxFilters) => void;
}

const ALL_VALUE = '__all__';
const NO_REPLY_OPTIONS = [1, 3, 7, 14] as const;

export function InboxFiltersPopover({ filters, onChange }: InboxFiltersPopoverProps) {
  const activeCount = countActiveFilters(filters);

  const setStatus = (status: ConversationStatus | undefined) => {
    // `search` é preservado — chega via props, não é tocado pelo popover.
    onChange({ ...filters, status });
  };
  const setVendor = (vendorId: string | undefined) => {
    onChange({ ...filters, vendorId });
  };
  const setStage = (stageId: string | undefined) => {
    onChange({ ...filters, stageId });
  };
  const setNoReply = (noReplyDays: number | undefined) => {
    onChange({ ...filters, noReplyDays });
  };

  const clearAll = () => {
    onChange({ search: filters.search });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('gap-1.5', activeCount > 0 && 'border-primary text-primary')}
          aria-label={
            activeCount > 0
              ? `Filtros — ${activeCount} ativo${activeCount > 1 ? 's' : ''}`
              : 'Filtros'
          }
        >
          <Filter className="size-3.5" />
          Filtros
          {activeCount > 0 && (
            <Badge
              variant="default"
              className="h-4 min-w-4 px-1 text-[10px] tabular-nums"
              aria-hidden
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-0"
        // Popover do Radix recolhe o foco no trigger ao fechar — bom default.
      >
        <div className="flex flex-col gap-4 p-4">
          {/* Vendedor */}
          <FilterGroup label="Vendedor" htmlFor="filter-vendor">
            <Select
              value={filters.vendorId ?? ALL_VALUE}
              onValueChange={(v) => setVendor(v === ALL_VALUE ? undefined : v)}
            >
              <SelectTrigger id="filter-vendor" className="h-9">
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todos os vendedores</SelectItem>
                {SALES_REPS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterGroup>

          <Separator />

          {/* Status */}
          <FilterGroup label="Status">
            <div className="flex flex-wrap gap-1.5">
              <ChipToggle
                label="Aguardando"
                active={filters.status === 'awaiting'}
                onClick={() => setStatus(filters.status === 'awaiting' ? undefined : 'awaiting')}
              />
              <ChipToggle
                label="Respondido"
                active={filters.status === 'responded'}
                onClick={() => setStatus(filters.status === 'responded' ? undefined : 'responded')}
              />
              <ChipToggle
                label="Arquivadas"
                active={filters.status === 'archived'}
                onClick={() => setStatus(filters.status === 'archived' ? undefined : 'archived')}
              />
            </div>
          </FilterGroup>

          <Separator />

          {/* Etapa */}
          <FilterGroup label="Etapa do funil" htmlFor="filter-stage">
            <Select
              value={filters.stageId ?? ALL_VALUE}
              onValueChange={(v) => setStage(v === ALL_VALUE ? undefined : v)}
            >
              <SelectTrigger id="filter-stage" className="h-9">
                <SelectValue placeholder="Todas as etapas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todas as etapas</SelectItem>
                {ACTIVE_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterGroup>

          <Separator />

          {/* Sem resposta há ≥ N dias */}
          <FilterGroup label="Sem resposta há">
            <div className="flex flex-wrap gap-1.5">
              {NO_REPLY_OPTIONS.map((d) => (
                <ChipToggle
                  key={d}
                  label={`${d} dia${d > 1 ? 's' : ''}+`}
                  active={filters.noReplyDays === d}
                  onClick={() => setNoReply(filters.noReplyDays === d ? undefined : d)}
                />
              ))}
            </div>
          </FilterGroup>
        </div>

        <Separator />

        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-caption text-muted-foreground">
            {activeCount === 0
              ? 'Nenhum filtro'
              : `${activeCount} ativo${activeCount > 1 ? 's' : ''}`}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={activeCount === 0}
            className="text-caption h-7"
          >
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Subcomponentes locais ────────────────────────────────────────────────

interface FilterGroupProps {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}

function FilterGroup({ label, htmlFor, children }: FilterGroupProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-caption text-muted-foreground font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

interface ChipToggleProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

/**
 * Chip toggle com estado ativo/inativo. Padrão visual de M5 cadências
 * (TemplatePicker) — `aria-pressed` mantém semântica correta pra leitores
 * de tela mesmo sem `<button type="checkbox">`.
 */
function ChipToggle({ label, active, onClick }: ChipToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'text-caption rounded-md border px-2.5 py-1 font-medium transition-colors',
        'focus-visible:ring-primary/40 focus-visible:outline-none focus-visible:ring-2',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}
