import Link from 'next/link';

import { Button, EmptyState } from '@papopro/ui';
import { ChevronLeft, ChevronRight, History } from '@papopro/ui/icons';

import type { AuditFilters, AuditLogPage } from '../types';

/**
 * Tabela de eventos de auditoria (M13#3) — Server Component, sem
 * interatividade (a paginação são `<Link>` que recarregam o Server Component
 * da página com `?page=N`).
 *
 * Datas formatadas em America/Sao_Paulo via `Intl` (sem `date-fns-tz`).
 */

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Monta a query string preservando os filtros, trocando só a página. */
function pageHref(filters: AuditFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.actorId) params.set('actorId', filters.actorId);
  if (filters.action) params.set('action', filters.action);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (page > 0) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/settings/audit?${qs}` : '/settings/audit';
}

interface AuditTableProps {
  data: AuditLogPage;
  filters: AuditFilters;
}

export function AuditTable({ data, filters }: AuditTableProps) {
  if (data.total === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nenhum evento encontrado"
        description="Não há registros de auditoria para os filtros aplicados. Ajuste o período ou limpe os filtros."
      />
    );
  }

  const firstRow = data.page * data.pageSize + 1;
  const lastRow = data.page * data.pageSize + data.rows.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-border text-caption text-muted-foreground border-b">
              <th className="px-4 py-2.5 font-semibold">Evento</th>
              <th className="px-4 py-2.5 font-semibold">Autor</th>
              <th className="px-4 py-2.5 font-semibold">Entidade</th>
              <th className="px-4 py-2.5 font-semibold">IP</th>
              <th className="px-4 py-2.5 font-semibold">Quando</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr
                key={row.id}
                className="border-border/60 hover:bg-muted/40 border-b last:border-0"
              >
                <td className="px-4 py-2.5 align-top">
                  <div className="text-body text-foreground font-medium">{row.actionLabel}</div>
                  {row.changesSummary && (
                    <div className="text-muted-foreground mt-0.5 max-w-[280px] truncate font-mono text-[11px]">
                      {row.changesSummary}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 align-top">
                  {row.actorName || row.actorEmail ? (
                    <div className="flex flex-col">
                      <span className="text-body text-foreground">
                        {row.actorName ?? row.actorEmail}
                      </span>
                      {row.actorName && row.actorEmail && (
                        <span className="text-muted-foreground text-caption">{row.actorEmail}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-caption">Sistema</span>
                  )}
                </td>
                <td className="text-body text-muted-foreground px-4 py-2.5 align-top">
                  {row.entityType ? (
                    <span>
                      {row.entityType}
                      {row.entityId && (
                        <span className="font-mono text-[11px]"> · {row.entityId.slice(0, 8)}</span>
                      )}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="text-muted-foreground px-4 py-2.5 align-top font-mono text-[11px]">
                  {row.ipAddress ?? '—'}
                </td>
                <td className="text-body text-muted-foreground whitespace-nowrap px-4 py-2.5 align-top">
                  {DATE_FMT.format(new Date(row.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-caption text-muted-foreground">
          {firstRow}–{lastRow} de {data.total}
        </span>
        <div className="flex items-center gap-2">
          {data.page > 0 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(filters, data.page - 1)}>
                <ChevronLeft />
                Anterior
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft />
              Anterior
            </Button>
          )}
          {data.hasMore ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(filters, data.page + 1)}>
                Próxima
                <ChevronRight />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Próxima
              <ChevronRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
