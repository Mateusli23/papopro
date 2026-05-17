/**
 * Smoke test de Cadências — valida transforms puras, fixtures, templates
 * pré-configurados e schemas Zod.
 *
 * Existe pra dar confiança nos contratos do domínio antes de Vitest entrar
 * em M7+, e pra fixar shapes que viram Server Actions em M8 (`createCadence`,
 * `updateCadence`, `addStep`) e Edge Function executora em M10
 * (`cadence-runner`). Tipos permanecem; muda só a fonte (fixture → Postgres).
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/cadences` →
 * `{summary, results}` JSON. HTTP 200 se `failed === 0`, 500 caso contrário.
 */
import { NextResponse } from 'next/server';

import { AuditAction } from '@papopro/db';

import {
  computeBackoffNextRunAt,
  computeNextRunAt,
} from '@/features/cadences/dispatch/compute-next-run-at';
import {
  isPermanentBlock,
  mapAntiBanToSkipReason,
} from '@/features/cadences/dispatch/map-antiban-reason';
import { dispatchPayloadSchema } from '@/features/cadences/dispatch/schemas';
import { pickNextStep, type StepCandidate } from '@/features/cadences/dispatch/select-next-step';
import {
  CADENCE_CHANNELS,
  CADENCE_STATUSES,
  CADENCE_TEMPLATE_KEYS,
  DAY_OFFSETS,
  cadenceCreateSchema,
  stepCreateSchema,
} from '@/features/cadences/schemas';
import {
  applyAddStep,
  applyCreateCadence,
  applyDeleteCadence,
  applyDeleteStep,
  applyDuplicate,
  applyToggleStatus,
  applyUpdateCadence,
  applyUpdateStep,
  countCadences,
  filterCadences,
  groupCadencesByStage,
  sumActiveEnrollments,
} from '@/features/cadences/transforms';
import { resolvePlaceholders } from '@/features/inbox/transforms';
import { CADENCE_TEMPLATES, getTemplate } from '@/lib/fixtures/cadence-templates';
import { FAKE_CADENCES } from '@/lib/fixtures/cadences';
import { DEFAULT_STAGES } from '@/lib/fixtures/pipelines';

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

let counter = 9000;
const idGen = () => `cad_test_${(++counter).toString().padStart(5, '0')}`;
let stepCounter = 9000;
const stepIdGen = () => `step_test_${(++stepCounter).toString().padStart(5, '0')}`;

export const dynamic = 'force-dynamic';

export function GET() {
  const results: CheckResult[] = [];

  // ── Fixtures ────────────────────────────────────────────────────────────
  let t = run('fixtures', results);
  t(
    'FAKE_CADENCES tem pelo menos 4 cadências',
    () => FAKE_CADENCES.length >= 4 || `length=${FAKE_CADENCES.length}`,
  );
  t('IDs de cadência únicos', () => {
    const ids = FAKE_CADENCES.map((c) => c.id);
    return new Set(ids).size === ids.length;
  });
  t('IDs de step únicos globalmente', () => {
    const stepIds = FAKE_CADENCES.flatMap((c) => c.steps.map((s) => s.id));
    return new Set(stepIds).size === stepIds.length;
  });
  t('toda cadência tem workspaceId não-vazio', () =>
    FAKE_CADENCES.every((c) => typeof c.workspaceId === 'string' && c.workspaceId.length > 0),
  );
  t('toda cadência referencia stage existente', () => {
    const stageIds = new Set(DEFAULT_STAGES.map((s) => s.id));
    const offender = FAKE_CADENCES.find((c) => !stageIds.has(c.stageId));
    return !offender || `cadência ${offender.id} aponta pra stage "${offender.stageId}"`;
  });
  t('nenhuma cadência em etapa terminal', () => {
    const terminal = new Set(DEFAULT_STAGES.filter((s) => s.terminal).map((s) => s.id));
    const offender = FAKE_CADENCES.find((c) => terminal.has(c.stageId));
    return !offender || `cadência ${offender.id} em "${offender.stageId}"`;
  });
  t('métricas com taxas no intervalo [0,1]', () => {
    const offender = FAKE_CADENCES.find(
      (c) =>
        c.metrics.responseRate < 0 ||
        c.metrics.responseRate > 1 ||
        c.metrics.stageAdvanceRate < 0 ||
        c.metrics.stageAdvanceRate > 1,
    );
    return (
      !offender ||
      `cadência ${offender.id}: response=${offender.metrics.responseRate} advance=${offender.metrics.stageAdvanceRate}`
    );
  });
  t('cadência paused tem activeEnrollments=0', () => {
    const offender = FAKE_CADENCES.find(
      (c) => c.status === 'paused' && c.metrics.activeEnrollments > 0,
    );
    return (
      !offender || `cadência paused ${offender.id} tem ${offender.metrics.activeEnrollments} ativos`
    );
  });
  t('toda cadência ativa não-blank tem ao menos 1 step', () => {
    const offender = FAKE_CADENCES.find(
      (c) => c.status === 'active' && c.templateKey !== 'blank' && c.steps.length === 0,
    );
    return !offender || `cadência ${offender.id} ativa sem steps`;
  });

  // ── Templates ───────────────────────────────────────────────────────────
  t = run('templates', results);
  t(
    'CADENCE_TEMPLATE_KEYS exporta 4 chaves',
    () => CADENCE_TEMPLATE_KEYS.length === 4 || `length=${CADENCE_TEMPLATE_KEYS.length}`,
  );
  t('CADENCE_TEMPLATES tem entrada pra cada key', () => {
    const missing = CADENCE_TEMPLATE_KEYS.filter(
      (k) => !CADENCE_TEMPLATES.find((t) => t.key === k),
    );
    return missing.length === 0 || `faltando: ${missing.join(',')}`;
  });
  t('imobiliario / b2b / alto-ticket têm steps preenchidos', () => {
    const required: Array<'imobiliario' | 'b2b' | 'alto-ticket'> = [
      'imobiliario',
      'b2b',
      'alto-ticket',
    ];
    const empty = required.find((k) => (getTemplate(k)?.steps.length ?? 0) === 0);
    return !empty || `template "${empty}" sem steps`;
  });
  t('blank tem steps vazios (esqueleto)', () => {
    const blank = getTemplate('blank');
    return (blank?.steps.length ?? -1) === 0 || `blank tem ${blank?.steps.length} steps`;
  });
  t('todos os steps de templates usam dayOffset válido', () => {
    const allowed = new Set(DAY_OFFSETS as readonly number[]);
    const offender = CADENCE_TEMPLATES.flatMap((t) =>
      t.steps.map((s) => ({ key: t.key, dayOffset: s.dayOffset })),
    ).find((s) => !allowed.has(s.dayOffset));
    return !offender || `template ${offender.key} dayOffset=${offender.dayOffset}`;
  });
  t('todo step de template tem placeholder válido (algum {…})', () => {
    const offender = CADENCE_TEMPLATES.flatMap((t) =>
      t.steps.map((s) => ({ key: t.key, body: s.templateBody })),
    ).find(({ body }) => !/\{(nome|empresa|produto)\}/.test(body));
    return !offender || `template ${offender.key} sem placeholder reconhecido`;
  });
  t('templates sugerem stage ativo (não-terminal)', () => {
    const terminal = new Set(DEFAULT_STAGES.filter((s) => s.terminal).map((s) => s.id));
    const offender = CADENCE_TEMPLATES.find((tpl) => terminal.has(tpl.defaultStageId));
    return !offender || `template ${offender.key} sugere "${offender.defaultStageId}"`;
  });
  t('todo canal de step é whatsapp ou email', () => {
    const allowed = new Set(CADENCE_CHANNELS as readonly string[]);
    const offender = CADENCE_TEMPLATES.flatMap((tpl) =>
      tpl.steps.map((s) => ({ key: tpl.key, channel: s.channel })),
    ).find((s) => !allowed.has(s.channel));
    return !offender || `template ${offender.key} canal=${offender.channel}`;
  });

  // ── Filtros ─────────────────────────────────────────────────────────────
  t = run('filters', results);
  t(
    'sem filtros retorna todas',
    () => filterCadences(FAKE_CADENCES).length === FAKE_CADENCES.length,
  );
  t('filtra por stageId=novo', () => {
    const got = filterCadences(FAKE_CADENCES, { stageId: 'novo' });
    return got.every((c) => c.stageId === 'novo');
  });
  t('filtra por status=active', () => {
    const got = filterCadences(FAKE_CADENCES, { status: 'active' });
    return got.every((c) => c.status === 'active') && got.length > 0;
  });
  t('filtra por status=paused (case com 1+)', () => {
    const got = filterCadences(FAKE_CADENCES, { status: 'paused' });
    return got.every((c) => c.status === 'paused');
  });
  t('busca case-insensitive por name', () => {
    const got = filterCadences(FAKE_CADENCES, { search: 'IMOBILI' });
    return got.length >= 1 && got.every((c) => c.name.toLowerCase().includes('imobili'));
  });
  t('busca casa em description', () => {
    const got = filterCadences(FAKE_CADENCES, { search: 'qualifica' });
    return (
      got.some((c) => (c.description ?? '').toLowerCase().includes('qualifica')) ||
      `nenhuma description com "qualifica"`
    );
  });
  t('combinação stage + status', () => {
    const got = filterCadences(FAKE_CADENCES, { stageId: 'em_contato', status: 'active' });
    return got.every((c) => c.stageId === 'em_contato' && c.status === 'active');
  });
  t('busca sem matches retorna vazio', () => {
    return filterCadences(FAKE_CADENCES, { search: 'xyz123nada' }).length === 0;
  });

  // ── Agregações ──────────────────────────────────────────────────────────
  t = run('aggregations', results);
  const counts = countCadences(FAKE_CADENCES);
  t('counts.total === FAKE_CADENCES.length', () => counts.total === FAKE_CADENCES.length);
  t(
    'counts.active + counts.paused === total',
    () => counts.active + counts.paused === counts.total,
  );
  t('counts.totalSteps bate com flatMap', () => {
    const expected = FAKE_CADENCES.reduce((sum, c) => sum + c.steps.length, 0);
    return counts.totalSteps === expected || `got=${counts.totalSteps} expected=${expected}`;
  });
  t('sumActiveEnrollments bate com soma manual', () => {
    const expected = FAKE_CADENCES.reduce((sum, c) => sum + c.metrics.activeEnrollments, 0);
    return sumActiveEnrollments(FAKE_CADENCES) === expected;
  });
  // M10 followup: `groupCadencesByStage` agora recebe stages como parâmetro
  // (antes usava DEFAULT_STAGES como fonte fixa). Smoke continua passando o
  // fixture pra exercitar a invariante de agrupamento.
  const groups = groupCadencesByStage(FAKE_CADENCES, DEFAULT_STAGES);
  t('groupCadencesByStage exclui etapas terminais', () => {
    const stageIds = groups.map((g) => g.stageId);
    return !stageIds.includes('ganho') && !stageIds.includes('perdido');
  });
  t('groupCadencesByStage cobre todas as etapas ativas', () => {
    const active = DEFAULT_STAGES.filter((s) => !s.terminal).map((s) => s.id);
    return active.every((id) => groups.find((g) => g.stageId === id));
  });
  t('soma das cadências em grupos === total', () => {
    const sum = groups.reduce((acc, g) => acc + g.cadences.length, 0);
    return sum === FAKE_CADENCES.length || `sum=${sum} total=${FAKE_CADENCES.length}`;
  });

  // ── Mutações ────────────────────────────────────────────────────────────
  t = run('mutations', results);
  const sample = FAKE_CADENCES[0]!;

  // create
  const createInput = {
    name: 'Smoke test cadence',
    description: 'criada pelo smoke',
    stageId: 'novo',
    templateKey: 'imobiliario' as const,
  };
  const { cadences: afterCreate, created } = applyCreateCadence(
    FAKE_CADENCES,
    createInput,
    getTemplate('imobiliario'),
    idGen,
    stepIdGen,
    'ws_demo',
  );
  t('applyCreateCadence retorna cadência nova', () => !!created);
  t('applyCreateCadence prepende ao array', () => afterCreate[0]?.id === created.id);
  t('cadência criada herda steps do template', () => {
    const templateSteps = getTemplate('imobiliario')?.steps.length ?? 0;
    return created.steps.length === templateSteps;
  });
  t('cadência criada começa active', () => created.status === 'active');
  t('cadência criada zera métricas', () => created.metrics.activeEnrollments === 0);

  // update
  const afterUpdate = applyUpdateCadence(FAKE_CADENCES, sample.id, { name: 'Renomeada' });
  t('applyUpdateCadence renomeia', () => {
    const found = afterUpdate.find((c) => c.id === sample.id);
    return found?.name === 'Renomeada';
  });
  t('applyUpdateCadence preserva steps', () => {
    const found = afterUpdate.find((c) => c.id === sample.id);
    return found?.steps.length === sample.steps.length;
  });
  t('applyUpdateCadence em ID inexistente é no-op', () => {
    const result = applyUpdateCadence(FAKE_CADENCES, 'cad_naoexiste', { name: 'X' });
    return result === FAKE_CADENCES;
  });

  // toggle
  const afterToggle = applyToggleStatus(FAKE_CADENCES, sample.id);
  t('applyToggleStatus inverte status', () => {
    const found = afterToggle.find((c) => c.id === sample.id);
    const expected = sample.status === 'active' ? 'paused' : 'active';
    return found?.status === expected;
  });

  // duplicate
  const { cadences: afterDup, created: dup } = applyDuplicate(
    FAKE_CADENCES,
    sample.id,
    idGen,
    stepIdGen,
  );
  t('applyDuplicate cria cópia com novo ID', () => !!dup && dup.id !== sample.id);
  t('applyDuplicate adiciona "(cópia)" ao nome', () => dup?.name.endsWith('(cópia)') === true);
  t('cópia começa paused (força revisão)', () => dup?.status === 'paused');
  t('cópia zera métricas (não herda do original)', () => {
    if (!dup) return 'sem dup';
    return (
      dup.metrics.activeEnrollments === 0 &&
      dup.metrics.totalDispatched === 0 &&
      dup.metrics.responseRate === 0 &&
      dup.metrics.stageAdvanceRate === 0
    );
  });
  t('cópia tem mesma quantidade de steps mas IDs diferentes', () => {
    if (!dup) return 'sem dup';
    if (dup.steps.length !== sample.steps.length) return 'qtd diferente';
    const overlap = dup.steps.some((s) => sample.steps.find((os) => os.id === s.id));
    return !overlap || 'IDs de step colidiram';
  });
  t('afterDup tem cadência a mais', () => afterDup.length === FAKE_CADENCES.length + 1);

  // delete
  const afterDel = applyDeleteCadence(FAKE_CADENCES, sample.id);
  t('applyDeleteCadence remove uma', () => afterDel.length === FAKE_CADENCES.length - 1);
  t('applyDeleteCadence em ID inexistente é no-op', () => {
    const r = applyDeleteCadence(FAKE_CADENCES, 'cad_naoexiste');
    return r === FAKE_CADENCES;
  });

  // step add
  const cadWithSteps = FAKE_CADENCES.find((c) => c.steps.length > 0)!;
  const { cadences: afterAddStep, created: newStep } = applyAddStep(
    FAKE_CADENCES,
    cadWithSteps.id,
    {
      dayOffset: 7,
      channel: 'whatsapp',
      templateBody: 'Olá {nome}, novo passo de teste — só pro smoke.',
    },
    stepIdGen,
  );
  t('applyAddStep retorna step novo', () => !!newStep);
  t('applyAddStep insere no array da cadência alvo', () => {
    const found = afterAddStep.find((c) => c.id === cadWithSteps.id);
    return (found?.steps.length ?? -1) === cadWithSteps.steps.length + 1;
  });
  t('applyAddStep mantém ordenação por dayOffset asc', () => {
    const found = afterAddStep.find((c) => c.id === cadWithSteps.id);
    if (!found) return 'sem cadência';
    for (let i = 1; i < found.steps.length; i++) {
      const prev = found.steps[i - 1]!;
      const curr = found.steps[i]!;
      if (prev.dayOffset > curr.dayOffset) return `inversão em ${i}`;
    }
    return true;
  });
  t('applyAddStep em cadência inexistente é no-op', () => {
    const r = applyAddStep(
      FAKE_CADENCES,
      'cad_naoexiste',
      { dayOffset: 0, channel: 'email', templateBody: 'corpo qualquer pra passar mín 10' },
      stepIdGen,
    );
    return r.cadences === FAKE_CADENCES && r.created === undefined;
  });

  // step update + delete
  const targetStep = cadWithSteps.steps[0]!;
  const afterUpdStep = applyUpdateStep(FAKE_CADENCES, cadWithSteps.id, targetStep.id, {
    templateBody: 'corpo atualizado mas com mais de dez',
  });
  t('applyUpdateStep altera só o step alvo', () => {
    const found = afterUpdStep
      .find((c) => c.id === cadWithSteps.id)
      ?.steps.find((s) => s.id === targetStep.id);
    return found?.templateBody.startsWith('corpo atualizado') ?? false;
  });

  // Move step pra outro dayOffset — recalcula `order` no novo bucket
  // (regressão: antes do fix, mantinha order original e colidia).
  const movedStep = applyUpdateStep(FAKE_CADENCES, cadWithSteps.id, targetStep.id, {
    dayOffset: 30,
  })
    .find((c) => c.id === cadWithSteps.id)
    ?.steps.find((s) => s.id === targetStep.id);
  t('applyUpdateStep movendo dayOffset atualiza o campo', () => movedStep?.dayOffset === 30);
  t('applyUpdateStep movendo dayOffset não colide com order existente', () => {
    if (!movedStep) return 'sem step';
    const others = FAKE_CADENCES.find((c) => c.id === cadWithSteps.id)!
      .steps.filter((s) => s.id !== targetStep.id && s.dayOffset === 30)
      .map((s) => s.order);
    return (
      !others.includes(movedStep.order) || `order=${movedStep.order} colide com ${others.join(',')}`
    );
  });

  // Add 2 steps no mesmo dia novo — order deve incrementar 0, 1, …
  const addOnce = applyAddStep(
    FAKE_CADENCES,
    cadWithSteps.id,
    { dayOffset: 30, channel: 'email', templateBody: 'primeiro novo step do dia 30' },
    stepIdGen,
  );
  const addTwice = applyAddStep(
    addOnce.cadences,
    cadWithSteps.id,
    { dayOffset: 30, channel: 'whatsapp', templateBody: 'segundo novo step do dia 30' },
    stepIdGen,
  );
  t('applyAddStep no mesmo dayOffset incrementa order', () => {
    const stepsD30 = addTwice.cadences
      .find((c) => c.id === cadWithSteps.id)!
      .steps.filter((s) => s.dayOffset === 30);
    return stepsD30.length >= 2 && stepsD30[0]!.order < stepsD30[1]!.order;
  });

  const afterDelStep = applyDeleteStep(FAKE_CADENCES, cadWithSteps.id, targetStep.id);
  t('applyDeleteStep remove um step', () => {
    const found = afterDelStep.find((c) => c.id === cadWithSteps.id);
    return (found?.steps.length ?? -1) === cadWithSteps.steps.length - 1;
  });

  // ── Schema ──────────────────────────────────────────────────────────────
  t = run('schema', results);
  // M10 followup: stageId agora é UUID (alinhado com `pipeline_stages.id`).
  // A rejeição de stage terminal (`ganho`/`perdido`) e a checagem de
  // ownership rodam no Server Action (`createCadenceAction`), não no schema —
  // o schema não conhece o conjunto de stages do workspace do caller.
  const STAGE_UUID = '11111111-2222-4333-8444-555555555555';
  t('cadenceCreateSchema aceita input válido', () => {
    const r = cadenceCreateSchema.safeParse({
      name: 'Cadência de teste',
      stageId: STAGE_UUID,
      templateKey: 'imobiliario',
    });
    return r.success || JSON.stringify(r.error.issues);
  });
  t('rejeita nome muito curto', () => {
    const r = cadenceCreateSchema.safeParse({
      name: 'X',
      stageId: STAGE_UUID,
      templateKey: 'blank',
    });
    return r.success === false;
  });
  t('rejeita stageId que não é UUID (validação de stage terminal vai pro action)', () => {
    const r = cadenceCreateSchema.safeParse({
      name: 'Slug literal',
      stageId: 'ganho',
      templateKey: 'blank',
    });
    return r.success === false;
  });
  t('rejeita templateKey desconhecido', () => {
    const r = cadenceCreateSchema.safeParse({
      name: 'Teste',
      stageId: STAGE_UUID,
      templateKey: 'desconhecido',
    });
    return r.success === false;
  });
  t('stepCreateSchema aceita dayOffset=7 + corpo válido', () => {
    const r = stepCreateSchema.safeParse({
      dayOffset: 7,
      channel: 'whatsapp',
      templateBody: 'mensagem com mais de dez caracteres',
    });
    return r.success || JSON.stringify(r.error.issues);
  });
  t('rejeita dayOffset=5 (fora do enum do PRD)', () => {
    const r = stepCreateSchema.safeParse({
      dayOffset: 5,
      channel: 'whatsapp',
      templateBody: 'mensagem com mais de dez',
    });
    return r.success === false;
  });
  t('rejeita templateBody curto (<10)', () => {
    const r = stepCreateSchema.safeParse({
      dayOffset: 0,
      channel: 'email',
      templateBody: 'oi',
    });
    return r.success === false;
  });
  t('mensagens de erro em pt-BR (não en-US)', () => {
    const r = cadenceCreateSchema.safeParse({
      name: '',
      stageId: 'not-uuid',
      templateKey: 'blank',
    });
    if (r.success) return 'esperava falhar';
    const messages = r.error.issues.map((i) => i.message).join(' | ');
    // Detecta vazamento de mensagem padrão do Zod ("Required", "String must…")
    return !/Required|String must/i.test(messages) || `vazou en-US: ${messages}`;
  });

  // ── Edge cases ──────────────────────────────────────────────────────────
  t = run('edge-cases', results);
  t('countCadences([]) não quebra', () => {
    const c = countCadences([]);
    return c.total === 0 && c.active === 0 && c.paused === 0;
  });
  t('groupCadencesByStage([]) retorna grupos vazios', () => {
    const g = groupCadencesByStage([], DEFAULT_STAGES);
    return g.length > 0 && g.every((x) => x.cadences.length === 0);
  });
  t('sumActiveEnrollments([]) === 0', () => sumActiveEnrollments([]) === 0);
  t('filterCadences([]) não quebra com filtros aplicados', () => {
    return filterCadences([], { search: 'qualquer', status: 'active' }).length === 0;
  });
  t('CADENCE_STATUSES contém active e paused', () => {
    const set = new Set(CADENCE_STATUSES);
    return set.has('active') && set.has('paused');
  });

  // ── M10#2 — Dispatch helpers ────────────────────────────────────────────
  // Motor de cadência: mapping anti-ban→skip_reason, cálculo de next_run_at,
  // seleção de step, schema Zod do payload da rota /api/internal/cadence-dispatch.
  t = run('cadence-dispatch-m10', results);

  // AuditAction extension (M10#1 SQL + M10#2 schema.prisma sync).
  const M10_AUDIT_ACTIONS = [
    'cadence_created',
    'cadence_updated',
    'cadence_deleted',
    'cadence_enrolled',
    'cadence_paused',
    'cadence_reactivated',
    'cadence_completed',
    'cadence_step_sent',
    'cadence_step_failed',
    'cold_lead_alerted',
    'cold_lead_acknowledged',
    'cold_threshold_updated',
  ] as const;
  t('auditActionM10Extension', () => {
    const present = Object.values(AuditAction);
    const missing = M10_AUDIT_ACTIONS.filter((v) => !present.includes(v as AuditAction));
    return missing.length === 0 || `faltam: ${missing.join(', ')}`;
  });

  // mapAntiBanToSkipReason cobre as 6 razões do M9#3.
  t('mapAntiBan_blacklisted', () => {
    return mapAntiBanToSkipReason('blacklisted') === 'blacklist';
  });
  t('mapAntiBan_disconnected', () => {
    return mapAntiBanToSkipReason('instance_disconnected') === 'workspace_paused';
  });
  t('mapAntiBan_unhealthy', () => {
    return mapAntiBanToSkipReason('instance_unhealthy') === 'unhealthy';
  });
  t('mapAntiBan_paused', () => {
    return mapAntiBanToSkipReason('instance_paused') === 'rate_limit';
  });
  t('mapAntiBan_outsideHours', () => {
    return mapAntiBanToSkipReason('outside_business_hours') === 'outside_business_hours';
  });
  t('mapAntiBan_rateLimit24h', () => {
    return mapAntiBanToSkipReason('rate_limit_24h') === 'rate_limit';
  });

  // isPermanentBlock: só blacklisted é permanente (cancela enrollment).
  t('isPermanentBlock_onlyBlacklisted', () => {
    if (!isPermanentBlock('blacklisted')) return 'blacklisted deveria ser permanente';
    const transient = [
      'instance_disconnected',
      'instance_unhealthy',
      'instance_paused',
      'outside_business_hours',
      'rate_limit_24h',
    ] as const;
    const offender = transient.find((r) => isPermanentBlock(r));
    return !offender || `${offender} foi classificada como permanente`;
  });

  // computeNextRunAt avança pro próximo day_offset.
  t('computeNextRunAt_advancesToNextOffset', () => {
    const enrolledAt = new Date('2026-05-01T12:00:00Z');
    const result = computeNextRunAt(enrolledAt, 1, [0, 1, 3, 7]);
    const expected = new Date('2026-05-04T12:00:00Z');
    if (result.isComplete) return 'esperava !isComplete';
    return (
      result.nextRunAt?.getTime() === expected.getTime() ||
      `nextRunAt=${result.nextRunAt?.toISOString()}`
    );
  });

  // computeNextRunAt sem próximo step → completed.
  t('computeNextRunAt_completesWhenNoNext', () => {
    const enrolledAt = new Date('2026-05-01T12:00:00Z');
    const result = computeNextRunAt(enrolledAt, 30, [0, 1, 3, 7, 14, 30]);
    return (
      (result.isComplete && result.nextRunAt === null) ||
      `nextRunAt=${result.nextRunAt} isComplete=${result.isComplete}`
    );
  });

  // computeBackoffNextRunAt — backoff +30min default.
  t('computeBackoffNextRunAt_default30min', () => {
    const now = new Date('2026-05-16T10:00:00Z');
    const result = computeBackoffNextRunAt(now);
    const expected = new Date('2026-05-16T10:30:00Z');
    return result.getTime() === expected.getTime() || `recebi ${result.toISOString()}`;
  });

  // pickNextStep ordena por (day_offset, order_index) e ignora executed.
  t('pickNextStep_ordersAndSkipsExecuted', () => {
    const steps: StepCandidate[] = [
      { id: 's7', day_offset: 7, order_index: 0, channel: 'whatsapp', template_body: 'a' },
      { id: 's1a', day_offset: 1, order_index: 0, channel: 'whatsapp', template_body: 'b' },
      { id: 's1b', day_offset: 1, order_index: 1, channel: 'whatsapp', template_body: 'c' },
      { id: 's0', day_offset: 0, order_index: 0, channel: 'whatsapp', template_body: 'd' },
    ];
    const executed = new Set(['s0', 's1a']);
    const next = pickNextStep(steps, executed);
    return next?.id === 's1b' || `esperava 's1b', recebi '${next?.id}'`;
  });

  t('pickNextStep_returnsNullWhenAllExecuted', () => {
    const steps: StepCandidate[] = [
      { id: 's0', day_offset: 0, order_index: 0, channel: 'whatsapp', template_body: 'a' },
    ];
    return pickNextStep(steps, new Set(['s0'])) === null;
  });

  // dispatchPayloadSchema — strict + uuid validation. Zod 4 valida RFC 4122
  // version 1-8 (não aceita zeros no version nibble), então fixtures usam
  // UUIDs v4 reais.
  const VALID_UUIDS = {
    workspace: 'a1b2c3d4-1234-4567-8901-1234567890ab',
    enrollment: 'b2c3d4e5-1234-4567-8901-2234567890bc',
    lead: 'c3d4e5f6-1234-4567-8901-3234567890cd',
    cadence: 'd4e5f6a7-1234-4567-8901-4234567890de',
    step: 'e5f6a7b8-1234-4567-8901-5234567890ef',
    stepRun: 'f6a7b8c9-1234-4567-8901-6234567890f0',
  };

  t('dispatchPayloadSchema_acceptsValid', () => {
    const payload = {
      workspace_id: VALID_UUIDS.workspace,
      enrollment_id: VALID_UUIDS.enrollment,
      lead_id: VALID_UUIDS.lead,
      cadence_id: VALID_UUIDS.cadence,
      step_id: VALID_UUIDS.step,
      step_run_id: VALID_UUIDS.stepRun,
      scheduled_for: '2026-05-16T10:00:00.000Z',
    };
    const r = dispatchPayloadSchema.safeParse(payload);
    return r.success || `falhou: ${JSON.stringify(r.error.issues)}`;
  });

  t('dispatchPayloadSchema_rejectsExtraProps', () => {
    const payload = {
      workspace_id: VALID_UUIDS.workspace,
      enrollment_id: VALID_UUIDS.enrollment,
      lead_id: VALID_UUIDS.lead,
      cadence_id: VALID_UUIDS.cadence,
      step_id: VALID_UUIDS.step,
      step_run_id: VALID_UUIDS.stepRun,
      scheduled_for: '2026-05-16T10:00:00.000Z',
      extra_field: 'should reject',
    };
    return (
      !dispatchPayloadSchema.safeParse(payload).success || 'aceitou prop extra (strict falhou)'
    );
  });

  t('dispatchPayloadSchema_rejectsInvalidUuid', () => {
    const payload = {
      workspace_id: 'not-a-uuid',
      enrollment_id: VALID_UUIDS.enrollment,
      lead_id: VALID_UUIDS.lead,
      cadence_id: VALID_UUIDS.cadence,
      step_id: VALID_UUIDS.step,
      step_run_id: VALID_UUIDS.stepRun,
      scheduled_for: '2026-05-16T10:00:00.000Z',
    };
    return !dispatchPayloadSchema.safeParse(payload).success || 'aceitou uuid inválido';
  });

  // resolvePlaceholders — regressão (usada pela rota dispatch antes do adapter).
  t('resolvePlaceholders_substitutesAndLeavesUnknownLiteral', () => {
    const out = resolvePlaceholders('Olá {nome} da {empresa}, sobre {produto} e {desconhecido}', {
      nome: 'João',
      empresa: 'Acme',
    });
    const expected = 'Olá João da Acme, sobre {produto} e {desconhecido}';
    return out === expected || `recebi: ${out}`;
  });

  // ── M10#3 — Server Actions (Zod schemas + transforms puros) ─────────────
  // Valida APENAS Zod schemas + helpers de transforms. Não exercita o banco
  // (RBAC + withWorkspace exigem sessão Supabase). Lifecycle end-to-end
  // (enroll → dispatch → step_run) fica pra smoke E2E em M10#5.
  t = run('cadences-actions-m10', results);

  // cadenceCreateSchema aceita templateKey 'alto-ticket' com hífen
  // (alinhado SQL enum, sem precisar mapping em runtime).
  t('cadenceCreateSchema_acceptsAltoTicketHyphen', () => {
    const r = cadenceCreateSchema.safeParse({
      name: 'Cadência alto ticket',
      stageId: STAGE_UUID,
      templateKey: 'alto-ticket',
    });
    return r.success || JSON.stringify(r.error.issues);
  });

  // cadenceCreateSchema rejeita templateKey desconhecido
  t('cadenceCreateSchema_rejectsUnknownTemplateKey', () => {
    const r = cadenceCreateSchema.safeParse({
      name: 'Teste',
      stageId: STAGE_UUID,
      templateKey: 'inexistente',
    });
    return r.success === false;
  });

  // cadenceCreateSchema rejeita stageId que não é UUID (validação de stage
  // terminal vai pro Server Action, que tem acesso ao workspace).
  t('cadenceCreateSchema_rejectsNonUuidStageId', () => {
    const r = cadenceCreateSchema.safeParse({
      name: 'Slug literal',
      stageId: 'ganho',
      templateKey: 'blank',
    });
    return r.success === false;
  });

  // stepCreateSchema rejeita dayOffset fora do enum (5, 10, 60, etc.)
  t('stepCreateSchema_rejectsInvalidDayOffset', () => {
    const offenders = [-1, 2, 5, 10, 60, 100];
    const allRejected = offenders.every(
      (d) =>
        !stepCreateSchema.safeParse({
          dayOffset: d as 0,
          channel: 'whatsapp',
          templateBody: 'corpo válido com mais de dez',
        }).success,
    );
    return allRejected;
  });

  // stepCreateSchema rejeita templateBody muito curto (<10 chars)
  t('stepCreateSchema_rejectsShortBody', () => {
    const r = stepCreateSchema.safeParse({
      dayOffset: 0,
      channel: 'whatsapp',
      templateBody: 'oi',
    });
    return r.success === false;
  });

  // stepCreateSchema aceita body com placeholders {nome}/{empresa}/{produto}
  t('stepCreateSchema_acceptsBodyWithPlaceholders', () => {
    const r = stepCreateSchema.safeParse({
      dayOffset: 1,
      channel: 'whatsapp',
      templateBody: 'Olá {nome}, sobre {produto}, da {empresa}.',
    });
    return r.success || JSON.stringify(r.error.issues);
  });

  // stepCreateSchema aceita channel='email' mesmo com email-stub no runner
  t('stepCreateSchema_acceptsEmailChannel', () => {
    const r = stepCreateSchema.safeParse({
      dayOffset: 7,
      channel: 'email',
      templateBody: 'Email com mais de dez caracteres',
    });
    return r.success || JSON.stringify(r.error.issues);
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const allOk = failed === 0;

  return NextResponse.json(
    {
      summary: { total: results.length, passed, failed, allOk },
      results,
    },
    { status: allOk ? 200 : 500 },
  );
}
