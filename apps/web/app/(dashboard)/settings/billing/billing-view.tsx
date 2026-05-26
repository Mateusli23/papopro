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
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
  Zap,
} from '@papopro/ui/icons';

import { createCheckoutSessionAction, createPortalSessionAction } from '@/features/billing/actions';
import type { BillingStateUI, TrialStateUI } from '@/features/billing/types';
import type { LimitStateUI, WorkspaceUsageUI } from '@/lib/limits';

interface Props {
  initialState: BillingStateUI;
  initialUsage: WorkspaceUsageUI;
}

/**
 * `/settings/billing` — view client que renderiza estado de billing real
 * + uso atual + comparação Free vs Pro (M12#1 + M12#4).
 *
 * **Três blocos:**
 *  1. Cabeçalho com aviso "apenas Owner contrata".
 *  2. Card principal — Free ou Pro ativo (CTA contextual).
 *  3. Tabela "Free vs Pro" com limites + ✓ por feature.
 *
 * **Server Action pessimista** (padrão M10#3): toast loading → action →
 * redirect via `window.location.href = url`. Não fazemos `router.push` porque
 * o destino é externo (stripe.com).
 */
export function BillingView({ initialState, initialUsage }: Props) {
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
  const trial = initialState.trial;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cobrança"
        description="Plano atual, uso e gerenciamento da assinatura via Stripe."
      />

      <div className="bg-info/5 border-info/30 text-info flex items-center gap-2 rounded-md border px-4 py-2">
        <ShieldCheck className="size-4 shrink-0" />
        <span className="text-body">Apenas o Owner pode contratar ou cancelar a assinatura.</span>
      </div>

      {trial && trial.status === 'active' ? (
        <TrialActiveCard
          trial={trial}
          usage={initialUsage}
          onSubscribe={handleSubscribePro}
          pending={pending}
        />
      ) : isPro ? (
        <ProActiveCard
          state={initialState}
          usage={initialUsage}
          onOpenPortal={handleOpenPortal}
          pending={pending}
        />
      ) : (
        <FreeUpgradeCard
          usage={initialUsage}
          expiredTrial={trial && trial.status === 'expired' ? trial : null}
          onSubscribe={handleSubscribePro}
          pending={pending}
        />
      )}

      <PlanComparisonTable
        currentPlan={isPro ? 'pro' : 'free'}
        usage={initialUsage}
        onSubscribe={handleSubscribePro}
        pending={pending}
      />
    </div>
  );
}

// ─── Trial state ───────────────────────────────────────────────────────────

function TrialActiveCard({
  trial,
  usage,
  onSubscribe,
  pending,
}: {
  trial: TrialStateUI;
  usage: WorkspaceUsageUI;
  onSubscribe: () => void;
  pending: boolean;
}) {
  const endDate = format(new Date(trial.endsAt), "dd 'de' MMMM", { locale: ptBR });
  const urgent = trial.daysLeft <= 2;
  const daysLabel = trial.daysLeft === 1 ? 'Falta 1 dia' : `Faltam ${trial.daysLeft} dias`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-title flex items-center gap-2">
            <Sparkles className="text-primary size-5" />
            Teste grátis do Pro
          </CardTitle>
          <Badge variant={urgent ? 'warning' : 'info'}>{daysLabel}</Badge>
        </div>
        <CardDescription>
          Você está testando o PapoPro com todos os recursos do Pro liberados. O teste termina em{' '}
          {endDate} — assine pra não perder o acesso.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UsageStat label="Leads ativos" state={usage.leads} />
          <UsageStat label="Membros do time" state={usage.members} />
        </div>

        <div className="border-border bg-muted/30 flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-3xl font-semibold">R$ 197</span>
            <span className="text-muted-foreground text-body">/mês</span>
          </div>
          <p className="text-body text-muted-foreground">
            Quando o teste acabar, o workspace volta pro plano Free: leads e membros ficam limitados
            e o motor de cadência, o Inbox WhatsApp e os agentes IA param de rodar.
          </p>
        </div>

        <Button onClick={onSubscribe} disabled={pending} className="gap-2">
          <Sparkles className="size-4" />
          {pending ? 'Abrindo checkout...' : 'Assinar Pro'}
        </Button>
        <p className="text-caption text-muted-foreground">
          Sem cobrança até você assinar. Pagamento via Stripe, cancele quando quiser.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Free state ────────────────────────────────────────────────────────────

function FreeUpgradeCard({
  usage,
  expiredTrial,
  onSubscribe,
  pending,
}: {
  usage: WorkspaceUsageUI;
  /** Trial expirado — renderiza um aviso no topo do card. `null` se nunca houve trial. */
  expiredTrial: TrialStateUI | null;
  onSubscribe: () => void;
  pending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-title">Plano Free</CardTitle>
          <Badge variant="secondary">Atual</Badge>
        </div>
        <CardDescription>
          Você está usando o PapoPro no plano gratuito com recursos limitados. Assine o Pro pra
          desbloquear uso ilimitado, motor de cadência, alertas de lead frio e Inbox WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {expiredTrial && (
          <div className="bg-warning/10 border-warning/40 text-warning flex items-start gap-2 rounded-md border px-3 py-2">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <span className="text-body">
              Seu teste grátis terminou em{' '}
              {format(new Date(expiredTrial.endsAt), "dd 'de' MMMM", { locale: ptBR })}. Assine o
              Pro pra reativar os recursos.
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UsageStat label="Leads ativos" state={usage.leads} />
          <UsageStat label="Membros do time" state={usage.members} />
        </div>

        <div className="border-border bg-muted/30 flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-3xl font-semibold">R$ 197</span>
            <span className="text-muted-foreground text-body">/mês</span>
          </div>
          <ul className="text-body text-muted-foreground flex flex-col gap-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
              <span>Leads e membros ilimitados</span>
            </li>
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
  usage,
  onOpenPortal,
  pending,
}: {
  state: BillingStateUI;
  usage: WorkspaceUsageUI;
  onOpenPortal: () => void;
  pending: boolean;
}) {
  const sub = state.subscription;
  if (!sub) return null;

  const periodEnd = new Date(sub.currentPeriodEnd);
  const daysLeft = differenceInDays(periodEnd, new Date());
  const dateLabel = format(periodEnd, "dd 'de' MMMM", { locale: ptBR });

  const statusBadgeVariant =
    sub.status === 'active' ? 'success' : sub.status === 'past_due' ? 'warning' : 'destructive';
  const STATUS_LABELS: Record<typeof sub.status, string> = {
    active: 'Ativa',
    past_due: 'Pagamento atrasado',
    canceled: 'Cancelada',
    unpaid: 'Não paga',
    incomplete: 'Incompleta',
  };
  const statusLabel = STATUS_LABELS[sub.status];

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
          <div className="flex flex-col gap-1">
            <dt className="text-caption text-muted-foreground">Leads ativos</dt>
            <dd className="text-foreground font-medium">{usage.leads.current} (ilimitado)</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-caption text-muted-foreground">Membros do time</dt>
            <dd className="text-foreground font-medium">{usage.members.current} (ilimitado)</dd>
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

// ─── Usage stat (progresso) ────────────────────────────────────────────────

function UsageStat({ label, state }: { label: string; state: LimitStateUI }) {
  const barTone = state.atLimit ? 'bg-destructive' : state.nearLimit ? 'bg-warning' : 'bg-primary';
  const labelTone = state.atLimit
    ? 'text-destructive'
    : state.nearLimit
      ? 'text-warning'
      : 'text-foreground';

  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-caption text-muted-foreground">{label}</span>
        <span className={`text-body font-medium ${labelTone}`}>
          {state.current}
          <span className="text-muted-foreground">/{state.isUnlimited ? '∞' : state.limit}</span>
        </span>
      </div>
      {!state.isUnlimited && (
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={`h-full ${barTone} transition-all`}
            style={{ width: `${state.percent}%` }}
          />
        </div>
      )}
      {state.atLimit && (
        <p className="text-caption text-destructive flex items-center gap-1">
          <AlertTriangle className="size-3" />
          Limite atingido
        </p>
      )}
    </div>
  );
}

// ─── Comparison table ──────────────────────────────────────────────────────

function PlanComparisonTable({
  currentPlan,
  usage,
  onSubscribe,
  pending,
}: {
  currentPlan: 'free' | 'pro';
  usage: WorkspaceUsageUI;
  onSubscribe: () => void;
  pending: boolean;
}) {
  const rows: Array<{ label: string; free: React.ReactNode; pro: React.ReactNode }> = [
    {
      label: 'Leads ativos',
      free: '50',
      pro: 'Ilimitado',
    },
    {
      label: 'Membros do time',
      free: '2',
      pro: 'Ilimitado',
    },
    { label: 'CRM com pipeline Kanban', free: <YesIcon />, pro: <YesIcon /> },
    { label: 'Importação CSV de leads', free: <YesIcon />, pro: <YesIcon /> },
    { label: 'Motor de cadência automática', free: <NoIcon />, pro: <YesIcon /> },
    { label: 'Alertas de lead frio por etapa', free: <NoIcon />, pro: <YesIcon /> },
    { label: 'Inbox WhatsApp centralizado', free: <NoIcon />, pro: <YesIcon /> },
    { label: 'Agentes IA com base de conhecimento', free: <NoIcon />, pro: <YesIcon /> },
    { label: 'Anti-bloqueio WhatsApp', free: <NoIcon />, pro: <YesIcon /> },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-title flex items-center gap-2">
          <Users className="text-muted-foreground size-5" />
          Comparação Free × Pro
        </CardTitle>
        <CardDescription>
          {currentPlan === 'free'
            ? 'Veja o que o Pro libera em relação ao plano gratuito.'
            : 'Você já está no Pro — esta é a referência caso reveja a assinatura.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-caption text-muted-foreground py-2 pr-4 font-medium">
                  Recurso
                </th>
                <th className="text-caption px-4 py-2 text-center font-medium">
                  Free
                  {currentPlan === 'free' && (
                    <Badge variant="secondary" className="ml-2">
                      Atual
                    </Badge>
                  )}
                </th>
                <th className="text-caption py-2 pl-4 text-center font-medium">
                  Pro
                  {currentPlan === 'pro' && (
                    <Badge variant="success" className="ml-2">
                      Atual
                    </Badge>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-border/50 border-b last:border-0">
                  <td className="text-body py-2 pr-4">{row.label}</td>
                  <td className="px-4 py-2 text-center">{row.free}</td>
                  <td className="py-2 pl-4 text-center">{row.pro}</td>
                </tr>
              ))}
              <tr>
                <td className="text-caption text-muted-foreground py-2 pr-4">Preço</td>
                <td className="text-body px-4 py-2 text-center font-medium">Grátis</td>
                <td className="text-body py-2 pl-4 text-center font-medium">R$ 197/mês</td>
              </tr>
            </tbody>
          </table>
        </div>

        {currentPlan === 'free' && (
          <div className="mt-6 flex flex-col gap-3">
            {(usage.leads.atLimit || usage.members.atLimit) && (
              <div className="bg-destructive/5 border-destructive/30 text-destructive flex items-start gap-2 rounded-md border px-3 py-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span className="text-body">
                  Você atingiu o limite do plano Free
                  {usage.leads.atLimit
                    ? ` (${usage.leads.current}/${usage.leads.limit} leads)`
                    : ''}
                  {usage.leads.atLimit && usage.members.atLimit ? ' e' : ''}
                  {usage.members.atLimit
                    ? ` (${usage.members.current}/${usage.members.limit} membros)`
                    : ''}
                  . Assine o Pro pra liberar uso ilimitado.
                </span>
              </div>
            )}
            <Button onClick={onSubscribe} disabled={pending} className="gap-2 self-start">
              <Sparkles className="size-4" />
              {pending ? 'Abrindo checkout...' : 'Assinar Pro'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function YesIcon() {
  return <CheckCircle2 className="text-success mx-auto size-4" aria-label="Incluído" />;
}

function NoIcon() {
  return <XCircle className="text-muted-foreground mx-auto size-4" aria-label="Não incluído" />;
}
