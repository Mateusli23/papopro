/**
 * Re-export dos enums de cadência do Prisma client (M10#3).
 *
 * **Histórico**: M10#1 criou os ENUMs no Postgres (`cadence_step_run_status`,
 * `cadence_step_run_skip_reason`, etc.) sem adicionar os modelos
 * correspondentes em `schema.prisma`. M10#2 usou string literal types locais
 * pra não bloquear na falta dos modelos Prisma. M10#3 finalmente adiciona os
 * 6 modelos + 8 enums em schema.prisma; este arquivo agora só re-exporta de
 * `@papopro/db` mantendo a API pública que `route.ts` e
 * `map-antiban-reason.ts` consomem.
 *
 * **Defense-in-depth**: os tipos importados aqui são derivados do Prisma
 * client, então qualquer mudança no enum no schema.prisma propaga
 * automaticamente. Não há risco de drift com o SQL.
 */

export {
  CadenceStepRunStatus,
  CadenceStepRunSkipReason,
  CadenceEnrollmentStatus,
  CadenceEnrollmentPauseReason,
  CadenceStepChannel,
} from '@papopro/db';
