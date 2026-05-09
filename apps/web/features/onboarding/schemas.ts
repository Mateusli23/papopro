import { z } from 'zod';

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

export const AGENT_TEMPLATES = [
  {
    id: 'qualification',
    label: 'Qualificação SDR',
    description: 'Faz triagem do lead, coleta interesse e perfil.',
  },
  {
    id: 'attendance',
    label: 'Atendimento',
    description: 'Responde dúvidas frequentes e encaminha pro vendedor humano.',
  },
  {
    id: 'recovery',
    label: 'Recuperação',
    description: 'Reaquece leads parados há mais de 7 dias.',
  },
  {
    id: 'blank',
    label: 'Em branco',
    description: 'Comece do zero com seu próprio prompt.',
  },
] as const;

export type AgentTemplateId = (typeof AGENT_TEMPLATES)[number]['id'];

export const wizardAgentSchema = z.object({
  template: z.enum(['qualification', 'attendance', 'recovery', 'blank']),
  agentName: z
    .string()
    .min(1, 'Dê um nome ao agente')
    .min(2, 'Nome muito curto')
    .max(40, 'Nome muito longo (máx. 40 caracteres)'),
});

export type WizardAgentInput = z.infer<typeof wizardAgentSchema>;
