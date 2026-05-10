import * as React from 'react';

import { Badge } from '@papopro/ui';

import type { MemberRole } from '../types';

/**
 * Badge colorido por papel — paridade com lead temperature em
 * `<TemperatureBadge>`. Mapeamento:
 *  - Owner → primary (azul de marca; representa autoridade)
 *  - Admin → info (azul claro)
 *  - Manager → success (verde — gestor "operacional")
 *  - Vendedor → secondary (neutro — papel mais comum)
 *  - Viewer → outline (sem fundo, leitura)
 *
 * Cores semânticas, não decorativas — um Vendedor não vira "warning" por
 * estar abaixo de Manager. Status (ativo/convite) fica em outro badge.
 */
const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  vendedor: 'Vendedor',
  viewer: 'Viewer',
};

const ROLE_VARIANTS: Record<MemberRole, 'default' | 'info' | 'success' | 'secondary' | 'outline'> =
  {
    owner: 'default',
    admin: 'info',
    manager: 'success',
    vendedor: 'secondary',
    viewer: 'outline',
  };

export function RoleBadge({ role }: { role: MemberRole }) {
  return <Badge variant={ROLE_VARIANTS[role]}>{ROLE_LABELS[role]}</Badge>;
}
