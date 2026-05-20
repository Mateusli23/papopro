'use client';

import * as React from 'react';

import toast from 'react-hot-toast';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@papopro/ui';
import { CheckCircle2, Download, Smartphone } from '@papopro/ui/icons';

import { useInstallPrompt } from '@/components/pwa/pwa-provider';
import {
  detectPlatform,
  getInstallInstructions,
  isStandalone,
  type Platform,
} from '@/lib/pwa/platform';

/**
 * `/settings/app` (M13#1) — tela "Instalar app".
 *
 * Três estados:
 *  - Já instalado (`appinstalled` ou display-mode standalone) → card de sucesso.
 *  - Prompt nativo disponível (Chrome/Edge/Android) → botão "Instalar".
 *  - Sem prompt (iOS sempre; outros sem suporte) → instruções manuais.
 *
 * Detecção de plataforma roda em `useEffect` (precisa de `navigator`) — o
 * primeiro render é igual no servidor e no cliente (sem mismatch de hidratação).
 */
const BENEFITS = [
  'Abre direto da tela inicial, como qualquer app.',
  'Tela cheia, sem a barra do navegador — mais espaço pro Kanban e pra caixa de WhatsApp.',
  'Carrega mais rápido nas próximas aberturas.',
  'Base pra receber notificações de leads e cadências no aparelho.',
];

export function InstallView() {
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const [platform, setPlatform] = React.useState<Platform | null>(null);
  const [standalone, setStandalone] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
    setStandalone(isStandalone());
  }, []);

  const alreadyInstalled = installed || standalone;
  const instructions = platform ? getInstallInstructions(platform) : null;

  async function handleInstall() {
    if (pending) return;
    setPending(true);
    try {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        toast.success('PapoPro instalado! Procure o ícone na sua tela inicial.');
      } else if (outcome === 'dismissed') {
        toast('Instalação cancelada — você pode instalar quando quiser.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Instalar app"
        description="Use o PapoPro como aplicativo, em tela cheia, no celular ou no computador."
      />

      {alreadyInstalled ? (
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="text-body text-foreground font-medium">PapoPro instalado</p>
              <p className="text-body text-muted-foreground">
                Você já está usando o PapoPro como aplicativo. Abra pelo ícone na tela inicial pra
                ter a experiência em tela cheia.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {canInstall && (
            <Card>
              <CardHeader>
                <CardTitle className="text-title flex items-center gap-2">
                  <Download className="text-primary size-5" />
                  Instalar agora
                </CardTitle>
                <CardDescription>
                  Seu navegador suporta instalação com um clique. O PapoPro passa a abrir numa
                  janela própria, sem a barra de endereço.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleInstall} disabled={pending} className="gap-2">
                  <Download className="size-4" />
                  {pending ? 'Abrindo...' : 'Instalar PapoPro'}
                </Button>
              </CardContent>
            </Card>
          )}

          {instructions && (
            <Card>
              <CardHeader>
                <CardTitle className="text-title flex items-center gap-2">
                  <Smartphone className="text-muted-foreground size-5" />
                  {instructions.title}
                </CardTitle>
                <CardDescription>
                  {canInstall
                    ? 'Prefere instalar manualmente? Siga os passos abaixo.'
                    : 'Seu navegador não tem instalação com um clique — siga os passos abaixo.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-3">
                  {instructions.steps.map((step, i) => (
                    <li key={step} className="flex items-start gap-3">
                      <span className="bg-primary/10 text-primary text-caption flex size-6 shrink-0 items-center justify-center rounded-full font-semibold">
                        {i + 1}
                      </span>
                      <span className="text-body text-foreground pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-title">Por que instalar</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {BENEFITS.map((benefit) => (
                  <li
                    key={benefit}
                    className="text-body text-muted-foreground flex items-start gap-2"
                  >
                    <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
