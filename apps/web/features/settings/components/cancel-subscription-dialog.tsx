'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@papopro/ui';

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmação de cancelamento. Em M5 só fecha com toast informativo; em M12
 * chama Server Action que liga `cancel_at_period_end` no Stripe e marca o
 * workspace pra entrar em read-only após D+30 (PRD §3.12).
 */
export function CancelSubscriptionDialog({ open, onOpenChange }: CancelSubscriptionDialogProps) {
  function handleConfirm() {
    toast.success(
      'Cancelamento solicitado — você mantém acesso até o fim do ciclo atual e read-only por mais 30 dias.',
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar assinatura</DialogTitle>
          <DialogDescription>
            Você mantém acesso completo até o fim do ciclo atual. Depois disso fica em modo leitura
            por 30 dias antes da exclusão definitiva. Pode reativar a qualquer momento durante esse
            período.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Confirmar cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
