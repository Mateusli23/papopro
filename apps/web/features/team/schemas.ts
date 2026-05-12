import { z } from 'zod';

import { ALL_ROLES } from '@/lib/auth/require-role';

/**
 * Schemas Zod do feature `team` (M7#5).
 *
 * **Por que aceita `Owner` no `changeRoleSchema`:** transferência de
 * propriedade é uma operação válida do produto, mesmo que ainda não esteja
 * implementada como UI dedicada. A Server Action `changeRoleAction` bloqueia
 * promover/rebaixar Owner inline com microcopy específica ("Use Transferir
 * propriedade…") — falhar no Zod com mensagem genérica perderia o sinal.
 * Quando a tela de transferência entrar (M7#5+/M8), o gate fica na action,
 * o schema continua aceitando.
 */

export const changeRoleSchema = z.object({
  memberId: z.string().uuid('Membro inválido'),
  role: z.enum(ALL_ROLES, { message: 'Escolha um papel válido' }),
});

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

export const removeMemberSchema = z.object({
  memberId: z.string().uuid('Membro inválido'),
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

export const resendInviteSchema = z.object({
  invitationId: z.string().uuid('Convite inválido'),
});

export type ResendInviteInput = z.infer<typeof resendInviteSchema>;
