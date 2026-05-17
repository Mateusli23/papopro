import Link from 'next/link';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
} from '@papopro/ui';
import { CheckCheck, MessageSquare, Users, Zap, type LucideIcon } from '@papopro/ui/icons';

import type {
  CadenceReportRow,
  CadenceReportsSummary,
  ColdByStageRow,
} from '@/features/cadences/queries';
import { formatRate, sortCadenceReportRows } from '@/features/cadences/reports.helpers';

import { ColdByStageChart } from './cold-by-stage-chart';

/**
 * Bloco "Cadências" da página `/reports` (M10#5).
 *
 * Server Component que recebe agregações já carregadas pelo `page.tsx` e
 * renderiza 3 sub-blocos:
 *  1. KPI strip (4 cards)
 *  2. Tabela "Performance por cadência" (HTML semântica)
 *  3. BarChart Recharts "Leads frios por etapa" (delega pra Client)
 *
 * Dados são reais (servidor → Prisma + RLS via `withWorkspace`). Diferente
 * do resto de `/reports` que ainda hidrata via fixtures (M5/M6) — migração
 * total fica pra M10.x ou M13.
 */

interface KpiTile {
  label: string;
  value: string;
  hint: string;
  Icon: LucideIcon;
  tone: 'info' | 'warning' | 'success' | 'destructive';
}

const TONE_STYLES: Record<
  KpiTile['tone'],
  { bg: string; text: string; ring: string; iconBg: string }
> = {
  info: {
    bg: 'bg-info/[0.06]',
    text: 'text-info',
    ring: 'ring-info/20',
    iconBg: 'bg-info/15 text-info',
  },
  warning: {
    bg: 'bg-warning/[0.08]',
    text: 'text-warning',
    ring: 'ring-warning/20',
    iconBg: 'bg-warning/20 text-warning',
  },
  success: {
    bg: 'bg-success/[0.06]',
    text: 'text-success',
    ring: 'ring-success/20',
    iconBg: 'bg-success/15 text-success',
  },
  destructive: {
    bg: 'bg-destructive/[0.06]',
    text: 'text-destructive',
    ring: 'ring-destructive/20',
    iconBg: 'bg-destructive/15 text-destructive',
  },
};

interface Props {
  summary: CadenceReportsSummary;
  byCadence: CadenceReportRow[];
  coldByStage: ColdByStageRow[];
}

export function CadencesReportsSection({ summary, byCadence, coldByStage }: Props) {
  const tiles: KpiTile[] = [
    {
      label: 'Cadências ativas',
      value: String(summary.activeCadencesCount),
      hint: summary.activeCadencesCount === 0 ? 'nenhuma rodando' : 'rodando agora',
      Icon: Zap,
      tone: 'info',
    },
    {
      label: 'Inscrições ativas',
      value: String(summary.activeEnrollmentsCount),
      hint:
        summary.activeEnrollmentsCount === 0
          ? 'nenhum lead em cadência'
          : `${summary.activeEnrollmentsCount === 1 ? 'lead' : 'leads'} em sequência`,
      Icon: Users,
      tone: 'warning',
    },
    {
      label: 'Mensagens (30d)',
      value: summary.dispatched30d.toLocaleString('pt-BR'),
      hint: summary.dispatched30d === 0 ? 'nada disparado no mês' : 'disparadas pelo motor',
      Icon: MessageSquare,
      tone: 'success',
    },
    {
      label: 'Taxa resposta (30d)',
      value: summary.dispatched30d === 0 ? '—' : formatRate(summary.responseRate30d),
      hint:
        summary.dispatched30d === 0 ? 'sem volume pra medir' : 'inscrições que retornaram contato',
      Icon: CheckCheck,
      tone: 'info',
    },
  ];

  const sortedRows = sortCadenceReportRows(byCadence);

  return (
    <section
      aria-label="Motor de cadência — agregações dos últimos 30 dias"
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-title text-foreground font-semibold">Cadências</h2>
        <p className="text-body text-muted-foreground">
          Volume disparado, performance por cadência e leads frios por etapa.
        </p>
      </header>

      {/* KPI strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((s) => {
          const tone = TONE_STYLES[s.tone];
          return (
            <div
              key={s.label}
              className={cn(
                'border-border flex items-start gap-3 rounded-xl border p-3 ring-1',
                tone.bg,
                tone.ring,
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  tone.iconBg,
                )}
                aria-hidden
              >
                <s.Icon className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-caption text-muted-foreground font-medium">{s.label}</span>
                <span className={cn('text-title font-semibold tabular-nums', tone.text)}>
                  {s.value}
                </span>
                <span className="text-caption text-muted-foreground/80">{s.hint}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela "Performance por cadência" ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-title">Performance por cadência</CardTitle>
          <CardDescription>
            Cadências do workspace ordenadas por mensagens disparadas nos últimos 30 dias.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sortedRows.length === 0 ? (
            <div className="px-6 py-8">
              <EmptyState
                icon={Zap}
                title="Sem cadências ainda"
                description="Crie a primeira em /cadences pra começar a acompanhar performance."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-body w-full">
                <thead className="text-caption text-muted-foreground border-border border-b">
                  <tr className="text-left">
                    <th scope="col" className="px-4 py-2 font-medium">
                      Cadência
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Etapa
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Inscrições ativas
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Disparadas 30d
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Taxa resposta 30d
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right font-medium"
                      title="Step runs pulados por rate limit, instância insalubre ou fora do horário comercial nos últimos 30 dias."
                    >
                      Bloqueios anti-ban 30d
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-border hover:bg-muted/40 border-b transition-colors last:border-b-0"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/cadences/${row.id}`}
                          className="text-foreground hover:text-primary font-medium transition-colors"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5">{row.stageName}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={row.status === 'active' ? 'success' : 'secondary'}>
                          {row.status === 'active' ? 'Ativa' : 'Pausada'}
                        </Badge>
                      </td>
                      <td className="text-foreground px-4 py-2.5 text-right tabular-nums">
                        {row.activeEnrollments}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-2.5 text-right font-medium tabular-nums',
                          row.dispatched30d > 0 ? 'text-foreground' : 'text-muted-foreground/60',
                        )}
                      >
                        {row.dispatched30d > 0 ? row.dispatched30d.toLocaleString('pt-BR') : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-2.5 text-right tabular-nums',
                          row.dispatched30d === 0 ? 'text-muted-foreground/60' : 'text-foreground',
                        )}
                      >
                        {row.dispatched30d === 0 ? '—' : formatRate(row.responseRate30d)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-2.5 text-right tabular-nums',
                          row.skippedAntiBan30d > 0 ? 'text-warning' : 'text-muted-foreground/60',
                        )}
                      >
                        {row.skippedAntiBan30d > 0 ? row.skippedAntiBan30d : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BarChart "Leads frios por etapa" ──────────────────────────────── */}
      <ColdByStageChart rows={coldByStage} />
    </section>
  );
}
