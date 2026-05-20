'use client';

import * as React from 'react';

/**
 * Infraestrutura de PWA do app (M13#1).
 *
 * `<PwaProvider>` monta no root layout e faz duas coisas:
 *  1. Registra o service worker (`/sw.js`) — **só em produção**; em dev o SW
 *     cacheia assets e atrapalha o hot-reload.
 *  2. Captura o evento `beforeinstallprompt` (Chrome/Edge/Android), que dispara
 *     cedo no load e é perdido se ninguém o segurar. Fica guardado no contexto
 *     pra a tela `/settings/app` poder disparar o prompt nativo on-demand.
 *
 * `useInstallPrompt` é o consumidor. Fora do provider degrada pra "não dá pra
 * instalar" em vez de lançar — PWA nunca pode quebrar o app.
 */

/** Shape do evento `beforeinstallprompt` (não tipado no lib.dom padrão). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

interface PwaContextValue {
  /** Há um prompt nativo de instalação disponível (Chrome/Edge/Android). */
  canInstall: boolean;
  /** O app já foi instalado nesta sessão (evento `appinstalled`). */
  installed: boolean;
  /** Dispara o prompt nativo. `unavailable` quando não há prompt (ex: iOS). */
  promptInstall: () => Promise<InstallOutcome>;
}

const PwaContext = React.createContext<PwaContextValue | null>(null);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);

  // Registro do service worker — só em produção.
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Falha de registro não pode derrubar o app — degrada sem PWA.
    });
  }, []);

  // Captura do `beforeinstallprompt` + `appinstalled`.
  React.useEffect(() => {
    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = React.useCallback(async (): Promise<InstallOutcome> => {
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const choice = await deferred.userChoice;
    // O evento só pode ser usado uma vez — descarta após o prompt.
    setDeferred(null);
    return choice.outcome;
  }, [deferred]);

  const value = React.useMemo<PwaContextValue>(
    () => ({ canInstall: deferred !== null, installed, promptInstall }),
    [deferred, installed, promptInstall],
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

/**
 * `useInstallPrompt` — estado de instalação do PWA. Fora do `<PwaProvider>`
 * retorna um estado inerte (não lança).
 */
export function useInstallPrompt(): PwaContextValue {
  const ctx = React.useContext(PwaContext);
  if (!ctx) {
    return {
      canInstall: false,
      installed: false,
      promptInstall: async () => 'unavailable',
    };
  }
  return ctx;
}
