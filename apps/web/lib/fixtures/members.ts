/**
 * Membros mockados do workspace — cobre os 5 papéis RBAC do PRD §2.6 + 1
 * convite pendente (status `'invited'`) pra mostrar o estado na tabela.
 *
 * Personagens com nomes brasileiros plausíveis; e-mails em domínios distintos
 * pra não pareceram fakes copy-pastados. O Owner (`mb_00001`) é o "você" da
 * demo — é quem o usuário se identifica ao logar.
 *
 * Em M7+ substituído por `SELECT * FROM workspace_members WHERE workspace_id = ?`.
 */
import { subDays, subHours, subMinutes } from 'date-fns';

import type { Member } from '@/features/settings/types';

const NOW = new Date('2026-05-10T14:00:00-03:00');
const WORKSPACE = 'ws_demo';

export const FAKE_MEMBERS: Member[] = [
  {
    id: 'mb_00001',
    workspaceId: WORKSPACE,
    name: 'Mateus Lima',
    email: 'mateus@vistamar.com.br',
    avatarEmoji: '👤',
    role: 'owner',
    status: 'active',
    lastSeenAt: subMinutes(NOW, 4).toISOString(),
    createdAt: subDays(NOW, 32).toISOString(),
  },
  {
    id: 'mb_00002',
    workspaceId: WORKSPACE,
    name: 'Beatriz Souza',
    email: 'beatriz@vistamar.com.br',
    avatarEmoji: '👩‍💼',
    role: 'admin',
    status: 'active',
    lastSeenAt: subHours(NOW, 1).toISOString(),
    createdAt: subDays(NOW, 28).toISOString(),
  },
  {
    id: 'mb_00003',
    workspaceId: WORKSPACE,
    name: 'Rafael Toledo',
    email: 'rafael@vistamar.com.br',
    avatarEmoji: '🧑‍💼',
    role: 'manager',
    status: 'active',
    lastSeenAt: subHours(NOW, 3).toISOString(),
    createdAt: subDays(NOW, 21).toISOString(),
  },
  {
    id: 'mb_00004',
    workspaceId: WORKSPACE,
    name: 'Camila Ribeiro',
    email: 'camila@vistamar.com.br',
    avatarEmoji: '👩',
    role: 'vendedor',
    status: 'active',
    lastSeenAt: subMinutes(NOW, 22).toISOString(),
    createdAt: subDays(NOW, 14).toISOString(),
  },
  {
    id: 'mb_00005',
    workspaceId: WORKSPACE,
    name: 'Diego Martins',
    email: 'diego@vistamar.com.br',
    avatarEmoji: '🧑',
    role: 'vendedor',
    status: 'active',
    lastSeenAt: subHours(NOW, 18).toISOString(),
    createdAt: subDays(NOW, 10).toISOString(),
  },
  {
    id: 'mb_00006',
    workspaceId: WORKSPACE,
    name: 'Júlia Carvalho',
    email: 'julia@contadores-vm.com.br',
    avatarEmoji: '👩‍🎓',
    role: 'viewer',
    status: 'active',
    lastSeenAt: subDays(NOW, 6).toISOString(),
    createdAt: subDays(NOW, 9).toISOString(),
  },
  {
    id: 'mb_00007',
    workspaceId: WORKSPACE,
    name: 'lucas@vistamar.com.br',
    email: 'lucas@vistamar.com.br',
    role: 'vendedor',
    status: 'invited',
    invitedAt: subDays(NOW, 2).toISOString(),
    createdAt: subDays(NOW, 2).toISOString(),
  },
];
