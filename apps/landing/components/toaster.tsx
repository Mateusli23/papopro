'use client';

import * as React from 'react';

import { Toaster as HotToaster, type ToasterProps } from 'react-hot-toast';

/**
 * Toaster montado uma única vez no root layout da landing. Espelha exatamente
 * a configuração do `apps/web/components/toaster.tsx` — mesmas cores via
 * tokens semânticos, mesma posição `bottom-right` pra não conflitar com o
 * `WhatsApp FAB` (que fica no canto inferior direito também, mas como link
 * sempre visível; o toast é temporário e aparece por cima).
 *
 * Em landing, o uso primário é o formulário do CTA final ("Recebemos seu
 * cadastro — redirecionando…"). Mantemos o wrapper no app e não em
 * `@papopro/ui` porque `react-hot-toast` é dep opcional (BrandArcs, login,
 * etc. não precisam) — manter o pacote `ui` enxuto evita arrastar libs
 * opcionais pra todo consumidor.
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
