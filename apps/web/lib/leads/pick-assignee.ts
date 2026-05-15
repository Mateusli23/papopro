import 'server-only';

import type { Prisma } from '@papopro/db';

/**
 * `pickNextAssignee` — round-robin de leads entre vendedores ativos (M8#5).
 *
 * Estratégia: pega o Vendedor/Manager com **menor número de leads `status=ativo`**.
 * Tie-break por `workspaceMember.createdAt ASC` (quem entrou antes leva). Se o
 * workspace não tiver Vendedor/Manager (ex: solo Owner), cai no próprio Owner.
 *
 * **Por que não rotação por `last_assigned_at`:** balanceamento por *count
 * atual* respeita situações onde um vendedor saiu de férias e voltou com pilha
 * de leads — ele recebe menos enquanto se equilibra. Adicionar
 * `last_assigned_at` exigiria nova coluna + index sem ganho real no MVP.
 *
 * **Usado por:** webhook handler (`POST /api/webhooks/leads/[token]`) +
 * `importLeadsAction` quando a linha do CSV não traz `assignedTo`.
 *
 * **Defense-in-depth:** filtra `workspaceId` explicitamente, alinhado com
 * CLAUDE.md §7.2. Helper roda sempre dentro de uma `withWorkspace` tx — o
 * caller é quem garante o setting `app.workspace_id`.
 */
export async function pickNextAssignee(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<string | null> {
  const eligible = await tx.workspaceMember.findMany({
    where: {
      workspaceId,
      role: { in: ['Vendedor', 'Manager'] },
    },
    select: { id: true, createdAt: true },
  });

  if (eligible.length === 0) {
    const owner = await tx.workspaceMember.findFirst({
      where: { workspaceId, role: 'Owner' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return owner?.id ?? null;
  }

  const counts = await tx.lead.groupBy({
    by: ['assignedToId'],
    where: {
      workspaceId,
      status: 'ativo',
      deletedAt: null,
      assignedToId: { in: eligible.map((m) => m.id) },
    },
    _count: { _all: true },
  });

  const countByMember = new Map(counts.map((c) => [c.assignedToId, c._count._all]));

  const ranked = eligible
    .map((m) => ({ id: m.id, count: countByMember.get(m.id) ?? 0, createdAt: m.createdAt }))
    .sort((a, b) => {
      if (a.count !== b.count) return a.count - b.count;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  return ranked[0]?.id ?? null;
}

// ─── Versão pura pra smoke test ────────────────────────────────────────────

export interface MemberRef {
  id: string;
  role: 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer';
  createdAt: Date;
}

export interface LoadCount {
  memberId: string;
  count: number;
}

/**
 * Versão pura (sem `tx`) da mesma lógica — usada pelo smoke test pra validar
 * round-robin sem subir banco. Espelha 1:1 o comportamento do helper acima.
 */
export function pickNextAssigneePure(
  members: readonly MemberRef[],
  loads: readonly LoadCount[],
): string | null {
  const eligible = members.filter((m) => m.role === 'Vendedor' || m.role === 'Manager');
  if (eligible.length === 0) {
    const owner = members
      .filter((m) => m.role === 'Owner')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    return owner?.id ?? null;
  }
  const countByMember = new Map(loads.map((l) => [l.memberId, l.count]));
  const ranked = eligible
    .map((m) => ({ id: m.id, count: countByMember.get(m.id) ?? 0, createdAt: m.createdAt }))
    .sort((a, b) => {
      if (a.count !== b.count) return a.count - b.count;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  return ranked[0]?.id ?? null;
}
