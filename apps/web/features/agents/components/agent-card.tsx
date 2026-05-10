'use client';

import * as React from 'react';

import Link from 'next/link';

import { Card, cn } from '@papopro/ui';
import { MessageCircle, TrendingUp } from '@papopro/ui/icons';

import type { Agent } from '../types';

import { AgentStatusBadge } from './agent-status-badge';
import { AgentStatusToggle } from './agent-status-toggle';

/**
 * Card de agente exibido na lista da aba "Agentes".
 *
 * Click no card navega pra `/agents/[id]` (editor). O Switch de status
 * stoppa propagação pra não disparar a navegação.
 *
 * Métricas inline mostram só os 2 KPIs principais (conversas + taxa de
 * resolução). A vista completa de métricas vive na página do editor.
 *
 * Em paused/testing, opacity sutil reforça o estado sem esconder informação
 * — lição visual de cadences.
 */

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const dimmed = agent.status !== 'active';

  return (
    <Card
      className={cn(
        'group relative cursor-pointer overflow-hidden transition',
        'hover:border-primary/40 hover:shadow-sm',
        dimmed && 'opacity-85',
      )}
    >
      <Link
        href={`/agents/${agent.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Abrir agente ${agent.name}`}
      />

      <div className="relative z-10 flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full border text-xl',
                agent.status === 'active'
                  ? 'border-primary/30 bg-primary/10'
                  : 'border-border bg-muted',
              )}
              aria-hidden
            >
              {agent.avatarEmoji ?? '🤖'}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body text-foreground font-semibold">{agent.name}</span>
                <AgentStatusBadge status={agent.status} />
              </div>
              <span className="text-caption text-muted-foreground line-clamp-2">
                {agent.persona || (
                  <em className="text-muted-foreground/60">Sem persona definida</em>
                )}
              </span>
            </div>
          </div>

          <div className="relative z-20 flex shrink-0 items-center gap-3">
            <AgentStatusToggle agent={agent} />
          </div>
        </div>

        <div className="text-caption text-muted-foreground/80 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-14">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <MessageCircle className="size-3" />
            {agent.metrics.totalConversations}{' '}
            {agent.metrics.totalConversations === 1 ? 'conversa' : 'conversas'}
          </span>
          {agent.metrics.totalConversations > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <TrendingUp className="size-3" />
                {formatRate(agent.metrics.resolutionRate)} resolução
              </span>
            </>
          )}
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            {/*
             * Mostra a versão **atual** (currentVersionId), não a mais
             * recente — review MEDIUM M5#5. Após restaurar v1 num agente
             * com 3 versões, o card deve dizer v1 (em produção), não v3
             * (a mais recente do array).
             */}
            v{agent.versions.find((v) => v.id === agent.currentVersionId)?.versionNumber ?? 1}
          </span>
        </div>
      </div>
    </Card>
  );
}

function formatRate(rate: number): string {
  if (rate === 0) return '—';
  return `${Math.round(rate * 100)}%`;
}
