'use client';

import * as React from 'react';

import Link from 'next/link';

import { Button } from '@papopro/ui';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from '@papopro/ui/icons';

interface VerifyEmailCardProps {
  /**
   * Email exibido no texto. Em M3 vem opcionalmente do `searchParams`
   * (ex: `/verify-email?email=ana@empresa.com`); quando ausente, mostramos
   * mensagem genérica. Em M7 a Server Action de signup já redireciona com
   * o email no query.
   */
  email?: string;
}

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Tela de espera por confirmação de email. UX:
 *  - Estado inicial: explica que enviamos o email, oferece "Reenviar" com
 *    countdown de 60s pra evitar abuso.
 *  - Após clicar em "Reenviar": estado loading rápido (mock), depois mostra
 *    confirmação "email reenviado" e reinicia o countdown.
 *
 * Em M7, o handler do reenviar vira Server Action chamando
 * `supabase.auth.resend({ type: 'signup', email })`. Hoje é mockado.
 */
export function VerifyEmailCard({ email }: VerifyEmailCardProps) {
  const [secondsLeft, setSecondsLeft] = React.useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = React.useState(false);
  const [resentAt, setResentAt] = React.useState<number | null>(null);

  // Countdown — decrementa de 1 em 1s até zerar; o `setInterval` é encerrado
  // na limpeza do effect quando o componente desmonta ou o cooldown reinicia.
  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  // Mensagem "email reenviado" some depois de 4s pra não competir com o
  // próximo ciclo de countdown.
  React.useEffect(() => {
    if (resentAt === null) return;
    const id = window.setTimeout(() => setResentAt(null), 4000);
    return () => window.clearTimeout(id);
  }, [resentAt]);

  async function handleResend() {
    setResending(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setResending(false);
    setResentAt(Date.now());
    setSecondsLeft(RESEND_COOLDOWN_SECONDS);
  }

  const canResend = secondsLeft === 0 && !resending;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-4">
        <span
          aria-hidden
          className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full"
        >
          <Mail className="size-6" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-foreground text-title-lg font-semibold">Confirme seu email</h1>
          <p className="text-muted-foreground text-body">
            {email ? (
              <>
                Enviamos um link de confirmação para{' '}
                <strong className="text-foreground">{email}</strong>. Abra a mensagem e clique no
                botão para ativar sua conta.
              </>
            ) : (
              <>
                Enviamos um link de confirmação para o email que você cadastrou. Abra a mensagem e
                clique no botão para ativar sua conta.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="border-border bg-muted/40 flex flex-col gap-2 rounded-md border p-4">
        <p className="text-foreground text-body font-medium">Não chegou?</p>
        <ul className="text-muted-foreground text-caption flex list-disc flex-col gap-1 pl-5">
          <li>Verifique a caixa de spam ou promoções.</li>
          <li>O link expira em 24 horas — se passou disso, peça um novo.</li>
          <li>Pode levar até 5 minutos para chegar.</li>
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        {resentAt && (
          <div
            role="status"
            className="bg-success/10 text-success text-body flex items-center gap-2 rounded-md p-3"
          >
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Email reenviado. Confira sua caixa de entrada.</span>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={!canResend}
          onClick={handleResend}
          className="w-full"
        >
          {resending ? (
            <>
              <Loader2 className="animate-spin" />
              Reenviando…
            </>
          ) : canResend ? (
            <>
              <Mail />
              Reenviar email
            </>
          ) : (
            <>Reenviar em {secondsLeft}s</>
          )}
        </Button>

        <Button variant="ghost" asChild className="w-full">
          <Link href="/login">
            <ArrowLeft />
            Voltar para o login
          </Link>
        </Button>
      </div>
    </div>
  );
}
