/**
 * Tipos do domínio Agentes IA (CLAUDE.md §9 — glossário; PRD §3.9).
 *
 * Agente = persona configurável com prompt, tom de voz e regras de roteamento
 * que atende leads no WhatsApp. Até 3 agentes ativos por workspace no plano
 * Pro IA (PRD §2.5 / §3.9).
 *
 * Em M5 a UI roda 100% sobre fixtures + store in-memory. Os tipos aqui
 * **são propositadamente o contrato** que vai virar:
 *   - tabelas Postgres `ai_agents`, `agent_versions`, `agent_routing_rules`,
 *     `knowledge_base_fields`, `knowledge_documents` em M11
 *   - input de Server Actions (`createAgent`, `saveVersion`, `addRoute`) em M11
 *   - resolver de prompt + execução real via Claude API em M11
 *
 * Mudar a shape aqui = retrabalho em cascata. Cuidado.
 */

/**
 * Status agregado do agente:
 *  - `active`: atende leads novos seguindo o roteamento configurado
 *  - `paused`: motor ignora o agente (vendedor desativou manualmente)
 *  - `testing`: rascunho — só responde no chat de simulação do editor.
 *    Default ao criar — força revisão antes de "soltar" o agente real.
 */
export type AgentStatus = 'active' | 'paused' | 'testing';

/**
 * Tons de voz pré-definidos. Lista fechada por design — tom livre demais
 * (ex: "como Steve Jobs daria um pitch") gera prompts inconsistentes e
 * dificulta análise downstream. PRD §3.9 fala de "tom de voz" sem detalhar;
 * 4 buckets cobrem o espectro consultivo→casual→direto→institucional.
 */
export type AgentTone = 'consultivo' | 'amigavel' | 'direto' | 'formal';

/** Chaves dos templates pré-configurados que seedam a UI em M5. */
export type AgentTemplateKey = 'qualification' | 'attendance' | 'recovery' | 'blank';

/**
 * Tipos de regra de roteamento (PRD §3.9). Match no **primeiro hit** —
 * documentado no JSDoc de `getNextRouteMatch` e no badge da UI.
 *
 *  - `stage`: lead na etapa do funil X recebe este agente
 *  - `tag`: lead com tag X recebe este agente
 *  - `whatsapp_number`: leads que chegam pelo número conectado X
 *  - `keyword`: lead falou a palavra-chave X na primeira mensagem
 */
export type RouteKind = 'stage' | 'tag' | 'whatsapp_number' | 'keyword';

export interface AgentRoute {
  id: string;
  kind: RouteKind;
  /**
   * Valor da regra. Semântica depende do `kind`:
   *  - `stage` → `stageId` em `DEFAULT_STAGES`
   *  - `tag` → string livre da tag
   *  - `whatsapp_number` → identificador do número conectado (mock: `'main'` etc.)
   *  - `keyword` → palavra/frase a buscar na primeira mensagem
   */
  value: string;
  createdAt: string;
}

/**
 * Tipos de gatilho de handoff (PRD §3.9):
 *  - `manual` → vendedor clica "Assumir conversa" (sempre disponível)
 *  - `keyword` → lead falou uma das palavras configuradas
 *  - `commercial_intent` → IA detectou intenção de fechar negócio
 *  - `stage_negotiation` → lead avançou pra etapa Negociação
 *  - `outside_business_hours` → fora do horário comercial do workspace
 *  - `agent_to_agent` → handoff pra outro agente IA (não pra humano)
 */
export type HandoffTriggerKind =
  | 'manual'
  | 'keyword'
  | 'commercial_intent'
  | 'stage_negotiation'
  | 'outside_business_hours'
  | 'agent_to_agent';

export interface HandoffTrigger {
  id: string;
  kind: HandoffTriggerKind;
  /**
   * Habilitado/desabilitado no agente. UI mostra todos os 6 gatilhos como
   * toggles — gatilhos desabilitados ficam na lista mas com `enabled: false`.
   */
  enabled: boolean;
  /**
   * Configuração específica do gatilho:
   *  - `keyword` → array de palavras-chave
   *  - `agent_to_agent` → array de palavras + `targetAgentId` (agente de destino)
   *  - `stage_negotiation` → `stageId` da etapa que dispara o handoff (M11#6)
   *  - outros → undefined
   */
  config?: {
    keywords?: string[];
    targetAgentId?: string;
    /** M11#6 — etapa que dispara o gatilho `stage_negotiation`. */
    stageId?: string;
  };
}

/**
 * Métricas mockadas do agente. Em M11 viram VIEW Postgres calculada a partir
 * de `agent_sessions` + `agent_messages`. Manter os 4 campos pra UI não mudar
 * quando o backend chegar.
 */
export interface AgentMetrics {
  /** Total acumulado de conversas atendidas (todas as versões). */
  totalConversations: number;
  /**
   * Taxa de conversas resolvidas sem precisar de handoff humano [0–1].
   * UI formata como percentual.
   */
  resolutionRate: number;
  /** Tempo médio de resposta da IA em segundos. */
  avgResponseTimeSec: number;
  /**
   * Satisfação inferida pelo sentimento da última mensagem [0–1].
   * Em M11 calculado por embedding + classificador. Em M5 mockado.
   */
  inferredSatisfaction: number;
}

/**
 * Snapshot de uma versão antiga do agente. Gerada a cada clique em
 * "Salvar versão" — preserva o trio (prompt + persona + tone) que define
 * o comportamento. Roteamento e handoff **não** entram na versão (mudança
 * deles é instantânea e não-versionada — paridade com como cadências tratam
 * `status` e `metrics`).
 */
export interface AgentVersion {
  id: string;
  agentId: string;
  /** Número sequencial pra exibir como `v3`, `v2`, etc. */
  versionNumber: number;
  prompt: string;
  persona: string;
  tone: AgentTone;
  /**
   * Quem salvou a versão (mock: nome do user logado, sempre o mesmo na demo).
   * Em M11 vira `created_by user_id` real.
   */
  createdBy: string;
  /** Texto livre opcional pra explicar a mudança. */
  notes?: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  /**
   * Workspace dono. Em M5 fixo `'ws_demo'`. Em M11 vira workspace ativo do
   * contexto. Toda query de domínio filtra `workspace_id` mesmo com RLS —
   * defense in depth (CLAUDE.md §7.2).
   */
  workspaceId: string;
  name: string;
  /** Avatar emoji ou inicial — mock simples. Em M11 pode virar upload. */
  avatarEmoji?: string;
  status: AgentStatus;
  /** Template de origem. `undefined` = criado em branco. */
  templateKey?: AgentTemplateKey;
  /** Trio de configuração que define o comportamento (entra em versionamento). */
  prompt: string;
  persona: string;
  tone: AgentTone;
  /** Regras de roteamento — match no primeiro hit (ordem do array). */
  routes: AgentRoute[];
  /** 6 gatilhos de handoff. UI sempre renderiza os 6 (com `enabled` controlando). */
  handoffTriggers: HandoffTrigger[];
  /** Histórico de versões — sempre tem ≥ 1 (a inicial v1). */
  versions: AgentVersion[];
  /** ID da versão atual (a que está em "produção" + sendo testada). */
  currentVersionId: string;
  metrics: AgentMetrics;
  createdAt: string;
  updatedAt: string;
}

/**
 * Definição de um template pré-configurado. Não tem `id`/`workspaceId` — é
 * "esqueleto". Quando o usuário escolhe o template no dialog de criação,
 * o store aplica `applyCreateAgent` que materializa rotas/triggers/versão v1.
 */
export interface AgentTemplate {
  key: AgentTemplateKey;
  /** Nome curto pra exibir no card do TemplatePicker. */
  label: string;
  /** Chave do ícone (mapeada pra Lucide no componente). */
  iconKey: 'sparkles' | 'message-circle' | 'thermometer-snowflake' | 'square-pen';
  /** Frase explicativa de 1 linha. */
  description: string;
  /** Para quem este template foi pensado. */
  recommendedFor: string;
  /** Avatar default. Usuário pode trocar depois. */
  defaultAvatarEmoji: string;
  /** Trio default — copy realista, vira v1 do agente criado. */
  defaultPrompt: string;
  defaultPersona: string;
  defaultTone: AgentTone;
  /**
   * Regras de roteamento sugeridas. Sem `id`/`createdAt` — preenchidos pelo
   * store na materialização.
   */
  defaultRoutes: Array<{ kind: RouteKind; value: string }>;
  /** Gatilhos default — sempre os 6, com `enabled` ajustado por template. */
  defaultHandoffTriggers: Array<Omit<HandoffTrigger, 'id'>>;
  /**
   * Script canned pra o chat de simulação. 3-4 turnos alternando direções
   * (`out` = lead digita; `in` = agente responde). Vendedor digita qualquer
   * coisa → próxima resposta `in` da fila aparece com delay 800ms.
   */
  simulationScript: Array<{
    direction: 'in' | 'out';
    body: string;
  }>;
}

// ─── Cérebro da Empresa (base de conhecimento compartilhada) ───────────────

/**
 * 5 campos estruturados do Cérebro (PRD §3.9):
 *  - `about` → sobre a empresa
 *  - `products` → catálogo de produtos com preços
 *  - `faq` → perguntas frequentes
 *  - `scripts` → scripts de objeção
 *  - `policy` → política comercial / SLA
 *
 * Estrutura plana de strings — sem rich text, sem markdown formal nesta fatia.
 * UI usa `<Textarea>` por seção. Em M11 vira pgvector + RAG; mantém o mesmo
 * shape pra não quebrar.
 */
export interface KnowledgeBase {
  workspaceId: string;
  about: string;
  products: string;
  faq: string;
  scripts: string;
  policy: string;
  files: KnowledgeFile[];
  updatedAt: string;
}

/**
 * Arquivo no Cérebro. Mock total — guardamos só metadata (`name`/`size`/`kind`).
 * **NÃO lemos conteúdo** (`FileReader`/`Blob.text()` ficam fora do mock — risco
 * de quebrar a UI sem ganho proporcional pra demo).
 */
export interface KnowledgeFile {
  id: string;
  name: string;
  /** Bytes — UI formata em kb/mb com `format-utils`. */
  sizeBytes: number;
  /** Kind derivado do MIME type (uplodado) ou da extensão. */
  kind: 'pdf' | 'doc' | 'txt';
  /**
   * Status do processing mockado. Sempre `'processed'` no fim — só fica
   * `'processing'` durante o `setTimeout(1500)` do upload mock.
   */
  status: 'processing' | 'processed';
  uploadedAt: string;
}
