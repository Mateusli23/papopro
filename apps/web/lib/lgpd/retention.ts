/**
 * Política de retenção de logs (M13#3 — LGPD, CLAUDE.md §7.5).
 *
 * Helpers puros (sem `server-only`) pra serem testáveis no smoke
 * `/api/smoke-test/lgpd`. O job `/api/cron/purge-logs` usa estas funções pra
 * calcular o corte e apagar o que passou do prazo.
 *
 * **Auditoria — 12 meses.** O CLAUDE.md §7.5 prevê 12 meses no Pro/Pro IA e
 * 24 meses no Enterprise. O tier Enterprise ainda não existe no enum
 * `SubscriptionPlan` (só `pro`) — então hoje TODO workspace cai nos 12 meses.
 * Quando o Enterprise entrar, o purge precisa virar per-workspace; até lá o
 * corte global é correto e simples.
 *
 * **Notificações — 30 dias.** PRD §3.2: o sino guarda histórico de 30 dias.
 * A query do sino já filtra 30d na leitura (M13#2); o purge mensal só recupera
 * espaço das linhas que ninguém mais vê.
 */
import { subDays, subMonths } from 'date-fns';

/** Retenção padrão de `audit_logs` (Pro/Pro IA). Enterprise = 24 (futuro). */
export const AUDIT_RETENTION_MONTHS = 12;

/** Retenção do feed `notifications` (sino in-app, PRD §3.2). */
export const NOTIFICATION_RETENTION_DAYS = 30;

/**
 * Data-corte da auditoria: registros com `created_at` anterior a ela podem
 * ser apagados.
 */
export function computeAuditCutoff(now: Date): Date {
  return subMonths(now, AUDIT_RETENTION_MONTHS);
}

/** Data-corte do feed de notificações in-app. */
export function computeNotificationCutoff(now: Date): Date {
  return subDays(now, NOTIFICATION_RETENTION_DAYS);
}
