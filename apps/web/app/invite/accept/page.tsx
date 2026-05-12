import Link from 'next/link';

import type { Metadata } from 'next';

import { BrandArcs, Button, LogoFull, ThemeToggle } from '@papopro/ui';
import { AlertCircle, ArrowRight } from '@papopro/ui/icons';

import { getInvitationByToken } from '@/features/invitations/queries';
import { getCurrentUser } from '@/lib/auth/get-user';

import { AcceptInvitationForm } from './accept-form';

export const metadata: Metadata = {
  title: 'Convite para workspace',
  description: 'Aceite seu convite e entre no workspace.',
  robots: { index: false, follow: false },
};

/**
 * **`dynamic = 'force-dynamic'` (M7#4 review fix):** a página chama
 * `getInvitationByToken` (admin client) + `getCurrentUser` (server client) que
 * exigem `NEXT_PUBLIC_SUPABASE_URL` no env — sem isso o prerender em CI
 * crasha. Como o output depende do `?token=` e da sessão, nunca seria
 * cacheável estaticamente mesmo; force-dynamic é o flag honesto.
 */
export const dynamic = 'force-dynamic';

interface InviteAcceptPageProps {
  searchParams: { token?: string | string[] };
}

/**
 * `/invite/accept` — landing pública (semi-pública) de convites por email.
 *
 * **4 variantes:**
 *  1. Token ausente/inválido/expirado/revogado → mensagem específica + voltar
 *  2. Token válido + user NÃO logado → CTA pra `/signup?email=<convidado>&next=/invite/accept?token=…`
 *  3. Token válido + user logado mas email diferente → "Saia e entre como X"
 *  4. Token válido + user logado + email bate → form `AcceptInvitationForm`
 *
 * **Por que Server Component:** o token é validado server-side via admin client
 * (bypassa RLS), e a decisão de variante depende de `getCurrentUser`. Renderizar
 * o resultado já decidido evita flash entre estados.
 *
 * **Layout próprio** (não vive em `(auth)/` nem `(dashboard)/`) porque o user
 * pode estar logado ou não, e o card precisa ser visível em ambos os estados.
 * `BrandArcs` permitido aqui (CLAUDE.md §8 — superfície de onboarding).
 */
export default async function InviteAcceptPage({ searchParams }: InviteAcceptPageProps) {
  // **Fix do review M7#4 HIGH #13:** Next entrega `searchParams.token` como
  // `string | string[] | undefined`. Em `?token=a&token=b` vira array — o
  // código original `typeof rawToken === 'string'` descartava tudo silente e
  // caía na variante "Convite não encontrado". Normalizamos pegando o primeiro
  // elemento (UX honesta: o user provavelmente colou o link errado uma vez e
  // tentou de novo), e o Zod do Server Action ainda valida UUID estrito.
  const rawToken = searchParams.token;
  const tokenCandidate = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const token =
    typeof tokenCandidate === 'string' && tokenCandidate.length > 0 ? tokenCandidate : null;

  const invitation = token ? await getInvitationByToken(token) : null;
  const user = await getCurrentUser();

  return (
    <div className="bg-background relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <Link href="/" aria-label="PapoPro">
          <LogoFull />
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-6">
        <div className="relative w-full max-w-md">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-12 -inset-y-16 -z-10 opacity-60"
          >
            <BrandArcs variant="empty-state" absolute={false} className="size-full" />
          </div>

          <div className="border-border bg-card relative flex flex-col gap-6 rounded-lg border p-6 shadow-sm sm:p-8">
            {renderVariant({ invitation, user, token })}
          </div>
        </div>
      </main>
    </div>
  );
}

interface RenderVariantArgs {
  invitation: Awaited<ReturnType<typeof getInvitationByToken>>;
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  token: string | null;
}

function renderVariant({ invitation, user, token }: RenderVariantArgs) {
  // (1) Token ausente ou inválido.
  if (!token || !invitation) {
    return (
      <InvalidState
        title="Convite não encontrado"
        description="O link pode ter sido digitado errado ou o convite foi cancelado. Peça um novo ao Owner do workspace."
      />
    );
  }

  // (1b) Estados terminais do convite (status != pending OU expirado).
  if (invitation.status === 'accepted') {
    return (
      <InvalidState
        title="Convite já aceito"
        description="Esse convite já foi usado. Entre normalmente para acessar o workspace."
        action={{ href: '/login', label: 'Ir para o login' }}
      />
    );
  }
  if (invitation.status === 'revoked') {
    return (
      <InvalidState
        title="Convite cancelado"
        description="O Owner do workspace cancelou esse convite. Peça um novo se ainda quiser entrar."
      />
    );
  }
  const expired = new Date(invitation.expiresAt).getTime() < Date.now();
  if (expired || invitation.status === 'expired') {
    return (
      <InvalidState
        title="Convite expirado"
        description="Convites expiram em 7 dias. Peça um novo ao Owner do workspace."
      />
    );
  }

  // (2) Token válido + user não logado → CTA pra signup ou login.
  if (!user) {
    const next = `/invite/accept?token=${encodeURIComponent(token)}`;
    const emailParam = encodeURIComponent(invitation.email);
    return (
      <LoggedOutState
        invitation={invitation}
        signupHref={`/signup?next=${encodeURIComponent(next)}&email=${emailParam}`}
        loginHref={`/login?next=${encodeURIComponent(next)}`}
      />
    );
  }

  // (3) User logado mas email diferente do convite.
  const callerEmail = (user.email ?? '').toLowerCase();
  const inviteEmail = invitation.email.toLowerCase();
  if (callerEmail !== inviteEmail) {
    return (
      <EmailMismatchState
        callerEmail={user.email ?? '—'}
        invitationEmail={invitation.email}
        workspaceName={invitation.workspaceName}
      />
    );
  }

  // (4) Tudo certo — mostra confirmação.
  return <AcceptInvitationForm invitation={invitation} token={token} />;
}

// =============================================================================
// Variantes
// =============================================================================

function InvalidState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <>
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <AlertCircle className="size-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-title-lg font-semibold">{title}</h1>
        <p className="text-muted-foreground text-body">{description}</p>
      </div>
      <Button asChild variant="outline">
        <Link href={action?.href ?? '/'}>{action?.label ?? 'Voltar para a home'}</Link>
      </Button>
    </>
  );
}

function LoggedOutState({
  invitation,
  signupHref,
  loginHref,
}: {
  invitation: NonNullable<Awaited<ReturnType<typeof getInvitationByToken>>>;
  signupHref: string;
  loginHref: string;
}) {
  return (
    <>
      <span className="text-primary text-caption font-semibold uppercase tracking-wide">
        Convite recebido
      </span>
      <h1 className="text-foreground text-title-lg font-semibold">
        Você foi convidado para o {invitation.workspaceName}
      </h1>
      <p className="text-muted-foreground text-body">
        {invitation.inviterName ? `${invitation.inviterName} te convidou` : 'Você foi convidado'}{' '}
        como <strong className="text-foreground">{invitation.role}</strong>. Crie sua conta com o
        email <strong className="text-foreground">{invitation.email}</strong> para aceitar.
      </p>
      <div className="flex flex-col gap-2">
        <Button asChild size="lg">
          <Link href={signupHref}>
            Criar conta e aceitar
            <ArrowRight />
          </Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href={loginHref}>Já tenho conta — entrar</Link>
        </Button>
      </div>
    </>
  );
}

function EmailMismatchState({
  callerEmail,
  invitationEmail,
  workspaceName,
}: {
  callerEmail: string;
  invitationEmail: string;
  workspaceName: string;
}) {
  return (
    <>
      <div className="bg-warning/15 text-warning flex size-12 items-center justify-center rounded-full">
        <AlertCircle className="size-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-title-lg font-semibold">Email diferente do convite</h1>
        <p className="text-muted-foreground text-body">
          O convite para <strong className="text-foreground">{workspaceName}</strong> foi enviado
          para <strong className="text-foreground">{invitationEmail}</strong>, mas você está logado
          como <strong className="text-foreground">{callerEmail}</strong>.
        </p>
        <p className="text-muted-foreground text-body">
          Saia e entre com o email convidado, ou peça um novo convite para o email atual.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/login">Sair e trocar de conta</Link>
      </Button>
    </>
  );
}
