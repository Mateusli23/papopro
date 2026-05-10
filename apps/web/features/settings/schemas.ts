/**
 * Schemas Zod do domínio Configurações.
 *
 * Aplicado em formulários da UI (workspace, invite, etc.) hoje; em M7+ vira
 * input validation de Server Actions sem mudança de shape. Validar na borda,
 * confiar no tipo internamente (CLAUDE.md §5).
 *
 * Mensagens em pt-BR direto, propositivas (CLAUDE.md §7.6).
 */
import { z } from 'zod';

const SEGMENT_VALUES = ['imobiliario', 'b2b', 'servicos', 'outro'] as const;
const ROLE_VALUES = ['owner', 'admin', 'manager', 'vendedor', 'viewer'] as const;
const ROLE_VALUES_INVITE = ['admin', 'manager', 'vendedor', 'viewer'] as const;
const CHANNEL_VALUES = ['inapp', 'push', 'email'] as const;

/** Roles que podem ser atribuídos via convite — `owner` não (só transferência). */
export const INVITE_ROLES = ROLE_VALUES_INVITE;

// ─── Workspace ────────────────────────────────────────────────────────────

export const workspaceUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome muito curto (mín 2 caracteres)')
    .max(80, 'Nome muito longo (máx 80)'),
  segment: z.enum(SEGMENT_VALUES, { error: 'Escolha um segmento' }),
  timezone: z.string().min(1, 'Selecione um fuso horário'),
});
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;

export const workspaceDeleteSchema = z.object({
  /** Para confirmar, o Owner digita o nome do workspace. */
  confirmName: z.string(),
});
export type WorkspaceDeleteInput = z.infer<typeof workspaceDeleteSchema>;

// ─── Membros / convites ───────────────────────────────────────────────────

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Informe o e-mail').email('E-mail inválido'),
  role: z.enum(ROLE_VALUES_INVITE, { error: 'Escolha um papel' }),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const changeRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(ROLE_VALUES, { error: 'Papel inválido' }),
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

export const transferOwnershipSchema = z.object({
  /** ID do membro que vira o novo Owner. */
  newOwnerId: z.string().min(1, 'Escolha um membro'),
});
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

// ─── Notificações ─────────────────────────────────────────────────────────

export const notificationPrefSchema = z.object({
  /** Chave do evento — string aberta aqui, validação fina nas transforms. */
  event: z.string().min(1),
  channel: z.enum(CHANNEL_VALUES, { error: 'Canal inválido' }),
  enabled: z.boolean(),
});
export type NotificationPrefInput = z.infer<typeof notificationPrefSchema>;

// ─── Conexão WhatsApp ─────────────────────────────────────────────────────

/**
 * Form de conexão é trivial em M5 (só clica "Reconectar") — schemas reservados
 * pra M9 quando entrar number provisioning real.
 */
export const reconnectWhatsAppSchema = z.object({
  /** Em M5 sempre vazio; M9 valida número selecionado. */
  numberId: z.string().optional(),
});
export type ReconnectWhatsAppInput = z.infer<typeof reconnectWhatsAppSchema>;

// ─── Integrações ──────────────────────────────────────────────────────────

export const toggleIntegrationSchema = z.object({
  key: z.string().min(1, 'Chave de integração inválida'),
  connect: z.boolean(),
});
export type ToggleIntegrationInput = z.infer<typeof toggleIntegrationSchema>;
