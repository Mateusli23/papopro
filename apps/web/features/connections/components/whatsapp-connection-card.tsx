'use client';

import * as React from 'react';

import Image from 'next/image';

import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@papopro/ui';
import { Loader2, RotateCcw, Smartphone, Wifi, WifiOff } from '@papopro/ui/icons';

import { connectInstanceAction, disconnectInstanceAction } from '@/features/connections/actions';
import { useQrPolling } from '@/features/connections/hooks/use-qr-polling';
import type { ConnectionUI } from '@/features/connections/types';

/**
 * Card de `/settings/connections` (refatorado M9#2 — server-fed).
 *
 * Renderiza o estado da conexão WhatsApp (uazapi) lido via
 * `getWorkspaceConnection` no Server Component pai. Três fluxos:
 *
 *  - **Disconnected:** botão "Conectar WhatsApp" abre o dialog de QR.
 *  - **Connecting:** dialog mostra QR base64 da uazapi. Hook `useQrPolling`
 *    consulta `getConnectionStatusAction` a cada 2s até `connected` ou
 *    timeout 60s. Quando conecta, fecha modal + toast.
 *  - **Connected:** mostra avatar + número + tempo conectado. Botão
 *    Desconectar abre confirm destrutivo (pausa cadências em M10).
 *
 * **RBAC client-side:** prop `canConnect` controla se botão aparece. Server
 * Actions têm gate próprio (Owner/Admin) — defense-in-depth.
 *
 * **Cleanup do dialog:** se vendedor fecha o modal antes do pareamento,
 * o polling continua via prop `initial` da página (revalidatePath sincroniza).
 * Nova abertura via "Conectar" gera QR novo se o anterior expirou.
 */
export interface WhatsAppConnectionCardProps {
  initial: ConnectionUI;
  canConnect: boolean;
}

export function WhatsAppConnectionCard({ initial, canConnect }: WhatsAppConnectionCardProps) {
  const [optimisticConnection, setOptimisticConnection] = React.useState<ConnectionUI>(initial);
  const [qrDialogOpen, setQrDialogOpen] = React.useState(false);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Sincroniza com prop quando o Server Component re-renderiza após revalidate.
  React.useEffect(() => {
    setOptimisticConnection(initial);
  }, [initial]);

  const { connection, isPolling, timedOut } = useQrPolling(optimisticConnection, {
    onConnected: (next) => {
      setOptimisticConnection(next);
      setQrDialogOpen(false);
      toast.success(
        next.phoneNumber ? `WhatsApp conectado (${next.phoneNumber})` : 'WhatsApp conectado',
      );
    },
  });

  const isConnected = connection.status === 'connected';
  const isConnecting = connection.status === 'connecting';
  const isDisconnected = connection.status === 'disconnected';

  function handleConnect() {
    startTransition(async () => {
      const result = await connectInstanceAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOptimisticConnection(result.connection);
      setQrDialogOpen(true);
    });
  }

  function handleRefreshQr() {
    handleConnect();
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectInstanceAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOptimisticConnection(result.connection);
      setDisconnectConfirmOpen(false);
      toast('Número desconectado — gere novo QR para reconectar.');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="text-primary size-5" />
          WhatsApp
          {isConnected && <Badge variant="success">Conectado</Badge>}
          {isConnecting && <Badge variant="info">Conectando…</Badge>}
          {isDisconnected && <Badge variant="destructive">Desconectado</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Lado esquerdo: perfil conectado ou placeholder com CTA */}
        <div className="border-border bg-muted/20 flex flex-col items-center gap-3 rounded-md border p-4">
          {isConnected ? (
            <>
              <Avatar className="size-20">
                <AvatarFallback>
                  {(connection.displayName ?? connection.phoneNumber ?? 'WA')
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <div className="text-body text-foreground font-medium">
                  {connection.displayName ?? 'WhatsApp'}
                </div>
                <div className="text-caption text-muted-foreground tabular-nums">
                  {connection.phoneNumber ?? ''}
                </div>
              </div>
              {connection.connectedAt && (
                <div className="text-caption text-muted-foreground">
                  Conectado{' '}
                  {formatDistanceToNow(new Date(connection.connectedAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="bg-muted text-muted-foreground flex size-32 items-center justify-center rounded-md">
                <Smartphone className="size-12" />
              </div>
              <p className="text-caption text-muted-foreground text-center">
                {canConnect
                  ? 'Conecte o WhatsApp pra começar a receber mensagens dos seus leads.'
                  : 'Conexão gerenciada pelo Owner/Admin do workspace.'}
              </p>
            </>
          )}
        </div>

        {/* Lado direito: métricas + ações */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric
              label="Mensagens 24h"
              value={connection.messagesSent24h.toLocaleString('pt-BR')}
            />
            <Metric label="Saúde" value={healthLabel(connection.health)} />
            <Metric
              label="Último heartbeat"
              value={
                connection.lastSeenAt
                  ? format(new Date(connection.lastSeenAt), 'HH:mm:ss', { locale: ptBR })
                  : '—'
              }
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {isConnected && canConnect && (
              <Button
                variant="outline"
                onClick={() => setDisconnectConfirmOpen(true)}
                disabled={isPending}
                className="text-destructive hover:bg-destructive/5"
              >
                <WifiOff /> Desconectar
              </Button>
            )}
            {!isConnected && canConnect && (
              <Button onClick={handleConnect} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" /> Gerando QR…
                  </>
                ) : (
                  <>
                    <Wifi /> {isConnecting ? 'Continuar conexão' : 'Conectar WhatsApp'}
                  </>
                )}
              </Button>
            )}
            <span className="text-caption text-muted-foreground">
              Heartbeat automático e pausa em queda chegam no M9 polimento.
            </span>
          </div>
        </div>
      </CardContent>

      {/* Dialog do QR — visível enquanto status='connecting' */}
      <Dialog
        open={qrDialogOpen && isConnecting}
        onOpenChange={(open) => {
          if (!open) setQrDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho. Escaneie o
              QR Code abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-4">
            {connection.qrBase64 ? (
              <Image
                src={`data:image/png;base64,${connection.qrBase64}`}
                alt="QR Code WhatsApp"
                width={220}
                height={220}
                unoptimized
                className="border-border rounded-md border"
              />
            ) : (
              <div className="border-border bg-muted flex size-[220px] items-center justify-center rounded-md border">
                <Loader2 className="text-muted-foreground size-8 animate-spin" />
              </div>
            )}

            {timedOut ? (
              <p className="text-caption text-destructive text-center">
                QR Code expirou — gere outro pra continuar.
              </p>
            ) : isPolling ? (
              <p className="text-caption text-muted-foreground text-center">
                <Loader2 className="mr-1 inline size-3 animate-spin" />
                Aguardando confirmação do celular…
              </p>
            ) : null}
          </div>

          <DialogFooter>
            {timedOut && (
              <Button onClick={handleRefreshQr} disabled={isPending}>
                <RotateCcw /> Gerar novo QR
              </Button>
            )}
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm de desconexão */}
      <Dialog open={disconnectConfirmOpen} onOpenChange={setDisconnectConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar WhatsApp</DialogTitle>
            <DialogDescription>
              Você não vai receber mensagens novas até reconectar. Mensagens enviadas durante a
              queda chegam quando o número voltar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={isPending}>
              Desconectar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-muted/30 flex flex-col gap-0.5 rounded-md border px-3 py-2">
      <span className="text-caption text-muted-foreground uppercase">{label}</span>
      <span className="text-body text-foreground font-medium tabular-nums">{value}</span>
    </div>
  );
}

function healthLabel(health: ConnectionUI['health']): string {
  switch (health) {
    case 'healthy':
      return 'Verde';
    case 'degraded':
      return 'Amarelo';
    case 'unhealthy':
      return 'Vermelho';
  }
}
