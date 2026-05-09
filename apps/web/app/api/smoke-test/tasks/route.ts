/**
 * Smoke test de Tasks — valida transforms puras + schemas Zod do
 * domínio Tarefas que alimentam a tela `/tasks`.
 *
 * Existe pra dar confiança nas fórmulas antes de Vitest entrar em M7+,
 * e pra fixar contratos que vão virar Server Actions em M8 (`createTask`,
 * `updateTask`, `listTasksByDay`). Os tipos permanecem; só muda a fonte
 * dos dados (fixture → Postgres com `where: { workspaceId }`).
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/tasks` →
 * `{summary, results}` JSON. HTTP 200 se `failed === 0`, 500 caso contrário.
 */
import { NextResponse } from 'next/server';

import { taskCreateSchema } from '@/features/tasks/schemas';
import {
  applyCreateTask,
  applyToggleDone,
  applyUpdateTask,
  countTasks,
  filterTasks,
  getNextWeekTasks,
  getOverdueTasks,
  getTasksOnDay,
  groupTasksByDay,
} from '@/features/tasks/transforms';
import { FAKE_TASKS } from '@/lib/fixtures/tasks';

interface CheckResult {
  group: string;
  name: string;
  ok: boolean;
  detail?: string;
}

const NOW = new Date('2026-05-09T14:00:00-03:00');

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

export const dynamic = 'force-dynamic';

export function GET() {
  const results: CheckResult[] = [];

  // ── Fixtures ────────────────────────────────────────────────────────────
  let t = run('fixtures', results);
  t(
    'FAKE_TASKS tem ao menos 20 tasks',
    () => FAKE_TASKS.length >= 20 || `length=${FAKE_TASKS.length}`,
  );
  t('IDs únicos', () => new Set(FAKE_TASKS.map((x) => x.id)).size === FAKE_TASKS.length);
  t('mix de status (pending E done)', () => {
    const statuses = new Set(FAKE_TASKS.map((x) => x.status));
    return (statuses.has('pending') && statuses.has('done')) || `só ${[...statuses].join(',')}`;
  });
  t('todos têm dueAt (ISO válido)', () =>
    FAKE_TASKS.every((x) => !Number.isNaN(Date.parse(x.dueAt))),
  );
  t('todos têm assignedTo não-vazio', () =>
    FAKE_TASKS.every((x) => typeof x.assignedTo === 'string' && x.assignedTo.length > 0),
  );

  // ── Filtros ─────────────────────────────────────────────────────────────
  t = run('filters', results);
  t('sem filtro retorna tudo', () => filterTasks(FAKE_TASKS).length === FAKE_TASKS.length);
  t('filtro por assignedTo funciona', () => {
    const filtered = filterTasks(FAKE_TASKS, { assignedTo: 'user_mateus' });
    return filtered.every((x) => x.assignedTo === 'user_mateus');
  });
  t('filtro por status funciona', () => {
    const filtered = filterTasks(FAKE_TASKS, { status: 'done' });
    return filtered.every((x) => x.status === 'done');
  });
  t('filtro por kind funciona', () => {
    const filtered = filterTasks(FAKE_TASKS, { kind: 'call' });
    return filtered.every((x) => x.kind === 'call');
  });
  t('search é case-insensitive', () => {
    const sample = FAKE_TASKS.find((x) => x.title.includes(' '));
    if (!sample) return 'sem sample com espaço';
    const word = sample.title.split(' ')[0]!.toUpperCase();
    return filterTasks(FAKE_TASKS, { search: word }).length > 0;
  });
  t('filtros combinam (AND)', () => {
    const a = filterTasks(FAKE_TASKS, { assignedTo: 'user_mateus' });
    const b = filterTasks(FAKE_TASKS, { assignedTo: 'user_mateus', status: 'pending' });
    return b.length <= a.length;
  });

  // ── Agregações ──────────────────────────────────────────────────────────
  t = run('aggregations', results);
  const counts = countTasks(FAKE_TASKS, NOW);
  t(
    'total === FAKE_TASKS.length',
    () => counts.total === FAKE_TASKS.length || `got ${counts.total}`,
  );
  t(
    'pending + done <= total (snoozed pode existir)',
    () => counts.pending + counts.done <= counts.total,
  );
  t('overdue <= pending', () => counts.overdue <= counts.pending);
  t('todayPending <= pending', () => counts.todayPending <= counts.pending);
  t(
    'counts não-negativos',
    () =>
      counts.total >= 0 &&
      counts.pending >= 0 &&
      counts.done >= 0 &&
      counts.overdue >= 0 &&
      counts.todayPending >= 0,
  );

  // ── Calendário (groupByDay, getTasksOnDay) ──────────────────────────────
  t = run('calendar', results);
  const grouped = groupTasksByDay(FAKE_TASKS);
  t('groupByDay devolve chaves yyyy-MM-dd', () =>
    Object.keys(grouped).every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)),
  );
  t('soma dos buckets === total de tasks', () => {
    const sum = Object.values(grouped).reduce((acc, arr) => acc + arr.length, 0);
    return sum === FAKE_TASKS.length || `got ${sum}, esperado ${FAKE_TASKS.length}`;
  });
  t('cada bucket está ordenado por dueAt asc', () => {
    for (const bucket of Object.values(grouped)) {
      for (let i = 1; i < bucket.length; i++) {
        const prev = bucket[i - 1];
        const curr = bucket[i];
        if (!prev || !curr) continue;
        if (prev.dueAt.localeCompare(curr.dueAt) > 0) return 'desordem dentro do bucket';
      }
    }
    return true;
  });
  t('getTasksOnDay(NOW) retorna só tasks com dueAt no dia', () => {
    const todayTasks = getTasksOnDay(FAKE_TASKS, NOW);
    return todayTasks.every((x) => {
      const due = new Date(x.dueAt);
      return due.getDate() === NOW.getDate() && due.getMonth() === NOW.getMonth();
    });
  });
  t('getNextWeekTasks devolve exatamente 7 dias', () => {
    const week = getNextWeekTasks(FAKE_TASKS, NOW);
    return week.length === 7 || `got ${week.length}`;
  });
  t('getNextWeekTasks dias em ordem cronológica', () => {
    const week = getNextWeekTasks(FAKE_TASKS, NOW);
    for (let i = 1; i < week.length; i++) {
      const prev = week[i - 1];
      const curr = week[i];
      if (!prev || !curr) continue;
      if (prev.day.getTime() >= curr.day.getTime()) return 'desordem';
    }
    return true;
  });

  // ── Overdue ─────────────────────────────────────────────────────────────
  t = run('overdue', results);
  const overdue = getOverdueTasks(FAKE_TASKS, NOW);
  t('overdue todas têm status pending', () => overdue.every((x) => x.status === 'pending'));
  t('overdue todas têm dueAt < NOW', () => overdue.every((x) => new Date(x.dueAt) < NOW));

  // ── Mutações puras ──────────────────────────────────────────────────────
  t = run('mutations', results);
  t('applyCreateTask retorna nova task no topo + array crescido em 1', () => {
    const before = FAKE_TASKS.length;
    const { tasks, created } = applyCreateTask(
      FAKE_TASKS,
      {
        leadId: 'lead_001',
        kind: 'call',
        title: 'Smoke test task',
        assignedTo: 'user_mateus',
        dueAt: '2026-05-15T10:00:00-03:00',
      },
      () => 'task_smoke',
    );
    return (
      tasks.length === before + 1 && tasks[0]?.id === created.id && created.status === 'pending'
    );
  });
  t('applyUpdateTask muda só a task alvo (resto preservado)', () => {
    const targetId = FAKE_TASKS[0]!.id;
    const next = applyUpdateTask(FAKE_TASKS, targetId, { title: 'Renomeada' });
    return (
      next.length === FAKE_TASKS.length &&
      next.find((x) => x.id === targetId)!.title === 'Renomeada' &&
      next[1]?.title === FAKE_TASKS[1]?.title
    );
  });
  t('applyUpdateTask status=done seta doneAt automaticamente', () => {
    const target = FAKE_TASKS.find((x) => x.status === 'pending')!;
    const next = applyUpdateTask(FAKE_TASKS, target.id, { status: 'done' });
    const updated = next.find((x) => x.id === target.id)!;
    return updated.status === 'done' && typeof updated.doneAt === 'string';
  });
  t('applyToggleDone alterna pending ↔ done', () => {
    const pending = FAKE_TASKS.find((x) => x.status === 'pending')!;
    const after1 = applyToggleDone(FAKE_TASKS, pending.id);
    const after2 = applyToggleDone(after1, pending.id);
    return (
      after1.find((x) => x.id === pending.id)!.status === 'done' &&
      after2.find((x) => x.id === pending.id)!.status === 'pending' &&
      after2.find((x) => x.id === pending.id)!.doneAt === undefined
    );
  });
  t(
    'FAKE_TASKS NÃO foi mutado pelas operações acima (imutabilidade)',
    () =>
      FAKE_TASKS[0]!.title !== 'Renomeada' &&
      FAKE_TASKS.find((x) => x.id === 'task_smoke') === undefined,
  );

  // ── Schema Zod ──────────────────────────────────────────────────────────
  t = run('schema', results);
  t(
    'schema rejeita leadId vazio',
    () =>
      !taskCreateSchema.safeParse({
        leadId: '',
        kind: 'call',
        title: 'OK',
        assignedTo: 'user_mateus',
        dueAt: '2026-05-15T10:00:00-03:00',
      }).success,
  );
  t(
    'schema rejeita kind inválido',
    () =>
      !taskCreateSchema.safeParse({
        leadId: 'lead_001',
        kind: 'bogus' as never,
        title: 'OK',
        assignedTo: 'user_mateus',
        dueAt: '2026-05-15T10:00:00-03:00',
      }).success,
  );
  t(
    'schema rejeita dueAt inválido',
    () =>
      !taskCreateSchema.safeParse({
        leadId: 'lead_001',
        kind: 'call',
        title: 'OK',
        assignedTo: 'user_mateus',
        dueAt: 'não é data',
      }).success,
  );
  t(
    'schema rejeita title curto demais',
    () =>
      !taskCreateSchema.safeParse({
        leadId: 'lead_001',
        kind: 'call',
        title: 'a',
        assignedTo: 'user_mateus',
        dueAt: '2026-05-15T10:00:00-03:00',
      }).success,
  );
  t(
    'schema aceita input válido',
    () =>
      taskCreateSchema.safeParse({
        leadId: 'lead_001',
        kind: 'call',
        title: 'Ligar pra Mariana',
        assignedTo: 'user_mateus',
        dueAt: '2026-05-15T10:00:00-03:00',
      }).success,
  );

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const allOk = failed === 0;

  return NextResponse.json(
    {
      summary: {
        total: results.length,
        passed,
        failed,
        allOk,
      },
      results,
    },
    { status: allOk ? 200 : 500 },
  );
}
