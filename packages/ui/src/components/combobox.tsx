'use client';

import * as React from 'react';

import { Check, ChevronsUpDown } from '../icons';
import { cn } from '../utils/cn';

import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Texto extra para fuzzy match (ex: telefone formatado, sigla, alias). */
  keywords?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Mostrado no botão quando nada está selecionado. */
  placeholder?: string;
  /** Placeholder do campo de busca dentro do popover. */
  searchPlaceholder?: string;
  /** Mensagem quando filtro não casa nada. Default em pt-BR. */
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  /** ID para `aria-labelledby`/`aria-describedby` em formulários. */
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Combobox = Select com busca livre. Para 2-15 opções fixas use `Select`;
 * para listas longas (vendedores, tags, leads) ou matching por sub-string,
 * `Combobox`. Internamente é Popover + cmdk — toda a navegação por teclado
 * sai de graça.
 *
 * `value` é o `value` da opção selecionada (string), ou `null` quando
 * nenhuma. `onChange(null)` permite limpar.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Selecione…',
  searchPlaceholder = 'Buscar…',
  emptyMessage = 'Nada encontrado.',
  disabled,
  className,
  id,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid || undefined}
          aria-describedby={ariaDescribedby}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn(!selected && 'text-muted-foreground', 'truncate')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.label} ${opt.keywords ?? ''}`}
                    onSelect={() => {
                      onChange(isSelected ? null : opt.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn('text-primary', isSelected ? 'opacity-100' : 'opacity-0')}
                      aria-hidden
                    />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
