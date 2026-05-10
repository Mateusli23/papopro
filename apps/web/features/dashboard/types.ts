/**
 * Tipos do domínio Dashboard.
 *
 * O dashboard cruza Leads + Deals + Tasks + período de tempo, então tem escopo
 * cross-domain — vive em `features/dashboard/` em vez de estender
 * `features/deals/types.ts`. Em M8 quando virar Server Action, a shape
 * `DashboardKpis` permanece como contrato de retorno.
 */
import type { Deal } from '@/features/deals/types';
import type { Lead, LeadOrigin } from '@/features/leads/types';

// ─── Período / range filter ───────────────────────────────────────────────

/**
 * Os 5 ranges suportados pelo filtro de período do dashboard.
 *
 * - `today`: apenas o dia corrente (00:00 → 23:59 local).
 * - `week`: semana corrente (segunda → domingo, locale pt-BR).
 * - `month`: mês corrente (dia 1 → último dia).
 * - `all`: todo o histórico do workspace (sem filtro).
 * - `custom`: range arbitrário escolhido pelo usuário no calendário.
 *
 * Persistido na URL via `?range=`, com fallback `'week'` quando ausente
 * ou inválido (validação Zod no hook).
 */
export type DashboardRange = 'today' | 'week' | 'month' | 'all' | 'custom';

/**
 * Bounds derivados de um `DashboardRange` numa data de referência.
 * `previousStart`/`previousEnd` cobrem o período igual imediatamente
 * anterior — usado pra calcular trend (↑/↓ % vs período anterior).
 *
 * Em `range='all'` o "anterior" não tem sentido — `previousStart` e
 * `previousEnd` viram `undefined` e o trend cai pra `flat 0`.
 */
export interface RangeBounds {
  range: DashboardRange;
  start: Date;
  end: Date;
  previousStart?: Date;
  previousEnd?: Date;
  /** Label legível pra UI ("Esta semana", "8–14 mai", etc.). */
  label: string;
}

// ─── KPIs ─────────────────────────────────────────────────────────────────

/**
 * Variação entre período atual e anterior.
 * - `up` quando `pct > 1` (>= 1 ponto percentual de crescimento)
 * - `down` quando `pct < -1`
 * - `flat` quando `|pct| <= 1` ou quando o período anterior não existe
 *
 * `pct` é arredondado pra inteiro. Quando o período anterior é 0 e o
 * atual é > 0, retorna `up` com `pct: 100` (estamos "criando do zero",
 * 100% é um teto sensato — mostrar `Infinity` ou "—" confunde).
 */
export interface KpiTrend {
  direction: 'up' | 'down' | 'flat';
  pct: number;
}

export interface DashboardKpis {
  // ─── KPIs principais (5 cards do header) ────────────────────────────────
  /** Leads com `createdAt` dentro do range. */
  newLeadsCount: number;
  /** Tasks com `status === 'pending'` (sem filtro de range — backlog atual). */
  pendingTasksCount: number;
  /** Soma de `valueCents` de deals abertos (snapshot atual). */
  openPipelineCents: number;
  /**
   * `won_in_range / (won_in_range + lost_in_range)` × 100, inteiro.
   * Se denominador 0, retorna 0.
   */
  conversionRatePct: number;
  /** Soma de `valueCents` de deals abertos com `stageId === 'proposta'`. */
  proposalsCents: number;

  // ─── Métricas auxiliares (alimentam hints e banner) ─────────────────────
  /** Leads com `temperature === 'hot'` agora — alimenta `<HotLeadsAlert>`. */
  hotLeadsCount: number;
  /** Negócios abertos no momento — sumário pra hint do KPI Pipeline. */
  openDealsCount: number;
  /** Deals fechados (won + lost) com `closedAt` no range. */
  closedInRange: number;
  /** Subset de `closedInRange` com `status === 'won'`. */
  wonInRange: number;
  /** Subset de `closedInRange` com `status === 'lost'`. */
  lostInRange: number;

  // ─── Trends (período atual vs anterior igual) ───────────────────────────
  /** Trend pro KPI #1 (newLeadsCount). */
  newLeadsTrend: KpiTrend;
  /** Trend pro KPI #4 (conversionRatePct). */
  conversionTrend: KpiTrend;
  // Note: `proposalsTrend` foi removido — Propostas é snapshot puro do
  // pipeline em M5, sem histórico de stage. Em M8+ quando houver
  // `deal.stageHistory[]`, o trend volta como `proposalsTrend`.

  // ─── Período anterior (debug / smoke test) ──────────────────────────────
  /** Para `range='all'` ou inicialização vazia, vira `undefined`. */
  previousNewLeadsCount?: number;
  previousConversionRatePct?: number;
}

// ─── Origem (donut) ───────────────────────────────────────────────────────

/**
 * Os 9 valores de `LeadOrigin` mapeiam pra 5 buckets visuais no donut —
 * vendedor lê "de onde vêm meus leads" sem precisar de legenda com 9 entradas.
 *
 * Mapeamento:
 * - `paid` ← `meta_ads`, `google_ads` (mídia paga)
 * - `whatsapp` ← `whatsapp_inbound` (canal direto)
 * - `referral` ← `indicacao` (boca-a-boca)
 * - `site` ← `site` (formulários do site)
 * - `other` ← `csv_import`, `manual`, `rd_station`, `hotmart` (entradas
 *   diversas que não merecem fatia própria nessa visualização)
 *
 * Se algum cliente quiser visualizar `rd_station` separadamente em M8+,
 * adiciona-se um bucket sem quebrar o shape.
 */
export type OriginBucket = 'paid' | 'whatsapp' | 'referral' | 'site' | 'other';

export interface OriginDatum {
  bucket: OriginBucket;
  /** Label exibido na legenda ("Patrocinado", "WhatsApp", etc.). */
  label: string;
  /** Quantidade de leads no bucket dentro do range. */
  count: number;
  /** Percentual [0–100], inteiro arredondado. */
  pct: number;
  /** CSS color string `hsl(var(--token))` — adapta dark/light sem JS. */
  fill: string;
  /** Origens reais agrupadas neste bucket (pra deep-link `/leads?origin=`). */
  origins: LeadOrigin[];
}

// ─── Funil horizontal ─────────────────────────────────────────────────────

/**
 * Linha do funil horizontal — ordem natural do pipeline (Novo → Perdido),
 * NÃO ordenado por count (diferente do `FunnelDatum` trapezoidal antigo).
 *
 * O funil horizontal mostra TODAS as etapas, incluindo terminais
 * (Ganho/Perdido) — a leitura "linear" do funil exige ver onde entrou e
 * onde saiu, em paralelo.
 */
export interface HorizontalFunnelDatum {
  stageId: string;
  name: string;
  /** Count de deals na etapa (status='open' pra ativas; 'won'/'lost' pra terminais). */
  count: number;
  /** Soma agregada em centavos (todos os deals na etapa, abertos ou fechados). */
  totalCents: number;
  /** `bg-info`, `bg-success`, etc. — Tailwind class usada como fill da barra. */
  barClass: string;
  /** Tom semântico da etapa (`success`/`destructive` em terminais). */
  terminalTone?: 'default' | 'success' | 'destructive';
}

// ─── Hot leads (alimenta banner) ──────────────────────────────────────────

/**
 * Lead quente exposto na listagem do banner (caso virar drawer no futuro).
 * Em M5 o banner só mostra count agregado, mas o shape já permite expansão.
 */
export interface HotLead {
  id: string;
  name: string;
  /** Mais recente entre `lastActivityAt`, `lastTouchedAt`, ou `createdAt`. */
  lastTouchedAt: string;
}

// ─── Tipos legados (mantidos pelo trend chart 30d e tabelas existentes) ───

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
 *
 * Mantido com 30d fixos mesmo após a refatoração — é um insight temporal
 * complementar ao filtro de range, não substituível por ele.
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
