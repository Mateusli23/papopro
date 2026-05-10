/**
 * Agentes IA mockados — 3 agentes representando os 3 templates principais
 * (Qualificação SDR, Atendimento, Recuperação) em estados visuais distintos
 * pra a demo: 1 ativo cheio de métricas, 1 pausado com histórico, 1 em teste
 * recém-criado.
 *
 * Construídos clonando o trio default dos templates + acrescentando 1-2
 * versões "histórico" pra mostrar o feature de versionamento. Métricas
 * plausíveis (não zeradas) — a demo precisa **vender a feature**.
 *
 * Em M11 substituído por `SELECT * FROM ai_agents WHERE workspace_id = ?`.
 */
import { subDays, subHours } from 'date-fns';

import type {
  Agent,
  AgentRoute,
  AgentTone,
  AgentVersion,
  HandoffTrigger,
} from '@/features/agents/types';

import { AGENT_TEMPLATES, getAgentTemplate } from './agent-templates';

const NOW = new Date('2026-05-09T14:00:00-03:00');
const WORKSPACE = 'ws_demo';

let AGENT_ID = 0;
function nextAgentId(): string {
  AGENT_ID += 1;
  return `agt_${AGENT_ID.toString().padStart(5, '0')}`;
}

let ROUTE_ID = 0;
function nextRouteId(): string {
  ROUTE_ID += 1;
  return `route_${ROUTE_ID.toString().padStart(5, '0')}`;
}

let TRIGGER_ID = 0;
function nextTriggerId(): string {
  TRIGGER_ID += 1;
  return `htg_${TRIGGER_ID.toString().padStart(5, '0')}`;
}

let VERSION_ID = 0;
function nextVersionId(): string {
  VERSION_ID += 1;
  return `ver_${VERSION_ID.toString().padStart(5, '0')}`;
}

interface VersionSeed {
  prompt: string;
  persona: string;
  tone: AgentTone;
  notes?: string;
  hoursAgo: number;
}

interface AgentSeed {
  templateKey: 'qualification' | 'attendance' | 'recovery' | 'blank';
  name: string;
  avatarEmoji: string;
  status: 'active' | 'paused' | 'testing';
  createdDaysAgo: number;
  /**
   * Versões em ordem cronológica do mais antigo pro mais novo. Última entry
   * vira `currentVersionId` E o trio principal do agente. Se vazio, usa só
   * o default do template como v1.
   */
  versions: VersionSeed[];
  /** Override de routes — se ausente, usa o default do template. */
  customRoutes?: Array<Pick<AgentRoute, 'kind' | 'value'>>;
  /** Override de triggers — se ausente, usa o default do template. */
  customTriggers?: Array<Omit<HandoffTrigger, 'id'>>;
  metrics: {
    totalConversations: number;
    resolutionRate: number;
    avgResponseTimeSec: number;
    inferredSatisfaction: number;
  };
}

const SEEDS: AgentSeed[] = [
  // ─── 1. Sofia — SDR ativo, com 3 versões mostrando evolução de prompt ───
  {
    templateKey: 'qualification',
    name: 'Sofia · SDR',
    avatarEmoji: '🎯',
    status: 'active',
    createdDaysAgo: 45,
    versions: [
      {
        // v1 — prompt inicial do template, criado há 45 dias
        hoursAgo: 45 * 24,
        prompt:
          'Você é um SDR experiente que faz a primeira conversa com leads novos. Seu objetivo é entender 3 coisas em até 5 mensagens: 1) o que o lead procura, 2) o orçamento aproximado, 3) a urgência da decisão. Faça uma pergunta por vez, sempre com tom acolhedor e curioso. Quando coletar as 3 informações, agradeça e avise que um vendedor especialista vai continuar a conversa em até 1 hora útil. NÃO mencione preços específicos nem feche venda — isso fica com o humano.',
        persona:
          'Sofia, SDR junior da equipe. Curiosa, paciente, escuta antes de propor. Não enrola e não pressiona.',
        tone: 'consultivo',
        notes: 'Versão inicial — template Qualificação SDR',
      },
      {
        // v2 — ajuste pra ser mais direto, há 18 dias
        hoursAgo: 18 * 24,
        prompt:
          'Você é uma SDR que faz triagem rápida de leads novos. Objetivo: coletar em até 4 mensagens (1) interesse, (2) orçamento aproximado e (3) urgência. Uma pergunta por vez, tom acolhedor. Quando tiver as 3 respostas, agradeça e avise que um vendedor entra em contato em até 1 hora útil. NÃO informe preços — é com o humano.',
        persona: 'Sofia, SDR experiente. Curiosa, direta no ponto, escuta antes de propor.',
        tone: 'consultivo',
        notes: 'Mensagens mais curtas — leads reclamavam de "muito texto"',
      },
      {
        // v3 — ajuste fino do tom, há 3 dias (ATUAL)
        hoursAgo: 3 * 24,
        prompt:
          'Você é uma SDR que faz triagem rápida de leads novos. Em até 4 mensagens, descobre: (1) o que o lead procura, (2) faixa de orçamento, (3) urgência. Pergunta por vez, sempre acolhedor — leads ansiosos precisam de calma, não de eficiência. Quando tiver as 3 respostas, agradeça pelo nome e avise que vendedor entra em contato em até 1 hora útil (em horário comercial). NUNCA informe preços específicos — é trabalho do humano.',
        persona:
          'Sofia, SDR experiente que sabe que o tom faz diferença. Calma, curiosa, sem pressa. O lead sente que está sendo ouvido.',
        tone: 'amigavel',
        notes: 'Tom mais acolhedor após feedback do time',
      },
    ],
    metrics: {
      totalConversations: 287,
      resolutionRate: 0.78,
      avgResponseTimeSec: 28,
      inferredSatisfaction: 0.84,
    },
  },

  // ─── 2. Léo — Atendimento pausado, com 2 versões ─────────────────────────
  {
    templateKey: 'attendance',
    name: 'Léo · Atendimento',
    avatarEmoji: '💬',
    status: 'paused',
    createdDaysAgo: 30,
    versions: [
      {
        hoursAgo: 30 * 24,
        prompt:
          'Você é um atendente educado que responde dúvidas comuns sobre nossos produtos e horários. Use SEMPRE as informações da base de conhecimento da empresa — se a resposta não estiver lá, diga claramente que vai chamar um vendedor humano. Não invente preços, prazos ou condições. Mantenha respostas curtas (máx 3 linhas no WhatsApp) e termine sempre perguntando se ajudou.',
        persona:
          'Léo, atendente do time. Paciente, didático, gosta de simplificar. Reconhece quando a pergunta é complexa demais e passa pra pessoa.',
        tone: 'amigavel',
        notes: 'Versão inicial — template Atendimento',
      },
      {
        hoursAgo: 9 * 24,
        prompt:
          'Você é um atendente que responde dúvidas operacionais (horários, prazos, formas de pagamento, política de troca). Use SEMPRE a base de conhecimento — se não estiver lá, diga claro que vai passar pra um vendedor. Respostas curtas (máx 3 linhas), tom direto. Termine sempre perguntando se resolvi.',
        persona:
          'Léo, atendente direto. Não enrola, vai ao ponto. Passa rápido pro vendedor quando a dúvida sai do operacional.',
        tone: 'direto',
        notes: 'Pausamos pra refinar — vendia demais ao invés de só atender',
      },
    ],
    customRoutes: [
      { kind: 'stage', value: 'em_contato' },
      { kind: 'keyword', value: 'horario' },
      { kind: 'keyword', value: 'prazo' },
    ],
    metrics: {
      totalConversations: 148,
      resolutionRate: 0.62,
      avgResponseTimeSec: 19,
      inferredSatisfaction: 0.71,
    },
  },

  // ─── 3. Bia — Recuperação em teste, recém-criada ─────────────────────────
  {
    templateKey: 'recovery',
    name: 'Bia · Recuperação',
    avatarEmoji: '♻️',
    status: 'testing',
    createdDaysAgo: 2,
    versions: [
      {
        hoursAgo: 2 * 24,
        prompt:
          'Você reaquece leads que pararam de responder há mais de 7 dias. Use mensagens leves, curtas e sem cobrança. Comece reconhecendo a pausa ("imagino que tenha sumido aqui na correria"), traga uma novidade ou benefício novo, e SEMPRE deixe a porta aberta ("se não fizer mais sentido, é só me avisar"). Limite de 3 tentativas — depois disso passe pro humano. NÃO use linguagem de pressão ou urgência falsa.',
        persona:
          'Bia, especialista em retenção. Tom leve, sem urgência. Sabe que o "não" também é resposta.',
        tone: 'amigavel',
        notes: 'Versão inicial — template Recuperação',
      },
    ],
    metrics: {
      totalConversations: 14,
      resolutionRate: 0.5,
      avgResponseTimeSec: 41,
      inferredSatisfaction: 0.79,
    },
  },
];

function materializeAgent(seed: AgentSeed): Agent {
  const id = nextAgentId();
  const tpl = getAgentTemplate(seed.templateKey);
  if (!tpl) {
    throw new Error(`Template "${seed.templateKey}" não encontrado em AGENT_TEMPLATES`);
  }

  const createdAt = subDays(NOW, seed.createdDaysAgo).toISOString();

  // Materializa rotas (custom OU default do template) com IDs estáveis.
  const routesSource = seed.customRoutes ?? tpl.defaultRoutes;
  const routes: AgentRoute[] = routesSource.map((r) => ({
    id: nextRouteId(),
    kind: r.kind,
    value: r.value,
    createdAt,
  }));

  // Materializa triggers (custom OU default do template) com IDs estáveis.
  const triggersSource = seed.customTriggers ?? tpl.defaultHandoffTriggers;
  const handoffTriggers: HandoffTrigger[] = triggersSource.map((t) => ({
    id: nextTriggerId(),
    kind: t.kind,
    enabled: t.enabled,
    config: t.config,
  }));

  // Materializa versões. Ordenadas decrescente por `hoursAgo` (mais novo
  // primeiro) — mesmo padrão do array `versions` no agent (latest first
  // pra UI exibir como timeline).
  const sortedSeeds = [...seed.versions].sort((a, b) => a.hoursAgo - b.hoursAgo);
  const versions: AgentVersion[] = sortedSeeds.map((vs, idx) => ({
    id: nextVersionId(),
    agentId: id,
    versionNumber: idx + 1,
    prompt: vs.prompt,
    persona: vs.persona,
    tone: vs.tone,
    createdBy: idx === 0 ? 'Você' : ['Você', 'Mariana', 'Renato'][idx % 3] || 'Você',
    notes: vs.notes,
    createdAt: subHours(NOW, vs.hoursAgo).toISOString(),
  }));
  // Reverte a ordem pra latest first (UI consome direto sem sort).
  versions.reverse();
  const current = versions[0]!;

  return {
    id,
    workspaceId: WORKSPACE,
    name: seed.name,
    avatarEmoji: seed.avatarEmoji,
    status: seed.status,
    templateKey: seed.templateKey,
    prompt: current.prompt,
    persona: current.persona,
    tone: current.tone,
    routes,
    handoffTriggers,
    versions,
    currentVersionId: current.id,
    metrics: seed.metrics,
    createdAt,
    updatedAt: current.createdAt,
  };
}

export const FAKE_AGENTS: Agent[] = SEEDS.map(materializeAgent);

// Re-export pra módulos que precisam dos templates já com a fixture carregada.
export { AGENT_TEMPLATES };

// ─── Helpers de lookup ─────────────────────────────────────────────────────

export function getAgent(id: string): Agent | undefined {
  return FAKE_AGENTS.find((a) => a.id === id);
}
