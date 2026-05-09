'use client';

import * as React from 'react';

import { Badge, Button, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@papopro/ui';
import { ListChecks, PlusCircle } from '@papopro/ui/icons';

import { CalendarView } from '@/features/tasks/components/calendar-view';
import { TaskCreateDialog } from '@/features/tasks/components/task-create-dialog';
import { TaskList } from '@/features/tasks/components/task-list';
import { useTasks } from '@/features/tasks/store';
import { countTasks } from '@/features/tasks/transforms';
import { FAKE_USER } from '@/lib/fixtures/user';

/**
 * `/tasks` — central de tarefas do workspace.
 *
 * 3 abas (Tabs Radix horizontal):
 *  1. **Minhas tarefas** — só `assignedTo === FAKE_USER.id` (usuário logado)
 *  2. **Time** — todas do workspace
 *  3. **Calendário** — vistas Mês/Semana/Dia com toggle
 *
 * Atalho global `n` abre o modal "Nova tarefa" (mesmo padrão do Kanban).
 *
 * Em M8 essa view passa a ler `tasks` via Server Component + Prisma RLS,
 * com filtros aplicados server-side. As 3 abas viram queries distintas
 * mas a estrutura de UI sobrevive.
 */

const NOW = new Date('2026-05-09T14:00:00-03:00');

export function TasksView() {
  const tasks = useTasks();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [defaultDate, setDefaultDate] = React.useState<Date | undefined>();

  function openCreate(date?: Date) {
    setDefaultDate(date);
    setCreateOpen(true);
  }

  // Counts pra badges das abas
  const myCounts = React.useMemo(
    () =>
      countTasks(
        tasks.filter((t) => t.assignedTo === FAKE_USER.id),
        NOW,
      ),
    [tasks],
  );
  const teamCounts = React.useMemo(() => countTasks(tasks, NOW), [tasks]);

  return (
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Tarefas"
        description="Suas pendências, do time inteiro e o calendário compartilhado."
        actions={
          <Button size="sm" onClick={() => openCreate()}>
            <PlusCircle /> Nova tarefa
          </Button>
        }
      />

      <Tabs defaultValue="mine" className="flex flex-col gap-4">
        <TabsList className="self-start">
          <TabsTrigger value="mine" className="flex items-center gap-2">
            <ListChecks className="size-4" /> Minhas tarefas
            {myCounts.pending > 0 && (
              <Badge variant="secondary" className="text-caption px-1.5 tabular-nums">
                {myCounts.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="team">
            Time
            {teamCounts.pending > 0 && (
              <Badge variant="secondary" className="text-caption ml-2 px-1.5 tabular-nums">
                {teamCounts.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="m-0">
          <TaskList
            filters={{ assignedTo: FAKE_USER.id }}
            showAssignee={false}
            emptyTitle="Sem tarefas atribuídas a você"
            emptyDescription="Quando alguém atribuir uma tarefa pra você (ou você criar uma), ela aparece aqui."
          />
        </TabsContent>

        <TabsContent value="team" className="m-0">
          <TaskList
            emptyTitle="Sem tarefas no workspace"
            emptyDescription="Crie a primeira tarefa pra começar a popular esta lista."
          />
        </TabsContent>

        <TabsContent value="calendar" className="m-0">
          <CalendarView onCreateTask={openCreate} />
        </TabsContent>
      </Tabs>

      <TaskCreateDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setDefaultDate(undefined);
        }}
        defaultDueDate={defaultDate}
      />
    </div>
  );
}
