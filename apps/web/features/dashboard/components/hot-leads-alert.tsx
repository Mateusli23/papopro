'use client';

import * as React from 'react';

import Link from 'next/link';

import { cn } from '@papopro/ui';
import { ArrowRight, Flame } from '@papopro/ui/icons';

import { getHotLeads } from '@/features/dashboard/transforms';
import { useLeads } from '@/features/leads/store';

/**
 * Banner full-width no rodapé do dashboard alertando para leads quentes
 * que precisam de atenção. Espelha o padrão da imagem de referência:
 * fundo amarelo suave (`warning/10`), ícone Flame, texto + CTA explícito.
 *
 * - **Esconde quando count === 0** — não polui rodapé sem necessidade.
 * - **Linkado pra `/leads?temperature=hot`** — drill-down direto. Em M5
 *   o filtro existe na lista de leads (M2#5).
 * - **Animação sutil** no ícone (`animate-pulse`) reforça urgência sem
 *   ser distração — desabilitada via `prefers-reduced-motion`.
 *
 * Em M11 quando `useLeads()` virar TanStack Query, o componente continua
 * idêntico — só muda a fonte.
 */
export function HotLeadsAlert() {
  const leads = useLeads();
  const hot = React.useMemo(() => getHotLeads(leads), [leads]);

  if (hot.length === 0) return null;

  const count = hot.length;
  const message =
    count === 1
      ? '1 lead quente aguardando — clique para ver detalhes'
      : `${count} leads quentes aguardando — clique para ver detalhes`;

  return (
    <Link
      href="/leads?temperature=hot"
      className={cn(
        'bg-warning/10 border-warning/30 text-warning group',
        'flex items-center gap-3 rounded-lg border px-4 py-3',
        'hover:bg-warning/15 focus-visible:bg-warning/15 transition-colors',
        'focus-visible:ring-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      )}
    >
      <span
        className="bg-warning/20 inline-flex size-9 shrink-0 items-center justify-center rounded-full motion-safe:animate-pulse"
        aria-hidden
      >
        <Flame className="size-5" />
      </span>
      <div className="flex flex-1 flex-col">
        <span className="text-body text-foreground font-semibold">{message}</span>
        <span className="text-caption text-muted-foreground">
          Esses leads tiveram engajamento alto recentemente — fale com eles antes que esfriem.
        </span>
      </div>
      <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
