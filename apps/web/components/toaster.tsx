'use client';

import * as React from 'react';

import { Toaster as HotToaster, type ToasterProps } from 'react-hot-toast';

/**
 * Toaster montado uma única vez no root layout. Aplica os tokens semânticos
 * do design system (`@papopro/ui`) — chamadores usam `import { toast } from
 * 'react-hot-toast'` direto.
 *
 * Mantemos o wrapper aqui (em `apps/web/components`) e não em `@papopro/ui`
 * porque `react-hot-toast` é dependência do app (não toda interface do produto
 * vai precisar — landing usa `sonner` ou nada). Manter o pacote `ui` enxuto
 * evita arrastar libs opcionais para todo consumidor.
 *
 * Posição `bottom-right` casa com a topbar (sino fica em cima, à direita) —
 * o usuário não recebe duas notificações conflitando no mesmo canto.
 */
export function Toaster(props: ToasterProps) {
  return (
    <HotToaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        className:
          'bg-popover text-popover-foreground border-border text-body !rounded-md !border !shadow !p-3',
        success: {
          duration: 4000,
          iconTheme: {
            primary: 'hsl(var(--success))',
            secondary: 'hsl(var(--success-foreground))',
          },
        },
        error: {
          duration: 6000,
          iconTheme: {
            primary: 'hsl(var(--destructive))',
            secondary: 'hsl(var(--destructive-foreground))',
          },
        },
        loading: {
          iconTheme: {
            primary: 'hsl(var(--primary))',
            secondary: 'hsl(var(--primary-foreground))',
          },
        },
      }}
      {...props}
    />
  );
}
