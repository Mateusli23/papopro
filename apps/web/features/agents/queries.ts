/**
 * Queries server-only de Agentes IA (M11#3).
 *
 * Substituem o store in-memory + fixtures de M5. Retornam os shapes
 * existentes em `features/agents/types.ts` (`Agent`, `AgentVersion`,
 * `KnowledgeBase`, `HandoffTrigger`) pra que `<AgentsView>` / `<AgentEditorView>`
 * não mudem — só muda a origem dos dados.
 *
 * **Server-only.** Roda em Server Components (`/agents/page.tsx`,
 * `/agents/[id]/page.tsx`) e Server Actions. `withWorkspace` aplica RLS;
 * defense-in-depth filtra `workspace_id` explicitamente em todo `where`
 * (CLAUDE.md §7.2).
 *
 * **`handoff_config` JSONB → `HandoffTrigger[]`.** O DB armazena estado
 * dos 6 gatilhos num objeto único; serializamos pra o array de 6 que a UI
 * espera (com defaults `enabled:false` quando o JSONB não tem a entrada).
 *
 * **`metrics`.** Zeros temporariamente — métricas reais entram em M11#7
 * (VIEW Postgres agregada de `agent_sessions` + `agent_messages`).
 *
 * **Identidade do criador de versão.** `agent_versions.created_by_id` →
 * `users.name || users.email || '—'`. M5 mock era `'Você'` fixo.
 */
import 'server-only';

import { withWorkspace } from '@/lib/supabase/with-workspace';

import { HANDOFF_TRIGGER_KINDS } from './schemas';
import type {
  Agent,
  AgentMetrics,
  AgentRoute,
  AgentStatus,
  AgentTemplateKey,
  AgentTone,
  AgentVersion,
  HandoffTrigger,
  HandoffTriggerKind,
  KnowledgeBase,
  KnowledgeFile,
  RouteKind,
} from './types';

// ─── Tipos auxiliares ──────────────────────────────────────────────────────

/** Shape do JSONB `ai_agents.handoff_config`. Validado por Zod no Server Action
 *  de update; aqui assumimos shape correto (DB-managed). */
interface HandoffConfigJson {
  [kind: string]:
    | { enabled?: boolean; keywords?: string[]; targetAgentId?: string; stageId?: string }
    | undefined;
}

/** Resultado de uma chamada de simulation chat (M11#3). */
export interface SimulationMessageUI {
  id: string;
  direction: 'in' | 'out';
  body: string;
  createdAt: string;
}

/** Sessão de simulation ativa + mensagens (pra hidratar `agent-simulation-chat`). */
export interface SimulationStateUI {
  sessionId: string;
  messages: SimulationMessageUI[];
}

// ─── Serializers ───────────────────────────────────────────────────────────

/**
 * Converte JSONB `handoff_config` num array fixo de 6 `HandoffTrigger` (UI
 * espera sempre os 6 kinds). Trigger ausente vira `{ enabled: false }`.
 * `id` do trigger é deterministic-by-kind — UI usa `kind` como chave; `id`
 * fica como string previsível só pra manter contrato M5.
 */
function serializeHandoffConfig(agentId: string, handoffConfig: unknown): HandoffTrigger[] {
  const cfg = (handoffConfig ?? {}) as HandoffConfigJson;
  return HANDOFF_TRIGGER_KINDS.map<HandoffTrigger>((kind) => {
    const entry = cfg[kind] ?? {};
    return {
      id: `htg_${agentId.slice(0, 8)}_${kind}`,
      kind: kind as HandoffTriggerKind,
      enabled: entry.enabled ?? false,
      config:
        entry.keywords || entry.targetAgentId || entry.stageId
          ? {
              keywords: entry.keywords,
              targetAgentId: entry.targetAgentId,
              stageId: entry.stageId,
            }
          : undefined,
    };
  });
}

/** Métricas placeholder até M11#7. Zeros pra UI renderizar "0 conversas atendidas". */
function emptyMetrics(): AgentMetrics {
  return {
    totalConversations: 0,
    resolutionRate: 0,
    avgResponseTimeSec: 0,
    inferredSatisfaction: 0,
  };
}

/** Shape Prisma retornado pelas queries — manter consistente com `include` abaixo. */
interface AgentRowWithRelations {
  id: string;
  workspaceId: string;
  name: string;
  status: string;
  persona: string;
  tone: string;
  avatarEmoji: string | null;
  templateKey: string | null;
  prompt: string;
  activeVersionId: string | null;
  handoffConfig: unknown;
  createdAt: Date;
  updatedAt: Date;
  versions: Array<{
    id: string;
    agentId: string;
    versionNumber: number;
    prompt: string;
    persona: string;
    tone: string;
    notes: string | null;
    createdAt: Date;
    createdBy: { name: string | null; email: string } | null;
  }>;
  routingRules: Array<{
    id: string;
    kind: string;
    value: string;
    priority: number;
    createdAt: Date;
  }>;
}

/** Materializa um row Prisma no shape `Agent` da UI. */
function serializeAgent(row: AgentRowWithRelations): Agent {
  const versions: AgentVersion[] = row.versions
    .slice()
    .sort((a, b) => b.versionNumber - a.versionNumber)
    .map((v) => ({
      id: v.id,
      agentId: v.agentId,
      versionNumber: v.versionNumber,
      prompt: v.prompt,
      persona: v.persona,
      tone: v.tone as AgentTone,
      createdBy: v.createdBy?.name ?? v.createdBy?.email ?? '—',
      notes: v.notes ?? undefined,
      createdAt: v.createdAt.toISOString(),
    }));

  const routes: AgentRoute[] = row.routingRules
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((r) => ({
      id: r.id,
      kind: r.kind as RouteKind,
      value: r.value,
      createdAt: r.createdAt.toISOString(),
    }));

  // `currentVersionId` deve apontar pra uma versão real. Se DB tem
  // `active_version_id` setado, usa; senão, fallback pra v1 (sempre existe
  // por contrato — `createAgentAction` cria v1 junto com o agente).
  const currentVersionId =
    row.activeVersionId ?? versions[versions.length - 1]?.id ?? versions[0]?.id ?? '';

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    avatarEmoji: row.avatarEmoji ?? undefined,
    status: row.status as AgentStatus,
    templateKey: (row.templateKey as AgentTemplateKey | null) ?? undefined,
    prompt: row.prompt,
    persona: row.persona,
    tone: row.tone as AgentTone,
    routes,
    handoffTriggers: serializeHandoffConfig(row.id, row.handoffConfig),
    versions,
    currentVersionId,
    metrics: emptyMetrics(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Queries ───────────────────────────────────────────────────────────────

/**
 * Lista agentes não-deletados do workspace, ordenados por `updatedAt DESC`.
 * Inclui todas as relations necessárias pra renderizar a lista + transição
 * pro editor sem N+1 (versions + routingRules em batch).
 */
export async function listAgentsForWorkspace(workspaceId: string): Promise<Agent[]> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx.aiAgent.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            createdBy: { select: { name: true, email: true } },
          },
        },
        routingRules: { orderBy: { priority: 'asc' } },
      },
    });
    return rows.map(serializeAgent);
  });
}

/**
 * Busca 1 agente por ID. Retorna `null` se não encontrar ou se foi
 * soft-deleted — caller responde com 404 (`notFound()`).
 */
export async function getAgentDetailById(
  workspaceId: string,
  agentId: string,
): Promise<Agent | null> {
  return withWorkspace(workspaceId, async (tx) => {
    const row = await tx.aiAgent.findFirst({
      where: { id: agentId, workspaceId, deletedAt: null },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            createdBy: { select: { name: true, email: true } },
          },
        },
        routingRules: { orderBy: { priority: 'asc' } },
      },
    });
    if (!row) return null;
    return serializeAgent(row);
  });
}

/**
 * Lê os 5 campos estruturados do Cérebro da Empresa + lista de documentos.
 *
 * **Documentos em M11#3:** tabela `knowledge_documents` existe (M11#1) mas
 * upload + chunking + embedding ficam pra M11#4. Aqui retornamos a lista
 * vazia — UI mostra "Nenhum arquivo ainda" como estado vazio. Em M11#4 o
 * include vira `documents: { orderBy: { createdAt: 'desc' } }`.
 *
 * Retorna `null` quando workspace nunca tocou no Cérebro (row de
 * `knowledge_base_fields` não existe). UI seeda valores vazios na primeira
 * edição via `updateKnowledgeBaseFieldAction` (upsert).
 */
/** Mapeia kind do DB (5 valores) pro `KnowledgeFile.kind` da UI (3 valores M5). */
function serializeDocKind(kind: 'pdf' | 'doc' | 'docx' | 'txt' | 'md'): KnowledgeFile['kind'] {
  if (kind === 'pdf') return 'pdf';
  if (kind === 'doc' || kind === 'docx') return 'doc';
  return 'txt';
}

/** Mapeia status DB (4 valores M11#4) pro `KnowledgeFile.status` UI (2 valores M5).
 *  `uploading`/`failed` viram `processing` — UI M11#4 já lê `errorDetail`
 *  diretamente do shape estendido se quiser distinguir. */
function serializeDocStatus(
  status: 'uploading' | 'processing' | 'processed' | 'failed',
): KnowledgeFile['status'] {
  return status === 'processed' ? 'processed' : 'processing';
}

export async function getKnowledgeBaseFields(workspaceId: string): Promise<KnowledgeBase | null> {
  return withWorkspace(workspaceId, async (tx) => {
    const [row, docs] = await Promise.all([
      tx.knowledgeBaseField.findUnique({ where: { workspaceId } }),
      tx.knowledgeDocument.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const files: KnowledgeFile[] = docs.map((d) => ({
      id: d.id,
      name: d.name,
      sizeBytes: d.sizeBytes,
      kind: serializeDocKind(d.kind as 'pdf' | 'doc' | 'docx' | 'txt' | 'md'),
      status: serializeDocStatus(d.status as 'uploading' | 'processing' | 'processed' | 'failed'),
      uploadedAt: d.createdAt.toISOString(),
    }));

    if (!row) {
      // Workspace ainda sem campos estruturados — UI trata como vazio. Files
      // já vem populado (pode ter docs sem campos, ou vice-versa).
      return {
        workspaceId,
        about: '',
        products: '',
        faq: '',
        scripts: '',
        policy: '',
        files,
        updatedAt: new Date().toISOString(),
      };
    }
    return {
      workspaceId,
      about: row.about,
      products: row.products,
      faq: row.faq,
      scripts: row.scripts,
      policy: row.policy,
      files,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

/**
 * Busca o estado da sessão de simulation aberta do agente (`kind='simulation'`
 * + `endedAt IS NULL`). Retorna mensagens em ordem cronológica ascendente,
 * prontas pra `<AgentSimulationChat>` hidratar.
 *
 * Retorna `null` se não há sessão aberta — UI mostra estado vazio "Digite
 * pra começar uma simulação". Server Action `simulateAgentMessageAction`
 * cria a sessão na primeira mensagem.
 */
/**
 * Opções leves (`id` + `name`) de todos os agentes não-deletados do workspace.
 * Alimenta o `<Select>` de agente-alvo do gatilho de handoff `agent_to_agent`
 * (M11#6). O caller filtra o próprio agente fora da lista.
 */
export async function listAgentOptions(
  workspaceId: string,
): Promise<Array<{ id: string; name: string }>> {
  return withWorkspace(workspaceId, async (tx) => {
    return tx.aiAgent.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  });
}

export async function getActiveSimulationState(
  workspaceId: string,
  agentId: string,
): Promise<SimulationStateUI | null> {
  return withWorkspace(workspaceId, async (tx) => {
    const session = await tx.agentSession.findFirst({
      where: {
        workspaceId,
        agentId,
        kind: 'simulation',
        endedAt: null,
      },
      orderBy: { startedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, direction: true, body: true, createdAt: true },
        },
      },
    });
    if (!session) return null;
    return {
      sessionId: session.id,
      messages: session.messages.map((m) => ({
        id: m.id,
        direction: m.direction as 'in' | 'out',
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });
}
