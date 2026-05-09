'use client';

import * as React from 'react';

import { Badge, Button, cn, Separator } from '@papopro/ui';
import {
  Calendar,
  CheckCircle2,
  Mail,
  MessageCircle,
  Phone,
  PlusCircle,
  Send,
  type LucideIcon,
} from '@papopro/ui/icons';

import { getTasksForLead } from '@/lib/fixtures/tasks';
import { formatDateShort, formatRelative } from '@/lib/utils/format';

import type { Task, TaskKind } from '../types';

const KIND_META: Record<TaskKind, { Icon: LucideIcon; label: string; tone: string }> = {
  call: { Icon: Phone, label: 'Ligação', tone: 'bg-primary/15 text-primary' },
  whatsapp: { Icon: MessageCircle, label: 'WhatsApp', tone: 'bg-success/15 text-success' },
  email: { Icon: Mail, label: 'Email', tone: 'bg-info/15 text-info' },
  meeting: { Icon: Calendar, label: 'Reunião', tone: 'bg-primary/15 text-primary' },
  follow_up: { Icon: Send, label: 'Follow-up', tone: 'bg-warning/20 text-warning' },
  other: { Icon: CheckCircle2, label: 'Outro', tone: 'bg-muted text-muted-foreground' },
};

const QUICK_ACTIONS: { label: string; Icon: LucideIcon; tone: string }[] = [
  { label: 'Mandar mensagem', Icon: MessageCircle, tone: 'bg-success/10 text-success' },
  { label: 'Ligar', Icon: Phone, tone: 'bg-primary/10 text-primary' },
  { label: 'Agendar reunião', Icon: Calendar, tone: 'bg-info/10 text-info' },
  { label: 'Adicionar tarefa', Icon: PlusCircle, tone: 'bg-warning/10 text-warning' },
];

/**
 * Painel direito da página de detalhe — tarefas pendentes, atalhos rápidos
 * e histórico recente. Em M5 os "atalhos" viram modais funcionais
 * (ligação registra atividade, mensagem abre composer da inbox); aqui são
 * placeholders visuais que mostram o layout final.
 */
export function LeadNextActions({ leadId }: { leadId: string }) {
  const tasks = React.useMemo(() => getTasksForLead(leadId), [leadId]);
  const pending = tasks.filter((t) => t.status === 'pending');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <aside
      aria-label="Próximas ações"
      className="border-border bg-card flex flex-col gap-4 rounded-lg border p-5"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-title text-foreground">Próximas ações</h2>
        <Badge variant={pending.length === 0 ? 'secondary' : 'warning'}>
          {pending.length} pendentes
        </Badge>
      </header>

      {pending.length === 0 ? (
        <p className="text-body text-muted-foreground">
          Nenhuma tarefa pendente. Os atalhos abaixo criam novas em segundos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </ul>
      )}

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-caption text-muted-foreground font-medium">Atalhos rápidos</span>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.Icon;
            return (
              <Button
                key={a.label}
                variant="outline"
                size="sm"
                className="h-auto flex-col gap-2 px-3 py-3"
                disabled
                aria-label={a.label}
              >
                <span
                  className={cn('flex size-8 items-center justify-center rounded-full', a.tone)}
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
                <span className="text-caption text-foreground font-medium">{a.label}</span>
              </Button>
            );
          })}
        </div>
        <p className="text-caption text-muted-foreground/70">Funcionais a partir do M5.</p>
      </div>

      {done.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <span className="text-caption text-muted-foreground font-medium">
              Concluídas ({done.length})
            </span>
            <ul className="flex flex-col gap-1.5">
              {done.slice(0, 5).map((t) => {
                const meta = KIND_META[t.kind];
                const Icon = meta.Icon;
                return (
                  <li key={t.id} className="flex items-center gap-2">
                    <CheckCircle2 className="text-success size-3.5 shrink-0" />
                    <Icon className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="text-caption text-muted-foreground line-through">
                      {t.title}
                    </span>
                    <span className="text-caption text-muted-foreground/70 ml-auto shrink-0">
                      {formatDateShort(t.doneAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </aside>
  );
}

function TaskItem({ task }: { task: Task }) {
  const meta = KIND_META[task.kind];
  const Icon = meta.Icon;
  return (
    <li className="border-border bg-background flex gap-3 rounded-md border p-3">
      <span
        className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', meta.tone)}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body text-foreground font-medium">{task.title}</span>
        <span className="text-caption text-muted-foreground">
          {meta.label} · {formatRelative(task.dueAt)}
        </span>
      </div>
      <Button variant="ghost" size="sm" className="h-7 self-start" disabled>
        Concluir
      </Button>
    </li>
  );
}
