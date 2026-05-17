'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import { Button } from '@papopro/ui';
import { Snowflake } from '@papopro/ui/icons';

import { acknowledgeColdAlertAction } from '@/features/cadences/actions';
import type { ColdAlertUI } from '@/features/cadences/queries';

/**
 * Banner exibido no topo de `/leads/[id]` quando o lead tem cold alert
 * pendente (M10#4). Tom `warning` (amarelo mostarda — estado semântico, ver
 * CLAUDE.md §8 paleta) + ícone Snowflake pra leitura imediata.
 *
 * Botão "Marcar como visto" chama `acknowledgeColdAlertAction` e some
 * otimisticamente (state local) — Server Action revalidatePath garante que
 * próximo render do server não traga o banner de volta.
 *
 * Auto-ack via trigger M10#1 (lead responde) ou M10#4 (lead muda de etapa)
 * acontece em paralelo do lado SQL — se isso rodar antes do clique, o
 * action vira no-op (early return) e o banner some também.
 */
interface ColdAlertBannerProps {
  alert: ColdAlertUI;
}

export function ColdAlertBanner({ alert }: ColdAlertBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  if (dismissed) return null;

  async function handleAck() {
    setPending(true);
    const result = await acknowledgeColdAlertAction(alert.id);
    if (!result.ok) {
      setPending(false);
      toast.error(result.error);
      return;
    }
    setDismissed(true);
    toast.success('Alerta reconhecido.');
  }

  return (
    <div
      role="alert"
      className="border-warning/30 bg-warning/10 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3 sm:items-center">
        <span className="bg-warning/20 text-warning flex size-9 shrink-0 items-center justify-center rounded-full">
          <Snowflake className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-body text-foreground font-medium">
            Lead frio em {alert.stageName}
          </span>
          <span className="text-caption text-muted-foreground">
            Sem interação há {alert.daysInactive} {alert.daysInactive === 1 ? 'dia' : 'dias'}.
            Reaqueça com uma mensagem ou registre uma conversa.
          </span>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleAck}
        disabled={pending}
        className="border-warning/40 text-foreground hover:bg-warning/15 shrink-0"
      >
        {pending ? 'Marcando…' : 'Marcar como visto'}
      </Button>
    </div>
  );
}
