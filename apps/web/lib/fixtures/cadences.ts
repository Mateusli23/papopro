/**
 * Cadências mockadas — uma por etapa ativa + algumas extras pra mostrar
 * variedade visual (ativas, pausada, custom em-branco modificada).
 *
 * Construídas clonando os steps dos templates pré-configurados (mesmo
 * caminho que o `createCadence` real do store percorre quando o usuário
 * escolhe um template no dialog). Métricas plausíveis (não zeradas) — a
 * demo precisa **vender a feature**.
 *
 * Em M8 substituído por `SELECT * FROM cadences WHERE workspace_id = ?`.
 */
import { subDays } from 'date-fns';

import type { Cadence, CadenceStep, CadenceTemplate } from '@/features/cadences/types';

import { CADENCE_TEMPLATES, getTemplate } from './cadence-templates';

const NOW = new Date('2026-05-09T14:00:00-03:00');
const WORKSPACE = 'ws_demo';

let CADENCE_ID = 0;
function nextCadenceId(): string {
  CADENCE_ID += 1;
  return `cad_${CADENCE_ID.toString().padStart(5, '0')}`;
}

let STEP_ID = 0;
function nextStepId(): string {
  STEP_ID += 1;
  return `step_${STEP_ID.toString().padStart(5, '0')}`;
}

/** Materializa steps de um template em CadenceStep com IDs reais. */
function materializeSteps(
  cadenceId: string,
  template: CadenceTemplate,
  createdAt: string,
): CadenceStep[] {
  return template.steps.map((s, idx) => ({
    id: nextStepId(),
    cadenceId,
    dayOffset: s.dayOffset,
    channel: s.channel,
    templateBody: s.templateBody,
    // Garante ordenação determinística — mesmo dayOffset desempata por
    // posição no template original.
    order: s.order || idx,
    createdAt,
  }));
}

interface CadenceSeed {
  name: string;
  description?: string;
  stageId: string;
  templateKey: 'imobiliario' | 'b2b' | 'alto-ticket' | 'blank';
  status: 'active' | 'paused';
  createdDaysAgo: number;
  updatedDaysAgo: number;
  metrics: {
    activeEnrollments: number;
    totalDispatched: number;
    responseRate: number;
    stageAdvanceRate: number;
  };
  /**
   * Override opcional dos steps. Pra cadências `blank` ou customizadas
   * (ex: workspace que personalizou a B2B). Se ausente, usa o template puro.
   */
  customSteps?: Array<{
    dayOffset: 0 | 1 | 3 | 7 | 14 | 30;
    channel: 'whatsapp' | 'email';
    templateBody: string;
  }>;
}

const SEEDS: CadenceSeed[] = [
  {
    name: 'Boas-vindas Imobiliário',
    description: 'Primeira semana com lead novo de imóvel — alta cadência.',
    stageId: 'novo',
    templateKey: 'imobiliario',
    status: 'active',
    createdDaysAgo: 21,
    updatedDaysAgo: 3,
    metrics: {
      activeEnrollments: 12,
      totalDispatched: 248,
      responseRate: 0.38,
      stageAdvanceRate: 0.22,
    },
  },
  {
    name: 'Re-engajamento de visita',
    description: 'Pra leads que pediram visita mas sumiram.',
    stageId: 'novo',
    templateKey: 'blank',
    status: 'paused',
    createdDaysAgo: 15,
    updatedDaysAgo: 6,
    metrics: {
      activeEnrollments: 0,
      totalDispatched: 41,
      responseRate: 0.17,
      stageAdvanceRate: 0.07,
    },
    customSteps: [
      {
        dayOffset: 0,
        channel: 'whatsapp',
        templateBody:
          'Oi {nome}, percebi que você manifestou interesse em visitar o {produto} e ficamos sem resposta. Tudo bem? Se quiser, posso reagendar.',
      },
      {
        dayOffset: 3,
        channel: 'whatsapp',
        templateBody:
          '{nome}, alguns dias se passaram. Posso enviar um vídeo curto do {produto} pra você ver agora mesmo, sem precisar sair de casa?',
      },
      {
        dayOffset: 7,
        channel: 'whatsapp',
        templateBody:
          'Oi {nome}! Sem cobrança — só queria saber se ainda faz sentido falarmos sobre o {produto}. Se preferir outro perfil, é só me dizer.',
      },
      {
        dayOffset: 14,
        channel: 'email',
        templateBody:
          '{nome}, deixei aqui no email um resumo dos imóveis disponíveis na região do {produto}. Se algum chamar atenção, me chama no WhatsApp.',
      },
    ],
  },
  {
    name: 'Nutrição B2B consultivo',
    description: 'Sequência completa pra qualificar decisores na agenda.',
    stageId: 'em_contato',
    templateKey: 'b2b',
    status: 'active',
    createdDaysAgo: 45,
    updatedDaysAgo: 1,
    metrics: {
      activeEnrollments: 28,
      totalDispatched: 612,
      responseRate: 0.24,
      stageAdvanceRate: 0.16,
    },
  },
  {
    name: 'Recuperação Alto Ticket',
    description: 'Cadência calma pós-proposta de ticket alto. Ciclo de 30d.',
    stageId: 'negociacao',
    templateKey: 'alto-ticket',
    status: 'active',
    createdDaysAgo: 60,
    updatedDaysAgo: 5,
    metrics: {
      activeEnrollments: 4,
      totalDispatched: 89,
      responseRate: 0.51,
      stageAdvanceRate: 0.34,
    },
  },
  {
    name: 'Pós-proposta corporativa',
    description: 'Acompanhamento curto entre envio da proposta e decisão.',
    stageId: 'proposta',
    templateKey: 'b2b',
    status: 'active',
    createdDaysAgo: 9,
    updatedDaysAgo: 0,
    metrics: {
      activeEnrollments: 9,
      totalDispatched: 51,
      responseRate: 0.31,
      stageAdvanceRate: 0.21,
    },
  },
];

const CADENCES: Cadence[] = SEEDS.map((seed) => {
  const id = nextCadenceId();
  const template = getTemplate(seed.templateKey);
  if (!template) {
    throw new Error(`Template "${seed.templateKey}" não encontrado em CADENCE_TEMPLATES`);
  }

  const createdAt = subDays(NOW, seed.createdDaysAgo).toISOString();
  const updatedAt = subDays(NOW, seed.updatedDaysAgo).toISOString();

  // Steps: customSteps quando fornecidos (cadência personalizada),
  // senão clona do template.
  let steps: CadenceStep[];
  if (seed.customSteps) {
    steps = seed.customSteps.map((s, idx) => ({
      id: nextStepId(),
      cadenceId: id,
      dayOffset: s.dayOffset,
      channel: s.channel,
      templateBody: s.templateBody,
      order: idx,
      createdAt,
    }));
  } else {
    steps = materializeSteps(id, template, createdAt);
  }

  return {
    id,
    workspaceId: WORKSPACE,
    name: seed.name,
    description: seed.description,
    stageId: seed.stageId,
    status: seed.status,
    templateKey: seed.templateKey,
    steps,
    metrics: seed.metrics,
    createdAt,
    updatedAt,
  };
});

export const FAKE_CADENCES: Cadence[] = CADENCES;

// Re-export pra módulos que precisam dos templates já com a fixture carregada.
export { CADENCE_TEMPLATES };

// ─── Helpers de lookup ─────────────────────────────────────────────────────

export function getCadence(id: string): Cadence | undefined {
  return CADENCES.find((c) => c.id === id);
}

export function getCadencesForStage(stageId: string): Cadence[] {
  return CADENCES.filter((c) => c.stageId === stageId);
}

export function getCadenceStep(cadenceId: string, stepId: string): CadenceStep | undefined {
  return getCadence(cadenceId)?.steps.find((s) => s.id === stepId);
}
