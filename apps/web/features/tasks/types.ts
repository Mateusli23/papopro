/**
 * Tipos do domínio Tasks (Tarefas).
 *
 * O tipo `Task` base já existe em `features/leads/types.ts` (foi criado em
 * M4 quando tasks viraram parte do detalhe do lead). Aqui re-exportamos
 * pra que o módulo `features/tasks/` seja a fonte canônica daqui em
 * diante, sem quebrar imports existentes do lead detail.
 *
 * Em M8 vira tabela `tasks` no Postgres com FK pra `leads.id` e
 * `workspace_members.id`. A shape permanece — só a fonte muda.
 */
export type { Task, TaskKind, TaskStatus } from '@/features/leads/types';
