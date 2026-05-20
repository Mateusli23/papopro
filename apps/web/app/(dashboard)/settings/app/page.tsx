import type { Metadata } from 'next';

import { InstallView } from './install-view';

export const metadata: Metadata = {
  title: 'Instalar app · Configurações',
  description: 'Instale o PapoPro como aplicativo no celular ou no computador.',
};

/**
 * `/settings/app` (M13#1) — tela "Instalar app".
 *
 * Server Component fino: a lógica de instalação (prompt nativo, detecção de
 * plataforma, estado standalone) é toda client-side, no `<InstallView>`.
 */
export default function AppSettingsPage() {
  return <InstallView />;
}
