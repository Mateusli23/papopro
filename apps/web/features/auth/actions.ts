'use server';

/**
 * Server Actions de autenticação — substituem o mock de M3.
 *
 * **Padrão de retorno:** `AuthActionResult` em vez de `redirect()` direto.
 * `redirect()` server-side throws (NEXT_REDIRECT), o que polui o tratamento de
 * erro no RHF e mascara erros reais como "redirect intencional". Retornando
 * `{ ok, redirectTo }` o componente chama `router.push(redirectTo)` no client
 * — navegação fluida + erros limpos.
 *
 * **Validação Zod** na borda (CLAUDE.md §5) — reaproveita os schemas de M3 em
 * [./schemas.ts], então client e server validam pelo mesmo contrato.
 *
 * **Mensagens** sempre em pt-BR direto (CLAUDE.md §7.6) e propositivas. Os
 * códigos canônicos do Supabase Auth são mapeados pra texto de UX abaixo.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@papopro/db';

import { getRequestAuditContext } from '@/lib/audit/context';
import { clearWorkspaceCookie, readWorkspaceCookie } from '@/lib/auth/workspace-cookie';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils/uuid';

import {
  forgotPasswordSchema,
  loginSchema,
  signupSchema,
  updatePasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type SignupInput,
  type UpdatePasswordInput,
} from './schemas';

export type AuthActionResult =
  | { ok: true; redirectTo?: string; message?: string }
  | { ok: false; error: string };

/**
 * URL canônica do app pra montar `emailRedirectTo` no Supabase Auth.
 * Defaults pra `http://localhost:3000` se NEXT_PUBLIC_APP_URL não estiver setado
 * (não deveria acontecer fora de testes — env é exigido no build).
 */
function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

/**
 * `signupAction` — cria conta no Supabase Auth e dispara email de confirmação.
 *
 * Fluxo:
 *  1. Valida Zod (defense-in-depth: client já validou, mas Server Action precisa
 *     revalidar — input pode vir adulterado).
 *  2. `supabase.auth.signUp()` cria user em `auth.users` + envia email de
 *     confirmação via SMTP default Supabase (rate-limit 3/hora, OK pra dev e
 *     validation fechada — migra pra Resend em M7#4).
 *  3. Trigger `on_auth_user_created` (M7#2) espelha em `public.users`.
 *  4. Retorna `redirectTo: '/verify-email'`. Middleware vai impedir acesso a
 *     /dashboard até `email_verified_at != null` (gate por verificação
 *     conforme CLAUDE.md §7.8).
 *
 * **Não vazamos** se o email já existe — Supabase retorna o mesmo `data`
 * shape pra evitar enumeração. Mas se vier `error` com mensagem específica,
 * traduzimos pra pt-BR.
 */
export async function signupAction(
  input: SignupInput,
  options?: { next?: string },
): Promise<AuthActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  // Open-redirect guard espelha o do `/auth/callback`: aceita só paths
  // relativos sem `//`. `next` chega de `/signup?next=…` propagado pelo
  // landing `/invite/accept` ou pelo middleware. Fallback é o fluxo padrão
  // do signup (criar workspace em /onboarding).
  const safeNext =
    options?.next && options.next.startsWith('/') && !options.next.startsWith('//')
      ? options.next
      : '/onboarding';

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email.toLowerCase().trim(),
    password: parsed.data.password,
    options: {
      // Metadata fica em `auth.users.raw_user_meta_data` e o trigger
      // handle_new_auth_user (M7#2 §5.1) copia pra `public.users.name`.
      data: { name: parsed.data.name.trim() },
      // Link no email de confirmação aponta pra /auth/callback, que troca
      // o `?code` por sessão httpOnly e depois redireciona pro `next`. Em
      // M7#4 Onda 2: convites passam `next=/invite/accept?token=…` pra
      // levar o user recém-confirmado direto pro aceite.
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error) {
    if (error.message.includes('already registered') || error.message.includes('User already')) {
      return { ok: false, error: 'Esse email já tem conta — tente entrar ou recuperar a senha.' };
    }
    if (error.message.includes('Password should be') || error.code === 'weak_password') {
      return { ok: false, error: 'Senha muito fraca — use pelo menos 8 caracteres.' };
    }
    if (error.message.includes('rate limit') || error.status === 429) {
      return { ok: false, error: 'Muitas tentativas — aguarde 1 minuto e tente de novo.' };
    }
    return {
      ok: false,
      error: 'Não foi possível criar sua conta agora. Tente de novo em instantes.',
    };
  }

  // Sucesso: signUp cria sessão local (cookies httpOnly via @supabase/ssr) E
  // dispara o email de confirmação. O usuário fica "logado mas sem email
  // verificado" — o middleware reconhece isso e segura /dashboard até
  // confirmar (a tela /verify-email mostra o que esperar).
  return { ok: true, redirectTo: '/verify-email' };
}

/**
 * `loginAction` — autentica com email/senha.
 *
 * O destino pós-login é decidido pelo middleware (que tem visão de workspace):
 *  - sem nenhum `workspace_member` → /onboarding (wizard cria o primeiro)
 *  - 1+ memberships → /dashboard
 *
 * Por isso retornamos genericamente `redirectTo: '/dashboard'` — o middleware
 * corrige pra /onboarding se for o caso, evitando double-bounce.
 */
export async function loginAction(input: LoginInput): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.toLowerCase().trim(),
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { ok: false, error: 'Email ou senha incorretos.' };
    }
    if (error.message.includes('Email not confirmed')) {
      return {
        ok: false,
        error: 'Confirme seu email antes de entrar — verifique sua caixa de entrada.',
      };
    }
    if (error.message.includes('rate limit') || error.status === 429) {
      return { ok: false, error: 'Muitas tentativas — aguarde 1 minuto e tente de novo.' };
    }
    return { ok: false, error: 'Não foi possível entrar agora. Tente de novo em instantes.' };
  }

  // Audit log `user_logged_in` (M7#5). Resolve workspaceId via cookie ativo OU
  // primeiro membership do user. Se nenhum dos dois retorna (user sem
  // workspace, pré-onboarding), skip silente — não polui audit_logs com
  // rows órfãs sem workspace.
  await logLoginEvent(data.user?.id);

  return { ok: true, redirectTo: '/dashboard' };
}

/**
 * Helper interno — não exportado. Resolve workspaceId pra associar o evento
 * `user_logged_in` e grava na `audit_logs`. Non-fatal: falha de audit nunca
 * bloqueia login (UX: "consegui logar mas algo no banco quebrou" = sessão
 * útil; o audit é guardrail, não gating).
 */
async function logLoginEvent(userId: string | undefined): Promise<void> {
  if (!userId) return;

  const cookieWs = readWorkspaceCookie();
  let workspaceId: string | null = cookieWs && isUuid(cookieWs) ? cookieWs : null;

  if (!workspaceId) {
    try {
      const firstMembership = await prisma.workspaceMember.findFirst({
        where: { userId },
        select: { workspaceId: true },
        orderBy: { createdAt: 'asc' },
      });
      workspaceId = firstMembership?.workspaceId ?? null;
    } catch (err) {
      console.error('[loginAction] workspace lookup failed (non-fatal)', err);
      return;
    }
  }

  if (!workspaceId) return; // user sem workspace — login pré-onboarding

  const { ipAddress, userAgent } = getRequestAuditContext();
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        action: 'user_logged_in',
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error('[loginAction] audit log failed (non-fatal)', err);
  }
}

/**
 * `forgotAction` — dispara email de reset de senha.
 *
 * **Sempre retorna `ok: true`** mesmo se o email não existir — guardrail
 * anti-enumeração (LGPD §7.5 — não confirmar existência de cadastro). UX
 * mostra "Email enviado se a conta existir" pra ser honesto.
 */
export async function forgotAction(input: ForgotPasswordInput): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const supabase = createSupabaseServerClient();
  // Erros aqui não são vazados — silenciosamente fingimos sucesso pra não
  // permitir enumeração de emails cadastrados.
  await supabase.auth.resetPasswordForEmail(parsed.data.email.toLowerCase().trim(), {
    // Após click no link, aterriza em /auth/callback que troca code por sessão
    // e redireciona pra /settings/security (página de troca de senha — M7#3).
    redirectTo: `${getAppUrl()}/auth/callback?next=/settings/security`,
  });

  return {
    ok: true,
    message: 'Se essa conta existir, enviamos um email com instruções.',
  };
}

/**
 * `logoutAction` — encerra a sessão Supabase e redireciona pra /login.
 *
 * Diferente das outras, **usa `redirect()` direto** — não há erro a tratar e
 * a UX é "click em sair → estou no login". O `revalidatePath('/', 'layout')`
 * limpa cache de Server Components que dependem do user (sidebar, top bar)
 * pra não mostrar fantasma do session anterior.
 */
export async function logoutAction(): Promise<void> {
  const supabase = createSupabaseServerClient();

  // **Audit ANTES do signOut** (M7#5). Capturamos user + workspace ativo
  // enquanto a sessão ainda existe — depois de `signOut()` o `getUser()` volta
  // null e perdemos o vínculo. Non-fatal: falha de audit não impede o logout
  // (UX: "click em sair → estou no login" é o que importa).
  await logLogoutEvent();

  await supabase.auth.signOut();
  // Limpa o cookie de workspace ativo (M7#4 Onda 3). Sem isso, o user
  // loga com outra conta no mesmo navegador e o middleware ainda enxerga
  // o tenant anterior — `resolveHasWorkspace` retorna true por cookie
  // stale, e a primeira tela mostra dados do membership novo mas com
  // workspace cookie do antigo, gerando 403 em queries que filtram por
  // workspaceId. Limpeza explícita evita o ricochete.
  clearWorkspaceCookie();
  revalidatePath('/', 'layout');
  redirect('/login');
}

async function logLogoutEvent(): Promise<void> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const cookieWs = readWorkspaceCookie();
  if (!cookieWs || !isUuid(cookieWs)) return; // sem workspace ativo, skip

  const { ipAddress, userAgent } = getRequestAuditContext();
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: cookieWs,
        userId: user.id,
        action: 'user_logged_out',
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error('[logoutAction] audit log failed (non-fatal)', err);
  }
}

/**
 * `updatePasswordAction` — troca a senha do user logado.
 *
 * Usado em duas situações:
 *  - Reset por email: forgotAction → email link → /auth/callback?next=/settings/security
 *    (sessão temporária do reset token, com permissão pra `updateUser`).
 *  - Troca proativa em /settings/security (user já logado normalmente).
 *
 * Validação cruza os dois campos do schema (newPassword === confirmPassword)
 * antes de bater no Supabase, evitando round-trip desnecessário.
 */
export async function updatePasswordAction(input: UpdatePasswordInput): Promise<AuthActionResult> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });

  if (error) {
    if (error.message.includes('Password should be') || error.code === 'weak_password') {
      return { ok: false, error: 'Senha muito fraca — use pelo menos 8 caracteres.' };
    }
    if (error.message.includes('same as')) {
      return { ok: false, error: 'A nova senha precisa ser diferente da atual.' };
    }
    return { ok: false, error: 'Não foi possível trocar a senha agora. Tente em instantes.' };
  }

  return { ok: true, message: 'Senha atualizada. Use a nova nas próximas vezes.' };
}

/**
 * `resendVerificationAction` — re-dispara email de confirmação.
 *
 * Usado na tela /verify-email pelo botão "Reenviar email". Rate-limited pelo
 * próprio Supabase (1 req/60s por user). Não exige input — usa o email da
 * sessão atual.
 */
export async function resendVerificationAction(): Promise<AuthActionResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: 'Você precisa estar logado pra reenviar o email.' };
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: user.email,
    options: { emailRedirectTo: `${getAppUrl()}/auth/callback?next=/onboarding` },
  });

  if (error) {
    if (error.message.includes('rate limit') || error.status === 429) {
      return { ok: false, error: 'Aguarde 1 minuto antes de pedir outro email.' };
    }
    return { ok: false, error: 'Não foi possível reenviar agora. Tente em instantes.' };
  }

  return { ok: true, message: 'Email reenviado. Verifique sua caixa de entrada.' };
}
