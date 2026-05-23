import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { PageHeader } from '@papopro/ui';

import { AuditFilters } from '@/features/audit/components/audit-filters';
import { AuditTable } from '@/features/audit/components/audit-table';
import { listAuditActors, listAuditLogs } from '@/features/audit/queries';
import { parseAuditFilters, type RawSearchParams } from '@/features/audit/schemas';
import { getCurrentUserContext } from '@/lib/auth/get-user';
import { readWorkspaceCookie } from '@/lib/auth/workspace-cookie';

export const metadata: Metadata = {
  title: 'Auditoria · Configurações',
  description: 'Histórico de eventos do workspace para conformidade LGPD.',
};

/**
 * `dynamic = 'force-dynamic'` — depende do cookie httpOnly do workspace, da
 * sessão Supabase e dos `searchParams` de filtro.
 */
export const dynamic = 'force-dynamic';

/**
 * `/settings/audit` (M13#3) — **Owner/Admin only**.
 *
 * Viewer do log de auditoria (`audit_logs`) com filtros por autor, tipo de
 * evento e período. É a superfície de conformidade LGPD: quem fez o quê,
 * quando, de qual IP. Eventos administrativos críticos (exportação,
 * exclusão de dados, mudança de papel) ficam aqui rastreáveis.
 *
 * Não-Owner/Admin cai em `/settings` sem aviso (mesmo padrão de
 * `/settings/billing`).
 */
export default async function AuditSettingsPage({
  searchParams,
}: {
  searchParams: RawSearchParams;
}) {
  const ctx = await getCurrentUserContext();
  const workspaceId = readWorkspaceCookie();

  if (!ctx || !workspaceId) {
    redirect('/login');
  }

  const membership = ctx.memberships.find((m) => m.workspaceId === workspaceId);
  if (!membership) {
    redirect('/onboarding');
  }
  if (membership.role !== 'Owner' && membership.role !== 'Admin') {
    redirect('/settings');
  }

  const filters = parseAuditFilters(searchParams);
  const [actors, page] = await Promise.all([
    listAuditActors(workspaceId),
    listAuditLogs(workspaceId, filters),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auditoria"
        description="Histórico de eventos do workspace — quem fez o quê, quando e de onde. Registros mantidos por 12 meses (LGPD)."
      />
      <AuditFilters actors={actors} current={filters} />
      <AuditTable data={page} filters={filters} />
    </div>
  );
}
