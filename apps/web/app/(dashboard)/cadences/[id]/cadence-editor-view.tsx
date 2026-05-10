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
  EmptyState,
  PageHeader,
  cn,
} from '@papopro/ui';
import { ArrowLeft, Copy, MoreVertical, Pause, Play, Repeat, Trash2 } from '@papopro/ui/icons';

import { CadenceMetricsPanel } from '@/features/cadences/components/cadence-metrics-panel';
import { CadenceStatusToggle } from '@/features/cadences/components/cadence-status-toggle';
import { StepEditDialog } from '@/features/cadences/components/step-edit-dialog';
import { StepTimeline } from '@/features/cadences/components/step-timeline';
import {
  deleteCadence,
  deleteStep,
  duplicateCadence,
  toggleCadenceStatus,
  useCadence,
} from '@/features/cadences/store';
import type { CadenceStep } from '@/features/cadences/types';
import { getStageName } from '@/lib/fixtures/pipelines';

/**
 * `/cadences/[id]` — editor da cadência.
 *
 * Layout: header com título + status + ações; corpo em 2 colunas no
 * desktop (timeline 2/3, métricas 1/3) e empilhado no mobile.
 *
 * Quando o ID não bate com nenhuma cadência (ex: usuário acessa link de
 * cadência deletada ou inválido), mostramos EmptyState com link de volta.
 *
 * Em M8 lê via Server Component + Prisma, mas a forma da view permanece —
 * o `useCadence(id)` vira `cadence: Cadence` prop.
 */

interface CadenceEditorViewProps {
  id: string;
}

export function CadenceEditorView({ id }: CadenceEditorViewProps) {
  const router = useRouter();
  const cadence = useCadence(id);

  // Estado único do dialog de step. `null` = fechado; `{ mode: 'create' }` =
  // adicionar novo; `{ mode: 'edit', step }` = editar existente. Ter dois
  // dialogs separados (um pra criar, outro pra editar) montaria os dois em
  // simultâneo se o usuário fosse rápido — ambos disputariam foco e o Radix
  // aplicaria `aria-hidden` em camadas, gerando UX confusa.
  const [stepDialog, setStepDialog] = React.useState<
    { mode: 'create' } | { mode: 'edit'; step: CadenceStep } | null
  >(null);

  if (!cadence) {
    return (
      <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Cadência não encontrada"
          description="O link pode estar quebrado ou a cadência foi excluída."
        />
        <EmptyState
          icon={Repeat}
          title="Sem cadência por aqui"
          description="Volte pra lista pra ver as cadências disponíveis."
          action={
            <Button asChild>
              <Link href="/cadences">
                <ArrowLeft className="size-4" />
                Voltar pra cadências
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const isPaused = cadence.status === 'paused';

  function handleDuplicate() {
    const dup = duplicateCadence(cadence!.id);
    if (dup) {
      toast.success(`"${dup.name}" criada como cópia (pausada).`, { duration: 3500 });
      router.push(`/cadences/${dup.id}`);
    }
  }

  function handleDelete() {
    // TODO(M5+): trocar `window.confirm` por AlertDialog Radix — quebra
    // estética em dark mode e tema do produto. Funcional o suficiente pra
    // demo mockada; AlertDialog primitivo entra antes do beta fechado.
    if (!confirm(`Excluir a cadência "${cadence!.name}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    const ok = deleteCadence(cadence!.id);
    if (ok) {
      toast.success('Cadência excluída.', { duration: 3500 });
      router.push('/cadences');
    }
  }

  function handleToggleStatus() {
    const updated = toggleCadenceStatus(cadence!.id);
    if (updated) {
      toast.success(
        updated.status === 'active'
          ? 'Cadência ativada — passos seguintes voltam a disparar.'
          : 'Cadência pausada — sem novos disparos até reativar.',
        { duration: 3500 },
      );
    }
  }

  function handleDeleteStep(step: CadenceStep) {
    // TODO(M5+): mesmo motivo do `handleDelete` — trocar por AlertDialog.
    if (!confirm('Remover este passo? Os leads que já passaram por ele não são afetados.')) {
      return;
    }
    const ok = deleteStep(cadence!.id, step.id);
    if (ok) {
      toast.success(`Passo D+${step.dayOffset} removido.`, { duration: 3000 });
    }
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
            Etapa: <strong className="text-foreground">{getStageName(cadence.stageId)}</strong>
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
