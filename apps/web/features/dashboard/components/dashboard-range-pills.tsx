'use client';

import * as React from 'react';

import 'react-day-picker/dist/style.css';

import { format as fmtDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayPicker, type DateRange } from 'react-day-picker';

import { Button, cn, Popover, PopoverContent, PopoverTrigger } from '@papopro/ui';
import { Calendar, ChevronDown } from '@papopro/ui/icons';

import { useDashboardRange } from '../hooks/use-dashboard-range';
import { DASHBOARD_NOW } from '../range';
import type { DashboardRange } from '../types';

const RANGE_OPTIONS: Array<{
  key: Exclude<DashboardRange, 'custom'>;
  label: string;
  helper: string;
}> = [
  { key: 'today', label: 'Hoje', helper: 'Somente os dados de hoje' },
  { key: 'week', label: 'Esta semana', helper: 'Semana atual do dashboard' },
  { key: 'month', label: 'Este mês', helper: 'Mês atual do dashboard' },
  { key: 'all', label: 'Todo o período', helper: 'Todo histórico disponível' },
];

/**
 * Seletor único de período do dashboard.
 *
 * Mantém a mesma persistência em URL via `useDashboardRange()`, mas reduz o
 * peso visual do topo: em vez de várias pills competindo com o título, há um
 * botão compacto "Período: X" que abre as opções e o calendário personalizado.
 */
export function DashboardRangePills() {
  const { bounds, setRange } = useDashboardRange();
  const [open, setOpen] = React.useState(false);

  const isCustom = bounds.range === 'custom';
  const activeLabel = isCustom
    ? bounds.label
    : RANGE_OPTIONS.find((o) => o.key === bounds.range)?.label;

  function selectPreset(range: Exclude<DashboardRange, 'custom'>) {
    setRange(range);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'border-border bg-background text-foreground hover:bg-muted inline-flex min-h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto sm:min-w-56',
          )}
          aria-label={`Alterar período. Período atual: ${activeLabel}`}
        >
          <span className="text-body flex items-center gap-2 font-medium">
            <Calendar className="text-muted-foreground size-4" aria-hidden />
            <span className="text-muted-foreground font-normal">Período:</span>
            <span>{activeLabel}</span>
          </span>
          <ChevronDown className="text-muted-foreground size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(calc(100vw-2rem),24rem)] p-2" align="end">
        <div
          className="flex flex-col gap-1"
          role="listbox"
          aria-label="Selecionar período do dashboard"
        >
          {RANGE_OPTIONS.map((option) => {
            const active = bounds.range === option.key;
            return (
              <button
                key={option.key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => selectPreset(option.key)}
                className={cn(
                  'rounded-md px-3 py-2 text-left transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground',
                )}
              >
                <span className="text-body block font-medium">{option.label}</span>
                <span
                  className={cn(
                    'text-caption block',
                    active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                  )}
                >
                  {option.helper}
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-border mt-2 border-t pt-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Calendar className="text-muted-foreground size-4" aria-hidden />
            <div>
              <p className="text-body text-foreground font-medium">Período personalizado</p>
              <p className="text-caption text-muted-foreground">
                Escolha início e fim para filtrar o dashboard.
              </p>
            </div>
          </div>
          <CustomRangePicker
            initial={isCustom ? { from: bounds.start, to: bounds.end } : undefined}
            onApply={(range) => {
              if (range.from && range.to) {
                setRange('custom', { start: range.from, end: range.to });
                setOpen(false);
              }
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface CustomRangePickerProps {
  initial?: DateRange;
  onApply: (range: DateRange) => void;
  onCancel: () => void;
}

function CustomRangePicker({ initial, onApply, onCancel }: CustomRangePickerProps) {
  const [selected, setSelected] = React.useState<DateRange | undefined>(initial);

  return (
    <div className="flex flex-col gap-3">
      <DayPicker
        mode="range"
        selected={selected}
        onSelect={setSelected}
        locale={ptBR}
        weekStartsOn={1}
        showOutsideDays
        // Cap default — vendedor não compara décadas, evita range gigante.
        // Usa `DASHBOARD_NOW` (não `new Date()`) pra alinhar com fixtures
        // congeladas em M5; em M8+ vira `new Date()` real (review M5p#2).
        toDate={DASHBOARD_NOW}
      />
      <div className="text-caption text-muted-foreground px-1">
        {selected?.from && selected?.to
          ? `${fmtDate(selected.from, "d 'de' MMM", { locale: ptBR })} – ${fmtDate(selected.to, "d 'de' MMM", { locale: ptBR })}`
          : 'Selecione a data inicial e a data final'}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={() => selected && onApply(selected)}
          disabled={!selected?.from || !selected?.to}
        >
          Aplicar período
        </Button>
      </div>
    </div>
  );
}
