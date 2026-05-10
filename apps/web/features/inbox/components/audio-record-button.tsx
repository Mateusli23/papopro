'use client';

import * as React from 'react';

import { Button, cn } from '@papopro/ui';
import { Mic, Square, X } from '@papopro/ui/icons';

import { attachMedia } from '../store';

/**
 * Botão de gravação de áudio — **mock** em M5#4b. Decisão de escopo
 * registrada no commit do M5#4a: "Áudio: mock animado, sem MediaRecorder
 * real". Web Audio API real entra em M9 junto com o adapter uazapi.
 *
 * Comportamento mockado:
 *  - Estado `idle`: botão de mic. Clica → vira `recording`.
 *  - Estado `recording`: timer crescente (mm:ss), barra vermelha pulsante,
 *    botão Stop (Square) e botão Cancelar (X). Clicar Stop chama
 *    `attachMedia({ kind: 'audio', mediaDurationSeconds: tempo gravado })`.
 *  - Auto-stop em 60s (limite WhatsApp prático). Cancelar descarta sem
 *    enviar nada.
 *  - **Trocar de conversa mid-recording cancela a gravação** — protege
 *    contra áudio gravado em conversa A ser enviado pra conversa B
 *    (CRITICAL #2 do review M5#4b).
 *
 * Acessibilidade: `aria-pressed` no botão de mic indica estado; `role="timer"`
 * no display + `aria-live="polite"` faz screen readers anunciarem o tempo.
 * O region de gravação tem `aria-live="polite"` no anúncio de início.
 *
 * **Stale closure fix (CRITICAL #1 do review):** o tempo gravado fica em
 * `secondsRef`, não no state. `setSeconds` aciona re-render para atualizar
 * o display, mas o cálculo da duração e a verificação de auto-stop usam
 * o ref — eliminando off-by-one entre o que o vendedor vê (1:00) e o
 * `mediaDurationSeconds` enviado.
 *
 * Tamanho do arquivo mock: `mediaSizeKb: 0` — schema permite só pra `audio`.
 */

const MAX_RECORDING_SECONDS = 60;

interface AudioRecordButtonProps {
  conversationId: string;
  disabled?: boolean;
}

export function AudioRecordButton({ conversationId, disabled }: AudioRecordButtonProps) {
  const [state, setState] = React.useState<'idle' | 'recording'>('idle');
  // `seconds` é só pra render; a fonte da verdade é `secondsRef.current`.
  // Evita stale closure no callback do setInterval (que era recriado a cada
  // tick por `useCallback([seconds])`).
  const [seconds, setSeconds] = React.useState(0);
  const secondsRef = React.useRef(0);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  // Para a gravação. `send=true` envia, `send=false` descarta.
  // Não está em useCallback porque é só usado em handlers locais — sem
  // ganho de memo, e tirar das deps simplifica o efeito de cancelamento.
  function stopRecording(send: boolean) {
    clearTimer();
    const duration = secondsRef.current;
    secondsRef.current = 0;
    setSeconds(0);
    setState('idle');
    if (send && duration > 0) {
      attachMedia(conversationId, {
        kind: 'audio',
        mediaName: `audio-${Date.now()}.ogg`,
        mediaSizeKb: 0, // mock: gravação sem arquivo real
        mediaDurationSeconds: duration,
      });
    }
  }

  // Cleanup no unmount (vendedor sai da inbox enquanto gravava).
  React.useEffect(() => {
    return clearTimer;
  }, []);

  // Cancela gravação ao trocar de conversa. Sem isso, o áudio gravado
  // em conv_001 seria enviado pra conv_002 quando vendedor clicar Stop.
  // CRITICAL #2 do review M5#4b.
  const conversationIdRef = React.useRef(conversationId);
  React.useEffect(() => {
    if (conversationIdRef.current !== conversationId) {
      // Mudou: cancela gravação em andamento sem enviar.
      if (intervalRef.current) {
        clearTimer();
        secondsRef.current = 0;
        setSeconds(0);
        setState('idle');
      }
      conversationIdRef.current = conversationId;
    }
  }, [conversationId]);

  function startRecording() {
    setState('recording');
    secondsRef.current = 0;
    setSeconds(0);
    intervalRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= MAX_RECORDING_SECONDS) {
        stopRecording(true); // auto-stop ao bater no limite
      }
    }, 1000);
  }

  if (state === 'idle') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-9 shrink-0 p-0"
        aria-label="Gravar áudio"
        aria-pressed={false}
        onClick={startRecording}
        disabled={disabled}
      >
        <Mic className="size-4" />
      </Button>
    );
  }

  // Estado recording: substitui o ícone por painel inline com timer + ações.
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div
      className="bg-destructive/10 border-destructive/30 flex shrink-0 items-center gap-2 rounded-md border px-2 py-1"
      role="region"
      aria-label="Gravando áudio"
      aria-live="polite"
    >
      {/* Anúncio inicial pro screen reader — sem isso, usuário cego só
          recebe feedback no segundo "0:01" do timer. Fix do HIGH #5. */}
      <span className="sr-only">Gravação iniciada. Pressione Enviar quando terminar.</span>
      <span className={cn('bg-destructive size-2 animate-pulse rounded-full')} aria-hidden />
      <span
        className="text-caption text-destructive font-mono tabular-nums"
        role="timer"
        aria-live="polite"
      >
        {display}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive size-7 p-0"
        aria-label="Cancelar gravação"
        onClick={() => stopRecording(false)}
      >
        <X className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="size-7 p-0"
        aria-label="Enviar áudio gravado"
        onClick={() => stopRecording(true)}
      >
        <Square className="size-3" fill="currentColor" />
      </Button>
    </div>
  );
}
