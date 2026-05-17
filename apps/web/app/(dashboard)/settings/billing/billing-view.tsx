'use client';

import * as React from 'react';

import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@papopro/ui';
import { CheckCircle2, ExternalLink, ShieldCheck, Sparkles, Zap } from '@papopro/ui/icons';

import { createCheckoutSessionAction, createPortalSessionAction } from '@/features/billing/actions';
import type { BillingStateUI } from '@/features/billing/types';

interface Props {
  initialState: BillingStateUI;
}

/**
 * `/settings/billing` — view client que renderiza estado de billing real
 * (M12#1).
 *
 * **Dois estados visuais:**
 *  - `plan='free'`: card "Plano Free" com bullets do que o Pro entrega + CTA
 *    "Assinar Pro" (chama `createCheckoutSessionAction` e redireciona).
 *  - `plan='pro'`: card "Plano Pro ativo" com próxima cobrança + CTA
 *    "Gerenciar assinatura" (chama `createPortalSessionAction` e abre o
 *    Stripe Customer Portal pra cancelar/atualizar cartão).
 *
 * **Server Action pessimista** (padrão M10#3): toast loading → action →
 * redirect via `window.location.href = url`. Não fazemos `router.push` porque
 * o destino é externo (stripe.com).
 */
export function BillingView({ initialState }: Props) {
  const [pending, setPending] = React.useState(false);

  async function handleSubscribePro() {
    if (pending) return;
    setPending(true);
    const toastId = toast.loading('Abrindo checkout...');
    try {
      const result = await createCheckoutSessionAction({ plan: 'pro' });
      toast.dismiss(toastId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(`Não foi possível abrir o checkout: ${(err as Error).message}`);
    } finally {
      setPending(false);
    }
  }

  async function handleOpenPortal() {
    if (pending) return;
    setPending(true);
    const toastId = toast.loading('Abrindo portal...');
    try {
      const result = await createPortalSessionAction({});
      toast.dismiss(toastId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(`Não foi possível abrir o portal: ${(err as Error).message}`);
    } finally {
      setPending(false);
    }
  }

  const isPro = initialState.plan === 'pro' && initialState.subscription !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cobrança"
        description="Plano atual e gerenciamento da assinatura via Stripe."
      />

      <div className="bg-info/5 border-info/30 text-info flex items-center gap-2 rounded-md border px-4 py-2">
        <ShieldCheck className="size-4 shrink-0" />
        <span className="text-body">Apenas o Owner pode contratar ou cancelar a assinatura.</span>
      </div>

      {isPro ? (
        <ProActiveCard state={initialState} onOpenPortal={handleOpenPortal} pending={pending} />
      ) : (
        <FreeUpgradeCard onSubscribe={handleSubscribePro} pending={pending} />
      )}
    </div>
  );
}

// ─── Free state ────────────────────────────────────────────────────────────

function FreeUpgradeCard({ onSubscribe, pending }: { onSubscribe: () => void; pending: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-title">Plano Free</CardTitle>
          <Badge variant="secondary">Atual</Badge>
        </div>
        <CardDescription>
          Você está usando o PapoPro no plano gratuito com recursos limitados. Assine o Pro pra
          desbloquear o motor de cadência, alertas de lead frio e Inbox WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="border-border bg-muted/30 flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-3xl font-semibold">R$ 197</span>
            <span className="text-muted-foreground text-body">/mês</span>
          </div>
          <ul className="text-body text-muted-foreground flex flex-col gap-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
              <span>Motor de cadência automática — sequências por etapa do funil</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
              <span>Alertas de lead frio por etapa</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
              <span>Inbox WhatsApp unificado com anti-bloqueio</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
              <span>Pipeline ilimitado de leads</span>
            </li>
          </ul>
        </div>

        <Button onClick={onSubscribe} disabled={pending} className="gap-2">
          <Sparkles className="size-4" />
          {pending ? 'Abrindo checkout...' : 'Assinar Pro'}
        </Button>
        <p className="text-caption text-muted-foreground">
          Pagamento via Stripe. Cancele a qualquer momento — sem fidelidade.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Pro state ─────────────────────────────────────────────────────────────

function ProActiveCard({
  state,
  onOpenPortal,
  pending,
}: {
  state: BillingStateUI;
  onOpenPortal: () => void;
  pending: boolean;
}) {
  const sub = state.subscription;
  if (!sub) return null; // Type guard — isPro garante acima.

  const periodEnd = new Date(sub.currentPeriodEnd);
  const daysLeft = differenceInDays(periodEnd, new Date());
  const dateLabel = format(periodEnd, "dd 'de' MMMM", { locale: ptBR });

  const statusBadgeVariant =
    sub.status === 'active' ? 'success' : sub.status === 'past_due' ? 'warning' : 'destructive';
  const statusLabel = {
    active: 'Ativa',
    past_due: 'Pagamento atrasado',
    canceled: 'Cancelada',
    unpaid: 'Não paga',
    incomplete: 'Incompleta',
  }[sub.status];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-title flex items-center gap-2">
            <Zap className="text-primary size-5" />
            Plano Pro
          </CardTitle>
          <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
          {sub.cancelAtPeriodEnd && <Badge variant="warning">Cancelamento agendado</Badge>}
        </div>
        <CardDescription>
          {sub.cancelAtPeriodEnd
            ? `Acesso ao Pro encerra em ${dateLabel} (${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} restantes).`
            : `Próxima cobrança em ${dateLabel} (${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}).`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="text-body grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-caption text-muted-foreground">Valor mensal</dt>
            <dd className="text-foreground font-medium">R$ 197,00</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-caption text-muted-foreground">
              {sub.cancelAtPeriodEnd ? 'Termina em' : 'Renova em'}
            </dt>
            <dd className="text-foreground font-medium">{dateLabel}</dd>
          </div>
        </dl>

        <Button
          variant="outline"
          onClick={onOpenPortal}
          disabled={pending || !state.hasStripeCustomer}
          className="gap-2"
        >
          <ExternalLink className="size-4" />
          {pending ? 'Abrindo portal...' : 'Gerenciar assinatura'}
        </Button>
        <p className="text-caption text-muted-foreground">
          Atualize cartão, baixe faturas ou cancele a assinatura no portal seguro do Stripe.
        </p>
      </CardContent>
    </Card>
  );
}
