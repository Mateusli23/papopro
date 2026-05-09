/**
 * Vendedores do workspace ativo — fixture pra atribuir leads e renderizar
 * avatares. Em M7 vira leitura real de `workspace_members` filtrada por
 * `role IN ('Vendedor','Manager','Admin','Owner')`.
 *
 * O usuário "logado" do `FAKE_USER` é incluído como o primeiro vendedor
 * pra que tarefas "atribuídas a mim" tenham conteúdo natural.
 */
import type { SalesRep } from '@/features/leads/types';

import { FAKE_USER } from './user';

export const SALES_REPS: SalesRep[] = [
  {
    id: FAKE_USER.id,
    name: FAKE_USER.name,
    email: FAKE_USER.email,
    initials: FAKE_USER.initials,
    accent: 'primary',
  },
  {
    id: 'user_juliana',
    name: 'Juliana Pereira',
    email: 'juliana@papopro.com.br',
    initials: 'JP',
    accent: 'success',
  },
  {
    id: 'user_renato',
    name: 'Renato Almeida',
    email: 'renato@papopro.com.br',
    initials: 'RA',
    accent: 'info',
  },
  {
    id: 'user_carla',
    name: 'Carla Souza',
    email: 'carla@papopro.com.br',
    initials: 'CS',
    accent: 'warning',
  },
  {
    id: 'user_diego',
    name: 'Diego Tavares',
    email: 'diego@papopro.com.br',
    initials: 'DT',
    accent: 'accent',
  },
];

export function getRep(id: string): SalesRep | undefined {
  return SALES_REPS.find((r) => r.id === id);
}

export function getRepName(id: string): string {
  return getRep(id)?.name ?? 'Não atribuído';
}

/** Sistema "virtual" pra eventos automáticos (criação por webhook, mudança de etapa por sistema). */
export const SYSTEM_AUTHOR: SalesRep = {
  id: 'system',
  name: 'Sistema',
  email: 'sistema@papopro.com.br',
  initials: 'PP',
  accent: 'primary',
};
