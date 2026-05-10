import { z } from 'zod';

import { AGENT_TEMPLATE_KEYS, AGENT_TEMPLATES } from '@/lib/fixtures/agent-templates';

/**
 * Schemas Zod do welcome wizard (PLAN.md M3 — wizard de 4 passos).
 *
 * Cada passo é um sub-form independente — o estado vai sendo agregado em
 * `WizardState` no controller. Em M7+ esse mesmo shape vira o input das
 * Server Actions correspondentes (criar workspace, registrar conexão
 * WhatsApp, criar agente IA, importar CSV).
 *
 * Mensagens em pt-BR direto e propositivas (CLAUDE.md §5 + §7.6).
 */

export const wizardWorkspaceSchema = z.object({
  workspaceName: z
    .string()
    .min(1, 'Dê um nome ao workspace')
    .min(2, 'Nome muito curto')
    .max(60, 'Nome muito longo (máx. 60 caracteres)'),
});

export type WizardWorkspaceInput = z.infer<typeof wizardWorkspaceSchema>;

export const wizardWhatsappSchema = z.object({
  /**
   * `connected` é setado quando o usuário clica em "Já está conectado" no
   * mock do QR. Em M9 vira o `connection_id` real retornado pelo uazapi.
   */
  connected: z.boolean(),
});

export type WizardWhatsappInput = z.infer<typeof wizardWhatsappSchema>;

/**
 * AGENT_TEMPLATES vive em `lib/fixtures/agent-templates.ts` desde M5#5 — o
 * wizard usa só o subset `{ id, label, description }` que ele precisa pra
 * renderizar os cards de seleção. Re-exportar aqui mantém retrocompat dos
 * imports antigos (`agent-step.tsx` consumia `from '../schemas'`).
 *
 * Mantemos o tipo `AgentTemplateId` derivado de `AGENT_TEMPLATE_KEYS` (const
 * tuple) — single source of truth.
 */
export const WIZARD_AGENT_TEMPLATES = AGENT_TEMPLATES.map((t) => ({
  id: t.key,
  label: t.label,
  description: t.description,
}));

export type AgentTemplateId = (typeof AGENT_TEMPLATE_KEYS)[number];

export const wizardAgentSchema = z.object({
  template: z.enum(AGENT_TEMPLATE_KEYS),
  agentName: z
    .string()
    .min(1, 'Dê um nome ao agente')
    .min(2, 'Nome muito curto')
    .max(40, 'Nome muito longo (máx. 40 caracteres)'),
});

export type WizardAgentInput = z.infer<typeof wizardAgentSchema>;
