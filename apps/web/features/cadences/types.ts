/**
 * Tipos do domínio Cadências (CLAUDE.md §9 — glossário).
 *
 * Cadência = sequência configurável de mensagens automáticas por etapa,
 * com gatilhos D+0/D+1/D+3/D+7/D+14/D+30 (dias após enrollment).
 *
 * Em M5 a UI roda 100% sobre fixtures + store in-memory. Os tipos aqui
 * **são propositadamente o contrato** que vai virar:
 *   - tabelas Postgres `cadences`, `cadence_steps` em M8
 *   - input de Server Actions (`createCadence`, `addStep`, …) também em M8
 *   - resolver de placeholders e disparador via Edge Function em M10
 *
 * Mudar a shape aqui = retrabalho em cascata. Cuidado.
 */

/**
 * Gatilhos temporais permitidos pelo PRD §2.2. Lista fechada por design —
 * o produto vende "siga a cadência sem pensar"; permitir D+5, D+12, etc.
 * dilui o valor e complica o motor de execução em M10.
 */
export type DayOffset = 0 | 1 | 3 | 7 | 14 | 30;

/**
 * Canais de envio. WhatsApp via uazapi (Standard) / Cloud API (V2 — M9);
 * email via Resend (M7+). Templates de proposta em PDF ficam fora do MVP
 * (CLAUDE.md §10 / §12).
 */
export type CadenceChannel = 'whatsapp' | 'email';

/**
 * Status agregado da cadência inteira.
 *  - `active`: enrollments futuros vão acontecer; passos disparam quando bate o D+N
 *  - `paused`: motor ignora a cadência inteira (vendedor desativou manualmente)
 *
 * NÃO confundir com pausa por enrollment (quando lead responde) — essa é
 * por-lead e fica em outra tabela em M10.
 */
export type CadenceStatus = 'active' | 'paused';

/** Chaves dos templates pré-configurados que seedam a UI em M5. */
export type CadenceTemplateKey = 'imobiliario' | 'b2b' | 'alto-ticket' | 'blank';

export interface CadenceStep {
  id: string;
  cadenceId: string;
  /** Dias após enrollment do lead. Restrito ao set do PRD. */
  dayOffset: DayOffset;
  channel: CadenceChannel;
  /**
   * Texto literal com placeholders `{nome}` / `{empresa}` / `{produto}`.
   * Resolver real (substituir contra dados do lead) acontece em M10 dentro
   * da Edge Function `cadence-runner` — aqui é só string.
   */
  templateBody: string;
  /**
   * Ordenação dentro do mesmo `dayOffset`. Permite ter D+1 WhatsApp e
   * D+1 Email no mesmo dia com sequência determinística.
   */
  order: number;
  createdAt: string;
}

/**
 * Métricas mockadas da cadência. Em M10 viram VIEW Postgres calculada a
 * partir de `cadence_enrollments` + `cadence_step_runs`. Manter os mesmos
 * 4 campos pra UI não mudar quando o backend chegar.
 */
export interface CadenceMetrics {
  /** Leads atualmente em enrollment ativo (não pausado, não concluído). */
  activeEnrollments: number;
  /** Total de mensagens disparadas pela cadência (histórico cumulativo). */
  totalDispatched: number;
  /** Taxa de resposta normalizada [0–1]. UI formata como percentual. */
  responseRate: number;
  /** Taxa de leads que avançaram de etapa após esta cadência [0–1]. */
  stageAdvanceRate: number;
}

export interface Cadence {
  id: string;
  /**
   * Workspace dono. Em M5 é fixo `'ws_demo'` (mock). Em M7 vira o
   * workspace ativo do contexto. Toda query de domínio filtra `workspace_id`
   * no código mesmo com RLS — defense in depth (CLAUDE.md §7.2).
   */
  workspaceId: string;
  name: string;
  description?: string;
  /**
   * Etapa do funil onde a cadência dispara. Referencia
   * `DEFAULT_STAGES.id` em `lib/fixtures/pipelines.ts`. Etapas terminais
   * (`ganho`/`perdido`) não fazem sentido — o `cadenceCreateSchema` rejeita.
   */
  stageId: string;
  status: CadenceStatus;
  /**
   * Template de origem. `undefined` = criada do zero (em branco).
   * Útil pra exibir badge "B2B" ou "Imobiliário" no card e pra analytics
   * internos ("qual template é mais usado").
   */
  templateKey?: CadenceTemplateKey;
  steps: CadenceStep[];
  metrics: CadenceMetrics;
  createdAt: string;
  updatedAt: string;
}

/**
 * Definição de um template pré-configurado. Steps aqui não têm `id`/`cadenceId`
 * porque ainda não pertencem a cadência nenhuma — são "esqueleto". Quando o
 * usuário escolhe o template no dialog de criação, o store gera os IDs.
 */
export interface CadenceTemplate {
  key: CadenceTemplateKey;
  /** Nome curto pra exibir no card do TemplatePicker. */
  label: string;
  /** Chave do ícone (mapeada pra Lucide no componente). */
  iconKey: 'home' | 'briefcase' | 'gem' | 'square-pen';
  /** Frase explicativa de 1 linha. */
  description: string;
  /** Para quem este template foi pensado. */
  recommendedFor: string;
  /**
   * Etapa default sugerida no segundo passo do dialog de criação.
   * Usuário pode trocar antes de submeter.
   */
  defaultStageId: string;
  /** Steps esqueleto — sem id/cadenceId (preenchidos no createCadence). */
  steps: Array<Omit<CadenceStep, 'id' | 'cadenceId' | 'createdAt'>>;
}
