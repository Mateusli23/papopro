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
import {
  compareRulesForRouting,
  matchesKeyword,
  pickAgentForInbound,
  type RoutingRuleInput,
} from '@/lib/ai/router';
import { AGENT_TEMPLATES, getAgentTemplate } from '@/lib/fixtures/agent-templates';
import { chunkText, estimateTokens } from '@/lib/knowledge/chunking';

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

  // ── M11#4: chunking helper ──────────────────────────────────────────────
  t = run('chunking-m11-4', results);

  t('chunkText vazio retorna []', () => chunkText('').length === 0);
  t('chunkText apenas whitespace retorna []', () => chunkText('   \n\n\t  ').length === 0);

  t('chunkText texto pequeno retorna 1 chunk', () => {
    const chunks = chunkText('Texto curto que cabe num chunk só.');
    return chunks.length === 1 && chunks[0]?.content.includes('Texto curto') === true;
  });

  t('chunkText respeita target chars com texto grande', () => {
    // Texto de 10k chars com parágrafos. Target=2800 → 3-4 chunks esperados.
    const para = 'a'.repeat(500);
    const text = Array(20).fill(para).join('\n\n');
    const chunks = chunkText(text);
    return (
      chunks.length >= 3 && chunks.length <= 6 && chunks.every((c) => c.content.length <= 8000)
    );
  });

  t('chunkText preserva ordem (chunkIndex sequencial)', () => {
    const text = Array(10).fill('Parágrafo de teste com algum conteúdo.'.repeat(50)).join('\n\n');
    const chunks = chunkText(text);
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i]?.chunkIndex !== i) return `chunkIndex[${i}] = ${chunks[i]?.chunkIndex}`;
    }
    return true;
  });

  t('chunkText respeita maxChars hard cap (8000)', () => {
    // Texto monolítico sem parágrafos nem sentenças → cai em char split.
    const text = 'x'.repeat(20000);
    const chunks = chunkText(text);
    return chunks.every((c) => c.content.length <= 8000);
  });

  t('chunkText adiciona overlap entre chunks consecutivos (default)', () => {
    const para1 = 'AAAA'.repeat(750); // ~3000 chars
    const para2 = 'BBBB'.repeat(750);
    const chunks = chunkText(`${para1}\n\n${para2}`);
    if (chunks.length < 2) return `só ${chunks.length} chunks — não dá pra testar overlap`;
    // Segundo chunk deve começar com tail do primeiro (AAAA...) antes do BBBB.
    const second = chunks[1]?.content ?? '';
    return second.startsWith('AAAA') || `second starts with "${second.slice(0, 8)}"`;
  });

  t('chunkText overlapChars=0 desliga overlap', () => {
    const para1 = 'A'.repeat(3000);
    const para2 = 'B'.repeat(3000);
    const chunks = chunkText(`${para1}\n\n${para2}`, { overlapChars: 0 });
    if (chunks.length < 2) return 'esperado 2+ chunks';
    return chunks[1]?.content.startsWith('B') === true;
  });

  t('chunkText preenche tokens estimados', () => {
    const chunks = chunkText('Texto pra estimar tokens. '.repeat(50));
    return chunks.every((c) => c.tokens > 0 && c.tokens < c.content.length);
  });

  t('estimateTokens retorna ~chars/4', () => {
    // 100 chars → ~25 tokens.
    const tokens = estimateTokens('a'.repeat(100));
    return tokens === 25;
  });

  t('chunkText texto com parágrafos curtos consolida no mesmo chunk', () => {
    const text = 'Curto 1.\n\nCurto 2.\n\nCurto 3.\n\nCurto 4.\n\nCurto 5.';
    const chunks = chunkText(text);
    // Todos os parágrafos curtos cabem num chunk só (target=2800).
    return (
      chunks.length === 1 &&
      chunks[0]?.content.includes('Curto 1') === true &&
      chunks[0]?.content.includes('Curto 5') === true
    );
  });

  // ── M11#5: router runtime (pure) ────────────────────────────────────────
  t = run('router-m11-5', results);

  // Helper pra montar RoutingRuleInput rapidamente nos testes.
  const makeRule = (overrides: Partial<RoutingRuleInput> = {}): RoutingRuleInput => ({
    ruleId: overrides.ruleId ?? 'rl_test_00001',
    agentId: overrides.agentId ?? 'agt_test_00001',
    agentCreatedAt: overrides.agentCreatedAt ?? new Date('2026-01-01T00:00:00Z'),
    kind: overrides.kind ?? 'stage',
    value: overrides.value ?? 'novo',
    priority: overrides.priority ?? 0,
    ruleCreatedAt: overrides.ruleCreatedAt ?? new Date('2026-01-01T00:00:00Z'),
  });

  t('pickAgentForInbound retorna null sem regras', () => {
    return pickAgentForInbound([], { leadStageId: 'novo' }) === null;
  });

  t('pickAgentForInbound match exato em stage', () => {
    const r = pickAgentForInbound([makeRule({ kind: 'stage', value: 'novo' })], {
      leadStageId: 'novo',
    });
    return r?.ruleKind === 'stage' && r?.value === 'novo';
  });

  t('pickAgentForInbound não casa stage diferente', () => {
    const r = pickAgentForInbound([makeRule({ kind: 'stage', value: 'novo' })], {
      leadStageId: 'contato',
    });
    return r === null;
  });

  t('pickAgentForInbound match em tag presente', () => {
    const r = pickAgentForInbound([makeRule({ kind: 'tag', value: 'vip' })], {
      leadTags: ['vip', 'urgente'],
    });
    return r?.ruleKind === 'tag' && r?.value === 'vip';
  });

  t('pickAgentForInbound tag ausente não casa', () => {
    const r = pickAgentForInbound([makeRule({ kind: 'tag', value: 'vip' })], {
      leadTags: ['normal'],
    });
    return r === null;
  });

  t('pickAgentForInbound tags vazias / undefined não crashea', () => {
    const r1 = pickAgentForInbound([makeRule({ kind: 'tag', value: 'vip' })], { leadTags: [] });
    const r2 = pickAgentForInbound([makeRule({ kind: 'tag', value: 'vip' })], {});
    return r1 === null && r2 === null;
  });

  t('pickAgentForInbound match em whatsapp_number', () => {
    const r = pickAgentForInbound([makeRule({ kind: 'whatsapp_number', value: 'acc_main' })], {
      whatsappAccountId: 'acc_main',
    });
    return r?.ruleKind === 'whatsapp_number';
  });

  t('pickAgentForInbound keyword case-insensitive', () => {
    const rule = makeRule({ kind: 'keyword', value: 'PREÇO' });
    const r = pickAgentForInbound([rule], { messageBody: 'Qual o preço do imóvel?' });
    return r?.ruleKind === 'keyword';
  });

  t('pickAgentForInbound keyword exige palavra inteira (não substring)', () => {
    // "ço" não deve matar "preço" — match palavra inteira.
    const r = pickAgentForInbound([makeRule({ kind: 'keyword', value: 'ço' })], {
      messageBody: 'Qual o preço?',
    });
    return r === null;
  });

  t('pickAgentForInbound keyword respeita boundary com acento', () => {
    // "olá" deve casar "Olá tudo bem?" mas não "molá".
    const rule = makeRule({ kind: 'keyword', value: 'olá' });
    const r1 = pickAgentForInbound([rule], { messageBody: 'Olá tudo bem?' });
    const r2 = pickAgentForInbound([rule], { messageBody: 'molá pra você' });
    return r1?.ruleKind === 'keyword' && r2 === null;
  });

  t('pickAgentForInbound keyword com body vazio/null não crashea', () => {
    const rule = makeRule({ kind: 'keyword', value: 'oi' });
    const r1 = pickAgentForInbound([rule], { messageBody: null });
    const r2 = pickAgentForInbound([rule], { messageBody: '' });
    const r3 = pickAgentForInbound([rule], {});
    return r1 === null && r2 === null && r3 === null;
  });

  t('pickAgentForInbound primeiro hit por priority asc', () => {
    const rules = [
      makeRule({
        ruleId: 'rl_b',
        agentId: 'agt_b',
        priority: 10,
        kind: 'stage',
        value: 'novo',
      }),
      makeRule({
        ruleId: 'rl_a',
        agentId: 'agt_a',
        priority: 0,
        kind: 'stage',
        value: 'novo',
      }),
    ];
    const r = pickAgentForInbound(rules, { leadStageId: 'novo' });
    return r?.agentId === 'agt_a' && r?.ruleId === 'rl_a';
  });

  t('pickAgentForInbound tie-break por agentCreatedAt asc', () => {
    const rules = [
      makeRule({
        ruleId: 'rl_b',
        agentId: 'agt_b',
        agentCreatedAt: new Date('2026-06-01T00:00:00Z'),
        priority: 0,
        kind: 'tag',
        value: 'vip',
      }),
      makeRule({
        ruleId: 'rl_a',
        agentId: 'agt_a',
        agentCreatedAt: new Date('2026-01-01T00:00:00Z'),
        priority: 0,
        kind: 'tag',
        value: 'vip',
      }),
    ];
    const r = pickAgentForInbound(rules, { leadTags: ['vip'] });
    return r?.agentId === 'agt_a';
  });

  t('pickAgentForInbound tie-break por ruleCreatedAt asc', () => {
    const ts = new Date('2026-01-01T00:00:00Z');
    const rules = [
      makeRule({
        ruleId: 'rl_new',
        agentId: 'agt_x',
        agentCreatedAt: ts,
        priority: 0,
        ruleCreatedAt: new Date('2026-03-01T00:00:00Z'),
        kind: 'stage',
        value: 'novo',
      }),
      makeRule({
        ruleId: 'rl_old',
        agentId: 'agt_x',
        agentCreatedAt: ts,
        priority: 0,
        ruleCreatedAt: new Date('2026-01-15T00:00:00Z'),
        kind: 'stage',
        value: 'novo',
      }),
    ];
    const r = pickAgentForInbound(rules, { leadStageId: 'novo' });
    return r?.ruleId === 'rl_old';
  });

  t('pickAgentForInbound múltiplas regras — primeiro que casa vence', () => {
    // priority 0 não casa, priority 5 casa, priority 10 casaria mas não chega.
    const rules = [
      makeRule({ ruleId: 'r0', agentId: 'a0', priority: 0, kind: 'stage', value: 'outro' }),
      makeRule({ ruleId: 'r5', agentId: 'a5', priority: 5, kind: 'tag', value: 'vip' }),
      makeRule({ ruleId: 'r10', agentId: 'a10', priority: 10, kind: 'tag', value: 'vip' }),
    ];
    const r = pickAgentForInbound(rules, { leadStageId: 'novo', leadTags: ['vip'] });
    return r?.ruleId === 'r5';
  });

  t('compareRulesForRouting é estável e determinístico', () => {
    const ts = new Date('2026-01-01T00:00:00Z');
    const a = makeRule({ ruleId: 'r1', agentId: 'aaa', priority: 0, ruleCreatedAt: ts });
    const b = makeRule({ ruleId: 'r2', agentId: 'aaa', priority: 0, ruleCreatedAt: ts });
    // Mesmo agentId, mesmas datas, mesma priority → ruleId desempata.
    // Ambos têm agentId 'aaa', então fallback final (agentId) também é igual.
    // Resultado deve ser 0 (estável — não inventa ordem).
    return compareRulesForRouting(a, b) === 0;
  });

  t('matchesKeyword aceita palavras com pontuação ao redor', () => {
    return (
      matchesKeyword('Quero falar com um humano!', 'humano') === true &&
      matchesKeyword('humano?', 'humano') === true &&
      matchesKeyword('(humano)', 'humano') === true
    );
  });

  t('matchesKeyword escapa caracteres especiais do value', () => {
    // value com "?" não deve virar quantifier regex.
    return matchesKeyword('Você está aí?', 'aí?') === true;
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
