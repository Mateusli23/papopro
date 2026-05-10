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
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@papopro/ui';
import { Copy, RotateCcw } from '@papopro/ui/icons';

import { regenerateWebhookToken, useWebhookConfig } from '../store';

const ORIGINS = [
  'Meta Ads',
  'Google Ads',
  'RD Station',
  'Hotmart',
  'Forms genéricos (Lovable, WordPress, Webflow)',
];

/**
 * Card especial do `webhook_leads` — mostra URL única + botões de copiar e
 * regenerar token. Regenerar invalida o token anterior, então é destrutivo
 * (precisa atualizar todos os formulários externos).
 *
 * URL da fixture é construída a partir do hostname mock do produto. Em prod
 * vai ser `https://app.pipeflow.com.br/api/webhooks/leads/<token>`.
 */
export function WebhookCard() {
  const webhook = useWebhookConfig();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const url = `https://app.pipeflow.com.br/api/webhooks/leads/${webhook.token}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('URL copiada');
    } catch {
      toast.error('Não foi possível copiar — selecione manualmente');
    }
  }

  function handleRegenerate() {
    regenerateWebhookToken();
    setConfirmOpen(false);
    toast.success('Novo token gerado — atualize seus formulários externos');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Webhook de leads
          <Badge variant="success">Conectado</Badge>
        </CardTitle>
        <CardDescription>
          URL única que recebe leads de formulários externos. Copie e cole em qualquer ferramenta
          com webhook de saída.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input value={url} readOnly className="text-caption font-mono sm:flex-1" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopy}>
              <Copy /> Copiar
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              className="text-destructive hover:bg-destructive/5"
            >
              <RotateCcw /> Regenerar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Leads recebidos" value={webhook.totalReceived.toLocaleString('pt-BR')} />
          <Stat
            label="Última requisição"
            value={
              webhook.lastReceivedAt
                ? format(new Date(webhook.lastReceivedAt), "dd 'de' MMM, HH:mm", { locale: ptBR })
                : '—'
            }
          />
          <Stat
            label="Token gerado em"
            value={format(new Date(webhook.generatedAt), "dd 'de' MMM, yyyy", { locale: ptBR })}
          />
        </div>

        <div className="border-border bg-muted/30 flex flex-col gap-2 rounded-md border p-4">
          <span className="text-caption text-muted-foreground uppercase">Origens reconhecidas</span>
          <ul className="text-body flex flex-wrap gap-1.5">
            {ORIGINS.map((origin) => (
              <li key={origin}>
                <Badge variant="secondary">{origin}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerar token do webhook</DialogTitle>
            <DialogDescription>
              O token atual fica inválido imediatamente. Você precisa atualizar todos os formulários
              e ferramentas que apontam para esta URL antes de continuarem recebendo leads.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRegenerate}>
              Regenerar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-muted/30 flex flex-col gap-0.5 rounded-md border px-3 py-2">
      <span className="text-caption text-muted-foreground uppercase">{label}</span>
      <span className="text-body text-foreground font-medium tabular-nums">{value}</span>
    </div>
  );
}
