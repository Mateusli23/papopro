'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@papopro/ui';
import { Check } from '@papopro/ui/icons';

import { useSubscription } from '../store';
import type { PlanTier } from '../types';

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PlanOption {
  key: PlanTier;
  label: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const PLAN_OPTIONS: PlanOption[] = [
  {
    key: 'pro',
    label: 'Pro',
    price: 'R$ 197',
    description: 'CRM + WhatsApp + cadência. Sem agentes IA.',
    features: ['Até 5 usuários', '5.000 leads ativos', '5.000 disparos/mês', '1 número WhatsApp'],
    cta: 'Migrar para Pro',
  },
  {
    key: 'pro_ia',
    label: 'Pro IA',
    price: 'R$ 497',
    description: 'Tudo do Pro + agentes IA + Cérebro da Empresa.',
    features: [
      'Até 10 usuários',
      '20.000 leads ativos',
      '20.000 disparos/mês',
      '3 números WhatsApp',
      'Até 3 agentes IA ativos',
    ],
    cta: 'Plano atual',
    highlighted: true,
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    price: 'Sob consulta',
    description: 'Cloud API oficial, SLA, onboarding assistido.',
    features: [
      'Usuários ilimitados',
      'Volume sob medida',
      'Cloud API oficial Meta',
      'SLA + suporte prioritário',
    ],
    cta: 'Falar com vendas',
  },
];

export function ChangePlanDialog({ open, onOpenChange }: ChangePlanDialogProps) {
  const sub = useSubscription();

  function handleSelect(plan: PlanTier) {
    if (plan === sub.plan) {
      toast('Você já está nesse plano');
      return;
    }
    toast.success(
      `Mudança para ${plan === 'pro' ? 'Pro' : 'Enterprise'} solicitada — em M12 abre Stripe Checkout`,
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Mudar de plano</DialogTitle>
          <DialogDescription>
            Mudanças entram em vigor no próximo ciclo. Você não perde dados ao fazer downgrade.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PLAN_OPTIONS.map((plan) => (
            <PlanOptionCard
              key={plan.key}
              plan={plan}
              isCurrent={sub.plan === plan.key}
              onSelect={() => handleSelect(plan.key)}
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanOptionCard({
  plan,
  isCurrent,
  onSelect,
}: {
  plan: PlanOption;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={cn(
        'flex flex-col',
        plan.highlighted && 'border-primary/50 bg-primary/5',
        isCurrent && 'ring-primary ring-1',
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-title font-semibold">{plan.label}</span>
          {isCurrent && <Badge variant="success">Atual</Badge>}
        </div>
        <div>
          <span className="text-title-lg font-semibold">{plan.price}</span>
          {plan.key !== 'enterprise' && (
            <span className="text-body text-muted-foreground"> /mês</span>
          )}
        </div>
        <p className="text-body text-muted-foreground">{plan.description}</p>
        <ul className="flex flex-col gap-1.5 pt-2">
          {plan.features.map((f) => (
            <li key={f} className="text-body flex items-start gap-2">
              <Check className="text-success mt-0.5 size-4 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-3">
          <Button className="w-full" disabled={isCurrent} onClick={onSelect}>
            {isCurrent ? 'Plano atual' : plan.cta}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
