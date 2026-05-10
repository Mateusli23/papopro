/**
 * Transformações puras do domínio Agentes IA.
 *
 * Toda função aqui é pura: recebe `Agent[]` (e parâmetros), devolve novo
 * `Agent[]` ou agregação. Sem side-effects, sem React. O store (`store.ts`)
 * é wrapper fino que aplica essas transformações ao snapshot e dispara
 * listeners.
 *
 * Em M11 cada função vira core de Server Actions correspondentes
 * (`createAgent`, `saveVersion`, `addRoute`, …). Os tipos e contratos de
 * retorno permanecem.
 *
 * Decisões de produto codificadas aqui:
 *  - **Limite 3 ativos no Pro IA**: `applyToggleStatus` rejeita transição pra
 *    `'active'` quando já há 3 ativos (PRD §3.9). Retorna `cadences` inalterado
 *    + flag `limitReached: true` pra UI mostrar toast vermelho.
 *  - **Status default ao criar/duplicar**: `'testing'`. Força revisão no chat
 *    de simulação antes do agente atender lead real (paridade com cadences que
 *    duplica em `'paused'`).
 *  - **Roteamento — primeiro hit**: `getNextRouteMatch` itera regras na ordem
 *    do array; retorna o primeiro match. Documentado no badge da UI.
 *  - **Versionamento**: `applySaveVersion` cria snapshot do trio atual com
 *    versionNumber incrementado. `applyRestoreVersion` substitui o draft
 *    sem criar versão nova (evita explosão).
 */

import type { AgentUpdateInput, RouteCreateInput, RouteUpdateInput } from './schemas';
import type {
  Agent,
  AgentRoute,
  AgentStatus,
  AgentTemplate,
  AgentVersion,
  HandoffTrigger,
  HandoffTriggerKind,
  KnowledgeBase,
  KnowledgeFile,
  RouteKind,
} from './types';

/** Limite de agentes ativos por workspace no plano Pro IA (PRD §3.9). */
export const MAX_ACTIVE_AGENTS = 3;

// ─── Mutações puras (agente) ──────────────────────────────────────────────

interface CreateAgentInput {
  name: string;
  avatarEmoji?: string;
  templateKey: AgentTemplate['key'];
}

/**
 * Cria novo agente clonando trio (prompt/persona/tone) + rotas + handoff
 * triggers do template. Status sempre `'testing'`. Cria versão v1 inicial
 * com o trio default.
 */
export function applyCreateAgent(
  agents: Agent[],
  input: CreateAgentInput,
  template: AgentTemplate | undefined,
  idGen: () => string,
  routeIdGen: () => string,
  triggerIdGen: () => string,
  versionIdGen: () => string,
  workspaceId: string,
  now: string = new Date().toISOString(),
): { agents: Agent[]; created: Agent } {
  const id = idGen();
  const tpl = template;

  const routes: AgentRoute[] = (tpl?.defaultRoutes ?? []).map((r) => ({
    id: routeIdGen(),
    kind: r.kind,
    value: r.value,
    createdAt: now,
  }));

  const handoffTriggers: HandoffTrigger[] = (tpl?.defaultHandoffTriggers ?? []).map((t) => ({
    id: triggerIdGen(),
    kind: t.kind,
    enabled: t.enabled,
    config: t.config,
  }));

  const v1: AgentVersion = {
    id: versionIdGen(),
    agentId: id,
    versionNumber: 1,
    prompt: tpl?.defaultPrompt ?? '',
    persona: tpl?.defaultPersona ?? '',
    tone: tpl?.defaultTone ?? 'consultivo',
    createdBy: 'Você',
    notes: tpl ? `Versão inicial — template ${tpl.label}` : 'Versão inicial — em branco',
    createdAt: now,
  };

  const created: Agent = {
    id,
    workspaceId,
    name: input.name,
    avatarEmoji: input.avatarEmoji ?? tpl?.defaultAvatarEmoji,
    status: 'testing',
    templateKey: input.templateKey,
    prompt: v1.prompt,
    persona: v1.persona,
    tone: v1.tone,
    routes,
    handoffTriggers,
    versions: [v1],
    currentVersionId: v1.id,
    metrics: {
      totalConversations: 0,
      resolutionRate: 0,
      avgResponseTimeSec: 0,
      inferredSatisfaction: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  return { agents: [created, ...agents], created };
}

/**
 * Patch leve do agente (name/avatar/prompt/persona/tone/status). Mudanças
 * em routes/handoff/kb passam por mutações dedicadas. **Não cria versão**
 * automaticamente — o draft fica em memória e só vira versão quando o
 * usuário clica "Salvar versão".
 */
export function applyUpdateAgent(
  agents: Agent[],
  id: string,
  patch: AgentUpdateInput,
  now: string = new Date().toISOString(),
): Agent[] {
  let changed = false;
  const next = agents.map((a) => {
    if (a.id !== id) return a;
    changed = true;
    return {
      ...a,
      ...patch,
      // Garante que `undefined` no patch não sobrescreve valor existente.
      avatarEmoji: patch.avatarEmoji ?? a.avatarEmoji,
      updatedAt: now,
    };
  });
  return changed ? next : agents;
}

/**
 * Alterna `active`↔`paused`. Quando agente está em `testing`, primeira ativação
 * vai pra `active`; segunda vai pra `paused`.
 *
 * **Guard de 3 ativos**: ao tentar virar `'active'`, conta ativos existentes
 * (excluindo o próprio) e bloqueia se já há 3. Retorna `agents` inalterado +
 * `limitReached: true` pra UI mostrar toast.
 */
export function applyToggleStatus(
  agents: Agent[],
  id: string,
  now: string = new Date().toISOString(),
): { agents: Agent[]; limitReached: boolean; previousStatus: AgentStatus | undefined } {
  const target = agents.find((a) => a.id === id);
  if (!target) return { agents, limitReached: false, previousStatus: undefined };

  const nextStatus: AgentStatus = target.status === 'active' ? 'paused' : 'active';

  if (nextStatus === 'active') {
    const activeCount = agents.filter((a) => a.id !== id && a.status === 'active').length;
    if (activeCount >= MAX_ACTIVE_AGENTS) {
      return { agents, limitReached: true, previousStatus: target.status };
    }
  }

  const next = agents.map((a) => (a.id === id ? { ...a, status: nextStatus, updatedAt: now } : a));
  return { agents: next, limitReached: false, previousStatus: target.status };
}

/**
 * Set explícito de status — usado pelo undo do toggle pra restaurar
 * exatamente o status anterior (não o "oposto" do atual). Garante que undo
 * de `testing → active` volte pra `testing`, não caia em `paused` (review
 * HIGH M5#5).
 */
export function applySetStatus(
  agents: Agent[],
  id: string,
  status: AgentStatus,
  now: string = new Date().toISOString(),
): Agent[] {
  const target = agents.find((a) => a.id === id);
  if (!target || target.status === status) return agents;

  // Mesmo guard do toggle — se restaurar pra `'active'` e já há 3 ativos,
  // mantemos paused (não força). Esse caso só acontece se o usuário
  // ativar A, ativar B, ativar C, depois desfazer A — entre as ativações
  // o limite atualiza. Em vez de explodir, o undo vira no-op silencioso.
  if (status === 'active') {
    const activeCount = agents.filter((a) => a.id !== id && a.status === 'active').length;
    if (activeCount >= MAX_ACTIVE_AGENTS) return agents;
  }

  return agents.map((a) => (a.id === id ? { ...a, status, updatedAt: now } : a));
}

/**
 * Duplica agente mantendo nome+" (cópia)". Trio + rotas + triggers clonados
 * com novos IDs; métricas zeradas; status sempre `'testing'`. Cria nova v1.
 */
export function applyDuplicateAgent(
  agents: Agent[],
  id: string,
  idGen: () => string,
  routeIdGen: () => string,
  triggerIdGen: () => string,
  versionIdGen: () => string,
  now: string = new Date().toISOString(),
): { agents: Agent[]; created: Agent | undefined } {
  const original = agents.find((a) => a.id === id);
  if (!original) return { agents, created: undefined };

  const newId = idGen();

  const routes = original.routes.map((r) => ({ ...r, id: routeIdGen(), createdAt: now }));
  const handoffTriggers = original.handoffTriggers.map((t) => ({ ...t, id: triggerIdGen() }));

  const v1: AgentVersion = {
    id: versionIdGen(),
    agentId: newId,
    versionNumber: 1,
    prompt: original.prompt,
    persona: original.persona,
    tone: original.tone,
    createdBy: 'Você',
    notes: `Duplicado de ${original.name}`,
    createdAt: now,
  };

  const cloned: Agent = {
    ...original,
    id: newId,
    name: `${original.name} (cópia)`,
    status: 'testing',
    routes,
    handoffTriggers,
    versions: [v1],
    currentVersionId: v1.id,
    metrics: {
      totalConversations: 0,
      resolutionRate: 0,
      avgResponseTimeSec: 0,
      inferredSatisfaction: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  return { agents: [cloned, ...agents], created: cloned };
}

export function applyDeleteAgent(agents: Agent[], id: string): Agent[] {
  const next = agents.filter((a) => a.id !== id);
  return next.length === agents.length ? agents : next;
}

// ─── Mutações em rotas (operam dentro de um agente) ────────────────────────

export function applyAddRoute(
  agents: Agent[],
  agentId: string,
  input: RouteCreateInput,
  routeIdGen: () => string,
  now: string = new Date().toISOString(),
): { agents: Agent[]; created: AgentRoute | undefined } {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return { agents, created: undefined };

  const created: AgentRoute = {
    id: routeIdGen(),
    kind: input.kind,
    value: input.value.trim(),
    createdAt: now,
  };

  const next = agents.map((a) =>
    a.id !== agentId ? a : { ...a, routes: [...a.routes, created], updatedAt: now },
  );
  return { agents: next, created };
}

export function applyUpdateRoute(
  agents: Agent[],
  agentId: string,
  routeId: string,
  patch: RouteUpdateInput,
  now: string = new Date().toISOString(),
): Agent[] {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return agents;
  const target = agent.routes.find((r) => r.id === routeId);
  if (!target) return agents;

  return agents.map((a) =>
    a.id !== agentId
      ? a
      : {
          ...a,
          routes: a.routes.map((r) =>
            r.id !== routeId
              ? r
              : {
                  ...r,
                  ...patch,
                  // `value` chega trimado do schema, mas patch parcial pode trazer undefined.
                  value: patch.value !== undefined ? patch.value.trim() : r.value,
                },
          ),
          updatedAt: now,
        },
  );
}

export function applyDeleteRoute(
  agents: Agent[],
  agentId: string,
  routeId: string,
  now: string = new Date().toISOString(),
): Agent[] {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return agents;
  const exists = agent.routes.some((r) => r.id === routeId);
  if (!exists) return agents;

  return agents.map((a) =>
    a.id !== agentId
      ? a
      : { ...a, routes: a.routes.filter((r) => r.id !== routeId), updatedAt: now },
  );
}

// ─── Mutações em handoff triggers ──────────────────────────────────────────

/**
 * Atualiza um trigger existente. Triggers nascem com o agente (templates
 * sempre incluem os 6 kinds), então **não** existe `add` separado — o usuário
 * só liga/desliga e ajusta config.
 *
 * Se chamado com `kind` que não existe no array, retorna agents inalterado
 * (no-op silencioso). Em M11 com schema firme, isso vira erro 400.
 */
export function applyUpdateHandoffTrigger(
  agents: Agent[],
  agentId: string,
  kind: HandoffTriggerKind,
  patch: { enabled?: boolean; config?: HandoffTrigger['config'] },
  now: string = new Date().toISOString(),
): Agent[] {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return agents;
  const target = agent.handoffTriggers.find((t) => t.kind === kind);
  if (!target) return agents;

  return agents.map((a) =>
    a.id !== agentId
      ? a
      : {
          ...a,
          handoffTriggers: a.handoffTriggers.map((t) =>
            t.kind !== kind
              ? t
              : {
                  ...t,
                  enabled: patch.enabled ?? t.enabled,
                  config: patch.config !== undefined ? patch.config : t.config,
                },
          ),
          updatedAt: now,
        },
  );
}

// ─── Versionamento ─────────────────────────────────────────────────────────

/**
 * Cria snapshot do trio atual (prompt + persona + tone) como nova versão.
 * `versionNumber` = max + 1. Não modifica o draft em si — apenas registra
 * histórico e atualiza `currentVersionId` pra apontar pra v_new.
 */
export function applySaveVersion(
  agents: Agent[],
  agentId: string,
  notes: string | undefined,
  versionIdGen: () => string,
  now: string = new Date().toISOString(),
): { agents: Agent[]; created: AgentVersion | undefined } {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return { agents, created: undefined };

  const nextNumber = Math.max(0, ...agent.versions.map((v) => v.versionNumber)) + 1;

  const created: AgentVersion = {
    id: versionIdGen(),
    agentId,
    versionNumber: nextNumber,
    prompt: agent.prompt,
    persona: agent.persona,
    tone: agent.tone,
    createdBy: 'Você',
    notes,
    createdAt: now,
  };

  const next = agents.map((a) =>
    a.id !== agentId
      ? a
      : {
          ...a,
          versions: [created, ...a.versions],
          currentVersionId: created.id,
          updatedAt: now,
        },
  );
  return { agents: next, created };
}

/**
 * Restaura uma versão antiga: substitui o draft (prompt/persona/tone) pelos
 * valores da versão. **Não cria versão nova** — pra restaurar é gesto sem
 * efeito colateral. Atualiza `currentVersionId` pra apontar pra versão antiga.
 *
 * Se o usuário editar depois, o draft fica fora de qualquer versão até clicar
 * "Salvar versão" novamente.
 */
export function applyRestoreVersion(
  agents: Agent[],
  agentId: string,
  versionId: string,
  now: string = new Date().toISOString(),
): Agent[] {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return agents;
  const version = agent.versions.find((v) => v.id === versionId);
  if (!version) return agents;

  return agents.map((a) =>
    a.id !== agentId
      ? a
      : {
          ...a,
          prompt: version.prompt,
          persona: version.persona,
          tone: version.tone,
          currentVersionId: version.id,
          updatedAt: now,
        },
  );
}

// ─── Mutações no Cérebro da Empresa ────────────────────────────────────────

export function applyUpdateKbSection(
  kb: KnowledgeBase,
  patch: Partial<Pick<KnowledgeBase, 'about' | 'products' | 'faq' | 'scripts' | 'policy'>>,
  now: string = new Date().toISOString(),
): KnowledgeBase {
  return {
    ...kb,
    about: patch.about ?? kb.about,
    products: patch.products ?? kb.products,
    faq: patch.faq ?? kb.faq,
    scripts: patch.scripts ?? kb.scripts,
    policy: patch.policy ?? kb.policy,
    updatedAt: now,
  };
}

export function applyAddKbFile(
  kb: KnowledgeBase,
  input: { name: string; sizeBytes: number; kind: 'pdf' | 'doc' | 'txt' },
  fileIdGen: () => string,
  now: string = new Date().toISOString(),
): { kb: KnowledgeBase; created: KnowledgeFile } {
  const created: KnowledgeFile = {
    id: fileIdGen(),
    name: input.name,
    sizeBytes: input.sizeBytes,
    kind: input.kind,
    // No mock o status já chega `'processed'` — o `'processing'` é puramente
    // visual no componente Upload (setTimeout de 1.5s antes de chamar a mutação).
    status: 'processed',
    uploadedAt: now,
  };
  return { kb: { ...kb, files: [created, ...kb.files], updatedAt: now }, created };
}

export function applyDeleteKbFile(
  kb: KnowledgeBase,
  fileId: string,
  now: string = new Date().toISOString(),
): KnowledgeBase {
  const exists = kb.files.some((f) => f.id === fileId);
  if (!exists) return kb;
  return { ...kb, files: kb.files.filter((f) => f.id !== fileId), updatedAt: now };
}

// ─── Filtros / queries puras ──────────────────────────────────────────────

export interface AgentFilters {
  status?: AgentStatus;
  /** Busca em `name` e `persona` (case-insensitive). */
  search?: string;
}

export function filterAgents(agents: Agent[], filters: AgentFilters = {}): Agent[] {
  const search = filters.search?.trim().toLowerCase();
  return agents.filter((a) => {
    if (filters.status && a.status !== filters.status) return false;
    if (search) {
      const haystack = `${a.name} ${a.persona}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

// ─── Roteamento ────────────────────────────────────────────────────────────

/**
 * Contexto da conversa pra resolver qual agente atende. Em M11 vira shape
 * real consumido pela Edge Function de roteamento.
 */
export interface RouteMatchContext {
  stageId?: string;
  tags?: string[];
  whatsappNumber?: string;
  /** Texto da mensagem pra match `keyword`. Case-insensitive. */
  message?: string;
}

/**
 * Encontra o **primeiro** agente cujo `routes[]` matcha o contexto, na ordem
 * em que aparecem em `agents` (UI exibe "primeiro hit decide").
 *
 * Comportamento por kind:
 *  - `stage` → `route.value === ctx.stageId`
 *  - `tag` → `ctx.tags?.includes(route.value)`
 *  - `whatsapp_number` → `route.value === ctx.whatsappNumber`
 *  - `keyword` → `ctx.message?.toLowerCase().includes(route.value.toLowerCase())`
 *
 * Agentes em `'paused'`/`'testing'` são pulados — só `'active'` matcham.
 * Sem match → retorna `undefined`.
 */
export function getNextRouteMatch(agents: Agent[], ctx: RouteMatchContext): Agent | undefined {
  for (const agent of agents) {
    if (agent.status !== 'active') continue;
    for (const route of agent.routes) {
      if (matchRoute(route, ctx)) return agent;
    }
  }
  return undefined;
}

function matchRoute(route: AgentRoute, ctx: RouteMatchContext): boolean {
  switch (route.kind) {
    case 'stage':
      return ctx.stageId === route.value;
    case 'tag':
      return ctx.tags?.includes(route.value) ?? false;
    case 'whatsapp_number':
      return ctx.whatsappNumber === route.value;
    case 'keyword': {
      if (!ctx.message) return false;
      return ctx.message.toLowerCase().includes(route.value.toLowerCase());
    }
    default: {
      // Exhaustive — TS deve ter pego acima, mas fail-safe.
      const _never: never = route.kind;
      return _never;
    }
  }
}

// ─── Agregações ────────────────────────────────────────────────────────────

export interface AgentCounts {
  total: number;
  active: number;
  paused: number;
  testing: number;
  totalConversations: number;
}

export function countAgents(agents: Agent[]): AgentCounts {
  return {
    total: agents.length,
    active: agents.filter((a) => a.status === 'active').length,
    paused: agents.filter((a) => a.status === 'paused').length,
    testing: agents.filter((a) => a.status === 'testing').length,
    totalConversations: agents.reduce((sum, a) => sum + a.metrics.totalConversations, 0),
  };
}

/**
 * Lista de RouteKind exposta pro UI iterar (Select de kind no editor).
 * Mantida em sync com o tipo via `satisfies`.
 */
export const ROUTE_KIND_OPTIONS: ReadonlyArray<{ kind: RouteKind; label: string }> = [
  { kind: 'stage', label: 'Etapa do funil' },
  { kind: 'tag', label: 'Tag do lead' },
  { kind: 'whatsapp_number', label: 'Número do WhatsApp' },
  { kind: 'keyword', label: 'Palavra-chave' },
];
