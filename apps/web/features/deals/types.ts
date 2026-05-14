/**
 * Tipos do domínio Deal/Negócio.
 *
 * **Importante (CLAUDE.md §9):** Lead e Deal são entidades diferentes —
 * o Lead é o contato, o Deal é a oportunidade comercial vinculada a ele.
 * Um Lead pode ter 0..N Deals ativos. O Pipeline Kanban opera sobre Deals,
 * não sobre Leads. A confusão "lead = deal" do M4 (onde a etapa do funil
 * vivia no próprio Lead) fica aqui resolvida — `Lead.stageId` segue
 * existindo pra alimentar a lista densa, mas o Kanban passa a ler
 * `Deal.stageId` que é o estado canônico da oportunidade.
 *
 * Em M8 vira tabela `deals` no Postgres (FK pra `leads`, FK pra
 * `pipeline_stages`, FK pra `workspace_members` no `ownerId`).
 */

/** Estado terminal: ganho/perdido fecham o deal. */
export type DealStatus = 'open' | 'won' | 'lost';

export interface Deal {
  id: string;
  /** Título descritivo — "Apartamento Vértice 2026", não só nome do lead. */
  title: string;
  /** Lead associado (FK leads.id em M8). */
  leadId: string;
  /** Etapa atual no pipeline (FK pipeline_stages.id em M8 — UUID em deals reais). */
  stageId: string;
  /**
   * Slug da etapa (M8#3) — duplicado do `stage.slug` pra alimentar
   * `getStageStyle()` sem precisar de outro lookup. Server-fed deals sempre
   * têm; fixtures legadas (M4) usam o próprio `stageId` como slug (compat).
   */
  stageSlug?: string;
  /** Valor estimado em centavos (BRL). */
  valueCents: number;
  /** Vendedor responsável (FK workspace_members.id em M8). */
  ownerId: string;
  /** Probabilidade percebida de fechar (0..100). Em M11 vira sinal de IA. */
  probability?: number;
  /** Prazo previsto de fechamento. */
  dueAt?: string;
  status: DealStatus;
  /** Quando `status=lost`, motivo registrado pelo vendedor. */
  lostReason?: string;
  description?: string;
  /**
   * Posição do deal dentro da coluna (M8#3). Persistido em `deals.order_in_stage`.
   * Server-fed: sempre numerico (espaçado em múltiplos de ~1000 entre vizinhos);
   * fixtures legadas: undefined → sort cai pra `valueCents`.
   */
  orderInStage?: number;
  /** Nome do lead (denormalizado pelo server pra DealCard mostrar sem outro fetch). */
  leadName?: string;
  /** Empresa do lead (idem). */
  leadCompany?: string;
  createdAt: string;
  updatedAt: string;
  /** Quando virou won/lost. */
  closedAt?: string;
}
