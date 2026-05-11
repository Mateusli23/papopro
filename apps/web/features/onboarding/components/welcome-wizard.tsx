'use client';

import * as React from 'react';

import toast from 'react-hot-toast';

import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@papopro/ui';
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from '@papopro/ui/icons';

import { useWorkspaceMock } from '@/features/workspace/workspace-mock-provider';

import { AgentStep } from './steps/agent-step';
import { CsvStep } from './steps/csv-step';
import { WhatsappStep } from './steps/whatsapp-step';
import { WorkspaceStep } from './steps/workspace-step';

interface WelcomeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  { id: 'workspace', title: 'Confirme seu workspace' },
  { id: 'whatsapp', title: 'Conecte o WhatsApp' },
  { id: 'agent', title: 'Crie seu primeiro agente IA' },
  { id: 'csv', title: 'Importe seus leads' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export interface WizardState {
  workspaceName: string;
  whatsappConnected: boolean;
  agentTemplate: string | null;
  agentName: string;
  csvImported: boolean;
}

const INITIAL_STATE: WizardState = {
  workspaceName: '',
  whatsappConnected: false,
  agentTemplate: null,
  agentName: '',
  csvImported: false,
};

/**
 * Wizard de boas-vindas (PLAN.md M3 — 4 passos com botão "Pular este passo").
 *
 * Estrutura:
 *  - `Dialog` controlado pelo controller no layout do dashboard.
 *  - `currentStep` mantém o passo ativo; `wizardState` agrega dados.
 *  - Cada step é um componente independente que recebe `state`/`onChange`
 *    e expõe seu próprio botão "Continuar"/"Pular" via `onAdvance`/`onSkip`.
 *
 * Conclusão (qualquer combinação):
 *  - Concluir o último passo → `markWizardCompleted()` no WorkspaceMockProvider
 *  - "Pular este passo" no último → mesmo efeito (wizard não reabre)
 *  - Fechar pelo X / Esc → mesmo efeito (decisão de UX: o usuário viu uma
 *    vez, não enchemos a vista de novo)
 *
 * Em M7#4 o WorkspaceMockProvider sai e este wizard vira o caminho real de
 * criação de workspace (insert em `workspaces` + `workspace_members` com role
 * Owner). A forma `state ↔ onChange` permanece.
 */
export function WelcomeWizard({ open, onOpenChange }: WelcomeWizardProps) {
  const { markWizardCompleted } = useWorkspaceMock();
  const [currentStep, setCurrentStep] = React.useState<StepId>('workspace');
  const [state, setState] = React.useState<WizardState>(INITIAL_STATE);
  const [finishing, setFinishing] = React.useState(false);

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  function patchState(patch: Partial<WizardState>) {
    setState((s) => ({ ...s, ...patch }));
  }

  function goPrev() {
    if (isFirst) return;
    setCurrentStep(STEPS[stepIndex - 1]!.id);
  }

  function goNext() {
    if (isLast) return;
    setCurrentStep(STEPS[stepIndex + 1]!.id);
  }

  async function finish(skipped: boolean) {
    setFinishing(true);
    // Pequeno delay pra mostrar o estado de "concluindo" — UX honesta:
    // dá tempo do usuário entender que algo foi salvo.
    await new Promise((resolve) => setTimeout(resolve, 400));
    markWizardCompleted();
    setFinishing(false);
    onOpenChange(false);
    toast.success(skipped ? 'Você pode voltar quando quiser.' : 'Tudo pronto pra começar.');
  }

  // Wrapper que controla fechamento manual (X ou Esc): trata como "pulei tudo
  // que faltava" e marca como concluído. Evita o wizard re-abrir no F5.
  function handleOpenChange(next: boolean) {
    if (!next && open) {
      void finish(true);
      return;
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <header className="border-border bg-muted/40 flex flex-col gap-4 border-b p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full"
              >
                <Sparkles className="size-5" />
              </span>
              <div className="flex flex-col gap-1">
                <DialogTitle className="text-foreground text-title font-semibold">
                  Bem-vindo ao PapoPro
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-body">
                  Em 4 passos rápidos a gente deixa seu workspace operacional.
                </DialogDescription>
              </div>
            </div>
            <span
              className="bg-background text-foreground border-border text-caption shrink-0 rounded-full border px-3 py-1 font-medium"
              aria-live="polite"
            >
              Passo {stepIndex + 1} de {STEPS.length}
            </span>
          </div>
          <ProgressBar current={stepIndex} total={STEPS.length} />
        </header>

        <div className="flex flex-col gap-6 p-6">
          {currentStep === 'workspace' && (
            <WorkspaceStep
              value={state.workspaceName}
              onChange={(v) => patchState({ workspaceName: v })}
            />
          )}
          {currentStep === 'whatsapp' && (
            <WhatsappStep
              connected={state.whatsappConnected}
              onChange={(v) => patchState({ whatsappConnected: v })}
            />
          )}
          {currentStep === 'agent' && (
            <AgentStep
              template={state.agentTemplate}
              agentName={state.agentName}
              onChange={(patch) => patchState(patch)}
            />
          )}
          {currentStep === 'csv' && (
            <CsvStep
              imported={state.csvImported}
              onChange={(v) => patchState({ csvImported: v })}
            />
          )}
        </div>

        <footer className="border-border bg-muted/30 flex items-center justify-between gap-3 border-t px-6 py-4">
          <Button variant="ghost" onClick={goPrev} disabled={isFirst || finishing}>
            <ArrowLeft />
            Voltar
          </Button>

          <div className="flex items-center gap-2">
            {!isLast && (
              <Button variant="ghost" onClick={goNext} disabled={finishing}>
                Pular este passo
              </Button>
            )}
            {isLast ? (
              <>
                <Button variant="ghost" onClick={() => finish(true)} disabled={finishing}>
                  Pular este passo
                </Button>
                <Button onClick={() => finish(false)} disabled={finishing}>
                  {finishing ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Concluindo…
                    </>
                  ) : (
                    <>
                      <Check />
                      Concluir
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={goNext}>
                Continuar
                <ArrowRight />
              </Button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Barra horizontal de 4 segmentos. Segmento à esquerda do passo atual fica
 * preenchido, o atual destacado, os seguintes vazios.
 */
function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-label={`Passo ${current + 1} de ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={
            i < current
              ? 'bg-primary h-1.5 flex-1 rounded-full'
              : i === current
                ? 'bg-primary h-1.5 flex-1 rounded-full opacity-80'
                : 'bg-muted h-1.5 flex-1 rounded-full'
          }
          aria-hidden
        />
      ))}
    </div>
  );
}
