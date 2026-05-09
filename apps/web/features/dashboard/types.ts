/**
 * Tipos do domínio Dashboard.
 *
 * O dashboard cruza Leads + Deals + período de tempo, então tem escopo
 * cross-domain — vive em `features/dashboard/` em vez de estender
 * `features/deals/types.ts`. Em M8 quando virar Server Action, a shape
 * `DashboardKpis` permanece como contrato de retorno.
 */
import type { Deal } from '@/features/deals/types';
import type { Lead } from '@/features/leads/types';

export interface DashboardKpis {
  /** Conta de leads no workspace (visão de pipeline cheio). */
  totalLeads: number;
  /** Deals com `status === 'open'`. */
  openDealsCount: number;
  /** Soma de `valueCents` dos deals abertos (BRL). */
  openPipelineCents: number;
  /**
   * `won_30d / (won_30d + lost_30d)` × 100, arredondado pra inteiro.
   * Se `closed_30d === 0`, retorna 0 (não NaN).
   */
  conversionRatePct: number;
  // ─── Hints derivados (mostrados embaixo do número de cada KPI) ──────────
  /** Leads com `temperature === 'hot'` — alimenta o hint do KPI #1. */
  hotLeadsCount: number;
  /** Soma `wonLast30d + lostLast30d` (denominador da conversão). */
  closedLast30d: number;
  /** Deals com `status === 'won'` fechados nos últimos 30 dias. */
  wonLast30d: number;
  /** Deals com `status === 'lost'` fechados nos últimos 30 dias. */
  lostLast30d: number;
}

/**
 * Linha do FunnelChart Recharts. Recharts requer ordem **decrescente**
 * de `value` no array final (do trapézio mais largo no topo pro mais
 * estreito embaixo) — `buildFunnelData` ordena defensivamente.
 */
export interface FunnelDatum {
  stageId: string;
  /** "Novo", "Em contato", "Proposta", "Negociação". */
  name: string;
  /** Count de deals abertos na etapa — vira altura do trapézio. */
  value: number;
  /** Soma agregada em centavos — exibida no tooltip. */
  totalCents: number;
  /**
   * CSS color string consumido pelo `<Funnel fill>` do Recharts.
   * Usamos `hsl(var(--token))` pra que o gráfico respeite o tema
   * (light/dark) sem JS — quando a CSS var muda, o SVG re-renderiza.
   */
  fill: string;
  /** Label à direita do trapézio: "12 · R$ 850K". */
  labelRight: string;
  /** Label central — só preenchido se `value > 0` (senão polui o gráfico). */
  labelCenter: string;
}

/**
 * Linha da tabela "Próximos do prazo". `lead` pode ser undefined se
 * a fixture estiver com FK quebrada (defensivo — não deveria acontecer).
 */
export interface UpcomingDeal {
  deal: Deal;
  lead: Lead | undefined;
}

/**
 * Ponto da série temporal de tendência (últimos 30 dias).
 *
 * Cada ponto corresponde a um dia. `created` conta deals com `createdAt`
 * naquele dia; `won` conta deals com `closedAt` naquele dia + `status='won'`.
 * Lost não entra — o gráfico mostra atividade positiva (entrada e ganho)
 * pra leitura rápida de "saúde do mês".
 */
export interface TrendDatum {
  /** ISO date no formato `yyyy-MM-dd` — chave estável de ordenação. */
  date: string;
  /** Label curto do eixo X: "08 mai", "09 mai" (date-fns pt-BR). */
  label: string;
  /** Quantidade de deals criados nesse dia. */
  created: number;
  /** Quantidade de deals ganhos (closedAt nesse dia, status='won'). */
  won: number;
}

/**
 * Item da timeline "Atividade recente". Derivado das fixtures de deals:
 *
 *  - `created`: deal apareceu no pipeline (`createdAt`)
 *  - `won`: deal fechado como ganho (`closedAt` + status='won')
 *  - `lost`: deal fechado como perdido (`closedAt` + status='lost')
 *
 * Em M8 vira tabela `activities` no Postgres com mais tipos
 * (mensagem WhatsApp, mudança de etapa, nota, ligação) — `type` cresce
 * mas a shape sobrevive. Por enquanto reflete só os eventos que dá pra
 * inferir das fixtures atuais sem inventar dados.
 */
export interface ActivityItem {
  /** ISO datetime do evento — usado pra ordenar e pra `formatRelative`. */
  timestamp: string;
  /** Tipo do evento — controla ícone, cor e verbo. */
  type: 'created' | 'won' | 'lost';
  /** Deal a que se refere (clique → `/leads/{leadId}`). */
  dealId: string;
  dealTitle: string;
  leadId: string;
  /** Vendedor que executou a ação. */
  ownerId: string;
}
