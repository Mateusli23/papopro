'use client';

/**
 * Hook que faz polling do `getConnectionStatusAction` enquanto a sessão
 * estiver em `connecting`. Para quando:
 *  - status muda pra `connected` ou `disconnected` (provedor respondeu)
 *  - excede 60s sem transição (QR expirou)
 *  - componente desmonta
 *
 * Retorna `{ connection, isPolling, timedOut }`. Caller usa pra renderizar
 * spinner, mostrar mensagem "QR expirou — gere outro" e dar refresh manual.
 *
 * **2s entre polls** é o intervalo mínimo razoável — uazapi geralmente
 * confirma o pareamento em 3-5s após o scan. 60s é o TTL típico do QR.
 *
 * **Não usa Realtime no M9#2** (decisão fechada do plano) — polling cobre o
 * caso de uso com menor complexidade. M9#5 (Edge Function + Realtime) entra
 * pra heartbeat contínuo pós-conexão.
 */
import * as React from 'react';

import { getConnectionStatusAction } from '@/features/connections/actions';
import type { ConnectionUI } from '@/features/connections/types';

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 60_000;

export interface UseQrPollingResult {
  connection: ConnectionUI;
  isPolling: boolean;
  timedOut: boolean;
}

export function useQrPolling(
  initialConnection: ConnectionUI,
  options?: { onConnected?: (c: ConnectionUI) => void },
): UseQrPollingResult {
  const [connection, setConnection] = React.useState<ConnectionUI>(initialConnection);
  const [timedOut, setTimedOut] = React.useState(false);
  const onConnectedRef = React.useRef(options?.onConnected);

  React.useEffect(() => {
    onConnectedRef.current = options?.onConnected;
  }, [options?.onConnected]);

  // Atualiza estado se a prop inicial mudar (ex: refresh manual gerando novo QR).
  React.useEffect(() => {
    setConnection(initialConnection);
    setTimedOut(false);
  }, [initialConnection]);

  const isPolling = connection.status === 'connecting' && !timedOut;

  React.useEffect(() => {
    if (!isPolling) return;

    let cancelled = false;
    const startedAt = Date.now();

    const timer = setInterval(async () => {
      if (cancelled) return;

      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }

      const result = await getConnectionStatusAction();
      if (cancelled) return;

      if (result.ok) {
        setConnection(result.connection);
        if (result.connection.status === 'connected') {
          onConnectedRef.current?.(result.connection);
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isPolling]);

  return { connection, isPolling, timedOut };
}
