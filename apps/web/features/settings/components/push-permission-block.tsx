'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@papopro/ui';
import { Bell } from '@papopro/ui/icons';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

/**
 * Bloco do topo da tela de Notificações: status do `Notification.permission`
 * + botão de testar push. Em M5 o "teste" é toast local; em M13 dispara push
 * real via service worker (`apps/web/public/sw.js`).
 *
 * Lê `Notification.permission` apenas após mount pra evitar warning de
 * hydration mismatch (browser-only).
 */
export function PushPermissionBlock() {
  const [perm, setPerm] = React.useState<PermissionState>('default');

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPerm('unsupported');
      return;
    }
    setPerm(Notification.permission as PermissionState);
  }, []);

  function handleTest() {
    if (perm === 'unsupported') {
      toast.error('Seu navegador não suporta notificações push');
      return;
    }
    if (perm === 'denied') {
      toast.error('Push bloqueado nas permissões do navegador. Reabilite e tente de novo.');
      return;
    }
    if (perm === 'default') {
      Notification.requestPermission().then((next) => {
        setPerm(next as PermissionState);
        if (next === 'granted') {
          toast.success('Push autorizado — em M13 chega notificação real aqui');
        }
      });
      return;
    }
    toast.success('Push de teste enviado (mock — vira real em M13)');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="text-primary size-4" />
          Notificações push deste navegador
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <PermissionBadge state={perm} />
          <span className="text-body text-muted-foreground">
            {perm === 'granted' && 'Push autorizado pelo navegador.'}
            {perm === 'default' && 'Você ainda não autorizou push neste navegador.'}
            {perm === 'denied' && 'Push bloqueado — reabilite nas permissões do site.'}
            {perm === 'unsupported' && 'Seu navegador atual não suporta push.'}
          </span>
        </div>
        <Button onClick={handleTest} variant="outline" disabled={perm === 'unsupported'}>
          Enviar push de teste
        </Button>
      </CardContent>
    </Card>
  );
}

function PermissionBadge({ state }: { state: PermissionState }) {
  if (state === 'granted') return <Badge variant="success">Autorizado</Badge>;
  if (state === 'denied') return <Badge variant="destructive">Bloqueado</Badge>;
  if (state === 'unsupported') return <Badge variant="outline">Sem suporte</Badge>;
  return <Badge variant="warning">Pendente</Badge>;
}
