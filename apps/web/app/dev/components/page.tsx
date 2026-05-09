import type { Metadata } from 'next';

import { ComponentsShowcase } from './showcase';

/**
 * Showcase de todos os primitivos e componentes de domínio do design system.
 *
 * Como usar:
 *  - Acesse [/_dev/components] em desenvolvimento.
 *  - Use o `ThemeToggle` no header pra alternar entre light/dark — todo
 *    componente deve renderizar bem nos dois (CLAUDE.md §8: "Dark mode é
 *    tema de primeira classe").
 *  - O `AxeDevtools` (no layout) emite violações de acessibilidade no
 *    console — checar em ambos os temas.
 *
 * Esta rota é não-indexável e bloqueada em produção (vide layout de `_dev/`).
 */
export const metadata: Metadata = {
  title: 'Componentes — Dev',
  robots: { index: false, follow: false },
};

export default function DevComponentsPage() {
  return <ComponentsShowcase />;
}
