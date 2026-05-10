'use client';

import * as React from 'react';

import { getAgentTemplate } from '@/lib/fixtures/agent-templates';
import { FAKE_AGENTS } from '@/lib/fixtures/agents';
import { FAKE_KNOWLEDGE_BASE } from '@/lib/fixtures/knowledge-base';

import type {
  AgentCreateInput,
  AgentUpdateInput,
  HandoffTriggerUpdateInput,
  KbFileUploadInput,
  KbUpdateInput,
  RouteCreateInput,
  RouteUpdateInput,
  VersionCreateInput,
} from './schemas';
import {
  applyAddKbFile,
  applyAddRoute,
  applyCreateAgent,
  applyDeleteAgent,
  applyDeleteKbFile,
  applyDeleteRoute,
  applyDuplicateAgent,
  applyRestoreVersion,
  applySaveVersion,
  applySetStatus,
  applyToggleStatus,
  applyUpdateAgent,
  applyUpdateHandoffTrigger,
  applyUpdateKbSection,
  applyUpdateRoute,
} from './transforms';
import type {
  Agent,
  AgentRoute,
  AgentStatus,
  AgentVersion,
  KnowledgeBase,
  KnowledgeFile,
} from './types';

/**
 * Store in-memory client-side de Agentes IA — mesmo padrão de
 * `features/cadences/store.ts` e `features/tasks/store.ts`. Toda lógica de
 * mutação vive nas transforms puras (testáveis sem React); este arquivo
 * só gerencia snapshot + listeners + counters de ID.
 *
 * **Dois snapshots independentes**: agentes e Cérebro da Empresa. Eles
 * mudam em frequências diferentes e UIs distintas (lista de agentes vs aba
 * Cérebro), então separá-los evita re-render desnecessário (mudou prompt
 * do agente Sofia, aba Cérebro não rerenderiza).
 *
 * Em M11 cada mutação vira Server Action com input validado por Zod;
 * `useAgents` migra pra TanStack Query (`useQuery`) sem mudar a API
 * pública dos hooks.
 *
 * Workspace fixo `'ws_demo'` na criação — em M7 lê do contexto de auth.
 */

const WORKSPACE_ID = 'ws_demo';

// ─── Snapshots ─────────────────────────────────────────────────────────────

let agentsState: Agent[] = [...FAKE_AGENTS];
const agentListeners = new Set<() => void>();

function emitAgents() {
  for (const fn of agentListeners) fn();
}

function subscribeAgents(fn: () => void) {
  agentListeners.add(fn);
  return () => agentListeners.delete(fn);
}

function getAgentsSnapshot() {
  return agentsState;
}

function getAgentsServerSnapshot() {
  return FAKE_AGENTS;
}

let kbState: KnowledgeBase = FAKE_KNOWLEDGE_BASE;
const kbListeners = new Set<() => void>();

function emitKb() {
  for (const fn of kbListeners) fn();
}

function subscribeKb(fn: () => void) {
  kbListeners.add(fn);
  return () => kbListeners.delete(fn);
}

function getKbSnapshot() {
  return kbState;
}

function getKbServerSnapshot() {
  return FAKE_KNOWLEDGE_BASE;
}

// ─── Hooks de leitura ──────────────────────────────────────────────────────

export function useAgents(): Agent[] {
  return React.useSyncExternalStore(subscribeAgents, getAgentsSnapshot, getAgentsServerSnapshot);
}

export function useAgent(id: string): Agent | undefined {
  const all = useAgents();
  return React.useMemo(() => all.find((a) => a.id === id), [all, id]);
}

export function useKnowledgeBase(): KnowledgeBase {
  return React.useSyncExternalStore(subscribeKb, getKbSnapshot, getKbServerSnapshot);
}

// ─── ID generators ────────────────────────────────────────────────────────

/**
 * Counters começam acima do tamanho da fixture pra evitar colisão com IDs
 * já materializados em `FAKE_AGENTS` (que segue padrão `agt_NNNNN`,
 * `route_NNNNN`, `htg_NNNNN`, `ver_NNNNN`).
 */
let agentCounter = agentsState.length;
function nextAgentId(): string {
  agentCounter += 1;
  return `agt_${agentCounter.toString().padStart(5, '0')}`;
}

let routeCounter = agentsState.reduce((sum, a) => sum + a.routes.length, 0);
function nextRouteId(): string {
  routeCounter += 1;
  return `route_${routeCounter.toString().padStart(5, '0')}`;
}

let triggerCounter = agentsState.reduce((sum, a) => sum + a.handoffTriggers.length, 0);
function nextTriggerId(): string {
  triggerCounter += 1;
  return `htg_${triggerCounter.toString().padStart(5, '0')}`;
}

let versionCounter = agentsState.reduce((sum, a) => sum + a.versions.length, 0);
function nextVersionId(): string {
  versionCounter += 1;
  return `ver_${versionCounter.toString().padStart(5, '0')}`;
}

let fileCounter = kbState.files.length;
function nextFileId(): string {
  fileCounter += 1;
  return `kbf_${fileCounter.toString().padStart(5, '0')}`;
}

// ─── Mutações (agente) ─────────────────────────────────────────────────────

export function createAgent(input: AgentCreateInput): Agent {
  const template = getAgentTemplate(input.templateKey);
  const { agents, created } = applyCreateAgent(
    agentsState,
    input,
    template,
    nextAgentId,
    nextRouteId,
    nextTriggerId,
    nextVersionId,
    WORKSPACE_ID,
  );
  agentsState = agents;
  emitAgents();
  return created;
}

export function updateAgent(id: string, patch: AgentUpdateInput): Agent | undefined {
  const next = applyUpdateAgent(agentsState, id, patch);
  if (next === agentsState) return undefined;
  agentsState = next;
  emitAgents();
  return agentsState.find((a) => a.id === id);
}

/**
 * Toggle ativo/pausado com guard de 3 ativos.
 *
 * Retorno indica:
 *  - `agent`: estado atual (após transição, se aplicada)
 *  - `limitReached`: se o limite Pro IA bloqueou a transição
 *  - `previousStatus`: status que estava antes do toggle (`undefined` se
 *    agente não existe). Usado pelo undo pra restaurar exatamente o estado
 *    anterior (não o "oposto" do atual) — review HIGH M5#5.
 */
export function toggleAgentStatus(id: string): {
  agent: Agent | undefined;
  limitReached: boolean;
  previousStatus: AgentStatus | undefined;
} {
  const r = applyToggleStatus(agentsState, id);
  if (r.limitReached) {
    return {
      agent: agentsState.find((a) => a.id === id),
      limitReached: true,
      previousStatus: r.previousStatus,
    };
  }
  if (r.agents === agentsState) {
    return { agent: undefined, limitReached: false, previousStatus: undefined };
  }
  agentsState = r.agents;
  emitAgents();
  return {
    agent: agentsState.find((a) => a.id === id),
    limitReached: false,
    previousStatus: r.previousStatus,
  };
}

/**
 * Set explícito de status — usado pelo undo do toggle pra restaurar o status
 * exato anterior (`'testing'`/`'paused'`/`'active'`).
 */
export function setAgentStatus(id: string, status: AgentStatus): Agent | undefined {
  const next = applySetStatus(agentsState, id, status);
  if (next === agentsState) return undefined;
  agentsState = next;
  emitAgents();
  return agentsState.find((a) => a.id === id);
}

export function duplicateAgent(id: string): Agent | undefined {
  const r = applyDuplicateAgent(
    agentsState,
    id,
    nextAgentId,
    nextRouteId,
    nextTriggerId,
    nextVersionId,
  );
  if (!r.created) return undefined;
  agentsState = r.agents;
  emitAgents();
  return r.created;
}

export function deleteAgent(id: string): boolean {
  const next = applyDeleteAgent(agentsState, id);
  if (next === agentsState) return false;
  agentsState = next;
  emitAgents();
  return true;
}

// ─── Mutações (rotas) ──────────────────────────────────────────────────────

export function addRoute(agentId: string, input: RouteCreateInput): AgentRoute | undefined {
  const r = applyAddRoute(agentsState, agentId, input, nextRouteId);
  if (!r.created) return undefined;
  agentsState = r.agents;
  emitAgents();
  return r.created;
}

export function updateRoute(
  agentId: string,
  routeId: string,
  patch: RouteUpdateInput,
): AgentRoute | undefined {
  const next = applyUpdateRoute(agentsState, agentId, routeId, patch);
  if (next === agentsState) return undefined;
  agentsState = next;
  emitAgents();
  return agentsState.find((a) => a.id === agentId)?.routes.find((r) => r.id === routeId);
}

export function deleteRoute(agentId: string, routeId: string): boolean {
  const next = applyDeleteRoute(agentsState, agentId, routeId);
  if (next === agentsState) return false;
  agentsState = next;
  emitAgents();
  return true;
}

// ─── Mutações (handoff triggers) ───────────────────────────────────────────

export function updateHandoffTrigger(agentId: string, patch: HandoffTriggerUpdateInput): boolean {
  const next = applyUpdateHandoffTrigger(agentsState, agentId, patch.kind, {
    enabled: patch.enabled,
    config: patch.config,
  });
  if (next === agentsState) return false;
  agentsState = next;
  emitAgents();
  return true;
}

// ─── Mutações (versionamento) ──────────────────────────────────────────────

export function saveVersion(agentId: string, input: VersionCreateInput): AgentVersion | undefined {
  const r = applySaveVersion(agentsState, agentId, input.notes, nextVersionId);
  if (!r.created) return undefined;
  agentsState = r.agents;
  emitAgents();
  return r.created;
}

export function restoreVersion(agentId: string, versionId: string): boolean {
  const next = applyRestoreVersion(agentsState, agentId, versionId);
  if (next === agentsState) return false;
  agentsState = next;
  emitAgents();
  return true;
}

// ─── Mutações (Cérebro da Empresa) ─────────────────────────────────────────

export function updateKbSection(patch: KbUpdateInput): KnowledgeBase {
  kbState = applyUpdateKbSection(kbState, patch);
  emitKb();
  return kbState;
}

export function addKbFile(input: KbFileUploadInput): KnowledgeFile {
  const r = applyAddKbFile(kbState, input, nextFileId);
  kbState = r.kb;
  emitKb();
  return r.created;
}

export function deleteKbFile(fileId: string): boolean {
  const next = applyDeleteKbFile(kbState, fileId);
  if (next === kbState) return false;
  kbState = next;
  emitKb();
  return true;
}
