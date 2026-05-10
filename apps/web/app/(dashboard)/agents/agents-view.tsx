'use client';

import * as React from 'react';

import {
  Badge,
  Button,
  Input,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@papopro/ui';
import { Bot, Brain, PlusCircle, Search } from '@papopro/ui/icons';

import { AgentCreateDialog } from '@/features/agents/components/agent-create-dialog';
import { AgentList } from '@/features/agents/components/agent-list';
import { KnowledgeBaseTab } from '@/features/agents/components/knowledge-base-tab';
import { useAgents } from '@/features/agents/store';
import { MAX_ACTIVE_AGENTS, countAgents } from '@/features/agents/transforms';

/**
 * `/agents` — central de Agentes IA do workspace.
 *
 * Estrutura: header com KPIs + CTA "Novo agente"; abas "Agentes" e "Cérebro
 * da Empresa". A aba Agentes lista os agentes com busca; aba Cérebro mostra
 * 5 seções editáveis de base de conhecimento + arquivos.
 *
 * Por que tabs aqui (e não rota separada)?
 *  - PRD §3.9 trata agentes e Cérebro como mesmo escopo conceitual.
 *  - Vendedor pula entre eles enquanto configura o agente — Tabs evita
 *    navegação completa.
 *  - Padrão Notion-like que reduz fricção visual.
 *
 * Em M11 vira Server Component lendo `agents` via Prisma + RLS; este
 * componente fica `'use client'` só pra busca/dialog/atalhos.
 */
export function AgentsView() {
  const agents = useAgents();
  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [tab, setTab] = React.useState<'agents' | 'kb'>('agents');

  const counts = React.useMemo(() => countAgents(agents), [agents]);

  return (
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Agentes IA"
        description="Crie até 3 agentes ativos com prompts, regras de roteamento e base de conhecimento compartilhada."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusCircle /> Novo agente
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="agents" className="gap-2">
            <Bot className="size-4" /> Agentes
          </TabsTrigger>
          <TabsTrigger value="kb" className="gap-2">
            <Brain className="size-4" /> Cérebro da Empresa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="flex flex-col gap-4 pt-4">
          {agents.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success" className="text-caption gap-1">
                  <span className="tabular-nums">{counts.active}</span>
                  <span>ativos</span>
                  <span className="text-muted-foreground">/ {MAX_ACTIVE_AGENTS}</span>
                </Badge>
                {counts.testing > 0 && (
                  <Badge variant="warning" className="text-caption gap-1">
                    <span className="tabular-nums">{counts.testing}</span>
                    <span>em teste</span>
                  </Badge>
                )}
                {counts.paused > 0 && (
                  <Badge variant="outline" className="text-caption gap-1">
                    <span className="tabular-nums">{counts.paused}</span>
                    <span>pausados</span>
                  </Badge>
                )}
                {counts.totalConversations > 0 && (
                  <Badge variant="outline" className="text-caption gap-1">
                    <span className="tabular-nums">{counts.totalConversations}</span>
                    <span>conversas atendidas</span>
                  </Badge>
                )}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou persona…"
                  className="pl-9"
                  data-shortcut-search
                />
              </div>
            </div>
          )}

          <AgentList
            agents={agents}
            search={search || undefined}
            onCreateClick={() => setCreateOpen(true)}
          />
        </TabsContent>

        <TabsContent value="kb" className="pt-4">
          <KnowledgeBaseTab />
        </TabsContent>
      </Tabs>

      <AgentCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
