/**
 * Tipos de domínio de Leads/Deals/Pipeline.
 *
 * **Importante:** essa shape é o **contrato** que vai virar o schema Prisma
 * em M8. Qualquer coisa adicionada aqui durante o M4 deve ter contrapartida
 * planejada na migração inicial — campos viram colunas, enums viram enums
 * Postgres, etc.
 *
 * Mantemos os IDs como `string` (em runtime são UUIDs no Postgres; nas
 * fixtures usamos slugs legíveis pra debug visual mais rápido).
 */
import type { LeadTemperature } from '@papopro/ui';

// ─── Pipeline ──────────────────────────────────────────────────────────────

/** Slug da etapa default — referenciado por fixtures e helpers. */
export type DefaultStageId =
  | 'novo'
  | 'em_contato'
  | 'proposta'
  | 'negociacao'
  | 'ganho'
  | 'perdido';

export interface PipelineStage {
  id: DefaultStageId | string;
  /**
   * Slug estável (M8#3) — referencia o `getStageStyle()` cromático e
   * sobrevive a rename do `name`. Fixtures legadas usam `id === slug`;
   * stages reais do DB têm UUID em `id` e slug separado.
   */
  slug?: DefaultStageId | string;
  name: string;
  /** Ordem visual no Kanban e em selects. */
  order: number;
  /**
   * Limiar (em dias) pra considerar um deal "esfriando" nessa etapa
   * — vira `cold_lead_thresholds` em M10.
   */
  rotDays: number;
  /** "Estado terminal" — etapas Ganho/Perdido não têm rot, não disparam cadência. */
  terminal?: boolean;
  /** Tom semântico opcional (etapas terminais usam success/destructive). */
  tone?: 'default' | 'success' | 'destructive';
}

export interface Pipeline {
  id: string;
  name: string;
  /** Pipeline que o workspace usa por padrão na criação de leads. */
  isDefault: boolean;
  stages: PipelineStage[];
}

// ─── Lead / Deal ───────────────────────────────────────────────────────────

export type LeadOrigin =
  | 'site'
  | 'meta_ads'
  | 'google_ads'
  | 'indicacao'
  | 'whatsapp_inbound'
  | 'csv_import'
  | 'manual'
  | 'rd_station'
  | 'hotmart';

/** Status macro do lead (independente da etapa). */
export type LeadStatus = 'ativo' | 'arquivado' | 'perdido' | 'ganho';

export interface Lead {
  id: string;
  /** Nome completo do contato. */
  name: string;
  email?: string;
  /** Telefone E.164-ish — em fixtures usamos `+55 11 9 9999-0000` legível. */
  phone: string;
  company?: string;
  position?: string;
  origin: LeadOrigin;
  status: LeadStatus;
  /** Etapa atual (id de `pipeline_stages`). */
  stageId: string;
  /** Vendedor responsável (id de `workspace_members`). */
  assignedTo: string;
  temperature: LeadTemperature;
  /** Valor estimado do deal em centavos (BRL) — string para evitar imprecisão de float em M8. */
  valueCents: number;
  /** Tags livres — em M8 viram `tags` + `lead_tags` join table. */
  tags: string[];
  /** Anotação curta visível na ficha — observação genérica. */
  notes?: string;
  createdAt: string;
  updatedAt: string;
  /** Última interação (mensagem, ligação, nota). Usada pra "última atividade" e cálculo de temperatura. */
  lastInteractionAt?: string;
  /** Próxima ação pendente (deriva da próxima `task` aberta — denormalizado pra UI rápida). */
  nextActionAt?: string;
  nextActionLabel?: string;
}

// ─── Activity / Timeline ───────────────────────────────────────────────────

export type ActivityType =
  | 'whatsapp_in'
  | 'whatsapp_out'
  | 'call'
  | 'email'
  | 'meeting'
  | 'note'
  | 'task'
  | 'stage_change'
  | 'attachment'
  | 'lead_created';

export interface Activity {
  id: string;
  leadId: string;
  type: ActivityType;
  /** Texto principal do evento. WhatsApp/email/nota carrega o corpo aqui. */
  body?: string;
  /** Quem disparou (vendedor) ou ‘sistema’ pra eventos automáticos. */
  authorId: string;
  /** ISO datetime. */
  createdAt: string;
  /** Metadados específicos por tipo. */
  meta?: {
    /** stage_change: etapa antes/depois. */
    fromStageId?: string;
    toStageId?: string;
    /** call: duração em segundos. */
    durationSeconds?: number;
    /** meeting: link/local. */
    location?: string;
    /** attachment: nome/tamanho. */
    fileName?: string;
    fileSizeKb?: number;
  };
}

// ─── Tasks ─────────────────────────────────────────────────────────────────

export type TaskKind = 'call' | 'whatsapp' | 'email' | 'meeting' | 'follow_up' | 'other';
export type TaskStatus = 'pending' | 'done' | 'snoozed';

export interface Task {
  id: string;
  leadId: string;
  kind: TaskKind;
  title: string;
  notes?: string;
  /** ISO datetime — sempre em fuso `America/Sao_Paulo` na UI. */
  dueAt: string;
  status: TaskStatus;
  assignedTo: string;
  createdAt: string;
  doneAt?: string;
}

// ─── Vendedores (subset pra UI) ────────────────────────────────────────────

export interface SalesRep {
  id: string;
  name: string;
  email: string;
  initials: string;
  /** Token de cor (semântico, não hex) usado em chips/avatares. */
  accent: 'primary' | 'success' | 'warning' | 'info' | 'accent';
}
