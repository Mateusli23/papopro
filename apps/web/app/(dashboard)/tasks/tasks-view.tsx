'use client';

import * as React from 'react';

import { Badge, Button, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@papopro/ui';
import { ListChecks, PlusCircle } from '@papopro/ui/icons';

import type { SalesRep } from '@/features/leads/types';
import { CalendarView } from '@/features/tasks/components/calendar-view';
import { TaskCreateDialog } from '@/features/tasks/components/task-create-dialog';
import { TaskList } from '@/features/tasks/components/task-list';
import type { LeadComboboxOption } from '@/features/tasks/queries';
import { countTasks } from '@/features/tasks/transforms';
import type { TaskWithLead } from '@/features/tasks/transforms';

type Role = 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer';

/**
 * `/tasks` (M8#4 — server-fed) — central de tarefas do workspace.
 *
 * Recebe `initialTasks` (com lead resolvido), `salesReps`, `leadOptions`,
 * `callerMemberId`, `callerRole` por prop do Server Component pai.
 *
 * 3 abas:
 *  1. **Minhas tarefas** — `assignedTo === callerMemberId`
 *  2. **Time** — todas do workspace
 *  3. **Calendário** — vistas Mês/Semana/Dia (recebe `tasks` via prop)
 *
 * Atalho `n` abre "Nova tarefa". RBAC: Viewer não cria/edita/conclui;
 * Owner/Admin/Manager delete.
 */

interface TasksViewProps {
  initialTasks: TaskWithLead[];
  salesReps: SalesRep[];
  leadOptions: LeadComboboxOption[];
  callerMemberId: string | null;
  callerRole: Role;
}

export function TasksView({
  initialTasks,
  salesReps,
  leadOptions,
  callerMemberId,
  callerRole,
}: TasksViewProps) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [defaultDate, setDefaultDate] = React.useState<Date | undefined>();

  const canEdit = callerRole !== 'Viewer';
  const canDelete = callerRole === 'Owner' || callerRole === 'Admin' || callerRole === 'Manager';

  function openCreate(date?: Date) {
    if (!canEdit) return;
    setDefaultDate(date);
    setCreateOpen(true);
  }

  const myTasks = React.useMemo(
    () => (callerMemberId ? initialTasks.filter((t) => t.assignedTo === callerMemberId) : []),
    [initialTasks, callerMemberId],
  );
  const myCounts = React.useMemo(() => countTasks(myTasks), [myTasks]);
  const teamCounts = React.useMemo(() => countTasks(initialTasks), [initialTasks]);

  return (
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Tarefas"
        description="Suas pendências, do time inteiro e o calendário compartilhado."
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => openCreate()}>
              <PlusCircle /> Nova tarefa
            </Button>
          ) : null
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
            tasks={myTasks}
            salesReps={salesReps}
            canEdit={canEdit}
            canDelete={canDelete}
            showAssignee={false}
            emptyTitle="Sem tarefas atribuídas a você"
            emptyDescription="Quando alguém atribuir uma tarefa pra você (ou você criar uma), ela aparece aqui."
          />
        </TabsContent>

        <TabsContent value="team" className="m-0">
          <TaskList
            tasks={initialTasks}
            salesReps={salesReps}
            canEdit={canEdit}
            canDelete={canDelete}
            emptyTitle="Sem tarefas no workspace"
            emptyDescription="Crie a primeira tarefa pra começar a popular esta lista."
          />
        </TabsContent>

        <TabsContent value="calendar" className="m-0">
          <CalendarView
            onCreateTask={canEdit ? openCreate : undefined}
            tasks={initialTasks}
            salesReps={salesReps}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </TabsContent>
      </Tabs>

      {canEdit && (
        <TaskCreateDialog
          open={createOpen}
          onOpenChange={(o) => {
            setCreateOpen(o);
            if (!o) setDefaultDate(undefined);
          }}
          defaultDueDate={defaultDate}
          salesReps={salesReps}
          leadOptions={leadOptions}
        />
      )}
    </div>
  );
}
