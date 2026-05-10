'use client';

import * as React from 'react';

import { PageHeader } from '@papopro/ui';
import { ShieldCheck } from '@papopro/ui/icons';

import { CancelSubscriptionDialog } from '@/features/settings/components/cancel-subscription-dialog';
import { ChangePlanDialog } from '@/features/settings/components/change-plan-dialog';
import { InvoicesTable } from '@/features/settings/components/invoices-table';
import { PlanCard } from '@/features/settings/components/plan-card';
import { UsageLimitsCard } from '@/features/settings/components/usage-limits-card';

/**
 * `/settings/billing` — só Owner edita (em M5 informativo via banner; M12+
 * vira RBAC real escondendo a aba inteira para não-Owners).
 *
 * Composição: card de plano + card de uso + tabela de faturas + 2 dialogs.
 * Em M12 cada CTA vira fluxo Stripe Checkout / Customer Portal.
 */
export function BillingView() {
  const [changePlanOpen, setChangePlanOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cobrança"
        description="Plano, limites de uso, método de pagamento e histórico de faturas."
      />

      <div className="bg-info/5 border-info/30 text-info flex items-center gap-2 rounded-md border px-4 py-2">
        <ShieldCheck className="size-4 shrink-0" />
        <span className="text-body">
          Apenas o Owner pode mudar o plano ou cancelar a assinatura.
        </span>
      </div>

      <PlanCard onChangePlan={() => setChangePlanOpen(true)} onCancel={() => setCancelOpen(true)} />
      <UsageLimitsCard />
      <InvoicesTable />

      <ChangePlanDialog open={changePlanOpen} onOpenChange={setChangePlanOpen} />
      <CancelSubscriptionDialog open={cancelOpen} onOpenChange={setCancelOpen} />
    </div>
  );
}
