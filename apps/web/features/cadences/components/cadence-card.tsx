'use client';

import * as React from 'react';

import Link from 'next/link';

import { Badge, Card, cn } from '@papopro/ui';
import {
  Briefcase,
  Gem,
  Home,
  Layers,
  Mail,
  MessageCircle,
  Pause,
  Repeat,
  SquarePen,
  TrendingUp,
  Users as UsersIcon,
  type LucideIcon,
} from '@papopro/ui/icons';

import type { Cadence, CadenceTemplateKey } from '../types';

import { CadenceStatusToggle } from './cadence-status-toggle';

/**
 * Card de cadência exibido na lista agrupada por etapa.
 *
 * Click no card navega pra `/cadences/[id]` (editor). O Switch de status
 * stoppa propagação pra não disparar a navegação.
 *
 * Métricas inline mostram só os 2 KPIs principais (ativos + taxa resposta).
 * A vista completa de métricas vive na página do editor.
 *
 * Na cadência paused, aplicamos opacity sutil pra reforçar o estado sem
 * esconder informação.
 */

const TEMPLATE_ICON: Record<CadenceTemplateKey, LucideIcon> = {
  imobiliario: Home,
  b2b: Briefcase,
  'alto-ticket': Gem,
  blank: SquarePen,
};

const TEMPLATE_LABEL: Record<CadenceTemplateKey, string> = {
  imobiliario: 'Imobiliário',
  b2b: 'B2B',
  'alto-ticket': 'Alto Ticket',
  blank: 'Personalizada',
};

interface CadenceCardProps {
  cadence: Cadence;
}

export function CadenceCard({ cadence }: CadenceCardProps) {
  const channels = summarizeChannels(cadence);
  const isPaused = cadence.status === 'paused';
  const TemplateIcon = cadence.templateKey ? TEMPLATE_ICON[cadence.templateKey] : Repeat;
  const templateLabel = cadence.templateKey ? TEMPLATE_LABEL[cadence.templateKey] : 'Personalizada';

  return (
    <Card
      className={cn(
        'group relative cursor-pointer overflow-hidden transition',
        'hover:border-primary/40 hover:shadow-sm',
        isPaused && 'opacity-70',
      )}
    >
      <Link
        href={`/cadences/${cadence.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Abrir cadência ${cadence.name}`}
      />

      <div className="relative z-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg border',
              isPaused
                ? 'border-border bg-muted text-muted-foreground'
                : 'border-primary/20 bg-primary/10 text-primary',
            )}
          >
            <TemplateIcon className="size-5" />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body text-foreground font-semibold">{cadence.name}</span>
              <Badge variant="outline" className="text-caption gap-1 px-1.5 py-0">
                {templateLabel}
              </Badge>
              {isPaused && (
                <Badge
                  variant="secondary"
                  className="text-caption text-muted-foreground gap-1 px-1.5 py-0"
                >
                  <Pause className="size-3" /> Pausada
                </Badge>
              )}
            </div>
            {cadence.description && (
              <span className="text-caption text-muted-foreground line-clamp-1">
                {cadence.description}
              </span>
            )}
            <div className="text-caption text-muted-foreground/80 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="inline-flex items-center gap-1">
                <Layers className="size-3" />
                {cadence.steps.length} {cadence.steps.length === 1 ? 'passo' : 'passos'}
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">{channels}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <UsersIcon className="size-3" />
                {cadence.metrics.activeEnrollments} ativos
              </span>
              {cadence.metrics.totalDispatched > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <TrendingUp className="size-3" />
                    {formatRate(cadence.metrics.responseRate)} resposta
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-20 flex shrink-0 items-center gap-3 sm:self-center">
          <CadenceStatusToggle cadence={cadence} />
        </div>
      </div>
    </Card>
  );
}

function summarizeChannels(cadence: Cadence): React.ReactNode {
  if (cadence.steps.length === 0) {
    return <span className="text-muted-foreground/60">sem passos</span>;
  }
  const set = new Set(cadence.steps.map((s) => s.channel));
  if (set.size === 2) {
    return (
      <>
        <MessageCircle className="size-3" />
        <Mail className="-ml-2 size-3" />
        <span>WhatsApp + Email</span>
      </>
    );
  }
  if (set.has('whatsapp')) {
    return (
      <>
        <MessageCircle className="size-3" />
        <span>WhatsApp</span>
      </>
    );
  }
  return (
    <>
      <Mail className="size-3" />
      <span>Email</span>
    </>
  );
}

function formatRate(rate: number): string {
  if (rate === 0) return '—';
  return `${Math.round(rate * 100)}%`;
}
