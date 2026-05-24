'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@papopro/ui';
import { Bell } from '@papopro/ui/icons';

import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from '@/features/notifications/actions';
import {
  getCurrentPushSubscription,
  getNotificationPermission,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pwa/push';

/**
 * Bloco do topo da tela de Notificações (M13#2 — real).
 *
 * Em M5 o "push de teste" era um toast local. Agora:
 *  - **Ativar** → pede permissão, assina no `pushManager` e persiste a
 *    subscription via `savePushSubscriptionAction`.
 *  - **Desativar** → cancela a assinatura e apaga a linha no servidor.
 *  - **Push de teste** → `sendTestPushAction` dispara um Web Push real pra
 *    todos os dispositivos do usuário.
 *
 * Ao montar com uma subscription já ativa, re-sincroniza ela no servidor
 * (silencioso) — cobre o caso do `pushsubscriptionchange` ter rotacionado o
 * endpoint enquanto o app estava fechado.
 *
 * **Dev:** o service worker só é registrado em produção (decisão do M13#1),
 * então ativar push em `pnpm dev` falha com mensagem explicativa — esperado.
 */

type PushStatus = 'loading' | 'unsupported' | 'denied' | 'idle' | 'subscribed';

const ERROR_COPY: Record<string, string> = {
  unsupported: 'Seu navegador não suporta notificações push.',
  sw_not_registered: 'Instale o app (ou rode em produção) para ativar o push neste dispositivo.',
  permission_denied:
    'Notificações bloqueadas — reabilite nas permissões do navegador e tente de novo.',
  subscribe_failed: 'Não foi possível ativar o push agora. Tente de novo.',
};

export function PushPermissionBlock({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [status, setStatus] = React.useState<PushStatus>('loading');
  const [busy, setBusy] = React.useState(false);

  const configured = vapidPublicKey.length > 0;

  // Estado inicial — lido só após mount (browser-only, evita hydration mismatch).
  React.useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!isPushSupported()) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      if (getNotificationPermission() === 'denied') {
        if (!cancelled) setStatus('denied');
        return;
      }
      const existing = await getCurrentPushSubscription();
      if (cancelled) return;
      if (existing) {
        setStatus('subscribed');
        // Re-sincroniza silenciosamente (endpoint pode ter rotacionado).
        void savePushSubscriptionAction({
          endpoint: existing.endpoint,
          p256dh: existing.p256dh,
          auth: existing.auth,
          userAgent: navigator.userAgent,
        });
      } else {
        setStatus('idle');
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubscribe() {
    if (!configured) {
      toast.error('Push ainda não foi configurado no servidor.');
      return;
    }
    setBusy(true);
    try {
      const subscription = await subscribeToPush(vapidPublicKey);
      const result = await savePushSubscriptionAction({
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: navigator.userAgent,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatus('subscribed');
      toast.success('Push ativado neste dispositivo.');
    } catch (err) {
      const code = err instanceof Error ? err.message : 'subscribe_failed';
      if (code === 'permission_denied') setStatus('denied');
      toast.error(ERROR_COPY[code] ?? ERROR_COPY.subscribe_failed!);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnsubscribe() {
    setBusy(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await removePushSubscriptionAction(endpoint);
      setStatus('idle');
      toast.success('Push desativado neste dispositivo.');
    } catch {
      toast.error('Não foi possível desativar o push agora.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    try {
      const result = await sendTestPushAction();
      if (result.ok) toast.success('Push de teste enviado — confira a notificação.');
      else toast.error(result.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="text-primary size-4" />
          Notificações push deste dispositivo
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-body text-muted-foreground">
            {status === 'loading' && 'Verificando…'}
            {status === 'subscribed' && 'Este dispositivo recebe notificações push.'}
            {status === 'idle' && 'Ative para receber alertas mesmo com o app fechado.'}
            {status === 'denied' && 'Push bloqueado — reabilite nas permissões do navegador.'}
            {status === 'unsupported' && 'Seu navegador atual não suporta push.'}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          {status === 'subscribed' ? (
            <>
              <Button onClick={handleTest} variant="outline" disabled={busy}>
                Enviar teste
              </Button>
              <Button onClick={handleUnsubscribe} variant="ghost" disabled={busy}>
                Desativar
              </Button>
            </>
          ) : (
            <Button
              onClick={handleSubscribe}
              disabled={busy || status === 'loading' || status === 'unsupported' || !configured}
            >
              Ativar push
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: PushStatus }) {
  if (status === 'subscribed') return <Badge variant="success">Ativo</Badge>;
  if (status === 'denied') return <Badge variant="destructive">Bloqueado</Badge>;
  if (status === 'unsupported') return <Badge variant="outline">Sem suporte</Badge>;
  if (status === 'loading') return <Badge variant="outline">…</Badge>;
  return <Badge variant="warning">Inativo</Badge>;
}
