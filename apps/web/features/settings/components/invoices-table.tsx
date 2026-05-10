'use client';

import * as React from 'react';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@papopro/ui';
import { Download } from '@papopro/ui/icons';

import { useSubscription } from '../store';
import type { Invoice } from '../types';

/**
 * Histórico de faturas. Em M5 lê fixture; em M12 vira `Invoice[]` real do
 * Stripe Customer Portal. Botão "Baixar PDF" aponta pro link mock — `window.open`
 * com `noopener` previne tabnabbing.
 */
export function InvoicesTable() {
  const sub = useSubscription();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de faturas</CardTitle>
        <CardDescription>
          Últimas {sub.invoices.length} cobranças. Faturas pagas ficam disponíveis por 24 meses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border-border overflow-hidden rounded-md border">
          <table className="w-full text-left">
            <thead className="bg-muted/50">
              <tr className="text-caption text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Data</th>
                <th className="px-4 py-2 font-semibold">Valor</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">Recibo</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {sub.invoices.map((inv) => (
                <InvoiceRow key={inv.id} invoice={inv} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <tr className="text-body">
      <td className="px-4 py-3">
        {format(new Date(invoice.issuedAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
      </td>
      <td className="px-4 py-3 font-medium tabular-nums">
        R$ {invoice.amount.toFixed(2).replace('.', ',')}
      </td>
      <td className="px-4 py-3">
        {invoice.status === 'paid' && <Badge variant="success">Paga</Badge>}
        {invoice.status === 'pending' && <Badge variant="warning">Pendente</Badge>}
        {invoice.status === 'failed' && <Badge variant="destructive">Falhou</Badge>}
      </td>
      <td className="px-4 py-3 text-right">
        <Button asChild variant="ghost" size="sm" disabled={invoice.status !== 'paid'}>
          <a
            href={invoice.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Baixar fatura de ${format(new Date(invoice.issuedAt), 'MMMM yyyy', {
              locale: ptBR,
            })}`}
          >
            <Download /> PDF
          </a>
        </Button>
      </td>
    </tr>
  );
}
