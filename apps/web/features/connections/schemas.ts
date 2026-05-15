/**
 * Schemas Zod do feature Connections (M9#2).
 *
 * As 3 Server Actions (`connectInstance`, `getConnectionStatus`, `disconnect`)
 * são sem input externo — operam sobre o workspace ativo. Mantemos placeholder
 * schemas exportados pra que futuras evoluções (passar `provider`, `instanceId`
 * explícito) tenham anchor sem refatorar callers.
 *
 * Validar na borda mesmo quando o input é vazio garante que a action rejeita
 * `null`/`undefined` indevido — defense-in-depth (CLAUDE.md §5).
 */
import { z } from 'zod';

/** Input vazio — ação opera sobre o workspace do contexto auth. */
export const connectInstanceSchema = z.object({}).strict();
export type ConnectInstanceInput = z.infer<typeof connectInstanceSchema>;

export const disconnectInstanceSchema = z.object({}).strict();
export type DisconnectInstanceInput = z.infer<typeof disconnectInstanceSchema>;

export const getConnectionStatusSchema = z.object({}).strict();
export type GetConnectionStatusInput = z.infer<typeof getConnectionStatusSchema>;
