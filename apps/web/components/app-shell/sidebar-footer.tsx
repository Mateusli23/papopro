import { KbdShortcut, StatusDot, cn } from '@papopro/ui';

interface SidebarFooterProps {
  collapsed?: boolean;
}

/**
 * Rodapé fixo da sidebar — status da integração WhatsApp + dica de atalho.
 *
 * Enquanto não houver conexão real, não mostramos estado conectado nem número
 * fake. A conexão verdadeira entra em M9 quando o app ler `whatsapp_health_log`.
 */
export function SidebarFooter({ collapsed = false }: SidebarFooterProps) {
  return (
    <div
      className={cn(
        'border-sidebar-border flex flex-col gap-3 border-t p-3',
        collapsed && 'items-center px-2',
      )}
    >
      {!collapsed && (
        <div className="flex items-center gap-2.5 px-1.5">
          <StatusDot tone="offline" label="WhatsApp não configurado" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-caption text-foreground font-medium">WhatsApp</span>
            <span className="text-caption text-muted-foreground truncate">Não configurado</span>
          </div>
        </div>
      )}
      {collapsed && (
        <StatusDot
          tone="offline"
          label="WhatsApp não configurado"
          title="WhatsApp não configurado"
        />
      )}
      {!collapsed && (
        <div className="text-muted-foreground text-caption flex items-center justify-between px-1.5">
          <span>Buscar</span>
          <KbdShortcut keys={['Ctrl', 'K']} />
        </div>
      )}
    </div>
  );
}
