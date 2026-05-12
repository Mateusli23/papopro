import { z } from 'zod';

/**
 * Schemas Zod das telas de autenticação e onboarding.
 *
 * Mantidos juntos no `features/auth/` (CLAUDE.md §4 — colocation por feature)
 * para que login, signup e onboarding compartilhem regras (ex: senha mínima)
 * e a substituição em M7 — quando o submit virar Server Action real contra o
 * Supabase Auth — seja localizada e isolada.
 *
 * Mensagens em pt-BR direto e propositivas (CLAUDE.md §5 + §7.6) — o usuário
 * lê o erro e sabe o que fazer.
 */

const PASSWORD_MIN = 8;

/**
 * Bloqueia control chars (incluindo `\r\n`) em campos textuais — defense-in-
 * depth contra email header injection (M7#4 review CRÍTICO #4): `users.name`
 * é interpolado no subject do email de convite, e Resend repassa subject como
 * header MIME. Newline no nome permitiria adicionar `Bcc:` arbitrário.
 *
 * Igual ao helper em `features/workspace/schemas.ts` — duplicado de
 * propósito pra cada feature evoluir suas validações sem importar
 * cruzado. Se virar 3+ usos, extrair pra `lib/utils/strings.ts`.
 */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe seu email')
    .email('Email inválido — confira o formato (exemplo: voce@empresa.com)'),
  password: z.string().min(1, 'Informe sua senha'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe seu nome')
    .min(2, 'Nome muito curto')
    .max(80, 'Nome muito longo (máx. 80 caracteres)')
    // M7#4 review CRÍTICO #4: bloqueia `\r\n` no nome (vai virar subject de
    // email em convites; Resend repassa como header MIME).
    .refine((v) => !hasControlChars(v), { message: 'O nome tem caracteres inválidos' }),
  email: z
    .string()
    .min(1, 'Informe seu email')
    .email('Email inválido — confira o formato (exemplo: voce@empresa.com)'),
  password: z
    .string()
    .min(1, 'Crie uma senha')
    .min(PASSWORD_MIN, `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres`),
  // Usamos `boolean().refine(...)` em vez de `literal(true)` propositalmente:
  // o tipo inferido fica `boolean`, então o RHF aceita `false` como
  // `defaultValue` (campo "desmarcado"); só na validação a regra de aceite
  // é aplicada.
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: 'É preciso aceitar os termos para continuar',
  }),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe seu email')
    .email('Email inválido — confira o formato (exemplo: voce@empresa.com)'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Schema de troca de senha — usado em `/settings/security` e no fim do fluxo
 * de recuperação (forgot → email link → /auth/callback → /settings/security).
 *
 * `refine` cruza os dois campos pra exigir que confirmação bata. Mensagem
 * de erro aterrissa em `confirmPassword` (não em `newPassword`) — UX padrão
 * de "marca o campo da divergência".
 */
export const updatePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(1, 'Crie uma nova senha')
      .min(PASSWORD_MIN, `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres`),
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

export const onboardingSchema = z.object({
  workspaceName: z
    .string()
    .min(1, 'Dê um nome ao workspace')
    .min(2, 'Nome muito curto')
    .max(60, 'Nome muito longo (máx. 60 caracteres)'),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
