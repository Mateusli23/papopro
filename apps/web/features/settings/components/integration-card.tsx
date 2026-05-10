'use client';

import * as React from 'react';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@papopro/ui';
import { Calendar, Globe, Megaphone, type LucideIcon, Plug } from '@papopro/ui/icons';

import { toggleIntegration } from '../store';
import type { Integration, IntegrationKey } from '../types';

const ICON_BY_KEY: Record<IntegrationKey, LucideIcon> = {
  google_calendar: Calendar,
  webhook_leads: Globe,
  meta_ads: Megaphone,
  google_ads: Megaphone,
  rd_station: Plug,
  hotmart: Plug,
};

/**
 * Card de integração — usado pelos slots não-webhook no grid de
 * `/settings/integrations`. Webhook tem card próprio (`<WebhookCard>`)
 * porque mostra URL + botões de copiar/regenerar, layout diferente.
 *
 * Toggle de conectar/desconectar abre Dialog explicativo (em M5 mock; em M7+
 * vira fluxo OAuth ou setup wizard real).
 */
export function IntegrationCard({ integration }: { integration: Integration }) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const Icon = ICON_BY_KEY[integration.key] ?? Plug;

  function handleConfirm() {
    const r = toggleIntegration({
      key: integration.key,
      connect: integration.status !== 'connected',
    });
    if (!r.ok) {
      toast.error(r.reason ?? 'Não foi possível atualizar agora');
      setConfirmOpen(false);
      return;
    }
    toast.success(
      integration.status === 'connected'
        ? `${integration.label} desconectada`
        : `${integration.label} conectada`,
    );
    setConfirmOpen(false);
  }

  const isSoon = integration.status === 'soon';
  const isConnected = integration.status === 'connected';

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="bg-muted/40 inline-flex size-9 items-center justify-center rounded-md">
            <Icon className="text-foreground size-5" />
          </div>
          <StatusBadge status={integration.status} />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-body text-foreground font-medium">{integration.label}</span>
          <span className="text-caption text-muted-foreground">{integration.description}</span>
          {integration.connectedAt && (
            <span className="text-caption text-muted-foreground/80">
              Conectada em{' '}
              {format(new Date(integration.connectedAt), "dd 'de' MMM, yyyy", { locale: ptBR })}
            </span>
          )}
        </div>

        <div className="mt-auto pt-2">
          {isSoon ? (
            <Button variant="outline" disabled className="w-full">
              Em breve
            </Button>
          ) : (
            <Button
              variant={isConnected ? 'outline' : 'default'}
              className="w-full"
              onClick={() => setConfirmOpen(true)}
            >
              {isConnected ? 'Desconectar' : 'Conectar'}
            </Button>
          )}
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isConnected ? `Desconectar ${integration.label}` : `Conectar ${integration.label}`}
              </DialogTitle>
              <DialogDescription>
                {isConnected
                  ? 'A integração para de sincronizar imediatamente. Você pode reconectar a qualquer momento.'
                  : `Em M5 essa conexão é simulada. Em produção (M${integration.key === 'google_calendar' ? '8' : '11+'}), você é levado ao fluxo OAuth oficial.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button variant={isConnected ? 'destructive' : 'default'} onClick={handleConfirm}>
                {isConnected ? 'Desconectar' : 'Conectar agora'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Integration['status'] }) {
  if (status === 'connected') return <Badge variant="success">Conectada</Badge>;
  if (status === 'soon') return <Badge variant="outline">Em breve</Badge>;
  return <Badge variant="secondary">Não conectada</Badge>;
}
