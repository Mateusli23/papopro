import { KbdShortcut, StatusDot } from '@papopro/ui';

/**
 * Rodapé fixo da sidebar — saúde do WhatsApp do workspace + dica de atalho.
 *
 * Em M9 o `StatusDot` lê `whatsapp_health_log` real. Por ora mostra estado
 * "online" mockado pra validar o esqueleto visual.
 */
export function SidebarFooter() {
  return (
    <div className="border-sidebar-border flex flex-col gap-3 border-t p-3">
      <div className="flex items-center gap-2.5 px-1.5">
        <StatusDot tone="online" pulse />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-caption text-foreground font-medium">WhatsApp conectado</span>
          <span className="text-caption text-muted-foreground truncate">+55 11 9 9999-0000</span>
        </div>
      </div>
      <div className="text-muted-foreground flex items-center justify-between px-1.5 text-caption">
        <span>Buscar</span>
        <KbdShortcut keys={['Ctrl', 'K']} />
      </div>
    </div>
  );
}
