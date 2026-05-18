/**
 * Smoke test de Agentes IA (M11#1 + M11#3) — valida contratos puros do
 * domínio: enums DB, audit actions, schemas Zod, helpers puros, transforms
 * (countAgents, getNextRouteMatch), templates, e `buildSystemPrompt`.
 *
 * **Zero hit em DB e em API externa.** Funções puras + import de enums do
 * Prisma client gerado. Lifecycle real (criar agente, mandar mensagem na
 * simulation) fica em validação manual via UI ou em E2E Playwright (M13).
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/agents` → JSON.
 * HTTP 200 se `failed === 0`, 500 caso contrário.
 */
import { NextResponse } from 'next/server';

import {
  AgentRouteKind,
  AgentSessionKind,
  AgentStatus,
  AgentTone,
  AuditAction,
  KnowledgeDocKind,
  KnowledgeDocStatus,
  KnowledgeSourceKind,
} from '@papopro/db';

import {
  AGENT_STATUSES,
  HANDOFF_TRIGGER_KINDS,
  ROUTE_KINDS,
  agentCreateSchema,
  agentUpdateSchema,
  handoffTriggerUpdateSchema,
  kbUpdateSchema,
  routeCreateSchema,
  versionCreateSchema,
} from '@/features/agents/schemas';
import { countAgents, getNextRouteMatch } from '@/features/agents/transforms';
import type { Agent } from '@/features/agents/types';
import { buildSystemPrompt } from '@/lib/ai/build-system-prompt';
import { AGENT_TEMPLATES, getAgentTemplate } from '@/lib/fixtures/agent-templates';

interface CheckResult {
  group: string;
  name: string;
  ok: boolean;
  detail?: string;
}

function run(group: string, results: CheckResult[]) {
  return (name: string, fn: () => boolean | string) => {
    try {
      const r = fn();
      if (r === true) results.push({ group, name, ok: true });
      else
        results.push({
          group,
          name,
          ok: false,
          detail: typeof r === 'string' ? r : 'returned false',
        });
    } catch (err) {
      results.push({ group, name, ok: false, detail: (err as Error).message });
    }
  };
}

/**
 * Constrói um agente "vazio" mínimo pra testar transforms puras
 * (countAgents, getNextRouteMatch) sem depender de fixtures.
 */
function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: overrides.id ?? 'agt_test_00001',
    workspaceId: overrides.workspaceId ?? 'ws_demo',
    name: overrides.name ?? 'Test',
    status: overrides.status ?? 'testing',
    prompt: overrides.prompt ?? 'Você é um agente de teste com prompt longo o suficiente.',
    persona: overrides.persona ?? '',
    tone: overrides.tone ?? 'consultivo',
    routes: overrides.routes ?? [],
    handoffTriggers: overrides.handoffTriggers ?? [],
    versions: overrides.versions ?? [
      {
        id: 'ver_test_00001',
        agentId: overrides.id ?? 'agt_test_00001',
        versionNumber: 1,
        prompt: 'p'.repeat(30),
        persona: '',
        tone: 'consultivo',
        createdBy: 'Você',
        createdAt: 'now',
      },
    ],
    currentVersionId: overrides.currentVersionId ?? 'ver_test_00001',
    metrics: overrides.metrics ?? {
      totalConversations: 0,
      resolutionRate: 0,
      avgResponseTimeSec: 0,
      inferredSatisfaction: 0,
    },
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

export const dynamic = 'force-dynamic';

export function GET() {
  const results: CheckResult[] = [];

  // ── M11#1: Enums Prisma ─────────────────────────────────────────────────
  let t = run('db-enums-m11', results);
  t('AgentStatus tem 3 values (testing/active/paused)', () => {
    const vals = Object.values(AgentStatus).sort();
    return JSON.stringify(vals) === JSON.stringify(['active', 'paused', 'testing']);
  });
  t('AgentTone tem 4 values', () => {
    const vals = Object.values(AgentTone).sort();
    return JSON.stringify(vals) === JSON.stringify(['amigavel', 'consultivo', 'direto', 'formal']);
  });
  t('AgentRouteKind tem 4 values', () => {
    const vals = Object.values(AgentRouteKind).sort();
    return JSON.stringify(vals) === JSON.stringify(['keyword', 'stage', 'tag', 'whatsapp_number']);
  });
  t('AgentSessionKind tem 2 values (production/simulation)', () => {
    const vals = Object.values(AgentSessionKind).sort();
    return JSON.stringify(vals) === JSON.stringify(['production', 'simulation']);
  });
  t('KnowledgeSourceKind tem 2 values', () => {
    const vals = Object.values(KnowledgeSourceKind).sort();
    return JSON.stringify(vals) === JSON.stringify(['document', 'structured_field']);
  });
  t('KnowledgeDocStatus tem 4 values', () => {
    const vals = Object.values(KnowledgeDocStatus).sort();
    return (
      JSON.stringify(vals) === JSON.stringify(['failed', 'processed', 'processing', 'uploading'])
    );
  });
  t('KnowledgeDocKind tem 5 values', () => {
    const vals = Object.values(KnowledgeDocKind).sort();
    return JSON.stringify(vals) === JSON.stringify(['doc', 'docx', 'md', 'pdf', 'txt']);
  });
  t('AgentStatus DB casa com AGENT_STATUSES da UI', () => {
    const ui = [...AGENT_STATUSES].sort();
    const db = Object.values(AgentStatus).sort();
    return JSON.stringify(ui) === JSON.stringify(db);
  });
  t('AgentRouteKind DB casa com ROUTE_KINDS da UI', () => {
    const ui = [...ROUTE_KINDS].sort();
    const db = Object.values(AgentRouteKind).sort();
    return JSON.stringify(ui) === JSON.stringify(db);
  });

  // ── M11#1: AuditAction values ───────────────────────────────────────────
  t = run('audit-actions-m11', results);
  const M11_AUDIT_ACTIONS = [
    'agent_created',
    'agent_version_saved',
    'agent_activated',
    'agent_paused',
    'agent_deleted',
    'handoff_triggered',
    'knowledge_doc_uploaded',
    'knowledge_doc_processed',
  ] as const;
  for (const action of M11_AUDIT_ACTIONS) {
    t(`AuditAction.${action} existe`, () => {
      return Object.values(AuditAction).includes(action as AuditAction);
    });
  }

  // ── M11#1: handoff_config shape ─────────────────────────────────────────
  t = run('db-handoff-config-shape-m11', results);
  t('HANDOFF_TRIGGER_KINDS tem 6 valores', () => HANDOFF_TRIGGER_KINDS.length === 6);
  t('HANDOFF_TRIGGER_KINDS cobre os 6 esperados', () => {
    const expected = [
      'agent_to_agent',
      'commercial_intent',
      'keyword',
      'manual',
      'outside_business_hours',
      'stage_negotiation',
    ];
    return JSON.stringify([...HANDOFF_TRIGGER_KINDS].sort()) === JSON.stringify(expected);
  });

  // ── Templates (seed pra createAgentAction) ──────────────────────────────
  t = run('templates', results);
  t('AGENT_TEMPLATES tem 4 templates', () => AGENT_TEMPLATES.length === 4);
  t('keys são únicos', () => {
    const keys = AGENT_TEMPLATES.map((tpl) => tpl.key);
    return new Set(keys).size === keys.length;
  });
  t('templates não-blank têm prompt ≥ 50 chars', () => {
    const offender = AGENT_TEMPLATES.find(
      (tpl) => tpl.key !== 'blank' && tpl.defaultPrompt.length < 50,
    );
    return !offender || `template ${offender.key} prompt curto`;
  });
  t('"blank" tem prompt vazio', () => {
    const blank = AGENT_TEMPLATES.find((tpl) => tpl.key === 'blank');
    return blank?.defaultPrompt === '';
  });
  t('todo template tem 6 handoff triggers default', () => {
    const expected = new Set(HANDOFF_TRIGGER_KINDS);
    const offender = AGENT_TEMPLATES.find(
      (tpl) =>
        tpl.defaultHandoffTriggers.length !== 6 ||
        !tpl.defaultHandoffTriggers.every((h) => expected.has(h.kind)),
    );
    return !offender || `template ${offender.key} triggers incompletos`;
  });
  t('getAgentTemplate("recovery") retorna o template certo', () => {
    return getAgentTemplate('recovery')?.key === 'recovery';
  });

  // ── Transforms puras (countAgents, getNextRouteMatch) ───────────────────
  t = run('transforms-pure', results);
  t('countAgents([]) zerado', () => {
    const c = countAgents([]);
    return c.total === 0 && c.active === 0 && c.paused === 0 && c.testing === 0;
  });
  t('countAgents soma status corretamente', () => {
    const agents = [
      makeAgent({ id: 'a1', status: 'active' }),
      makeAgent({ id: 'a2', status: 'paused' }),
      makeAgent({ id: 'a3', status: 'testing' }),
      makeAgent({ id: 'a4', status: 'active' }),
    ];
    const c = countAgents(agents);
    return c.active === 2 && c.paused === 1 && c.testing === 1 && c.total === 4;
  });
  t('getNextRouteMatch([]) retorna undefined', () => {
    return getNextRouteMatch([], { stageId: 'novo' }) === undefined;
  });
  t('getNextRouteMatch retorna primeiro hit', () => {
    const a1 = makeAgent({
      id: 'agt_a',
      status: 'active',
      routes: [{ id: 'r1', kind: 'stage', value: 'novo', createdAt: 'now' }],
    });
    const a2 = makeAgent({
      id: 'agt_b',
      status: 'active',
      routes: [{ id: 'r2', kind: 'stage', value: 'novo', createdAt: 'now' }],
    });
    const r = getNextRouteMatch([a1, a2], { stageId: 'novo' });
    return r?.id === 'agt_a';
  });
  t('getNextRouteMatch ignora agentes não-ativos', () => {
    const paused = makeAgent({
      id: 'agt_paused',
      status: 'paused',
      routes: [{ id: 'r1', kind: 'stage', value: 'novo', createdAt: 'now' }],
    });
    return getNextRouteMatch([paused], { stageId: 'novo' }) === undefined;
  });

  // ── Schemas Zod (M11#3 Server Actions validam por essas) ────────────────
  t = run('schemas', results);
  t('agentCreateSchema aceita input válido', () => {
    return agentCreateSchema.safeParse({ name: 'Sofia', templateKey: 'qualification' }).success;
  });
  t('agentCreateSchema rejeita name curto', () => {
    return !agentCreateSchema.safeParse({ name: 'a', templateKey: 'blank' }).success;
  });
  t('agentCreateSchema rejeita templateKey inválido', () => {
    return !agentCreateSchema.safeParse({ name: 'X', templateKey: 'unknown' }).success;
  });
  t('agentUpdateSchema rejeita prompt curto', () => {
    return !agentUpdateSchema.safeParse({ prompt: 'oi' }).success;
  });
  t('agentUpdateSchema rejeita tone inválido', () => {
    return !agentUpdateSchema.safeParse({ tone: 'sarcastico' }).success;
  });
  t('routeCreateSchema rejeita kind desconhecido', () => {
    return !routeCreateSchema.safeParse({ kind: 'unknown', value: 'x' }).success;
  });
  t('routeCreateSchema rejeita value vazio', () => {
    return !routeCreateSchema.safeParse({ kind: 'tag', value: '   ' }).success;
  });
  t('handoffTriggerUpdateSchema aceita config keywords', () => {
    return handoffTriggerUpdateSchema.safeParse({
      kind: 'keyword',
      enabled: true,
      config: { keywords: ['humano', 'atendente'] },
    }).success;
  });
  t('versionCreateSchema aceita notes opcional', () => {
    return versionCreateSchema.safeParse({}).success;
  });
  t('versionCreateSchema rejeita notes longas (>240)', () => {
    return !versionCreateSchema.safeParse({ notes: 'x'.repeat(241) }).success;
  });
  t('kbUpdateSchema aceita seções vazias', () => {
    return kbUpdateSchema.safeParse({ about: '', products: '' }).success;
  });
  t('mensagens em pt-BR (sem vazar "Required")', () => {
    const r = agentCreateSchema.safeParse({});
    if (r.success) return 'should have failed';
    const msgs = JSON.stringify(r.error.issues);
    return !msgs.includes('Required') && !msgs.includes('String must');
  });

  // ── M11#3: build-system-prompt helper ───────────────────────────────────
  t = run('build-system-prompt-m11-3', results);
  t('buildSystemPrompt retorna string não-vazia', () => {
    const s = buildSystemPrompt({ name: 'Sofia', persona: '', prompt: '', tone: 'consultivo' });
    return typeof s === 'string' && s.length > 50;
  });
  t('buildSystemPrompt inclui nome do agente', () => {
    return buildSystemPrompt({
      name: 'Sofia',
      persona: '',
      prompt: '',
      tone: 'consultivo',
    }).includes('Sofia');
  });
  t('buildSystemPrompt inclui descrição do tom', () => {
    const s = buildSystemPrompt({ name: 'X', persona: '', prompt: '', tone: 'consultivo' });
    return s.includes('consultivo') && s.includes('Tom de voz');
  });
  t('buildSystemPrompt varia output por tom', () => {
    const a = buildSystemPrompt({ name: 'X', persona: '', prompt: '', tone: 'consultivo' });
    const b = buildSystemPrompt({ name: 'X', persona: '', prompt: '', tone: 'direto' });
    return a !== b;
  });
  t('buildSystemPrompt inclui persona quando passada', () => {
    const s = buildSystemPrompt({
      name: 'X',
      persona: 'Vendedor experiente em imobiliário',
      prompt: '',
      tone: 'amigavel',
    });
    return s.includes('Vendedor experiente em imobiliário') && s.includes('persona');
  });
  t('buildSystemPrompt omite persona vazia', () => {
    const s = buildSystemPrompt({ name: 'X', persona: '   ', prompt: '', tone: 'formal' });
    return !s.includes('**Sua persona:**');
  });
  t('buildSystemPrompt inclui prompt configurado', () => {
    const s = buildSystemPrompt({
      name: 'X',
      persona: '',
      prompt: 'Você ajuda leads a escolher imóveis em SP.',
      tone: 'consultivo',
    });
    return s.includes('ajuda leads a escolher imóveis');
  });
  t('buildSystemPrompt sempre inclui guardrails fixos pt-BR', () => {
    const s = buildSystemPrompt({ name: 'X', persona: '', prompt: '', tone: 'consultivo' });
    return (
      s.includes('português brasileiro') &&
      s.includes('Diretrizes gerais') &&
      s.includes('knowledge-base')
    );
  });
  t('buildSystemPrompt aceita workspaceName opcional', () => {
    const s = buildSystemPrompt({
      name: 'X',
      persona: '',
      prompt: '',
      tone: 'consultivo',
      workspaceName: 'Imobiliária Foo',
    });
    return s.includes('Imobiliária Foo');
  });
  t('buildSystemPrompt cobre os 4 tons sem crash', () => {
    const tones = ['consultivo', 'amigavel', 'direto', 'formal'] as const;
    for (const tone of tones) {
      const s = buildSystemPrompt({ name: 'X', persona: '', prompt: '', tone });
      if (typeof s !== 'string' || s.length < 50) return `tone=${tone} produced bad output`;
    }
    return true;
  });

  // ── Summary ─────────────────────────────────────────────────────────────
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const failed = total - passed;
  return NextResponse.json(
    {
      summary: { total, passed, failed, allOk: failed === 0 },
      results,
    },
    { status: failed === 0 ? 200 : 500 },
  );
}
