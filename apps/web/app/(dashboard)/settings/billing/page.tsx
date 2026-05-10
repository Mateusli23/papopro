import type { Metadata } from 'next';

import { BillingView } from './billing-view';

export const metadata: Metadata = {
  title: 'Cobrança · Configurações',
  description: 'Plano, faturas e método de pagamento.',
};

export default function BillingSettingsPage() {
  return <BillingView />;
}
