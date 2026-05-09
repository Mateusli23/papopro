/**
 * Tarefas mockadas — pendentes pra leads ativos. Cada lead com `nextActionLabel`
 * recebe uma task pendente com a mesma label e o `nextActionAt` como `dueAt`.
 *
 * Em M8 isso vira a tabela `tasks`; aqui é só pra o painel "Próximas ações"
 * da página de detalhe ter conteúdo natural.
 */
import { addDays, parseISO, subDays } from 'date-fns';

import type { Task } from '@/features/leads/types';

import { FAKE_LEADS } from './leads';

let ID = 0;
function nextId(): string {
  ID += 1;
  return `task_${ID.toString().padStart(5, '0')}`;
}

const NOW = new Date('2026-05-09T14:00:00-03:00');

const TASKS: Task[] = [];

for (const lead of FAKE_LEADS) {
  if (!lead.nextActionLabel || !lead.nextActionAt) continue;
  // Heurística leve pra inferir kind a partir da label.
  const label = lead.nextActionLabel.toLowerCase();
  let kind: Task['kind'] = 'follow_up';
  if (label.includes('liga') || label.includes('call')) kind = 'call';
  else if (label.includes('whatsapp') || label.includes('mensagem')) kind = 'whatsapp';
  else if (label.includes('reuni') || label.includes('apresenta') || label.includes('demo'))
    kind = 'meeting';
  else if (label.includes('email') || label.includes('material') || label.includes('proposta'))
    kind = 'email';

  TASKS.push({
    id: nextId(),
    leadId: lead.id,
    kind,
    title: lead.nextActionLabel,
    dueAt: lead.nextActionAt,
    status: 'pending',
    assignedTo: lead.assignedTo,
    createdAt: subDays(NOW, 1).toISOString(),
  });
}

// Algumas tasks concluídas pros leads "ricos" (mostra histórico no painel direito).
TASKS.push({
  id: nextId(),
  leadId: 'lead_016',
  kind: 'call',
  title: 'Call de descoberta',
  dueAt: subDays(NOW, 3).toISOString(),
  status: 'done',
  assignedTo: 'user_mateus',
  createdAt: subDays(NOW, 4).toISOString(),
  doneAt: subDays(NOW, 3).toISOString(),
});

TASKS.push({
  id: nextId(),
  leadId: 'lead_029',
  kind: 'meeting',
  title: 'Reunião com sócia',
  dueAt: subDays(NOW, 14).toISOString(),
  status: 'done',
  assignedTo: 'user_carla',
  createdAt: subDays(NOW, 18).toISOString(),
  doneAt: subDays(NOW, 14).toISOString(),
});

TASKS.push({
  id: nextId(),
  leadId: 'lead_037',
  kind: 'meeting',
  title: 'Demo executiva',
  dueAt: subDays(NOW, 25).toISOString(),
  status: 'done',
  assignedTo: 'user_juliana',
  createdAt: subDays(NOW, 26).toISOString(),
  doneAt: subDays(NOW, 25).toISOString(),
});

export const FAKE_TASKS: Task[] = TASKS;

export function getTasksForLead(leadId: string): Task[] {
  return TASKS.filter((t) => t.leadId === leadId).sort(
    (a, b) => parseISO(a.dueAt).getTime() - parseISO(b.dueAt).getTime(),
  );
}

export function _addDays(date: Date, n: number): Date {
  return addDays(date, n);
}
