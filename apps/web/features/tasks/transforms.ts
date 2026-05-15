/**
 * Transformações puras do domínio Tasks.
 *
 * Toda função aqui é pura: recebe `Task[]` (e parâmetros), devolve
 * `Task[]` ou agregação. Sem side-effects, sem React. O store
 * (`store.ts`) é wrapper fino que aplica essas transformações ao
 * snapshot atual.
 *
 * Em M8 cada função vira core de Server Actions correspondentes
 * (`createTask`, `updateTask`, `completeTask`, `listTasksByDay`).
 * Os tipos e contratos de retorno permanecem.
 */
import { addDays, endOfDay, format, isWithinInterval, parseISO, startOfDay } from 'date-fns';

import type { TaskCreateInput, TaskUpdateInput } from './schemas';
import type { Task, TaskKind, TaskStatus } from './types';

// =============================================================================
// Prisma row → UI shape (M8#4 — server-fed tasks)
// =============================================================================

/**
 * Shape mínimo da row Prisma `Task` (com `lead` opcional via include) que
 * `toTaskUI` espera. Definido aqui pra desacoplar transforms de `@papopro/db`
 * em runtime — qualquer arquivo client/smoke pode usar sem puxar engine.
 */
export interface PrismaTaskRow {
  id: string;
  leadId: string;
  kind: TaskKind;
  title: string;
  notes: string | null;
  dueAt: Date;
  status: TaskStatus;
  assignedToId: string;
  doneAt: Date | null;
  createdAt: Date;
  /** Opcional via `include: { lead: { ... } }` — `/tasks` precisa do nome do lead. */
  lead?: { id: string; name: string; company: string | null };
}

/**
 * Task UI estendida que carrega nome do lead pra renderizar em /tasks
 * sem fetch adicional. Quando o caller é a ficha do lead (já tem o lead),
 * `leadName`/`leadCompany` ficam undefined.
 */
export interface TaskWithLead extends Task {
  leadName?: string;
  leadCompany?: string;
}

export function toTaskUI(row: PrismaTaskRow): TaskWithLead {
  return {
    id: row.id,
    leadId: row.leadId,
    kind: row.kind,
    title: row.title,
    notes: row.notes ?? undefined,
    dueAt: row.dueAt.toISOString(),
    status: row.status,
    assignedTo: row.assignedToId,
    doneAt: row.doneAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    leadName: row.lead?.name,
    leadCompany: row.lead?.company ?? undefined,
  };
}

// =============================================================================
// Next action computation (M8#4 — denormalização Lead.nextActionAt/Label)
// =============================================================================

/**
 * Calcula qual é a "próxima ação" pendente do lead. Retorna `null` quando
 * não há tasks pending. Ordem: `dueAt ASC` (mais cedo primeiro), critério
 * de desempate `createdAt ASC` (criada antes vence).
 *
 * Reusada na Server Action `recomputeLeadNextAction` (mas implementada
 * separadamente lá com Prisma `findFirst`).
 */
export interface PendingTaskRef {
  dueAt: string;
  title: string;
  createdAt: string;
  status: TaskStatus;
}

export function computeNextActionFromTasks(
  tasks: readonly PendingTaskRef[],
): { dueAt: string; title: string } | null {
  const pending = tasks.filter((t) => t.status === 'pending');
  if (pending.length === 0) return null;
  // Sort estável: dueAt asc, depois createdAt asc.
  const sorted = [...pending].sort((a, b) => {
    const byDue = a.dueAt.localeCompare(b.dueAt);
    if (byDue !== 0) return byDue;
    return a.createdAt.localeCompare(b.createdAt);
  });
  const next = sorted[0]!;
  return { dueAt: next.dueAt, title: next.title };
}

// ─── Mutações puras ───────────────────────────────────────────────────────

export function applyCreateTask(
  tasks: Task[],
  input: TaskCreateInput,
  idGen: () => string,
  now: string = new Date().toISOString(),
): { tasks: Task[]; created: Task } {
  const created: Task = {
    id: idGen(),
    leadId: input.leadId,
    kind: input.kind,
    title: input.title,
    notes: input.notes,
    dueAt: input.dueAt,
    status: 'pending',
    assignedTo: input.assignedTo,
    createdAt: now,
  };
  return { tasks: [created, ...tasks], created };
}

export function applyUpdateTask(
  tasks: Task[],
  id: string,
  patch: TaskUpdateInput,
  now: string = new Date().toISOString(),
): Task[] {
  return tasks.map((t) => {
    if (t.id !== id) return t;
    const next: Task = { ...t, ...patch };
    // doneAt é setado automaticamente quando status vira 'done' (a menos
    // que o caller passe explicitamente — caso da reabertura).
    if (patch.status === 'done' && !patch.doneAt) {
      next.doneAt = now;
    } else if (patch.status === 'pending') {
      next.doneAt = undefined;
    }
    return next;
  });
}

/** Toggle done/pending — atalho pro caso comum. */
export function applyToggleDone(
  tasks: Task[],
  id: string,
  now: string = new Date().toISOString(),
): Task[] {
  const t = tasks.find((x) => x.id === id);
  if (!t) return tasks;
  return applyUpdateTask(tasks, id, { status: t.status === 'done' ? 'pending' : 'done' }, now);
}

// ─── Filtros / queries puras ──────────────────────────────────────────────

export interface TaskFilters {
  /** ID do vendedor — `undefined` = todos. */
  assignedTo?: string;
  /** Status. `undefined` = todos. */
  status?: Task['status'];
  /** Tipo. `undefined` = todos. */
  kind?: Task['kind'];
  /** Busca em `title` (case-insensitive). */
  search?: string;
}

export function filterTasks(tasks: Task[], filters: TaskFilters = {}): Task[] {
  const search = filters.search?.trim().toLowerCase();
  return tasks.filter((t) => {
    if (filters.assignedTo && t.assignedTo !== filters.assignedTo) return false;
    if (filters.status && t.status !== filters.status) return false;
    if (filters.kind && t.kind !== filters.kind) return false;
    if (search && !t.title.toLowerCase().includes(search)) return false;
    return true;
  });
}

/** Tasks atrasadas: `dueAt` no passado e `status === 'pending'`. */
export function getOverdueTasks(tasks: Task[], now: Date = new Date()): Task[] {
  return tasks.filter((t) => t.status === 'pending' && parseISO(t.dueAt) < now);
}

/** Tasks dentro de um intervalo de datas (inclui ambas as pontas). */
export function getTasksInRange(tasks: Task[], start: Date, end: Date): Task[] {
  return tasks.filter((t) => isWithinInterval(parseISO(t.dueAt), { start, end }));
}

/**
 * Tasks de um dia específico — usadas pelo grid do calendário.
 * Inclui qualquer task com `dueAt` no intervalo `[startOfDay, endOfDay]`.
 */
export function getTasksOnDay(tasks: Task[], day: Date): Task[] {
  return getTasksInRange(tasks, startOfDay(day), endOfDay(day));
}

/**
 * Mapa `yyyy-MM-dd` → Task[] pra renderizar mês/semana sem fazer N filters.
 * Usar com `Object.entries(map)` ou direct lookup `map[date]`.
 */
export function groupTasksByDay(tasks: Task[]): Record<string, Task[]> {
  const map: Record<string, Task[]> = {};
  for (const t of tasks) {
    const key = format(parseISO(t.dueAt), 'yyyy-MM-dd');
    if (!map[key]) map[key] = [];
    map[key].push(t);
  }
  // Ordena cada bucket por dueAt asc — mais cedo primeiro
  for (const key of Object.keys(map)) {
    map[key]!.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }
  return map;
}

// ─── Agregações pra dashboards/headers ────────────────────────────────────

export interface TaskCounts {
  total: number;
  pending: number;
  done: number;
  overdue: number;
  todayPending: number;
}

export function countTasks(tasks: Task[], now: Date = new Date()): TaskCounts {
  const startToday = startOfDay(now);
  const endToday = endOfDay(now);

  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    done: tasks.filter((t) => t.status === 'done').length,
    overdue: getOverdueTasks(tasks, now).length,
    todayPending: tasks.filter(
      (t) =>
        t.status === 'pending' &&
        isWithinInterval(parseISO(t.dueAt), { start: startToday, end: endToday }),
    ).length,
  };
}

/**
 * "Próximos 7 dias" agrupados por dia — útil pra preview lateral
 * em vista de mês ou widget de "esta semana".
 */
export function getNextWeekTasks(
  tasks: Task[],
  now: Date = new Date(),
): { day: Date; tasks: Task[] }[] {
  const end = addDays(now, 7);
  const inRange = getTasksInRange(tasks, startOfDay(now), endOfDay(end));
  const grouped = groupTasksByDay(inRange);
  const days: { day: Date; tasks: Task[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(startOfDay(now), i);
    const key = format(day, 'yyyy-MM-dd');
    days.push({ day, tasks: grouped[key] ?? [] });
  }
  return days;
}
