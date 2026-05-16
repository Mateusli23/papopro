/**
 * Tipos internos do motor de despacho (M10#2).
 *
 * **Por que string literals e não enums Prisma**: M10#1 criou os ENUMs no
 * Postgres (`cadence_step_run_status`, `cadence_step_run_skip_reason`,
 * `cadence_enrollment_status`, `cadence_enrollment_pause_reason`) mas NÃO
 * adicionou os modelos correspondentes em `schema.prisma`. Em M10#2 a rota
 * dispatch usa `$queryRaw`/`$executeRaw` pra acessar essas tabelas, então
 * tipamos via union local. Quando M10#3 adicionar os modelos Prisma, este
 * arquivo pode re-exportar de `@papopro/db` sem quebrar o resto.
 */

export type CadenceStepRunStatus = 'pending' | 'sent' | 'skipped' | 'failed';

export type CadenceStepRunSkipReason =
  | 'email_stub'
  | 'outside_business_hours'
  | 'blacklist'
  | 'rate_limit'
  | 'unhealthy'
  | 'no_phone'
  | 'lead_deleted'
  | 'workspace_paused';

export type CadenceEnrollmentStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export type CadenceEnrollmentPauseReason =
  | 'lead_replied'
  | 'manual'
  | 'stage_changed'
  | 'disconnected'
  | 'admin';

export type CadenceStepChannel = 'whatsapp' | 'email';
