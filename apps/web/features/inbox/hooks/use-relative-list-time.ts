'use client';

import * as React from 'react';

/**
 * Timestamp compacto pra item da lista de conversas — estilo WhatsApp:
 *  - Mesmo dia: "14:32"
 *  - Ontem: "Ontem"
 *  - Esta semana: "qua"
 *  - Mais antigo: "07/05"
 *
 * **Hydration-safe**: depende de `new Date()` (qual é o "agora" do
 * usuário?), que é não-determinístico entre SSR e CSR. Por isso retorna
 * `fallback` (`'—'` por padrão) na primeira render e popula via
 * `useEffect`. Mesmo padrão do `cadence-metrics-panel.tsx`.
 */
export function useRelativeListTime(iso: string, fallback = '—'): string {
  const [label, setLabel] = React.useState(fallback);

  React.useEffect(() => {
    setLabel(computeRelativeListTime(iso));
  }, [iso]);

  return label;
}

function computeRelativeListTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return 'Ontem';

  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7) {
    return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('-feira', '').slice(0, 3);
  }

  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
