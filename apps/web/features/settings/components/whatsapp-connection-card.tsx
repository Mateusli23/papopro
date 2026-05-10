'use client';

import * as React from 'react';

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
import { Loader2, Smartphone, Wifi, WifiOff } from '@papopro/ui/icons';

import {
  connectWhatsApp,
  disconnectWhatsApp,
  setConnectingState,
  useWhatsAppConnection,
} from '../store';

import { HealthScoreBar } from './health-score-bar';
import { QrCodeMock } from './qr-code-mock';

/**
 * Card principal de `/settings/connections`. Em desktop renderiza 2 colunas
 * (QR + métricas); em mobile empilha. Status `connecting` mostra spinner
 * + mensagem "Aguardando confirmação do WhatsApp…".
 *
 * Reconectar mock: muda pra `connecting`, espera 2s, vira `connected`.
 * Desconectar abre Dialog destrutivo antes.
 */
export function WhatsAppConnectionCard() {
  const conn = useWhatsAppConnection();
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const [qrSeed, setQrSeed] = React.useState('papopro-initial');
  const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup do timeout no unmount evita race entre Reconectar → navegar pra
  // outra rota / desconectar manualmente antes dos 2s mock (review HIGH M5#6).
  React.useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, []);

  const isConnected = conn.status === 'connected';
  const isConnecting = conn.status === 'connecting';

  function handleReconnect() {
    setConnectingState();
    setQrSeed(`papopro-${Date.now()}`);
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      connectWhatsApp();
      toast.success('Número reconectado');
    }, 2000);
  }

  function handleDisconnect() {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    disconnectWhatsApp();
    setConfirmDisconnect(false);
    toast('Número desconectado — escaneie o QR Code novamente para voltar.');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="text-primary size-5" />
          WhatsApp
          {isConnected && <Badge variant="success">Conectado</Badge>}
          {isConnecting && <Badge variant="info">Conectando…</Badge>}
          {conn.status === 'disconnected' && <Badge variant="destructive">Desconectado</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Lado esquerdo: QR ou perfil conectado */}
        <div className="border-border bg-muted/20 flex flex-col items-center gap-3 rounded-md border p-4">
          {isConnected ? (
            <>
              <Avatar className="size-20">
                <AvatarFallback>
                  {(conn.displayName ?? 'WA').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <div className="text-body text-foreground font-medium">{conn.displayName}</div>
                <div className="text-caption text-muted-foreground tabular-nums">
                  {conn.phoneNumber}
                </div>
              </div>
              {conn.connectedAt && (
                <div className="text-caption text-muted-foreground">
                  Conectado{' '}
                  {formatDistanceToNow(new Date(conn.connectedAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <QrCodeMock seed={qrSeed} size={180} />
              <p className="text-caption text-muted-foreground text-center">
                {isConnecting
                  ? 'Aguardando confirmação do WhatsApp…'
                  : 'Abra o WhatsApp no celular → Aparelhos conectados → Conectar'}
              </p>
              {isConnecting && <Loader2 className="text-primary size-5 animate-spin" />}
            </>
          )}
        </div>

        {/* Lado direito: health + métricas + ações */}
        <div className="flex flex-col gap-4">
          <HealthScoreBar health={conn.health} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Mensagens 24h" value={conn.messagesLast24h.toLocaleString('pt-BR')} />
            <Metric label="Taxa de entrega" value={`${(conn.deliveryRate * 100).toFixed(1)}%`} />
            <Metric
              label="Último heartbeat"
              value={
                conn.lastHeartbeatAt
                  ? format(new Date(conn.lastHeartbeatAt), 'HH:mm:ss', { locale: ptBR })
                  : '—'
              }
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {isConnected ? (
              <Button
                variant="outline"
                onClick={() => setConfirmDisconnect(true)}
                className="text-destructive hover:bg-destructive/5"
              >
                <WifiOff /> Desconectar
              </Button>
            ) : (
              <Button onClick={handleReconnect} disabled={isConnecting}>
                <Wifi /> {isConnecting ? 'Conectando…' : 'Reconectar'}
              </Button>
            )}
            <span className="text-caption text-muted-foreground">
              Em M9 o QR Code chega ao vivo da uazapi e o status atualiza via Realtime.
            </span>
          </div>
        </div>
      </CardContent>

      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar WhatsApp</DialogTitle>
            <DialogDescription>
              Cadências em fila ficam pausadas até você reconectar. Mensagens recebidas durante a
              queda chegam quando o número voltar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisconnect(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDisconnect}>
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
