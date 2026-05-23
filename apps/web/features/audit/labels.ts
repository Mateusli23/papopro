/**
 * Rótulos pt-BR das ações de auditoria (M13#3).
 *
 * O enum Postgres `audit_action` cresce a cada milestone (M7→M13: 57 valores).
 * Este arquivo é a fonte única de tradução para a UI de `/settings/audit` — o
 * banco guarda a chave técnica (`lead_created`), o viewer mostra o rótulo
 * humano ("Lead criado").
 *
 * Puro (sem `server-only`) — usado pela query server-side E pelo
 * `<AuditFilters>` client. Coberto pelo smoke `/api/smoke-test/lgpd`.
 */

/** Grupos pro `<Select>` de filtro — espelham as áreas do produto. */
export const AUDIT_ACTION_GROUPS: ReadonlyArray<{
  label: string;
  actions: ReadonlyArray<string>;
}> = [
  { label: 'Workspace', actions: ['workspace_created', 'workspace_updated'] },
  {
    label: 'Membros',
    actions: [
      'member_invited',
      'member_joined',
      'member_role_changed',
      'member_removed',
      'invitation_revoked',
    ],
  },
  { label: 'Sessão', actions: ['user_logged_in', 'user_logged_out'] },
  { label: 'Dados e LGPD', actions: ['export_started', 'data_deleted'] },
  { label: 'Leads', actions: ['lead_created', 'lead_updated', 'lead_deleted'] },
  { label: 'Negócios', actions: ['deal_created', 'deal_updated', 'deal_stage_changed'] },
  { label: 'Tarefas', actions: ['task_created', 'task_completed'] },
  {
    label: 'WhatsApp',
    actions: [
      'whatsapp_connected',
      'whatsapp_disconnected',
      'whatsapp_message_sent',
      'whatsapp_blocked_optout',
    ],
  },
  {
    label: 'Inbox',
    actions: [
      'quick_reply_created',
      'quick_reply_deleted',
      'conversation_archived',
      'conversation_transferred',
    ],
  },
  { label: 'Anexos', actions: ['attachment_uploaded', 'attachment_deleted'] },
  { label: 'Webhooks', actions: ['webhook_token_regenerated'] },
  {
    label: 'Cadências',
    actions: [
      'cadence_created',
      'cadence_updated',
      'cadence_deleted',
      'cadence_enrolled',
      'cadence_paused',
      'cadence_reactivated',
      'cadence_completed',
      'cadence_step_sent',
      'cadence_step_failed',
    ],
  },
  {
    label: 'Lead frio',
    actions: ['cold_lead_alerted', 'cold_lead_acknowledged', 'cold_threshold_updated'],
  },
  {
    label: 'Cobrança',
    actions: [
      'checkout_initiated',
      'subscription_activated',
      'subscription_canceled',
      'payment_succeeded',
      'payment_failed',
    ],
  },
  {
    label: 'Agentes IA',
    actions: [
      'agent_created',
      'agent_version_saved',
      'agent_activated',
      'agent_paused',
      'agent_deleted',
      'handoff_triggered',
      'handoff_reverted',
      'knowledge_doc_uploaded',
      'knowledge_doc_processed',
    ],
  },
] as const;

export const AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = {
  workspace_created: 'Workspace criado',
  workspace_updated: 'Workspace atualizado',
  member_invited: 'Membro convidado',
  member_joined: 'Membro entrou',
  member_role_changed: 'Papel de membro alterado',
  member_removed: 'Membro removido',
  invitation_revoked: 'Convite revogado',
  user_logged_in: 'Login',
  user_logged_out: 'Logout',
  export_started: 'Exportação de dados',
  data_deleted: 'Exclusão de dados (LGPD)',
  lead_created: 'Lead criado',
  lead_updated: 'Lead atualizado',
  lead_deleted: 'Lead removido',
  deal_created: 'Negócio criado',
  deal_updated: 'Negócio atualizado',
  deal_stage_changed: 'Negócio mudou de etapa',
  task_created: 'Tarefa criada',
  task_completed: 'Tarefa concluída',
  webhook_token_regenerated: 'Token de webhook regenerado',
  attachment_uploaded: 'Anexo enviado',
  attachment_deleted: 'Anexo removido',
  whatsapp_connected: 'WhatsApp conectado',
  whatsapp_disconnected: 'WhatsApp desconectado',
  whatsapp_message_sent: 'Mensagem WhatsApp enviada',
  whatsapp_blocked_optout: 'Envio bloqueado por opt-out',
  quick_reply_created: 'Resposta rápida criada',
  quick_reply_deleted: 'Resposta rápida removida',
  conversation_archived: 'Conversa arquivada',
  conversation_transferred: 'Conversa transferida',
  cadence_created: 'Cadência criada',
  cadence_updated: 'Cadência atualizada',
  cadence_deleted: 'Cadência removida',
  cadence_enrolled: 'Lead inscrito em cadência',
  cadence_paused: 'Cadência pausada',
  cadence_reactivated: 'Cadência reativada',
  cadence_completed: 'Cadência concluída',
  cadence_step_sent: 'Passo de cadência enviado',
  cadence_step_failed: 'Passo de cadência falhou',
  cold_lead_alerted: 'Alerta de lead frio',
  cold_lead_acknowledged: 'Alerta de lead frio reconhecido',
  cold_threshold_updated: 'Limite de lead frio atualizado',
  checkout_initiated: 'Checkout iniciado',
  subscription_activated: 'Assinatura ativada',
  subscription_canceled: 'Assinatura cancelada',
  payment_succeeded: 'Pagamento confirmado',
  payment_failed: 'Pagamento recusado',
  agent_created: 'Agente IA criado',
  agent_version_saved: 'Versão de agente salva',
  agent_activated: 'Agente IA ativado',
  agent_paused: 'Agente IA pausado',
  agent_deleted: 'Agente IA removido',
  handoff_triggered: 'Handoff disparado',
  handoff_reverted: 'Handoff revertido',
  knowledge_doc_uploaded: 'Documento do Cérebro enviado',
  knowledge_doc_processed: 'Documento do Cérebro processado',
};

/** Todas as chaves de ação conhecidas (achatado dos grupos). */
export const ALL_AUDIT_ACTIONS: ReadonlyArray<string> = AUDIT_ACTION_GROUPS.flatMap(
  (g) => g.actions,
);

/** Rótulo humano de uma ação. Fallback pra própria chave se for desconhecida. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
