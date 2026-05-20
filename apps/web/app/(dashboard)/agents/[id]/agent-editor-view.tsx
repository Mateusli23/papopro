'use client';

import * as React from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { toast } from 'react-hot-toast';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from '@papopro/ui';
import { ArrowLeft, Copy, History, MoreVertical, Save, Trash2 } from '@papopro/ui/icons';

import {
  deleteAgentAction,
  duplicateAgentAction,
  saveAgentVersionAction,
  updateAgentDraftAction,
} from '@/features/agents/actions';
import { AgentHandoffPanel } from '@/features/agents/components/agent-handoff-panel';
import { AgentMetricsPanel } from '@/features/agents/components/agent-metrics-panel';
import { AgentPersonaFields } from '@/features/agents/components/agent-persona-fields';
import { AgentPromptEditor } from '@/features/agents/components/agent-prompt-editor';
import { AgentRoutingPanel } from '@/features/agents/components/agent-routing-panel';
import { AgentSimulationChat } from '@/features/agents/components/agent-simulation-chat';
import { AgentStatusBadge } from '@/features/agents/components/agent-status-badge';
import { AgentStatusToggle } from '@/features/agents/components/agent-status-toggle';
import { AgentVersionHistorySheet } from '@/features/agents/components/agent-version-history-sheet';
import type { SimulationStateUI } from '@/features/agents/queries';
import type { Agent } from '@/features/agents/types';

/**
 * `/agents/[id]` — editor do agente IA (M11#3).
 *
 * Server Component pai (`page.tsx`) faz fetch via `getAgentDetailById` +
 * `getActiveSimulationState`. Aqui recebemos como props e cada panel chama
 * Server Actions diretamente.
 *
 * Mutations no body do header (`saveAgentVersionAction`, `duplicateAgentAction`,
 * `deleteAgentAction`, `updateAgentDraftAction`) sobem aqui pra centralizar
 * roteamento/router.refresh. Cada panel especializado faz o resto.
 */

interface AgentEditorViewProps {
  agent: Agent;
  initialSimulationState: SimulationStateUI | null;
  callerRole: string;
  /** Outros agentes do workspace — opções do gatilho `agent_to_agent` (M11#6). */
  agentOptions: Array<{ id: string; name: string }>;
  /** Etapas do pipeline default — opções do gatilho `stage_negotiation` (M11#6). */
  stageOptions: Array<{ id: string; name: string }>;
}

export function AgentEditorView({
  agent,
  initialSimulationState,
  callerRole,
  agentOptions,
  stageOptions,
}: AgentEditorViewProps) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const canDelete = callerRole === 'Owner' || callerRole === 'Admin';

  async function handleSaveVersion() {
    setSaving(true);
    const result = await saveAgentVersionAction(agent.id, {});
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Versão salva — versão anterior preservada no histórico.', {
      duration: 4000,
    });
    router.refresh();
  }

  async function handleDuplicate() {
    const result = await duplicateAgentAction(agent.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${agent.name} (cópia)" criada em modo de teste.`, { duration: 3500 });
    router.push(`/agents/${result.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Excluir o agente "${agent.name}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    const result = await deleteAgentAction(agent.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Agente excluído.', { duration: 3500 });
    router.push('/agents');
    router.refresh();
  }

  // Debounce do name pra evitar Server Action a cada keystroke.
  const nameDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    nameDebounceRef.current = setTimeout(() => {
      void updateAgentDraftAction(agent.id, { name: next });
    }, 600);
  }

  const currentVersion = agent.versions.find((v) => v.id === agent.currentVersionId);

  return (
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          href="/agents"
          className="text-caption text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1"
        >
          <ArrowLeft className="size-3" />
          Agentes
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="border-primary/30 bg-primary/10 flex size-12 shrink-0 items-center justify-center rounded-full border text-2xl"
              aria-hidden
            >
              {agent.avatarEmoji ?? '🤖'}
            </div>
            <div className="flex flex-col gap-1">
              <Input
                defaultValue={agent.name}
                onChange={handleNameChange}
                className="text-title focus-visible:bg-muted/50 h-auto border-none bg-transparent p-0 font-semibold focus-visible:px-2"
              />
              <div className="flex flex-wrap items-center gap-2">
                <AgentStatusBadge status={agent.status} />
                {currentVersion && (
                  <span className="text-caption text-muted-foreground">
                    v{currentVersion.versionNumber} · {agent.versions.length} versões no histórico
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AgentStatusToggle agent={agent} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              className="gap-1"
            >
              <History className="size-4" />
              Histórico
            </Button>
            <Button size="sm" onClick={handleSaveVersion} disabled={saving} className="gap-1">
              <Save className="size-4" />
              {saving ? 'Salvando…' : 'Salvar versão'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="size-4" /> Duplicar agente
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <Trash2 className="size-4" /> Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Body 2-col */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <AgentPromptEditor agent={agent} />
          <AgentPersonaFields agent={agent} />
          <AgentRoutingPanel agent={agent} />
          <AgentHandoffPanel
            agent={agent}
            agentOptions={agentOptions}
            stageOptions={stageOptions}
          />
          <AgentSimulationChat agent={agent} initialState={initialSimulationState} />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-1">
          <AgentMetricsPanel agent={agent} />
        </div>
      </div>

      <AgentVersionHistorySheet agent={agent} open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}
