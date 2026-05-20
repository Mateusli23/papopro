import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
} from '@papopro/ui';
import { Bot, Clock, MessageSquare, ShieldCheck, type LucideIcon } from '@papopro/ui/icons';

import { AgentStatusBadge } from '@/features/agents/components/agent-status-badge';
import {
  type AgentReportRow,
  type AgentReportsSummary,
  formatMetricRate,
  formatResponseTime,
} from '@/features/agents/metrics.helpers';

/**
 * Bloco "Agentes IA" da página `/reports` (M11#7).
 *
 * Server Component que recebe as agregações já carregadas pelo `page.tsx`
 * (`getAgentReports`) e renderiza:
 *  1. KPI strip (4 cards) — rollup do workspace
 *  2. Tabela "Performance por agente"
 *
 * Dados reais (servidor → `$queryRaw` agregando `agent_sessions` +
 * `agent_messages`, RLS via `withWorkspace`). Mesmo padrão server-fed do
 * `<CadencesReportsSection>` (M10#5).
 *
 * Satisfação inferida não aparece — campo adiado pra V2 (precisa de
 * classificador de sentimento). As 3 métricas mostradas são reais.
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
  summary: AgentReportsSummary;
  byAgent: AgentReportRow[];
}

export function AgentsReportsSection({ summary, byAgent }: Props) {
  const hasVolume = summary.totalConversations > 0;

  const tiles: KpiTile[] = [
    {
      label: 'Agentes ativos',
      value: String(summary.activeAgentsCount),
      hint:
        summary.totalAgentsCount === 0
          ? 'nenhum agente criado'
          : `de ${summary.totalAgentsCount} no workspace`,
      Icon: Bot,
      tone: 'info',
    },
    {
      label: 'Conversas atendidas',
      value: summary.totalConversations.toLocaleString('pt-BR'),
      hint: hasVolume ? 'sessões de produção' : 'nenhuma conversa ainda',
      Icon: MessageSquare,
      tone: 'success',
    },
    {
      label: 'Resolução sem handoff',
      value: hasVolume ? formatMetricRate(summary.overallResolutionRate) : '—',
      hint: hasVolume ? 'sem precisar de humano' : 'sem volume pra medir',
      Icon: ShieldCheck,
      tone: 'info',
    },
    {
      label: 'Tempo médio de resposta',
      value: summary.avgResponseTimeSec > 0 ? formatResponseTime(summary.avgResponseTimeSec) : '—',
      hint: summary.avgResponseTimeSec > 0 ? 'processamento da IA' : 'sem turnos medidos',
      Icon: Clock,
      tone: 'warning',
    },
  ];

  return (
    <section aria-label="Agentes IA — métricas acumuladas" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-title text-foreground font-semibold">Agentes IA</h2>
        <p className="text-body text-muted-foreground">
          Conversas atendidas, resolução sem handoff e tempo de resposta por agente.
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

      {/* Tabela "Performance por agente" ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-title">Performance por agente</CardTitle>
          <CardDescription>
            Agentes do workspace ordenados por conversas atendidas (acumulado, todas as versões).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {byAgent.length === 0 ? (
            <div className="px-6 py-8">
              <EmptyState
                icon={Bot}
                title="Sem agentes ainda"
                description="Crie o primeiro em /agents pra começar a acompanhar performance."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-body w-full">
                <thead className="text-caption text-muted-foreground border-border border-b">
                  <tr className="text-left">
                    <th scope="col" className="px-4 py-2 font-medium">
                      Agente
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Conversas
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right font-medium"
                      title="Conversas que a IA resolveu sem precisar passar pra um humano."
                    >
                      Resolução sem handoff
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right font-medium"
                      title="Latência média entre a mensagem do lead e a resposta da IA — não inclui o jitter anti-ban."
                    >
                      Tempo médio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byAgent.map((row) => {
                    const m = row.metrics;
                    const rowHasVolume = m.totalConversations > 0;
                    return (
                      <tr
                        key={row.id}
                        className="border-border hover:bg-muted/40 border-b transition-colors last:border-b-0"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/agents/${row.id}`}
                            className="text-foreground hover:text-primary font-medium transition-colors"
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <AgentStatusBadge status={row.status} />
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-medium tabular-nums',
                            rowHasVolume ? 'text-foreground' : 'text-muted-foreground/60',
                          )}
                        >
                          {rowHasVolume ? m.totalConversations.toLocaleString('pt-BR') : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right tabular-nums',
                            rowHasVolume ? 'text-foreground' : 'text-muted-foreground/60',
                          )}
                        >
                          {rowHasVolume ? formatMetricRate(m.resolutionRate) : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right tabular-nums',
                            m.avgResponseTimeSec > 0
                              ? 'text-foreground'
                              : 'text-muted-foreground/60',
                          )}
                        >
                          {m.avgResponseTimeSec > 0
                            ? formatResponseTime(m.avgResponseTimeSec)
                            : '—'}
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
    </section>
  );
}
