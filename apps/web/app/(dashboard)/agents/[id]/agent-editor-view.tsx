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
  EmptyState,
  Input,
  PageHeader,
} from '@papopro/ui';
import { ArrowLeft, Bot, Copy, History, MoreVertical, Save, Trash2 } from '@papopro/ui/icons';

import { AgentHandoffPanel } from '@/features/agents/components/agent-handoff-panel';
import { AgentMetricsPanel } from '@/features/agents/components/agent-metrics-panel';
import { AgentPersonaFields } from '@/features/agents/components/agent-persona-fields';
import { AgentPromptEditor } from '@/features/agents/components/agent-prompt-editor';
import { AgentRoutingPanel } from '@/features/agents/components/agent-routing-panel';
import { AgentSimulationChat } from '@/features/agents/components/agent-simulation-chat';
import { AgentStatusBadge } from '@/features/agents/components/agent-status-badge';
import { AgentStatusToggle } from '@/features/agents/components/agent-status-toggle';
import { AgentVersionHistorySheet } from '@/features/agents/components/agent-version-history-sheet';
import {
  deleteAgent,
  duplicateAgent,
  saveVersion,
  updateAgent,
  useAgent,
} from '@/features/agents/store';

/**
 * `/agents/[id]` — editor do agente IA.
 *
 * Layout: header com título + status + ações ("Salvar versão", "Histórico",
 * dropdown extras); corpo em 2 colunas no desktop (prompt + persona + futuros
 * panels do passo 9 ocupam 2/3, métricas 1/3) e empilhado no mobile.
 *
 * Quando o ID não bate com nenhum agente, mostra EmptyState com link de volta.
 *
 * Em M11 lê via Server Component + Prisma; a forma do view permanece — o
 * `useAgent(id)` vira `agent: Agent` prop.
 */

interface AgentEditorViewProps {
  agentId: string;
}

export function AgentEditorView({ agentId }: AgentEditorViewProps) {
  const router = useRouter();
  const agent = useAgent(agentId);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  if (!agent) {
    return (
      <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Agente não encontrado"
          description="O link pode estar quebrado ou o agente foi excluído."
        />
        <EmptyState
          icon={Bot}
          title="Sem agente por aqui"
          description="Volte pra lista pra ver os agentes disponíveis."
          action={
            <Button asChild>
              <Link href="/agents">
                <ArrowLeft className="size-4" />
                Voltar pra agentes
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  function handleSaveVersion() {
    setSaving(true);
    // Async-like UX — saveVersion é síncrono mas damos feedback de "salvando".
    setTimeout(() => {
      const created = saveVersion(agent!.id, {});
      setSaving(false);
      if (created) {
        toast.success(
          `Versão v${created.versionNumber} salva — versão anterior preservada no histórico.`,
          { duration: 4000 },
        );
      }
    }, 200);
  }

  function handleDuplicate() {
    const dup = duplicateAgent(agent!.id);
    if (dup) {
      toast.success(`"${dup.name}" criada em modo de teste.`, { duration: 3500 });
      router.push(`/agents/${dup.id}`);
    }
  }

  function handleDelete() {
    // TODO(M5+): AlertDialog Radix em vez de window.confirm — paridade com
    // cadences. Funcional o suficiente pra demo mockada.
    if (!confirm(`Excluir o agente "${agent!.name}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    const ok = deleteAgent(agent!.id);
    if (ok) {
      toast.success('Agente excluído.', { duration: 3500 });
      router.push('/agents');
    }
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    updateAgent(agent!.id, { name: e.target.value });
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
                value={agent.name}
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
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="size-4" /> Excluir
                </DropdownMenuItem>
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
          <AgentHandoffPanel agent={agent} />
          <AgentSimulationChat agent={agent} />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-1">
          <AgentMetricsPanel agent={agent} />
        </div>
      </div>

      <AgentVersionHistorySheet agent={agent} open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}
