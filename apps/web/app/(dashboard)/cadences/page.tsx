import type { Metadata } from 'next';

import { CadencesView } from './cadences-view';

export const metadata: Metadata = {
  title: 'Cadências',
  description: 'Sequências automáticas de follow-up por etapa do funil.',
};

export default function CadencesPage() {
  return <CadencesView />;
}
