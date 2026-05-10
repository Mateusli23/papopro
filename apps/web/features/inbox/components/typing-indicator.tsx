'use client';

import * as React from 'react';

/**
 * Indicador "está digitando..." — bolha cinza com 3 dots animados.
 *
 * Em M5#4a o ciclo é simulado em **uma conversa específica** (`conv_001`,
 * Mariana) pelo hook `useSimulatedTyping`: liga 4s, desliga 26s, repete.
 * Em M9 vira evento Realtime `presence` do Supabase — quando o webhook
 * da uazapi/Cloud API reporta `typing` do lead, dispara o componente.
 *
 * Hidratação: o estado inicial é sempre `false` no servidor; o `useEffect`
 * inicia o ciclo só no cliente, evitando hydration mismatch.
 */

interface TypingIndicatorProps {
  /** Nome do contato pra mostrar no rótulo. */
  name: string;
}

export function TypingIndicator({ name }: TypingIndicatorProps) {
  return (
    <div className="flex w-full">
      <div
        className="bg-muted text-muted-foreground flex items-center gap-2 rounded-lg rounded-bl-none px-3 py-2 shadow-sm"
        role="status"
        aria-live="polite"
        aria-label={`${name} está digitando`}
      >
        <span className="flex gap-1">
          <Dot />
          <Dot delay="0.15s" />
          <Dot delay="0.3s" />
        </span>
        <span className="text-caption">{name} está digitando…</span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay?: string }) {
  return (
    <span
      aria-hidden
      className="bg-muted-foreground inline-block size-1.5 animate-bounce rounded-full"
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}

/**
 * Hook que simula o cliente "digitando" em ciclo periódico.
 *
 * Estratégia (decidida com o usuário): só ativa em `conversationId === activeId`.
 * Padrão mostrado: 4s ON / 26s OFF, totalizando 30s. Em conversas que não
 * são a alvo, retorna sempre `false`.
 *
 * Cleanup: cancela `setTimeout`s ao desmontar/trocar conversa.
 */
export function useSimulatedTyping(
  conversationId: string | undefined,
  activeId = 'conv_001',
): boolean {
  const [typing, setTyping] = React.useState(false);

  React.useEffect(() => {
    if (conversationId !== activeId) {
      setTyping(false);
      return;
    }

    let onTimer: ReturnType<typeof setTimeout> | undefined;
    let offTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    function cycleOn() {
      if (cancelled) return;
      setTyping(true);
      offTimer = setTimeout(cycleOff, 4000); // typing visible 4s
    }
    function cycleOff() {
      if (cancelled) return;
      setTyping(false);
      onTimer = setTimeout(cycleOn, 26000); // wait 26s before next cycle
    }

    // Começa primeiro ciclo após 8s — dá tempo do usuário ver a thread sem ruído
    onTimer = setTimeout(cycleOn, 8000);

    return () => {
      cancelled = true;
      if (onTimer) clearTimeout(onTimer);
      if (offTimer) clearTimeout(offTimer);
    };
  }, [conversationId, activeId]);

  return typing;
}
