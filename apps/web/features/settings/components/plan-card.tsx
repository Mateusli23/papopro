'use client';

import * as React from 'react';

import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@papopro/ui';
import { ExternalLink } from '@papopro/ui/icons';

import { useSubscription } from '../store';
import type { PlanTier } from '../types';

const PLAN_LABELS: Record<PlanTier, string> = {
  pro: 'Pro',
  pro_ia: 'Pro IA',
  enterprise: 'Enterprise',
};

interface PlanCardProps {
  /** Abre o Dialog de mudança de plano. */
  onChangePlan: () => void;
  /** Abre o Dialog de cancelamento (destrutivo). */
  onCancel: () => void;
}

/**
 * Card principal do `/settings/billing` — mostra plano atual, status (trial /
 * ativo / atrasado), próxima cobrança e CTAs primários.
 *
 * Selo de trial calcula dias restantes a partir de `currentPeriodEnd`. Em M5
 * a fixture aponta pra `+3 dias` propositalmente — alimenta a demo do PRD §3.12
 * "trial expirando em 2 dias". Em M12 vira subscription real do Stripe.
 */
export function PlanCard({ onChangePlan, onCancel }: PlanCardProps) {
  const sub = useSubscription();

  const periodEnd = new Date(sub.currentPeriodEnd);
  const daysLeft = differenceInDays(periodEnd, new Date());
  const isTrial = sub.status === 'trialing';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>Plano atual: {PLAN_LABELS[sub.plan]}</span>
          {isTrial && (
            <Badge variant={daysLeft <= 2 ? 'warning' : 'info'}>
              Trial: {daysLeft <= 0 ? 'expirado' : `faltam ${daysLeft} dias`}
            </Badge>
          )}
          {sub.status === 'past_due' && <Badge variant="destructive">Pagamento em atraso</Badge>}
          {sub.status === 'active' && <Badge variant="success">Ativo</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            label="Mensalidade"
            value={`R$ ${sub.monthlyAmount.toFixed(2).replace('.', ',')}`}
          />
          <Field
            label={isTrial ? 'Trial termina em' : 'Próxima cobrança'}
            value={format(periodEnd, "dd 'de' MMMM", { locale: ptBR })}
          />
          <Field
            label="Forma de pagamento"
            value={
              sub.paymentMethod
                ? `${capitalize(sub.paymentMethod.brand)} •••• ${sub.paymentMethod.last4}`
                : 'Sem cartão cadastrado'
            }
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancelar assinatura
          </Button>
          <Button asChild variant="outline">
            <a
              href="https://billing.stripe.com/p/login/mock"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Atualizar cartão no Stripe (abre em nova aba)"
            >
              <ExternalLink /> Atualizar cartão
            </a>
          </Button>
          <Button onClick={onChangePlan}>Mudar de plano</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-muted-foreground uppercase">{label}</span>
      <span className="text-body text-foreground font-medium">{value}</span>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
