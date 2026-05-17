'use client';

import * as React from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { toast } from 'react-hot-toast';

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PageHeader,
  cn,
} from '@papopro/ui';
import { ArrowLeft, Copy, MoreVertical, Pause, Play, Trash2 } from '@papopro/ui/icons';

import {
  deleteCadenceAction,
  deleteStepAction,
  duplicateCadenceAction,
  toggleCadenceStatusAction,
} from '@/features/cadences/actions';
import { CadenceMetricsPanel } from '@/features/cadences/components/cadence-metrics-panel';
import { CadenceStatusToggle } from '@/features/cadences/components/cadence-status-toggle';
import { StepEditDialog } from '@/features/cadences/components/step-edit-dialog';
import { StepTimeline } from '@/features/cadences/components/step-timeline';
import type { Cadence, CadenceStep } from '@/features/cadences/types';
import type { PipelineStage } from '@/features/leads/types';

/**
 * `/cadences/[id]` — editor da cadência.
 *
 * Layout: header com título + status + ações; corpo em 2 colunas no
 * desktop (timeline 2/3, métricas 1/3) e empilhado no mobile.
 *
 * **M10#3**: recebe `initialCadence` carregado pelo Server Component
 * (`page.tsx` chama `getCadence` que inclui steps + métricas reais
 * agregadas). Mutações via Server Actions revalidam o path — Next refetcha
 * e re-renderiza com snapshot fresco.
 */

interface CadenceEditorViewProps {
  initialCadence: Cadence;
  /** Stages do pipeline default — usadas pra resolver o nome da etapa. */
  stages: readonly PipelineStage[];
}

export function CadenceEditorView({ initialCadence, stages }: CadenceEditorViewProps) {
  const router = useRouter();
  const cadence = initialCadence;
  const stageName = stages.find((s) => s.id === cadence.stageId)?.name ?? '—';

  // Estado único do dialog de step. `null` = fechado; `{ mode: 'create' }` =
  // adicionar novo; `{ mode: 'edit', step }` = editar existente. Ter dois
  // dialogs separados (um pra criar, outro pra editar) montaria os dois em
  // simultâneo se o usuário fosse rápido — ambos disputariam foco e o Radix
  // aplicaria `aria-hidden` em camadas, gerando UX confusa.
  const [stepDialog, setStepDialog] = React.useState<
    { mode: 'create' } | { mode: 'edit'; step: CadenceStep } | null
  >(null);

  const isPaused = cadence.status === 'paused';

  async function handleDuplicate() {
    const loadingId = toast.loading('Duplicando cadência…');
    const result = await duplicateCadenceAction(cadence.id);
    toast.dismiss(loadingId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${cadence.name} (cópia)" criada (pausada).`, { duration: 3500 });
    router.push(`/cadences/${result.id}`);
  }

  async function handleDelete() {
    // TODO(M5+): trocar `window.confirm` por AlertDialog Radix — quebra
    // estética em dark mode e tema do produto. Funcional o suficiente pra
    // demo mockada; AlertDialog primitivo entra antes do beta fechado.
    if (!confirm(`Excluir a cadência "${cadence.name}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    const loadingId = toast.loading('Excluindo cadência…');
    const result = await deleteCadenceAction(cadence.id);
    toast.dismiss(loadingId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Cadência excluída.', { duration: 3500 });
    router.push('/cadences');
  }

  async function handleToggleStatus() {
    const wasActive = cadence.status === 'active';
    const loadingId = toast.loading(wasActive ? 'Pausando cadência…' : 'Ativando cadência…');
    const result = await toggleCadenceStatusAction(cadence.id);
    toast.dismiss(loadingId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      wasActive
        ? 'Cadência pausada — sem novos disparos até reativar.'
        : 'Cadência ativada — passos seguintes voltam a disparar.',
      { duration: 3500 },
    );
  }

  async function handleDeleteStep(step: CadenceStep) {
    // TODO(M5+): mesmo motivo do `handleDelete` — trocar por AlertDialog.
    if (!confirm('Remover este passo? Os leads que já passaram por ele não são afetados.')) {
      return;
    }
    const loadingId = toast.loading('Removendo passo…');
    const result = await deleteStepAction(cadence.id, step.id);
    toast.dismiss(loadingId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Passo D+${step.dayOffset} removido.`, { duration: 3000 });
  }

  return (
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground gap-1 self-start"
        >
          <Link href="/cadences">
            <ArrowLeft className="size-4" />
            Cadências
          </Link>
        </Button>

        <PageHeader
          title={cadence.name}
          description={cadence.description ?? 'Sem descrição.'}
          actions={
            <div className="flex items-center gap-2">
              <Badge
                variant={isPaused ? 'secondary' : 'default'}
                className={cn(
                  'text-caption gap-1',
                  isPaused
                    ? 'text-muted-foreground'
                    : 'bg-success/15 text-success border-success/20 hover:bg-success/20',
                )}
              >
                {isPaused ? <Pause className="size-3" /> : <Play className="size-3" />}
                {isPaused ? 'Pausada' : 'Ativa'}
              </Badge>
              <CadenceStatusToggle cadence={cadence} compact />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Mais ações">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={handleDuplicate} className="gap-2">
                    <Copy className="size-4" />
                    Duplicar cadência
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleToggleStatus} className="gap-2">
                    {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
                    {isPaused ? 'Ativar' : 'Pausar'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleDelete} className="text-destructive gap-2">
                    <Trash2 className="size-4" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        <div className="text-caption text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Etapa: <strong className="text-foreground">{stageName}</strong>
          </span>
          <span aria-hidden>·</span>
          <span>
            {cadence.steps.length} {cadence.steps.length === 1 ? 'passo' : 'passos'}
          </span>
          {cadence.templateKey && cadence.templateKey !== 'blank' && (
            <>
              <span aria-hidden>·</span>
              <span>Baseada em template</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StepTimeline
            steps={cadence.steps}
            onAddStep={() => setStepDialog({ mode: 'create' })}
            onEditStep={(step) => setStepDialog({ mode: 'edit', step })}
            onDeleteStep={handleDeleteStep}
          />
        </div>

        <aside className="lg:col-span-1">
          <CadenceMetricsPanel cadence={cadence} />
        </aside>
      </div>

      {/*
       * Único dialog de step: muda entre criação e edição via `step` prop.
       * Quando `null`, dialog está fechado; ao fechar (`onOpenChange(false)`),
       * volta pra `null`.
       */}
      <StepEditDialog
        open={stepDialog !== null}
        onOpenChange={(o) => {
          if (!o) setStepDialog(null);
        }}
        cadenceId={cadence.id}
        step={stepDialog?.mode === 'edit' ? stepDialog.step : undefined}
      />
    </div>
  );
}
