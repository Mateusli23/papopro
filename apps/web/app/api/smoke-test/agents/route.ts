/**
 * Smoke test de Agentes IA — valida transforms puras, fixtures, templates
 * pré-configurados e schemas Zod.
 *
 * Existe pra dar confiança nos contratos do domínio antes de Vitest entrar
 * em M7+, e pra fixar shapes que viram Server Actions em M11 (`createAgent`,
 * `saveVersion`, `addRoute`) e prompt-execution-via-Claude também em M11.
 * Tipos permanecem; muda só a fonte (fixture → Postgres + pgvector).
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/agents` →
 * `{summary, results}` JSON. HTTP 200 se `failed === 0`, 500 caso contrário.
 */
import { NextResponse } from 'next/server';

import {
  AGENT_STATUSES,
  HANDOFF_TRIGGER_KINDS,
  ROUTE_KINDS,
  agentCreateSchema,
  agentUpdateSchema,
  kbFileUploadSchema,
  kbUpdateSchema,
  routeCreateSchema,
} from '@/features/agents/schemas';
import {
  MAX_ACTIVE_AGENTS,
  applyAddKbFile,
  applyAddRoute,
  applyCreateAgent,
  applyDeleteAgent,
  applyDeleteKbFile,
  applyDeleteRoute,
  applyDuplicateAgent,
  applyRestoreVersion,
  applySaveVersion,
  applyToggleStatus,
  applyUpdateAgent,
  applyUpdateHandoffTrigger,
  applyUpdateKbSection,
  applyUpdateRoute,
  countAgents,
  filterAgents,
  getNextRouteMatch,
} from '@/features/agents/transforms';
import { AGENT_TEMPLATES, getAgentTemplate } from '@/lib/fixtures/agent-templates';
import { FAKE_AGENTS } from '@/lib/fixtures/agents';
import { FAKE_KNOWLEDGE_BASE } from '@/lib/fixtures/knowledge-base';

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

// ID generators determinísticos pros testes — começam alto pra não colidir
// com fixtures (`agt_NNNNN`, `route_NNNNN`, `htg_NNNNN`, `ver_NNNNN`).
let agentCounter = 9000;
const agentIdGen = () => `agt_test_${(++agentCounter).toString().padStart(5, '0')}`;
let routeCounter = 9000;
const routeIdGen = () => `route_test_${(++routeCounter).toString().padStart(5, '0')}`;
let triggerCounter = 9000;
const triggerIdGen = () => `htg_test_${(++triggerCounter).toString().padStart(5, '0')}`;
let versionCounter = 9000;
const versionIdGen = () => `ver_test_${(++versionCounter).toString().padStart(5, '0')}`;
let fileCounter = 9000;
const fileIdGen = () => `kbf_test_${(++fileCounter).toString().padStart(5, '0')}`;

export const dynamic = 'force-dynamic';

export function GET() {
  const results: CheckResult[] = [];

  // ── Fixtures ────────────────────────────────────────────────────────────
  let t = run('fixtures', results);
  t(
    'FAKE_AGENTS tem pelo menos 3 agentes',
    () => FAKE_AGENTS.length >= 3 || `length=${FAKE_AGENTS.length}`,
  );
  t('IDs de agente únicos', () => {
    const ids = FAKE_AGENTS.map((a) => a.id);
    return new Set(ids).size === ids.length;
  });
  t('toda agente tem workspaceId não-vazio', () =>
    FAKE_AGENTS.every((a) => typeof a.workspaceId === 'string' && a.workspaceId.length > 0),
  );
  t('toda agente referencia template existente (ou undefined)', () => {
    const keys = new Set(AGENT_TEMPLATES.map((t) => t.key));
    const offender = FAKE_AGENTS.find((a) => a.templateKey && !keys.has(a.templateKey));
    return !offender || `agente ${offender.id} aponta pra template "${offender.templateKey}"`;
  });
  t('toda agente tem ≥ 1 versão', () => {
    const offender = FAKE_AGENTS.find((a) => a.versions.length === 0);
    return !offender || `agente ${offender.id} sem versões`;
  });
  t('currentVersionId aponta pra versão existente', () => {
    const offender = FAKE_AGENTS.find((a) => !a.versions.some((v) => v.id === a.currentVersionId));
    return !offender || `agente ${offender.id} com currentVersionId solto`;
  });
  t('status enum válido', () => {
    const allowed = new Set(AGENT_STATUSES);
    const offender = FAKE_AGENTS.find((a) => !allowed.has(a.status));
    return !offender || `agente ${offender.id} com status "${offender.status}"`;
  });
  t('métricas em [0,1] pras taxas', () => {
    const offender = FAKE_AGENTS.find(
      (a) =>
        a.metrics.resolutionRate < 0 ||
        a.metrics.resolutionRate > 1 ||
        a.metrics.inferredSatisfaction < 0 ||
        a.metrics.inferredSatisfaction > 1,
    );
    return !offender || `agente ${offender.id} com taxa fora de [0,1]`;
  });
  t('métricas não-negativas (counters/segundos)', () => {
    const offender = FAKE_AGENTS.find(
      (a) => a.metrics.totalConversations < 0 || a.metrics.avgResponseTimeSec < 0,
    );
    return !offender || `agente ${offender.id} com métrica negativa`;
  });
  t(
    `máximo ${MAX_ACTIVE_AGENTS} agentes ativos no fixture`,
    () =>
      FAKE_AGENTS.filter((a) => a.status === 'active').length <= MAX_ACTIVE_AGENTS ||
      'fixture excede limite de ativos',
  );
  t(
    'Cérebro tem 5 seções definidas (não undefined)',
    () =>
      typeof FAKE_KNOWLEDGE_BASE.about === 'string' &&
      typeof FAKE_KNOWLEDGE_BASE.products === 'string' &&
      typeof FAKE_KNOWLEDGE_BASE.faq === 'string' &&
      typeof FAKE_KNOWLEDGE_BASE.scripts === 'string' &&
      typeof FAKE_KNOWLEDGE_BASE.policy === 'string',
  );
  t('Cérebro tem ≥ 1 arquivo exemplo com sizeBytes > 0', () => {
    const offender = FAKE_KNOWLEDGE_BASE.files.find((f) => f.sizeBytes <= 0);
    return (
      (FAKE_KNOWLEDGE_BASE.files.length >= 1 && !offender) ||
      `${FAKE_KNOWLEDGE_BASE.files.length} files, offender=${offender?.id ?? '—'}`
    );
  });

  // ── Templates ───────────────────────────────────────────────────────────
  t = run('templates', results);
  t(
    'AGENT_TEMPLATES tem 4 templates',
    () => AGENT_TEMPLATES.length === 4 || `length=${AGENT_TEMPLATES.length}`,
  );
  t('keys são únicos', () => {
    const keys = AGENT_TEMPLATES.map((t) => t.key);
    return new Set(keys).size === keys.length;
  });
  t('templates não-blank têm prompt ≥ 50 chars', () => {
    const offender = AGENT_TEMPLATES.find((t) => t.key !== 'blank' && t.defaultPrompt.length < 50);
    return !offender || `template ${offender.key} prompt curto`;
  });
  t('"blank" tem prompt vazio', () => {
    const blank = AGENT_TEMPLATES.find((t) => t.key === 'blank');
    return blank?.defaultPrompt === '' || `blank prompt = "${blank?.defaultPrompt}"`;
  });
  t('todo template tem simulationScript com ≥ 3 turnos', () => {
    const offender = AGENT_TEMPLATES.find((t) => t.simulationScript.length < 3);
    return !offender || `template ${offender.key} script curto`;
  });
  t('simulationScript usa só "in"/"out"', () => {
    const offender = AGENT_TEMPLATES.find((t) =>
      t.simulationScript.some((s) => s.direction !== 'in' && s.direction !== 'out'),
    );
    return !offender || `template ${offender.key} tem direction inválido`;
  });
  t('todo template tem 6 handoff triggers default (todos os kinds)', () => {
    const expected = new Set(HANDOFF_TRIGGER_KINDS);
    const offender = AGENT_TEMPLATES.find(
      (t) =>
        t.defaultHandoffTriggers.length !== 6 ||
        !t.defaultHandoffTriggers.every((h) => expected.has(h.kind)),
    );
    return !offender || `template ${offender.key} triggers incompletos`;
  });
  t('getAgentTemplate("recovery") retorna o template certo', () => {
    const r = getAgentTemplate('recovery');
    return r?.key === 'recovery' || `got ${r?.key}`;
  });

  // ── Filters ─────────────────────────────────────────────────────────────
  t = run('filters', results);
  t('sem filtros retorna todos', () => filterAgents(FAKE_AGENTS, {}).length === FAKE_AGENTS.length);
  t('filterAgents status=active', () => {
    const r = filterAgents(FAKE_AGENTS, { status: 'active' });
    return r.every((a) => a.status === 'active');
  });
  t('filterAgents status=paused', () => {
    const r = filterAgents(FAKE_AGENTS, { status: 'paused' });
    return r.every((a) => a.status === 'paused');
  });
  t('filterAgents status=testing', () => {
    const r = filterAgents(FAKE_AGENTS, { status: 'testing' });
    return r.every((a) => a.status === 'testing');
  });
  t('busca case-insensitive em name', () => {
    const some = FAKE_AGENTS[0];
    if (!some) return 'fixture vazia';
    const r = filterAgents(FAKE_AGENTS, { search: some.name.toLowerCase() });
    return r.some((a) => a.id === some.id);
  });
  t('busca em persona', () => {
    const withPersona = FAKE_AGENTS.find((a) => a.persona.length > 5);
    if (!withPersona) return 'sem persona pra testar';
    const term = withPersona.persona.slice(0, 5);
    const r = filterAgents(FAKE_AGENTS, { search: term });
    return r.some((a) => a.id === withPersona.id);
  });
  t('combinação status + search', () => {
    const r = filterAgents(FAKE_AGENTS, { status: 'active', search: 'a' });
    return r.every((a) => a.status === 'active');
  });

  // ── Aggregations ────────────────────────────────────────────────────────
  t = run('aggregations', results);
  t('countAgents total bate com array length', () => {
    const c = countAgents(FAKE_AGENTS);
    return c.total === FAKE_AGENTS.length;
  });
  t('soma active+paused+testing == total', () => {
    const c = countAgents(FAKE_AGENTS);
    return c.active + c.paused + c.testing === c.total;
  });
  t('countAgents([]) retorna zeros', () => {
    const c = countAgents([]);
    return (
      c.total === 0 &&
      c.active === 0 &&
      c.paused === 0 &&
      c.testing === 0 &&
      c.totalConversations === 0
    );
  });
  t('getNextRouteMatch sem match retorna undefined', () => {
    const r = getNextRouteMatch(FAKE_AGENTS, { stageId: 'stage-que-nao-existe' });
    return r === undefined;
  });
  t('getNextRouteMatch retorna primeiro hit (ordem do array)', () => {
    // Constrói cenário: 2 agentes ativos, ambos com regra stage=novo.
    // Espera o primeiro do array.
    const a1: import('@/features/agents/types').Agent = {
      ...FAKE_AGENTS[0]!,
      id: 'agt_a',
      status: 'active',
      routes: [{ id: 'r1', kind: 'stage', value: 'novo', createdAt: 'now' }],
    };
    const a2: import('@/features/agents/types').Agent = {
      ...FAKE_AGENTS[0]!,
      id: 'agt_b',
      status: 'active',
      routes: [{ id: 'r2', kind: 'stage', value: 'novo', createdAt: 'now' }],
    };
    const r = getNextRouteMatch([a1, a2], { stageId: 'novo' });
    return r?.id === 'agt_a' || `got ${r?.id}`;
  });
  t('getNextRouteMatch ignora agentes não-ativos', () => {
    const paused: import('@/features/agents/types').Agent = {
      ...FAKE_AGENTS[0]!,
      id: 'agt_paused',
      status: 'paused',
      routes: [{ id: 'r1', kind: 'stage', value: 'novo', createdAt: 'now' }],
    };
    const r = getNextRouteMatch([paused], { stageId: 'novo' });
    return r === undefined;
  });

  // ── Mutations: agente ────────────────────────────────────────────────────
  t = run('mutations-agent', results);
  t('applyCreateAgent usa template (clona prompt/persona)', () => {
    const tpl = getAgentTemplate('qualification');
    if (!tpl) return 'template missing';
    const { created } = applyCreateAgent(
      [],
      { name: 'Test SDR', templateKey: 'qualification' },
      tpl,
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    return created.prompt === tpl.defaultPrompt && created.persona === tpl.defaultPersona;
  });
  t('applyCreateAgent começa em status testing', () => {
    const { created } = applyCreateAgent(
      [],
      { name: 'X', templateKey: 'blank' },
      getAgentTemplate('blank'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    return created.status === 'testing';
  });
  t('applyCreateAgent zera métricas', () => {
    const { created } = applyCreateAgent(
      [],
      { name: 'X', templateKey: 'blank' },
      getAgentTemplate('blank'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    return (
      created.metrics.totalConversations === 0 &&
      created.metrics.resolutionRate === 0 &&
      created.metrics.avgResponseTimeSec === 0 &&
      created.metrics.inferredSatisfaction === 0
    );
  });
  t('applyCreateAgent cria v1 com mesmo trio', () => {
    const tpl = getAgentTemplate('qualification');
    if (!tpl) return 'template missing';
    const { created } = applyCreateAgent(
      [],
      { name: 'X', templateKey: 'qualification' },
      tpl,
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const v1 = created.versions[0];
    return (
      created.versions.length === 1 &&
      created.currentVersionId === v1?.id &&
      v1?.versionNumber === 1
    );
  });
  t('applyUpdateAgent altera prompt sem criar versão', () => {
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'X', templateKey: 'blank' },
      getAgentTemplate('blank'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const next = applyUpdateAgent(agents, created.id, {
      prompt: 'Você é um agente experiente que atende leads novos com calma.',
    });
    const after = next.find((a) => a.id === created.id);
    return after?.prompt.startsWith('Você é um') === true && after?.versions.length === 1;
  });
  t('applyToggleStatus testing→active funciona quando há vagas', () => {
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'X', templateKey: 'blank' },
      getAgentTemplate('blank'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const r = applyToggleStatus(agents, created.id);
    return !r.limitReached && r.agents.find((a) => a.id === created.id)?.status === 'active';
  });
  t(`applyToggleStatus bloqueia quando há ${MAX_ACTIVE_AGENTS} ativos`, () => {
    // Cria 3 agentes ativos manualmente
    const base: Array<import('@/features/agents/types').Agent> = ['a', 'b', 'c'].map((suf) => ({
      id: `agt_${suf}`,
      workspaceId: 'ws_demo',
      name: `Agent ${suf}`,
      status: 'active',
      prompt: 'p'.repeat(30),
      persona: '',
      tone: 'consultivo',
      routes: [],
      handoffTriggers: [],
      versions: [
        {
          id: `ver_${suf}`,
          agentId: `agt_${suf}`,
          versionNumber: 1,
          prompt: 'p'.repeat(30),
          persona: '',
          tone: 'consultivo',
          createdBy: 'Você',
          createdAt: 'now',
        },
      ],
      currentVersionId: `ver_${suf}`,
      metrics: {
        totalConversations: 0,
        resolutionRate: 0,
        avgResponseTimeSec: 0,
        inferredSatisfaction: 0,
      },
      createdAt: 'now',
      updatedAt: 'now',
    }));
    const target: import('@/features/agents/types').Agent = {
      ...base[0]!,
      id: 'agt_target',
      status: 'paused',
      versions: [{ ...base[0]!.versions[0]!, agentId: 'agt_target', id: 'ver_target' }],
      currentVersionId: 'ver_target',
    };
    const r = applyToggleStatus([...base, target], 'agt_target');
    return r.limitReached && r.agents.find((a) => a.id === 'agt_target')?.status === 'paused';
  });
  t('applyDuplicateAgent força status testing', () => {
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'Original', templateKey: 'blank' },
      getAgentTemplate('blank'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const r = applyDuplicateAgent(
      agents,
      created.id,
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
    );
    return r.created?.status === 'testing' && r.created?.name.includes('(cópia)');
  });
  t('applyDeleteAgent remove o alvo', () => {
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'Y', templateKey: 'blank' },
      getAgentTemplate('blank'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const next = applyDeleteAgent(agents, created.id);
    return next.length === agents.length - 1;
  });
  t('applySaveVersion incrementa versionNumber e seta currentVersionId', () => {
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'Z', templateKey: 'blank' },
      getAgentTemplate('blank'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const updated = applyUpdateAgent(agents, created.id, {
      prompt: 'Novo prompt com 25 caracteres ok',
    });
    const r = applySaveVersion(updated, created.id, 'mudei tom', versionIdGen);
    const after = r.agents.find((a) => a.id === created.id);
    return (
      after?.versions.length === 2 &&
      after?.versions[0]?.versionNumber === 2 &&
      after?.currentVersionId === r.created?.id
    );
  });
  t('applyRestoreVersion troca o draft sem criar versão nova', () => {
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'W', templateKey: 'qualification' },
      getAgentTemplate('qualification'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const v1 = created.versions[0]!;
    const updated = applyUpdateAgent(agents, created.id, {
      prompt: 'Outro prompt completamente diferente aqui',
    });
    const restored = applyRestoreVersion(updated, created.id, v1.id);
    const after = restored.find((a) => a.id === created.id);
    return after?.prompt === v1.prompt && after?.versions.length === 1;
  });

  // ── Mutations: routing & handoff ────────────────────────────────────────
  t = run('mutations-routing-handoff', results);
  t('applyAddRoute insere com value trimado', () => {
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'R', templateKey: 'blank' },
      getAgentTemplate('blank'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const r = applyAddRoute(
      agents,
      created.id,
      { kind: 'tag', value: '  imovel-rj  ' },
      routeIdGen,
    );
    return r.created?.value === 'imovel-rj';
  });
  t('applyUpdateRoute altera value', () => {
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'R', templateKey: 'blank' },
      getAgentTemplate('blank'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const added = applyAddRoute(agents, created.id, { kind: 'stage', value: 'novo' }, routeIdGen);
    if (!added.created) return 'add failed';
    const next = applyUpdateRoute(added.agents, created.id, added.created.id, {
      value: 'em_contato',
    });
    const after = next.find((a) => a.id === created.id);
    return after?.routes[0]?.value === 'em_contato';
  });
  t('applyDeleteRoute remove a regra', () => {
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'R', templateKey: 'blank' },
      getAgentTemplate('blank'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const added = applyAddRoute(agents, created.id, { kind: 'stage', value: 'novo' }, routeIdGen);
    if (!added.created) return 'add failed';
    const next = applyDeleteRoute(added.agents, created.id, added.created.id);
    const after = next.find((a) => a.id === created.id);
    return after?.routes.length === 0;
  });
  t('applyAddRoute preserva ordem (append no fim)', () => {
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'R', templateKey: 'blank' },
      getAgentTemplate('blank'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const a1 = applyAddRoute(agents, created.id, { kind: 'stage', value: 'novo' }, routeIdGen);
    const a2 = applyAddRoute(a1.agents, created.id, { kind: 'tag', value: 'vip' }, routeIdGen);
    const after = a2.agents.find((a) => a.id === created.id);
    return after?.routes[0]?.kind === 'stage' && after?.routes[1]?.kind === 'tag';
  });
  t('applyUpdateHandoffTrigger toggle por kind', () => {
    const tpl = getAgentTemplate('qualification');
    if (!tpl) return 'template missing';
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'H', templateKey: 'qualification' },
      tpl,
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const next = applyUpdateHandoffTrigger(agents, created.id, 'outside_business_hours', {
      enabled: true,
    });
    const after = next.find((a) => a.id === created.id);
    return (
      after?.handoffTriggers.find((t) => t.kind === 'outside_business_hours')?.enabled === true
    );
  });
  t('applyUpdateHandoffTrigger atualiza config keywords', () => {
    const tpl = getAgentTemplate('qualification');
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'H', templateKey: 'qualification' },
      tpl,
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const next = applyUpdateHandoffTrigger(agents, created.id, 'keyword', {
      config: { keywords: ['gerente', 'supervisor'] },
    });
    const after = next.find((a) => a.id === created.id);
    return after?.handoffTriggers.find((t) => t.kind === 'keyword')?.config?.keywords?.length === 2;
  });

  // ── Mutations: knowledge base ───────────────────────────────────────────
  t = run('mutations-knowledge', results);
  t('applyUpdateKbSection altera seção sem afetar outras', () => {
    const next = applyUpdateKbSection(FAKE_KNOWLEDGE_BASE, { about: 'Nova descrição' });
    return next.about === 'Nova descrição' && next.products === FAKE_KNOWLEDGE_BASE.products;
  });
  t('applyAddKbFile cria arquivo com status processed', () => {
    const r = applyAddKbFile(
      FAKE_KNOWLEDGE_BASE,
      { name: 'novo.pdf', sizeBytes: 1024, kind: 'pdf' },
      fileIdGen,
    );
    return r.created.status === 'processed' && r.created.sizeBytes === 1024;
  });
  t('applyAddKbFile prepende novo arquivo no array', () => {
    const r = applyAddKbFile(
      FAKE_KNOWLEDGE_BASE,
      { name: 'novo.pdf', sizeBytes: 1024, kind: 'pdf' },
      fileIdGen,
    );
    return r.kb.files[0]?.id === r.created.id;
  });
  t('applyDeleteKbFile remove o alvo', () => {
    const first = FAKE_KNOWLEDGE_BASE.files[0];
    if (!first) return 'fixture sem arquivos';
    const next = applyDeleteKbFile(FAKE_KNOWLEDGE_BASE, first.id);
    return next.files.length === FAKE_KNOWLEDGE_BASE.files.length - 1;
  });
  t('applyDeleteKbFile com id inexistente é no-op', () => {
    const next = applyDeleteKbFile(FAKE_KNOWLEDGE_BASE, 'kbf_no_existe');
    return next === FAKE_KNOWLEDGE_BASE;
  });

  // ── Schema validation ───────────────────────────────────────────────────
  t = run('schema', results);
  t('agentCreateSchema válido', () => {
    return agentCreateSchema.safeParse({
      name: 'Sofia',
      templateKey: 'qualification',
    }).success;
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
  t('kbUpdateSchema aceita seções vazias', () => {
    return kbUpdateSchema.safeParse({ about: '', products: '' }).success;
  });
  t('kbFileUploadSchema rejeita arquivo > 10MB', () => {
    return !kbFileUploadSchema.safeParse({
      name: 'x.pdf',
      sizeBytes: 11 * 1024 * 1024,
      kind: 'pdf',
    }).success;
  });
  t('mensagens em pt-BR (sem vazar "Required")', () => {
    const r = agentCreateSchema.safeParse({});
    if (r.success) return 'should have failed';
    const msgs = JSON.stringify(r.error.issues);
    return !msgs.includes('Required') && !msgs.includes('String must');
  });

  // ── Edge cases ──────────────────────────────────────────────────────────
  t = run('edge-cases', results);
  t('countAgents([]) zerado', () => {
    const c = countAgents([]);
    return c.total === 0 && c.active === 0;
  });
  t('filterAgents([]) retorna []', () => filterAgents([]).length === 0);
  t('getNextRouteMatch([], _) retorna undefined', () => {
    return getNextRouteMatch([], { stageId: 'novo' }) === undefined;
  });
  t('agente sem regras nunca matcha', () => {
    const { created, agents } = applyCreateAgent(
      [],
      { name: 'X', templateKey: 'blank' },
      getAgentTemplate('blank'),
      agentIdGen,
      routeIdGen,
      triggerIdGen,
      versionIdGen,
      'ws_demo',
    );
    const active = agents.map((a) =>
      a.id === created.id ? { ...a, status: 'active' as const } : a,
    );
    return getNextRouteMatch(active, { stageId: 'novo' }) === undefined;
  });
  t('AGENT_STATUSES contém os 3 valores', () => {
    return AGENT_STATUSES.length === 3 && AGENT_STATUSES.includes('testing');
  });
  t('ROUTE_KINDS tem 4 valores', () => {
    return ROUTE_KINDS.length === 4;
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
