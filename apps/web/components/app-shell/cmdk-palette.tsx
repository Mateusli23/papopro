'use client';

import * as React from 'react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@papopro/ui';
import {
  ArrowRight,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  Settings,
  Users,
} from '@papopro/ui/icons';

import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';

/**
 * Placeholder do Cmd+K palette (M3). Abre via `g + n` ou `⌘/Ctrl + K`.
 *
 * Hoje lista as rotas conhecidas como ações de navegação (todas levam pro
 * dashboard porque as outras telas só nascem em M4–M5; alinhado com o
 * comportamento da sidebar).
 *
 * Em M5 isso vira indexação cross-feature (leads, conversas, tarefas) com
 * busca fuzzy via `cmdk` (já temos).
 */
export function CmdKPalette() {
  const [open, setOpen] = React.useState(false);

  useGlobalShortcuts({ onOpenCmdK: () => setOpen(true) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0" data-shortcut-ignore>
        <DialogTitle className="sr-only">Busca rápida</DialogTitle>
        <DialogDescription className="sr-only">
          Acesso rápido a páginas e ações via teclado.
        </DialogDescription>
        <Command>
          <CommandInput placeholder="Buscar página, lead ou ação…" autoFocus />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup heading="Navegação">
              <PaletteItem
                icon={LayoutDashboard}
                label="Dashboard"
                href="/dashboard"
                onClose={() => setOpen(false)}
              />
              <PaletteItem
                icon={Users}
                label="Leads"
                href="/dashboard"
                onClose={() => setOpen(false)}
                soon
              />
              <PaletteItem
                icon={KanbanSquare}
                label="Kanban"
                href="/dashboard"
                onClose={() => setOpen(false)}
                soon
              />
              <PaletteItem
                icon={Inbox}
                label="Inbox"
                href="/dashboard"
                onClose={() => setOpen(false)}
                soon
              />
              <PaletteItem
                icon={Settings}
                label="Configurações"
                href="/dashboard"
                onClose={() => setOpen(false)}
                soon
              />
            </CommandGroup>
          </CommandList>
        </Command>
        <footer className="border-border bg-muted/30 text-muted-foreground text-caption flex items-center justify-between border-t px-4 py-2">
          <span>
            Dica: <kbd className="text-foreground font-semibold">G</kbd> →{' '}
            <kbd className="text-foreground font-semibold">N</kbd> abre essa busca
          </span>
          <span>Versão completa em M5</span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

interface PaletteItemProps {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  onClose: () => void;
  soon?: boolean;
}

function PaletteItem({ icon: Icon, label, href, onClose, soon }: PaletteItemProps) {
  // Usar `useRouter` aqui complicaria com `'use client'` inline;
  // `window.location.assign` é suficiente porque o destino é sempre
  // intra-app — o Next vai capturar e tratar como navegação cliente.
  function handleSelect() {
    onClose();
    window.location.assign(href);
  }

  return (
    <CommandItem onSelect={handleSelect} value={label}>
      <Icon className="text-muted-foreground" />
      <span className="flex-1 truncate">{label}</span>
      {soon && <span className="text-muted-foreground/70 text-caption">em breve</span>}
      <CommandShortcut>
        <ArrowRight className="size-3" />
      </CommandShortcut>
    </CommandItem>
  );
}
