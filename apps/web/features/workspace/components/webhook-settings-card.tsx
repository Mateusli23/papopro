'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@papopro/ui';
import { AlertCircle, CheckCircle2, Copy } from '@papopro/ui/icons';

import type { WebhookEventListItem } from '@/features/webhooks/queries';
import { regenerateWebhookTokenAction } from '@/features/workspace/actions';

/**
 * Card de Webhook na tela de Settings → Connections (M8#5).
 *
 * **O que mostra:**
 *  - URL completa pronta pra copiar (`/api/webhooks/leads/<token>`).
 *  - Botão "Regenerar token" (Owner/Admin only) que invalida o antigo.
 *  - Últimos 20 eventos recebidos com status (✅ processado / ❌ erro).
 *
 * Server Component pai (`ConnectionsView`) passa `webhookUrl`, `events` e
 * `canRegenerate` por prop. Esse componente é client por causa do clipboard
 * + Dialog de confirmação.
 */

interface WebhookSettingsCardProps {
  webhookUrl: string | null;
  events: WebhookEventListItem[];
  canRegenerate: boolean;
}

export function WebhookSettingsCard({
  webhookUrl,
  events,
  canRegenerate,
}: WebhookSettingsCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);

  async function handleCopy() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success('URL copiada.');
    } catch {
      toast.error('Não foi possível copiar — copie manualmente.');
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const result = await regenerateWebhookTokenAction();
      if (result.ok) {
        toast.success('Token regenerado. A URL antiga deixou de funcionar.');
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook de captura de leads</CardTitle>
        <CardDescription>
          Use essa URL para receber leads automaticamente do Zapier, Make, N8N ou de qualquer
          formulário/integração que faça POST com JSON.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {webhookUrl ? (
          <>
            <div className="flex items-center gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={handleCopy} aria-label="Copiar URL">
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-caption text-muted-foreground">
              Envie POST com JSON: <code>{'{"name":"...","phone":"...","email":"..."}'}</code>.
              Aceita também <code>source</code> (meta_ads, google_ads, rd_station, hotmart, site,
              indicacao), <code>utm_*</code> e <code>custom_fields</code>.
            </p>
          </>
        ) : (
          <p className="text-caption text-muted-foreground">
            Token ainda não foi gerado. Recarregue a página.
          </p>
        )}

        {canRegenerate && webhookUrl && (
          <div className="border-border flex items-start justify-between gap-3 border-t pt-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-warning mt-0.5 size-4 shrink-0" />
              <div className="text-caption text-muted-foreground">
                <strong className="text-foreground">Regenerar invalida a URL atual.</strong>{' '}
                Integrações existentes precisam ser atualizadas com a nova URL.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={regenerating}
            >
              Regenerar token
            </Button>
          </div>
        )}

        {events.length > 0 && (
          <div className="border-border border-t pt-3">
            <p className="text-body text-foreground mb-2 font-medium">Últimos eventos</p>
            <div className="border-border max-h-64 overflow-auto rounded-md border">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/40 text-caption text-muted-foreground border-border border-b">
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Quando</th>
                    <th className="px-3 py-2 font-medium">Origem</th>
                    <th className="px-3 py-2 font-medium">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} className="border-border text-caption border-b last:border-0">
                      <td className="px-3 py-1.5">
                        {ev.error ? (
                          <span className="text-destructive inline-flex items-center gap-1">
                            <AlertCircle className="size-3" />
                            Erro
                          </span>
                        ) : ev.processedAt ? (
                          <span className="text-success inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            OK
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Pendente</span>
                        )}
                      </td>
                      <td className="text-muted-foreground px-3 py-1.5">
                        {format(new Date(ev.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                      </td>
                      <td className="text-foreground px-3 py-1.5">{ev.source}</td>
                      <td className="text-muted-foreground truncate px-3 py-1.5">
                        {ev.error ?? ev.externalId.slice(0, 16) + '…'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerar token do webhook?</DialogTitle>
            <DialogDescription>
              A URL atual deixará de funcionar imediatamente. Integrações que dependem dela (Zapier,
              Make, N8N…) precisarão ser atualizadas com a nova URL antes de receber leads
              novamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={regenerating}>
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? 'Regenerando…' : 'Regenerar agora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
