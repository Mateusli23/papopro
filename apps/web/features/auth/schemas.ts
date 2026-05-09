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
    .max(80, 'Nome muito longo (máx. 80 caracteres)'),
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

export const onboardingSchema = z.object({
  workspaceName: z
    .string()
    .min(1, 'Dê um nome ao workspace')
    .min(2, 'Nome muito curto')
    .max(60, 'Nome muito longo (máx. 60 caracteres)'),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
