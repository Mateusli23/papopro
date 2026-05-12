'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import toast from 'react-hot-toast';

import { Button } from '@papopro/ui';
import { AlertCircle, ArrowRight, Check, Loader2 } from '@papopro/ui/icons';

import { acceptInvitationAction } from '@/features/invitations/actions';
import type { InvitationByToken } from '@/features/invitations/queries';

interface AcceptInvitationFormProps {
  invitation: NonNullable<InvitationByToken>;
  token: string;
}

/**
 * Form de aceite — variante (4) da `/invite/accept`: user logado com email
 * correto confirma entrar no workspace.
 *
 * Submit chama `acceptInvitationAction(token)`, que:
 *  - cria `workspace_member` (role do convite)
 *  - marca invitation como aceito
 *  - registra audit log
 *  - seta cookie `papopro_workspace_id`
 *
 * Pós-sucesso, `router.refresh()` força middleware re-rodar com cookie novo
 * (evita race que mandaria pra /onboarding) antes do `router.push`.
 */
export function AcceptInvitationForm({ invitation, token }: AcceptInvitationFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onAccept() {
    setSubmitting(true);
    setError(null);
    const result = await acceptInvitationAction({ token });
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    toast.success(`Bem-vindo ao ${invitation.workspaceName}!`);
    router.refresh();
    router.push(result.redirectTo);
  }

  return (
    <>
      <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
        <Check className="size-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-primary text-caption font-semibold uppercase tracking-wide">
          Pronto pra entrar
        </span>
        <h1 className="text-foreground text-title-lg font-semibold">
          Entrar no {invitation.workspaceName}
        </h1>
        <p className="text-muted-foreground text-body">
          {invitation.inviterName ? `${invitation.inviterName} te convidou` : 'Você foi convidado'}{' '}
          como <strong className="text-foreground">{invitation.role}</strong>. Confirme pra começar
          a acompanhar leads e conversas do time.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive text-body flex items-start gap-2 rounded-md p-3"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button onClick={onAccept} disabled={submitting} size="lg">
        {submitting ? (
          <>
            <Loader2 className="animate-spin" />
            Entrando…
          </>
        ) : (
          <>
            Aceitar convite
            <ArrowRight />
          </>
        )}
      </Button>
    </>
  );
}
