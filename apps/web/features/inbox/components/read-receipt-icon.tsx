import { cn } from '@papopro/ui';
import { Check, CheckCheck } from '@papopro/ui/icons';

import type { Message } from '../types';

/**
 * Ícone de status de entrega (check/check-check) ao lado do timestamp em
 * mensagens outbound. Convenção do WhatsApp:
 *  - 1 check (cinza): enviada (servidor recebeu)
 *  - 2 checks cinza: entregue ao celular do lead
 *  - 2 checks azul: lida (lead abriu)
 *
 * Inbound não mostra (não faz sentido).
 */
interface ReadReceiptIconProps {
  message: Message;
  className?: string;
}

export function ReadReceiptIcon({ message, className }: ReadReceiptIconProps) {
  if (message.direction !== 'out' || message.kind === 'internal_note') return null;

  if (message.readAt) {
    return <CheckCheck aria-label="Lida" className={cn('text-info size-3.5', className)} />;
  }
  if (message.deliveredAt) {
    return (
      <CheckCheck
        aria-label="Entregue"
        className={cn('text-muted-foreground size-3.5', className)}
      />
    );
  }
  return <Check aria-label="Enviada" className={cn('text-muted-foreground size-3.5', className)} />;
}
