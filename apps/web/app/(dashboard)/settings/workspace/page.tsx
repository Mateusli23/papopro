import type { Metadata } from 'next';

import { WorkspaceView } from './workspace-view';

export const metadata: Metadata = {
  title: 'Workspace · Configurações',
  description: 'Nome da empresa, segmento, logotipo, fuso e zona de perigo.',
};

export default function WorkspaceSettingsPage() {
  return <WorkspaceView />;
}
