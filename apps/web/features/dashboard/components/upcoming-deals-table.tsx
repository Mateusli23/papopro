'use client';

import * as React from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
} from '@papopro/ui';
import { ArrowRight, Clock } from '@papopro/ui/icons';

import { getUpcomingDeals } from '@/features/dashboard/transforms';
import { DueDatePill } from '@/features/deals/components/due-date-pill';
import { getStageStyle } from '@/features/deals/stage-style';
import { useDeals } from '@/features/deals/store';
import { RepAvatar } from '@/features/leads/components/rep-avatar';
import { useLeads } from '@/features/leads/store';
import { getStageName } from '@/lib/fixtures/pipelines';
import { formatCentsCompact } from '@/lib/utils/format';

/**
 * Tabela "Próximos do prazo" — top 8 deals abertos ordenados por `dueAt`
 * ascendente. Atrasados aparecem primeiro (ISO ordena cronologicamente,
 * passado < futuro), o `<DueDatePill>` comunica visualmente o estado.
 *
 * Densidade alta tipo HubSpot, hover sutil tipo Attio. `<table>` HTML
 * semântica (não divs com role) — screen readers anunciam coluna/linha
 * automaticamente.
 *
 * Cada linha clica pra `/leads/{leadId}` (não `/kanban`): vendedor varrendo
 * prazos quer detalhe da oportunidade. Action no header navega pra `/kanban`
 * pra ver tudo.
 */
export function UpcomingDealsTable() {
  const deals = useDeals();
  const leads = useLeads();
  const router = useRouter();

  const rows = React.useMemo(() => getUpcomingDeals(deals, leads, 8), [deals, leads]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-title">Próximos do prazo</CardTitle>
          <CardDescription>Os 8 negócios mais urgentes — atrasados primeiro</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/kanban">
            Ver todos <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {rows.length === 0 ? (
          <div className="px-6 py-8">
            <EmptyState
              icon={Clock}
              title="Nenhum prazo nos próximos dias"
              description="Quando você definir prazo nos negócios abertos, eles aparecem aqui."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-body w-full">
              <thead className="text-caption text-muted-foreground border-border border-b">
                <tr className="text-left">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Negócio
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Lead
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Etapa
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Valor
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Vence em
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Vendedor
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ deal, lead }) => {
                  const stage = getStageStyle(deal.stageId);
                  return (
                    <tr
                      key={deal.id}
                      className="border-border hover:bg-muted/40 cursor-pointer border-b transition-colors last:border-b-0"
                      onClick={() => router.push(`/leads/${deal.leadId}`)}
                    >
                      <td className="text-foreground max-w-[220px] truncate px-4 py-2.5 font-medium">
                        {deal.title}
                      </td>
                      <td className="text-muted-foreground max-w-[180px] truncate px-4 py-2.5">
                        {lead?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(stage.headerBg, stage.headerText, 'border-transparent')}
                        >
                          {getStageName(deal.stageId)}
                        </Badge>
                      </td>
                      <td className="text-foreground px-4 py-2.5 text-right font-medium tabular-nums">
                        {formatCentsCompact(deal.valueCents)}
                      </td>
                      <td className="px-4 py-2.5">
                        <DueDatePill due={deal.dueAt} />
                      </td>
                      <td className="px-4 py-2.5">
                        <RepAvatar repId={deal.ownerId} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
