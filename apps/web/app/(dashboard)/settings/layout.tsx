import * as React from 'react';

import { SettingsMobileSelect } from '@/features/settings/components/settings-mobile-select';
import { SettingsSubNav } from '@/features/settings/components/settings-sub-nav';

/**
 * Layout do hub de Configurações. Aplica sub-nav lateral 220px em desktop
 * (`lg:`) e Select compacto em mobile/tablet. Conteúdo amplo à direita.
 *
 * Server component — `<SettingsSubNav>` e `<SettingsMobileSelect>` cuidam
 * da parte interativa.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full">
      <SettingsSubNav />
      <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <SettingsMobileSelect />
        {children}
      </div>
    </div>
  );
}
