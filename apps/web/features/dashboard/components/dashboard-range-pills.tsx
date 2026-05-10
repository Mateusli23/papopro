'use client';

import * as React from 'react';

import 'react-day-picker/dist/style.css';

import { format as fmtDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayPicker, type DateRange } from 'react-day-picker';

import { Button, cn, Popover, PopoverContent, PopoverTrigger } from '@papopro/ui';
import { Calendar } from '@papopro/ui/icons';

import { useDashboardRange } from '../hooks/use-dashboard-range';
import type { DashboardRange } from '../types';

/**
 * Pills de filtro de período do dashboard. Replicam o padrão da imagem
 * de referência: Hoje, Esta Semana, Este Mês, Máximo, Personalizado.
 *
 * - Item ativo destaca-se com `bg-primary text-primary-foreground`.
 * - "Personalizado" abre um Popover com `<DayPicker mode="range">` (já no
 *   projeto via M5#2 Tasks, finalmente usado).
 * - Em mobile, vira scroll horizontal com `snap-x` — caberá na largura
 *   típica de 360px com 5 pills sem quebrar layout.
 *
 * Persiste em URL via `useDashboardRange()` (que usa `router.replace()` —
 * trocar pill não polui o "Voltar" do navegador).
 */

const PILLS: Array<{ key: Exclude<DashboardRange, 'custom'>; label: string }> = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mês' },
  { key: 'all', label: 'Máximo' },
];

export function DashboardRangePills() {
  const { bounds, setRange } = useDashboardRange();
  const [customOpen, setCustomOpen] = React.useState(false);

  const isCustom = bounds.range === 'custom';

  return (
    <div className="scrollbar-thin flex snap-x items-center gap-1 overflow-x-auto">
      {PILLS.map((pill) => {
        const active = bounds.range === pill.key;
        return (
          <button
            key={pill.key}
            type="button"
            onClick={() => setRange(pill.key)}
            className={cn(
              'text-caption shrink-0 snap-start rounded-md border px-3 py-1.5 font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-muted',
            )}
            aria-pressed={active}
          >
            {pill.label}
          </button>
        );
      })}

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'text-caption inline-flex shrink-0 snap-start items-center gap-1 rounded-md border px-3 py-1.5 font-medium transition-colors',
              isCustom
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-muted',
            )}
          >
            <Calendar className="size-3.5" />
            <span>{isCustom ? bounds.label : 'Personalizado'}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="end">
          <CustomRangePicker
            initial={isCustom ? { from: bounds.start, to: bounds.end } : undefined}
            onApply={(range) => {
              if (range.from && range.to) {
                setRange('custom', { start: range.from, end: range.to });
                setCustomOpen(false);
              }
            }}
            onCancel={() => setCustomOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
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
        // Em M8 com dados reais o cap pode ser revisto.
        toDate={new Date()}
      />
      <div className="text-caption text-muted-foreground">
        {selected?.from && selected?.to
          ? `${fmtDate(selected.from, "d 'de' MMM", { locale: ptBR })} – ${fmtDate(selected.to, "d 'de' MMM", { locale: ptBR })}`
          : 'Selecione início e fim'}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => selected && onApply(selected)} disabled={!selected?.to}>
          Aplicar
        </Button>
      </div>
    </div>
  );
}
