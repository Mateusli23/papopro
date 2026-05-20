/**
 * Roteador runtime de Agentes IA (M11#5).
 *
 * Função pura que decide **qual agente** (se algum) atende uma mensagem
 * inbound. Roda dentro do webhook uazapi depois que `handleMessageReceived`
 * persistiu o lead + mensagem `in` — o caller (`runtime.ts`) carrega as
 * regras ativas do workspace e passa pra cá.
 *
 * **Por que função pura, não query Prisma:** loading de rules + match são
 * responsabilidades separadas. Aqui só decidimos. Testável em smoke sem DB
 * e sem mocking. `runtime.ts` faz o carregamento + chamada Claude + envio.
 *
 * **Contrato:** primeiro hit ordenado por
 *   `(priority asc, agentCreatedAt asc, ruleCreatedAt asc, agentId asc)`.
 *
 * `priority` é local ao agente em M11#3 (UI ordena rules de UM agente via
 * drag-and-drop). Globalmente ela vira tie-breaker entre agentes — depois
 * cai pra `agentCreatedAt` (agente criado primeiro vence empate) e por
 * último `agentId` (ordem alfabética estável). Sem isso, dois agentes com
 * mesma `priority=0` produziriam resultado não-determinístico.
 *
 * **Matching por kind:**
 *   - `stage`            → `leadStageId === value`
 *   - `tag`              → `leadTags.includes(value)`
 *   - `whatsapp_number`  → `whatsappAccountId === value`
 *   - `keyword`          → `messageBody` contém `value` como palavra inteira
 *                          (case-insensitive). Substring é ruim — "ço" não
 *                          deve matar regra "preço".
 *
 * **Agentes elegíveis** ficam a cargo do caller: só passar `status='active'`
 * + `deletedAt IS NULL`. O router não filtra de novo — confia no input.
 */

import type { AgentRouteKind } from '@papopro/db';

/**
 * Regra de roteamento "achatada" (rule + metadata do agente) pronta pro
 * algoritmo de match. Caller (`runtime.ts`) monta esse shape a partir do
 * `prisma.agentRoutingRule.findMany(...)` com `include: { agent: {...} }`.
 */
export interface RoutingRuleInput {
  ruleId: string;
  agentId: string;
  agentCreatedAt: Date;
  kind: AgentRouteKind;
  value: string;
  priority: number;
  ruleCreatedAt: Date;
}

export interface RouterContext {
  /** ID da etapa atual do lead. Pode ser undefined se o lead não tem stage
   *  resolvida ainda (cenário raro — fallback do webhook M9 sempre seta). */
  leadStageId?: string;
  /** Tags do lead (M8 deal/lead tags). Default `[]` se workspace não usa tags. */
  leadTags?: string[];
  /** Identificador do `WhatsappAccount` que recebeu a mensagem.
   *  Match contra rules `kind='whatsapp_number'` (UI guarda o accountId). */
  whatsappAccountId?: string;
  /** Corpo cru da mensagem inbound. `null`/empty (mídia sem caption) faz
   *  rules `keyword` falharem silenciosamente — só texto pode dar match. */
  messageBody?: string | null;
}

export interface RouterMatch {
  agentId: string;
  ruleId: string;
  ruleKind: AgentRouteKind;
  /** Valor literal da regra que casou — útil pra log/audit ("matched on tag=vip"). */
  value: string;
}

/**
 * Compara duas regras pra ordenação determinística. Exportado pra que o
 * smoke valide a precedência sem reimplementar.
 *
 * Ordem:
 *   1. priority asc          (rule local do agente decide entre rules dele)
 *   2. agentCreatedAt asc    (entre agentes empatados, o mais antigo vence)
 *   3. ruleCreatedAt asc     (entre rules do mesmo agente com mesma priority)
 *   4. agentId asc           (fallback final pra ser 100% estável)
 */
export function compareRulesForRouting(a: RoutingRuleInput, b: RoutingRuleInput): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  const aMs = a.agentCreatedAt.getTime();
  const bMs = b.agentCreatedAt.getTime();
  if (aMs !== bMs) return aMs - bMs;
  const arMs = a.ruleCreatedAt.getTime();
  const brMs = b.ruleCreatedAt.getTime();
  if (arMs !== brMs) return arMs - brMs;
  return a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0;
}

/**
 * Match palavra inteira case-insensitive. Evita o problema clássico de
 * `String.includes`: regra `value="ço"` matando `messageBody="preço"`.
 *
 * **Word boundary próprio**, não regex `\b`:
 *   - regex `\b` em JS é ASCII-only e quebra com acentos pt-BR ("preço" tem
 *     boundary entre "c" e "ç" no `\b`, mas não onde a gente quer)
 *   - aqui considera boundary qualquer caractere não-letra/dígito Unicode
 *
 * Regex `\p{L}\p{N}` exige flag `u`. Empty `value` retorna `false` (nunca
 * deveria chegar — schema Zod garante `min(1)`, defense-in-depth).
 */
export function matchesKeyword(messageBody: string | null | undefined, value: string): boolean {
  if (!messageBody) return false;
  const needle = value.trim().toLowerCase();
  if (!needle) return false;
  const haystack = messageBody.toLowerCase();

  // Constrói regex com word boundary Unicode-aware. `RegExp` precisa de
  // escape em chars especiais do `value` — usuário pode digitar "?" ou ".".
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu');
  return pattern.test(haystack);
}

/**
 * Testa uma única regra contra o contexto. Exportado pra smoke testar cada
 * kind isoladamente.
 */
export function ruleMatchesContext(rule: RoutingRuleInput, ctx: RouterContext): boolean {
  switch (rule.kind) {
    case 'stage':
      return !!ctx.leadStageId && ctx.leadStageId === rule.value;
    case 'tag':
      return !!ctx.leadTags && ctx.leadTags.includes(rule.value);
    case 'whatsapp_number':
      return !!ctx.whatsappAccountId && ctx.whatsappAccountId === rule.value;
    case 'keyword':
      return matchesKeyword(ctx.messageBody, rule.value);
    default: {
      // Exhaustive — TS deve ter pego, mas se enum crescer sem update aqui,
      // melhor retornar `false` que dar match silencioso.
      const _never: never = rule.kind;
      void _never;
      return false;
    }
  }
}

/**
 * Decide qual agente atende. `null` se nenhuma regra bate — caller segue
 * o caminho atual (lead fica pro vendedor humano).
 */
export function pickAgentForInbound(
  rules: RoutingRuleInput[],
  ctx: RouterContext,
): RouterMatch | null {
  if (rules.length === 0) return null;

  // Cópia + sort (não muta input — caller pode reusar a lista).
  const sorted = [...rules].sort(compareRulesForRouting);

  for (const rule of sorted) {
    if (ruleMatchesContext(rule, ctx)) {
      return {
        agentId: rule.agentId,
        ruleId: rule.ruleId,
        ruleKind: rule.kind,
        value: rule.value,
      };
    }
  }

  return null;
}
