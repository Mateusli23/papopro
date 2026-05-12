import { z } from 'zod';

/**
 * Schemas Zod do feature `invitations` (M7#4 Onda 2).
 *
 * Casamento com schema.prisma:
 *  - `Invitation.email` é `@db.Citext` (case-insensitive); aqui normalizamos
 *    no Server Action via `toLowerCase().trim()` antes do insert.
 *  - `Invitation.role` é o enum `Role` (Owner | Admin | Manager | Vendedor | Viewer).
 *  - `Invitation.token` é UUID gerado pelo banco (`gen_random_uuid()`).
 *
 * **Não convidar como Owner.** Owner é o criador do workspace; transferência
 * de propriedade é fluxo separado (Onda 3 / M7#5) com confirmação dupla.
 * Lista de papéis convidáveis exclui Owner intencionalmente.
 */

export const INVITABLE_ROLES = ['Admin', 'Manager', 'Vendedor', 'Viewer'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const invitationCreateSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe o email do convidado')
    .email('Email inválido — confira o formato (exemplo: pessoa@empresa.com)')
    .max(254, 'Email muito longo'),
  role: z.enum(INVITABLE_ROLES, {
    message: 'Escolha um papel válido',
  }),
});

export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;

/**
 * Schema do aceite — só o token vem do form. Caller carrega o `userId` da
 * sessão atual e o action valida que o email da sessão bate com o do convite.
 */
export const invitationAcceptSchema = z.object({
  token: z.string().uuid('Token de convite inválido'),
});

export type InvitationAcceptInput = z.infer<typeof invitationAcceptSchema>;

/**
 * Schema de revogação — usado em `/settings/team` (M7#5) e na própria
 * Onda 2 pra cancelar convites pendentes pelo owner.
 */
export const invitationRevokeSchema = z.object({
  invitationId: z.string().uuid('Convite inválido'),
});

export type InvitationRevokeInput = z.infer<typeof invitationRevokeSchema>;
