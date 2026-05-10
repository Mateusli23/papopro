import type { Metadata } from 'next';

import { TeamView } from './team-view';

export const metadata: Metadata = {
  title: 'Time · Configurações',
  description: 'Gerencie membros, convites e papéis do workspace.',
};

export default function TeamSettingsPage() {
  return <TeamView />;
}
