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

  useGlobalShortcuts({
    onOpenCmdK: () => setOpen(true),
    // `g+l` / `g+k` ficam aqui (no shell) pra funcionar de qualquer rota.
    // Pra navegação simples usamos `window.location.assign` — o Next captura
    // como navegação client-side intra-app sem precisar do `useRouter`.
    onGoLeads: () => window.location.assign('/leads'),
    onGoKanban: () => window.location.assign('/kanban'),
  });

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
                href="/leads"
                onClose={() => setOpen(false)}
              />
              <PaletteItem
                icon={KanbanSquare}
                label="Kanban"
                href="/kanban"
                onClose={() => setOpen(false)}
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
        <footer className="border-border bg-muted/30 text-muted-foreground text-caption flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2">
          <span className="flex flex-wrap items-center gap-2">
            <Shortcut keys={['G', 'L']} label="Leads" />
            <Shortcut keys={['G', 'K']} label="Kanban" />
            <Shortcut keys={['N']} label="Adicionar lead" />
            <Shortcut keys={['/']} label="Buscar" />
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

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <React.Fragment key={`${k}-${i}`}>
          <kbd className="border-border bg-card text-foreground inline-flex h-4 min-w-4 items-center justify-center rounded border px-1 text-[10px] font-semibold">
            {k}
          </kbd>
          {i < keys.length - 1 && <span className="text-muted-foreground/60">+</span>}
        </React.Fragment>
      ))}
      <span>{label}</span>
    </span>
  );
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
