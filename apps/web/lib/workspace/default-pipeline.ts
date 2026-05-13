/**
 * Stages padrão do funil semeadas em `createWorkspaceAction` (M8#1) — todo
 * workspace novo nasce com este pipeline default + 6 etapas.
 *
 * **Por que aqui e não em uma migration SQL?** A migration roda 1x por banco;
 * o seed precisa rodar 1x por workspace criado. Manter na Server Action
 * garante atomicidade com o resto do INSERT (workspace + member + prefs +
 * pipeline + stages em 1 transação) — se qualquer parte falhar, nada
 * persiste.
 *
 * **Valores idênticos aos fixtures de M4** (`apps/web/lib/fixtures/pipelines.ts`)
 * pra que a transição mock → DB seja invisível pra UI. Customização (templates
 * por segmento: imobiliário, B2B, alto-ticket) entra em M8#2+ como onda
 * separada.
 *
 * **Sobre tipos:** `tone` é union literal aqui (não enum importado do Prisma)
 * seguindo o padrão do resto do código — Prisma aceita string literal nos
 * `data: {}` e mantém o arquivo independente de runtime do client.
 */

/** Tom semântico da etapa — espelha o enum `stage_tone` em `schema.prisma`. */
type StageToneLiteral = 'default' | 'success' | 'destructive';

export interface DefaultPipelineStage {
  slug: string;
  name: string;
  order: number;
  rotDays: number;
  terminal: boolean;
  tone: StageToneLiteral;
}

export const DEFAULT_PIPELINE_NAME = 'Funil padrão';

export const DEFAULT_PIPELINE_STAGES: readonly DefaultPipelineStage[] = [
  { slug: 'novo', name: 'Novo', order: 1, rotDays: 7, terminal: false, tone: 'default' },
  {
    slug: 'em_contato',
    name: 'Em contato',
    order: 2,
    rotDays: 14,
    terminal: false,
    tone: 'default',
  },
  { slug: 'proposta', name: 'Proposta', order: 3, rotDays: 7, terminal: false, tone: 'default' },
  {
    slug: 'negociacao',
    name: 'Negociação',
    order: 4,
    rotDays: 5,
    terminal: false,
    tone: 'default',
  },
  { slug: 'ganho', name: 'Ganho', order: 5, rotDays: 0, terminal: true, tone: 'success' },
  { slug: 'perdido', name: 'Perdido', order: 6, rotDays: 0, terminal: true, tone: 'destructive' },
] as const;
