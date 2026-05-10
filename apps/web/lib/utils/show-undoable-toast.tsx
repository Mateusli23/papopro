'use client';

import * as React from 'react';

import toast from 'react-hot-toast';

/**
 * Toast com botão "Desfazer" inline.
 *
 * Extraído de `features/inbox/components/lead-ficha-quick-actions.tsx` em
 * M5#5 quando ganhou um segundo consumer (versionamento de agentes IA —
 * "Versão v3 restaurada · Desfazer"). O padrão original veio do code review
 * de M5#4c que pediu pra deduplicar os 3 handlers.
 *
 * Cada toast captura seu `undo` por closure — toasts concorrentes preservam
 * o estado anterior independentemente.
 *
 * **Retorna** o ID do toast pra que o caller possa fazer `toast.dismiss(id)`
 * em cleanup (ex: ao desmontar o componente que emitiu o toast — review HIGH
 * M5#5: undo perdido em closure pós-navegação não pode mais afetar agentes
 * que já saíram da tela).
 *
 * Em M9/M11 quando essas ações virarem Server Actions, este helper continua
 * útil — só troca o callback síncrono por um async com optimistic update +
 * revert no erro. A UI permanece igual.
 */
export function showUndoableToast(message: React.ReactNode, undo: () => void): string {
  return toast.success(
    (t) => (
      <span className="flex items-center gap-3">
        {message}
        <button
          type="button"
          onClick={() => {
            undo();
            toast.dismiss(t.id);
          }}
          className="text-primary text-caption font-semibold hover:underline"
        >
          Desfazer
        </button>
      </span>
    ),
    { duration: 5000 },
  );
}
