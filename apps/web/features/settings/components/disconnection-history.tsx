'use client';

import * as React from 'react';

import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@papopro/ui';

import { useWhatsAppConnection } from '../store';
import type { WhatsAppOutage } from '../types';

const REASON_LABELS: Record<WhatsAppOutage['reason'], string> = {
  celular_offline: 'Celular offline',
  rede: 'Falha de rede',
  ban_temporario: 'Banimento temporário',
  manutencao: 'Manutenção',
  manual: 'Desconexão manual',
};

const REASON_VARIANTS: Record<
  WhatsAppOutage['reason'],
  'default' | 'warning' | 'destructive' | 'info' | 'secondary'
> = {
  celular_offline: 'warning',
  rede: 'warning',
  ban_temporario: 'destructive',
  manutencao: 'info',
  manual: 'secondary',
};

/**
 * Tabela de quedas históricas — mostra as últimas 10. Ordem mais recente
 * primeiro (já vem ordenada do store).
 */
export function DisconnectionHistory() {
  const conn = useWhatsAppConnection();
  const recent = conn.outages.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de desconexões</CardTitle>
        <CardDescription>
          {recent.length === 0
            ? 'Nenhuma queda registrada — conexão estável.'
            : 'As 10 desconexões mais recentes do número conectado.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? null : (
          <div className="border-border overflow-hidden rounded-md border">
            <table className="w-full text-left">
              <thead className="bg-muted/50">
                <tr className="text-caption text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Quando</th>
                  <th className="px-4 py-2 font-semibold">Duração</th>
                  <th className="px-4 py-2 font-semibold">Motivo</th>
                  <th className="px-4 py-2 font-semibold">Ação tomada</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {recent.map((o) => (
                  <tr key={o.id} className="text-body">
                    <td className="text-muted-foreground px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-foreground">
                          {format(new Date(o.startedAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                        </span>
                        <span className="text-caption">
                          {formatDistanceToNow(new Date(o.startedAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {o.durationMin === undefined
                        ? 'em andamento'
                        : o.durationMin < 60
                          ? `${o.durationMin} min`
                          : `${(o.durationMin / 60).toFixed(1)} h`}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={REASON_VARIANTS[o.reason]}>{REASON_LABELS[o.reason]}</Badge>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">{o.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
