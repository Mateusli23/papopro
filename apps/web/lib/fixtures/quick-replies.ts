/**
 * Respostas rápidas (templates) do workspace mockado.
 *
 * PRD §3.8: "botões com mensagens pré-prontas configuráveis por workspace".
 * Em M5#4b o composer renderiza esses chips acima do textarea; clique insere
 * o texto na posição do cursor (e resolve placeholders `{nome}`/`{empresa}`/
 * `{produto}` contra o lead da conversa atual).
 *
 * Em M9 vira leitura real de `quick_replies` filtrada por `workspace_id`.
 * A tela `/settings/connections` (M5#6) terá CRUD pra esses templates.
 */
import type { QuickReply } from '@/features/inbox/types';

const WORKSPACE_ID = 'ws_demo';

export const FAKE_QUICK_REPLIES: QuickReply[] = [
  {
    id: 'qr_001',
    workspaceId: WORKSPACE_ID,
    label: 'Bom dia',
    body: 'Bom dia, {nome}! Tudo bem?',
    order: 0,
  },
  {
    id: 'qr_002',
    workspaceId: WORKSPACE_ID,
    label: 'Vou verificar',
    body: 'Vou verificar e te retorno em alguns minutos.',
    order: 1,
  },
  {
    id: 'qr_003',
    workspaceId: WORKSPACE_ID,
    label: 'Posso ligar?',
    body: 'Posso te ligar agora pra explicar com mais calma?',
    order: 2,
  },
  {
    id: 'qr_004',
    workspaceId: WORKSPACE_ID,
    label: 'Material',
    body: 'Vou te mandar o material por aqui em instantes.',
    order: 3,
  },
  {
    id: 'qr_005',
    workspaceId: WORKSPACE_ID,
    label: 'Combinamos?',
    body: 'Combina amanhã às 14h, {nome}? Se não puder, me diz outro horário.',
    order: 4,
  },
  {
    id: 'qr_006',
    workspaceId: WORKSPACE_ID,
    label: 'Recebi',
    body: 'Recebi sua mensagem, já volto pra você com o retorno.',
    order: 5,
  },
  {
    id: 'qr_007',
    workspaceId: WORKSPACE_ID,
    label: 'Obrigado',
    body: 'Obrigado pelo contato, {nome}! Qualquer coisa estou por aqui.',
    order: 6,
  },
  {
    id: 'qr_008',
    workspaceId: WORKSPACE_ID,
    label: 'Passar pra time',
    body: 'Vou te passar pra alguém do time que entende mais desse ponto. Um momento.',
    order: 7,
  },
];
