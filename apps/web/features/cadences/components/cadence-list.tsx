'use client';

import * as React from 'react';

import { Badge, Button, EmptyState } from '@papopro/ui';
import { PlusCircle, Repeat } from '@papopro/ui/icons';

import type { Cadence } from '../types';

import { CadenceCard } from './cadence-card';

/**
 * Lista de cadências agrupada por etapa do funil. Cada `<section>` é uma
 * etapa (Novo, Em contato, Proposta, Negociação) — etapas terminais já
 * foram excluídas pelo `groupCadencesByStage`.
 *
 * Etapa sem cadência mostra EmptyState compacto inline com CTA pra criar
 * direto naquela etapa (passa `defaultStageId` pro dialog).
 *
 * Quando não há cadência **em nenhuma etapa**, exibe EmptyState grande no
 * topo da página (tratado pelo CadencesView, não aqui).
 */

interface StageGroup {
  stageId: string;
  stageName: string;
  cadences: Cadence[];
}

interface CadenceListProps {
  groups: StageGroup[];
  onCreateForStage: (stageId: string) => void;
}

export function CadenceList({ groups, onCreateForStage }: CadenceListProps) {
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.stageId} className="flex flex-col gap-3">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-body text-foreground font-semibold">{group.stageName}</h2>
              <Badge variant="secondary" className="text-caption tabular-nums">
                {group.cadences.length}
              </Badge>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCreateForStage(group.stageId)}
              className="text-caption text-muted-foreground hover:text-foreground gap-1"
            >
              <PlusCircle className="size-3.5" />
              Criar para esta etapa
            </Button>
          </header>

          {group.cadences.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="Sem cadência configurada"
              description="Leads que entrarem nesta etapa não recebem follow-up automático."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCreateForStage(group.stageId)}
                >
                  <PlusCircle className="size-4" />
                  Criar cadência
                </Button>
              }
              className="py-6"
            />
          ) : (
            <div className="flex flex-col gap-2">
              {group.cadences.map((c) => (
                <CadenceCard key={c.id} cadence={c} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
