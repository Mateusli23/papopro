/**
 * 10 conversas WhatsApp mockadas pra alimentar a Inbox (M5#4a).
 *
 * Distribuição planejada:
 *  - 4 `awaiting` (vendor mandou, lead silent) cobrindo 1d/3d/7d/14d pra
 *    testar o filtro "sem resposta há X dias" (M5#4c).
 *  - 4 `responded` (lead respondeu, vendor precisa agir).
 *  - 2 `archived` (deals ganhos, fora da view default).
 *  - 4 vendedores diferentes; 4 etapas diferentes do funil.
 *
 * Conversa `conv_001` (Mariana) é o **rich path** — mostra todos os tipos
 * de mídia, internal note, todos os 3 estados de read receipt e dispara
 * o `TypingIndicator` simulado em `MessageThread`.
 *
 * Em M9 essas fixtures saem; uazapi adapter alimenta `conversations` /
 * `messages` reais via webhook. A shape **é o contrato** — manter idêntica.
 *
 * Implementação: o seed inclui o `thread` completo de cada conversa; o
 * builder produz tanto `FAKE_CONVERSATIONS` quanto `FAKE_MESSAGES` a
 * partir do mesmo seed, garantindo que `lastMessageAt`/`lastMessagePreview`/
 * `status` sempre batam com a última mensagem real. Se eu mudar uma
 * mensagem aqui, os agregados auto-atualizam.
 */
import { addSeconds, parseISO, subDays, subHours, subMinutes } from 'date-fns';

import { formatMessagePreview } from '@/features/inbox/transforms';
import type {
  Conversation,
  ConversationStatus,
  Message,
  MessageDirection,
  MessageKind,
  WhatsAppConnection,
} from '@/features/inbox/types';

// `NOW` é congelado pra que datas relativas fiquem estáveis entre renders
// (mesmo padrão de `leads.ts` e `activities.ts`).
const NOW = new Date('2026-05-09T14:00:00-03:00');

const WORKSPACE_ID = 'ws_demo';
const WHATSAPP_NUMBER = '+55 11 9 8888-7777';

// ─── Tipos do seed (privados) ─────────────────────────────────────────────

/**
 * Estado de entrega da mensagem outbound:
 *  - `sent`: cliente WhatsApp recebeu o comando (1 check)
 *  - `delivered`: chegou no celular do lead (2 checks cinza)
 *  - `read`: lead leu (2 checks azul)
 *
 * Inbound nunca tem esse campo — não faz sentido (a mensagem CHEGOU pra nós).
 */
type ReadState = 'sent' | 'delivered' | 'read';

interface MessageSeed {
  /** Quando: forneça **um** dos 3 (preferência: o mais natural pra escala). */
  minutesAgo?: number;
  hoursAgo?: number;
  daysAgo?: number;
  kind: MessageKind;
  direction: MessageDirection;
  body?: string;
  /** Necessário pra outbound; ignorado em inbound. */
  authorId?: string;
  /** Estado de entrega outbound. Default `'read'` se a mensagem é antiga (>=2h ago). */
  state?: ReadState;
  mediaName?: string;
  mediaSizeKb?: number;
  mediaDurationSeconds?: number;
}

interface ConversationSeed {
  id: string;
  leadId: string;
  vendorId: string;
  contactPhone: string;
  /** Se setado, conversa é arquivada (status='archived', archivedAt = NOW - dias). */
  archivedDaysAgo?: number;
  /**
   * Quantas mensagens inbound ficam **sem** `readAt` (= não lidas pelo time).
   * Tomadas a partir da última inbound em ordem reversa. Ex: `unreadCount: 1`
   * deixa só a última inbound não-lida; `unreadCount: 0` marca tudo como lido.
   */
  unreadCount: number;
  thread: MessageSeed[];
}

// ─── Seeds ────────────────────────────────────────────────────────────────

const SEEDS: ConversationSeed[] = [
  // ─── conv_001 — Rich path: text + image + audio + note + document ─────
  // Mariana Costa / lead_001 / Novo / user_mateus
  // Status final: awaiting (vendor mandou última msg, aguarda resposta).
  // Lead "está digitando" simulado pelo TypingIndicator nesse ID.
  {
    id: 'conv_001',
    leadId: 'lead_001',
    vendorId: 'user_mateus',
    contactPhone: '+55 11 9 8765-4321',
    unreadCount: 0,
    thread: [
      {
        hoursAgo: 3,
        kind: 'text',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Oi Mariana! Vi seu interesse no nosso material de lançamentos. Posso te ligar amanhã pra entender melhor?',
        state: 'read',
      },
      {
        hoursAgo: 2.5,
        kind: 'text',
        direction: 'in',
        body: 'Pode sim, melhor depois das 14h.',
      },
      {
        hoursAgo: 2,
        kind: 'text',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Combinado. Quer que eu mande um resumo do PapoPro pra você dar uma olhada antes?',
        state: 'read',
      },
      {
        hoursAgo: 1.75,
        kind: 'text',
        direction: 'in',
        body: 'Manda sim! Estamos com 7 corretores e perdendo lead direto no WhatsApp.',
      },
      {
        hoursAgo: 1.5,
        kind: 'image',
        direction: 'out',
        authorId: 'user_mateus',
        mediaName: 'painel-vertice-resumo.jpg',
        mediaSizeKb: 384,
        state: 'read',
      },
      {
        hoursAgo: 1.42,
        kind: 'text',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Esse é o painel principal. Veja como o time enxerga cada lead em tempo real.',
        state: 'read',
      },
      {
        hoursAgo: 1,
        kind: 'audio',
        direction: 'out',
        authorId: 'user_mateus',
        mediaDurationSeconds: 47,
        state: 'delivered',
      },
      {
        minutesAgo: 50,
        kind: 'internal_note',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Lead premium — diretora de compras de construtora grande. Falar de plano Pro IA na próxima rodada.',
      },
      {
        minutesAgo: 40,
        kind: 'document',
        direction: 'out',
        authorId: 'user_mateus',
        mediaName: 'PapoPro_apresentacao_construtoras.pdf',
        mediaSizeKb: 2840,
        state: 'delivered',
      },
      {
        minutesAgo: 30,
        kind: 'text',
        direction: 'in',
        body: 'Recebi! Vou olhar com calma e te falo amanhã.',
      },
      {
        minutesAgo: 20,
        kind: 'text',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Beleza, Mariana. Qualquer dúvida me chama por aqui.',
        state: 'sent',
      },
    ],
  },

  // ─── conv_002 — Awaiting 1 dia (lead inbound original, vendor sem resposta) ─
  // Larissa Mendes / lead_005 / Novo / user_mateus
  {
    id: 'conv_002',
    leadId: 'lead_005',
    vendorId: 'user_mateus',
    contactPhone: '+55 11 9 9988-1122',
    unreadCount: 0,
    thread: [
      {
        daysAgo: 1.2,
        kind: 'text',
        direction: 'in',
        body: 'Oi! Vi vocês no Instagram. Vendo distribuidora aqui em SP, queria saber mais.',
      },
      {
        daysAgo: 1.1,
        kind: 'text',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Olá Larissa! Que bom que entrou em contato. Trabalhamos com times de vendas em distribuição. Posso te ligar amanhã às 10h pra entender melhor?',
        state: 'read',
      },
      {
        daysAgo: 1,
        kind: 'text',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Se não puder esse horário, me diz outro que combina pra você.',
        state: 'read',
      },
    ],
  },

  // ─── conv_003 — Responded: lead acabou de pedir reunião ────────────────
  // Roberto Esteves / lead_016 / Em contato / user_mateus
  {
    id: 'conv_003',
    leadId: 'lead_016',
    vendorId: 'user_mateus',
    contactPhone: '+55 11 9 9722-1144',
    unreadCount: 1,
    thread: [
      {
        daysAgo: 5,
        kind: 'text',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Bom dia Roberto. Aqui é o Mateus do PapoPro. Vi que você baixou o material pra construtoras.',
        state: 'read',
      },
      {
        daysAgo: 4.5,
        kind: 'text',
        direction: 'in',
        body: 'Bom dia, sim! Queria entender como funcionaria pra um time de obras.',
      },
      {
        daysAgo: 4.4,
        kind: 'text',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Posso te ligar amanhã pra explicar com calma?',
        state: 'read',
      },
      {
        daysAgo: 4,
        kind: 'text',
        direction: 'in',
        body: 'Pode sim, depois das 14h.',
      },
      {
        daysAgo: 3,
        kind: 'audio',
        direction: 'out',
        authorId: 'user_mateus',
        mediaDurationSeconds: 72,
        state: 'read',
      },
      {
        daysAgo: 2,
        kind: 'internal_note',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Decisor é ele. 8 vendedores em campo, orçamento aprovado pra Q2. Fechar até final do mês.',
      },
      {
        hoursAgo: 2,
        kind: 'text',
        direction: 'in',
        body: 'Tudo bem, Mateus? Cheguei a ver a proposta. Quero marcar uma reunião com a sócia pra fechar.',
      },
    ],
  },

  // ─── conv_004 — Awaiting 3 dias ────────────────────────────────────────
  // Felipe Santana / lead_018 / Em contato / user_renato
  {
    id: 'conv_004',
    leadId: 'lead_018',
    vendorId: 'user_renato',
    contactPhone: '+55 11 9 9544-8822',
    unreadCount: 0,
    thread: [
      {
        daysAgo: 5,
        kind: 'text',
        direction: 'out',
        authorId: 'user_renato',
        body: 'Olá Felipe! Vi que você baixou nosso material de SaaS B2B. Posso te apresentar o produto numa call rápida?',
        state: 'read',
      },
      {
        daysAgo: 5,
        kind: 'text',
        direction: 'in',
        body: 'Pode sim, manda os detalhes que peço pra agendar.',
      },
      {
        daysAgo: 3,
        kind: 'text',
        direction: 'out',
        authorId: 'user_renato',
        body: 'Felipe, segue o material e os cases que conversamos. Aguardo seu retorno.',
        state: 'read',
      },
    ],
  },

  // ─── conv_005 — Awaiting 7 dias (com tentativas de follow-up) ──────────
  // Vanessa Lopes / lead_021 / Em contato / user_mateus
  {
    id: 'conv_005',
    leadId: 'lead_021',
    vendorId: 'user_mateus',
    contactPhone: '+55 21 9 9211-3322',
    unreadCount: 0,
    thread: [
      {
        daysAgo: 12,
        kind: 'text',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Oi Vanessa! Conversamos rapidamente na semana passada sobre a Lopes. Faz sentido marcar uma demo?',
        state: 'read',
      },
      {
        daysAgo: 10,
        kind: 'text',
        direction: 'in',
        body: 'Faz, mas estou super atolada. Me chama dia 15?',
      },
      {
        daysAgo: 9,
        kind: 'text',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Combinado, dia 15 às 10h. Te mando link de calendário hoje.',
        state: 'read',
      },
      {
        daysAgo: 7,
        kind: 'text',
        direction: 'out',
        authorId: 'user_mateus',
        body: 'Vanessa, mandei o convite pelo email — confirma pra mim?',
        state: 'delivered',
      },
    ],
  },

  // ─── conv_006 — Responded: proposta + pedido de desconto ───────────────
  // Carolina Maranhão / lead_029 / Proposta / user_carla
  {
    id: 'conv_006',
    leadId: 'lead_029',
    vendorId: 'user_carla',
    contactPhone: '+55 11 9 9744-3300',
    unreadCount: 1,
    thread: [
      {
        daysAgo: 10,
        kind: 'text',
        direction: 'out',
        authorId: 'user_carla',
        body: 'Oi Carol! Conversamos rapidamente ontem. Posso te enviar a proposta?',
        state: 'read',
      },
      {
        daysAgo: 10,
        kind: 'text',
        direction: 'in',
        body: 'Pode sim, manda assim que tiver.',
      },
      {
        daysAgo: 9,
        kind: 'document',
        direction: 'out',
        authorId: 'user_carla',
        mediaName: 'Proposta_Maranhao_v1.pdf',
        mediaSizeKb: 1240,
        state: 'read',
      },
      {
        daysAgo: 9,
        kind: 'text',
        direction: 'out',
        authorId: 'user_carla',
        body: 'Carol, tá aí a proposta. Qualquer dúvida me chama!',
        state: 'read',
      },
      {
        daysAgo: 8,
        kind: 'text',
        direction: 'in',
        body: 'Olha, gostei muito do escopo. Mas o investimento ficou um pouco acima do esperado.',
      },
      {
        daysAgo: 8,
        kind: 'text',
        direction: 'out',
        authorId: 'user_carla',
        body: 'Entendi, Carol. Fala um pouco mais sobre o que você esperava — vamos ver onde dá pra ajustar.',
        state: 'read',
      },
      {
        daysAgo: 7,
        kind: 'internal_note',
        direction: 'out',
        authorId: 'user_carla',
        body: 'Cliente mencionou orçamento de 150k mas proposta v1 está 185k. Ver com gerente desconto progressivo de 10%.',
      },
      {
        daysAgo: 7,
        kind: 'image',
        direction: 'out',
        authorId: 'user_carla',
        mediaName: 'comparativo-pacotes.png',
        mediaSizeKb: 240,
        state: 'read',
      },
      {
        daysAgo: 7,
        kind: 'text',
        direction: 'out',
        authorId: 'user_carla',
        body: 'Mandei um comparativo de 3 pacotes pra clarear as opções. Olha com calma e me chama depois.',
        state: 'read',
      },
      {
        hoursAgo: 6,
        kind: 'text',
        direction: 'in',
        body: 'Carol, gostei do pacote intermediário. Posso fechar com ele se conseguir 10% de desconto. Combina?',
      },
    ],
  },

  // ─── conv_007 — Responded: lead aprovou contrato (close iminente) ──────
  // Letícia Bertoni / lead_037 / Negociação / user_juliana
  {
    id: 'conv_007',
    leadId: 'lead_037',
    vendorId: 'user_juliana',
    contactPhone: '+55 11 9 9722-3300',
    unreadCount: 1,
    thread: [
      {
        daysAgo: 15,
        kind: 'text',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Letícia, segue a proposta pro Bertoni Solar conforme combinado.',
        state: 'read',
      },
      {
        daysAgo: 15,
        kind: 'document',
        direction: 'out',
        authorId: 'user_juliana',
        mediaName: 'Proposta_Bertoni_v2.pdf',
        mediaSizeKb: 1024,
        state: 'read',
      },
      {
        daysAgo: 14,
        kind: 'text',
        direction: 'in',
        body: 'Recebi! Vou levar pra reunião do board na quarta.',
      },
      {
        daysAgo: 10,
        kind: 'text',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Letícia, quando rola o board?',
        state: 'read',
      },
      {
        daysAgo: 10,
        kind: 'text',
        direction: 'in',
        body: 'Foi adiado — agora é segunda-feira.',
      },
      {
        daysAgo: 8,
        kind: 'text',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Boa sorte! Estou na torcida 🙌',
        state: 'read',
      },
      {
        daysAgo: 7,
        kind: 'text',
        direction: 'in',
        body: 'Aprovaram com algumas ressalvas. Posso te ligar pra explicar?',
      },
      {
        daysAgo: 7,
        kind: 'text',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Ligo agora!',
        state: 'read',
      },
      {
        daysAgo: 5,
        kind: 'internal_note',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Board pediu prazo de 90 dias pro contrato + cláusula de SLA. Negociar com o jurídico antes de mandar.',
      },
      {
        daysAgo: 1,
        kind: 'image',
        direction: 'out',
        authorId: 'user_juliana',
        mediaName: 'contrato-rascunho-pag1.jpg',
        mediaSizeKb: 420,
        state: 'read',
      },
      {
        daysAgo: 1,
        kind: 'text',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Letícia, segue o rascunho do contrato com as ressalvas. Olha aí com seu jurídico e me retorna.',
        state: 'read',
      },
      {
        // Áudio inbound de 30s: WhatsApp não tem caption pra áudios; deixar
        // só o waveform/duração. Em M11 o transcript do agente IA aparece
        // numa nota interna anexada, não no body da mensagem.
        hoursAgo: 12,
        kind: 'audio',
        direction: 'in',
        mediaDurationSeconds: 30,
      },
    ],
  },

  // ─── conv_008 — Awaiting 14 dias (lead esfriou completamente) ──────────
  // Sara Iwata / lead_023 / Em contato / user_renato
  {
    id: 'conv_008',
    leadId: 'lead_023',
    vendorId: 'user_renato',
    contactPhone: '+55 11 9 8966-1144',
    unreadCount: 0,
    thread: [
      {
        daysAgo: 20,
        kind: 'text',
        direction: 'out',
        authorId: 'user_renato',
        body: 'Oi Sara! Vi sua indicação pelo Bruno. Posso te apresentar o PapoPro?',
        state: 'read',
      },
      {
        daysAgo: 19,
        kind: 'text',
        direction: 'in',
        body: 'Pode! Manda quando puder, semana que vem fica bom.',
      },
      {
        daysAgo: 18,
        kind: 'text',
        direction: 'out',
        authorId: 'user_renato',
        body: 'Sara, segue o link do nosso material e um vídeo de 3min. Qualquer coisa me chama.',
        state: 'read',
      },
      {
        daysAgo: 14,
        kind: 'text',
        direction: 'out',
        authorId: 'user_renato',
        body: 'Sara, deu pra dar uma olhada? Tô à disposição pra responder.',
        state: 'delivered',
      },
    ],
  },

  // ─── conv_009 — Archived: deal ganho com histórico longo ──────────────
  // Gustavo Beltrame / lead_042 / Ganho / user_juliana
  {
    id: 'conv_009',
    leadId: 'lead_042',
    vendorId: 'user_juliana',
    contactPhone: '+55 11 9 9211-7700',
    archivedDaysAgo: 1,
    unreadCount: 0,
    thread: [
      {
        daysAgo: 45,
        kind: 'text',
        direction: 'in',
        body: 'Oi! Daniel me passou seu contato. Trabalho com auto centers, queria entender o produto.',
      },
      {
        daysAgo: 44,
        kind: 'text',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Oi Gustavo! Que bom que o Daniel passou. Posso te ligar agora?',
        state: 'read',
      },
      {
        daysAgo: 44,
        kind: 'text',
        direction: 'in',
        body: 'Pode!',
      },
      {
        daysAgo: 43,
        kind: 'text',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Falamos agora — ótima conversa. Mando o material e a próxima reunião pra demo.',
        state: 'read',
      },
      {
        daysAgo: 40,
        kind: 'text',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Gustavo, segue o link da reunião pra quinta às 15h.',
        state: 'read',
      },
      {
        daysAgo: 40,
        kind: 'text',
        direction: 'in',
        body: 'Perfeito! Confirmado.',
      },
      {
        daysAgo: 37,
        kind: 'text',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Excelente reunião hoje. Mando proposta amanhã.',
        state: 'read',
      },
      {
        daysAgo: 36,
        kind: 'document',
        direction: 'out',
        authorId: 'user_juliana',
        mediaName: 'Proposta_Beltrame.pdf',
        mediaSizeKb: 980,
        state: 'read',
      },
      {
        daysAgo: 35,
        kind: 'text',
        direction: 'in',
        body: 'Recebi e vou avaliar com a equipe.',
      },
      {
        daysAgo: 30,
        kind: 'text',
        direction: 'in',
        body: 'Tudo certo aqui, vamos fechar! Manda o contrato.',
      },
      {
        daysAgo: 29,
        kind: 'document',
        direction: 'out',
        authorId: 'user_juliana',
        mediaName: 'Contrato_Beltrame.pdf',
        mediaSizeKb: 320,
        state: 'read',
      },
      {
        daysAgo: 28,
        kind: 'text',
        direction: 'in',
        body: 'Assinado e devolvido por aqui.',
      },
      {
        daysAgo: 28,
        kind: 'text',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Receeebido! Bem-vindo ao PapoPro 🎉🎉🎉',
        state: 'read',
      },
      {
        daysAgo: 28,
        kind: 'audio',
        direction: 'out',
        authorId: 'user_juliana',
        mediaDurationSeconds: 18,
        state: 'read',
      },
      {
        daysAgo: 27,
        kind: 'text',
        direction: 'in',
        body: 'Obrigado! Até semana que vem na call de onboarding.',
      },
      {
        daysAgo: 10,
        kind: 'text',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Gustavo, como está sendo a experiência? Qualquer feedback é bem-vindo!',
        state: 'read',
      },
      {
        daysAgo: 10,
        kind: 'text',
        direction: 'in',
        body: 'Tudo ótimo, Juliana! O time está adorando.',
      },
      {
        daysAgo: 8,
        kind: 'text',
        direction: 'out',
        authorId: 'user_juliana',
        body: 'Que ótimo! Caso queira referendar a gente em algum momento, me avisa 👍',
        state: 'read',
      },
    ],
  },

  // ─── conv_010 — Archived: deal ganho mais curto ───────────────────────
  // Isabella Wagner / lead_043 / Ganho / user_renato
  {
    id: 'conv_010',
    leadId: 'lead_043',
    vendorId: 'user_renato',
    contactPhone: '+55 11 9 9100-3344',
    archivedDaysAgo: 3,
    unreadCount: 0,
    thread: [
      {
        daysAgo: 60,
        kind: 'text',
        direction: 'in',
        body: 'Olá! Vi vocês na pesquisa do Google e quero saber mais.',
      },
      {
        daysAgo: 59,
        kind: 'text',
        direction: 'out',
        authorId: 'user_renato',
        body: 'Oi Isabella! Trabalhamos com clínicas odontológicas. Posso te apresentar o produto?',
        state: 'read',
      },
      {
        daysAgo: 59,
        kind: 'text',
        direction: 'in',
        body: 'Pode sim, manda!',
      },
      {
        daysAgo: 58,
        kind: 'document',
        direction: 'out',
        authorId: 'user_renato',
        mediaName: 'Material_Odontologia.pdf',
        mediaSizeKb: 600,
        state: 'read',
      },
      {
        daysAgo: 55,
        kind: 'text',
        direction: 'in',
        body: 'Adorei. Quero fazer uma demo.',
      },
      {
        daysAgo: 54,
        kind: 'text',
        direction: 'out',
        authorId: 'user_renato',
        body: 'Vamos marcar! Que dia fica bom?',
        state: 'read',
      },
      {
        daysAgo: 53,
        kind: 'text',
        direction: 'in',
        body: 'Sexta de manhã.',
      },
      {
        daysAgo: 50,
        kind: 'text',
        direction: 'out',
        authorId: 'user_renato',
        body: 'Após a demo: tô animado pra começar com vocês. Mando proposta agora.',
        state: 'read',
      },
      {
        daysAgo: 50,
        kind: 'document',
        direction: 'out',
        authorId: 'user_renato',
        mediaName: 'Proposta_Wagner.pdf',
        mediaSizeKb: 480,
        state: 'read',
      },
      {
        daysAgo: 45,
        kind: 'text',
        direction: 'in',
        body: 'Aprovado pelo time! Como segue?',
      },
      {
        daysAgo: 44,
        kind: 'text',
        direction: 'out',
        authorId: 'user_renato',
        body: 'Mando o contrato hoje à noite. Vai pra assinatura digital.',
        state: 'read',
      },
      {
        daysAgo: 43,
        kind: 'text',
        direction: 'in',
        body: 'Tudo certo, assinei. Aguardo onboarding 🚀',
      },
    ],
  },
];

// ─── Builder ──────────────────────────────────────────────────────────────

let MSG_COUNTER = 0;
function nextMessageId(): string {
  MSG_COUNTER += 1;
  return `msg_${MSG_COUNTER.toString().padStart(5, '0')}`;
}

function seedDate(seed: MessageSeed): Date {
  // Precedência: minutesAgo > hoursAgo > daysAgo. **Importante**: o
  // `subDays` do date-fns 4.x trunca valores fracionários (`subDays(d, 1.5)`
  // == `subDays(d, 1)`), o que colapsava timestamps como `1.1` e `1.2`
  // para o mesmo instante e quebrava o sort de seeds. Convertemos
  // `daysAgo` fracionário para horas pra preservar precisão sub-diária.
  // `subHours` aceita fracionários sem perda (chama `addMilliseconds`
  // internamente).
  if (seed.minutesAgo !== undefined) return subMinutes(NOW, seed.minutesAgo);
  if (seed.hoursAgo !== undefined) return subHours(NOW, seed.hoursAgo);
  if (seed.daysAgo !== undefined) return subHours(NOW, seed.daysAgo * 24);
  return NOW;
}

/**
 * Resolve datas de delivered/read para uma mensagem outbound a partir do
 * seu `state`. Sem state = considera 'read' (default seguro pra histórico).
 *
 * Heurística temporal: delivered = createdAt + 5s; read = createdAt + 30s.
 * É só pra ter timestamps plausíveis pro tooltip — não tem semântica real.
 */
function resolveDeliveryDates(
  createdAt: Date,
  state: ReadState | undefined,
): { deliveredAt?: string; readAt?: string } {
  const effective = state ?? 'read';
  if (effective === 'sent') return {};
  const deliveredAt = addSeconds(createdAt, 5).toISOString();
  if (effective === 'delivered') return { deliveredAt };
  return {
    deliveredAt,
    readAt: addSeconds(createdAt, 30).toISOString(),
  };
}

interface BuiltConversation {
  conversation: Conversation;
  messages: Message[];
}

function buildConversation(seed: ConversationSeed): BuiltConversation {
  // 1. Build messages com IDs e timestamps absolutos
  const messages: Message[] = seed.thread.map((m) => {
    const createdAt = seedDate(m);
    const id = nextMessageId();
    if (m.direction === 'in') {
      // Inbound: read recente é decidido depois (campo `unreadCount`).
      return {
        id,
        conversationId: seed.id,
        kind: m.kind,
        direction: 'in',
        body: m.body,
        createdAt: createdAt.toISOString(),
        mediaName: m.mediaName,
        mediaSizeKb: m.mediaSizeKb,
        mediaDurationSeconds: m.mediaDurationSeconds,
      };
    }
    // Outbound: resolver delivery
    const dates = resolveDeliveryDates(createdAt, m.state);
    return {
      id,
      conversationId: seed.id,
      kind: m.kind,
      direction: 'out',
      body: m.body,
      authorId: m.authorId,
      createdAt: createdAt.toISOString(),
      ...dates,
      mediaName: m.mediaName,
      mediaSizeKb: m.mediaSizeKb,
      mediaDurationSeconds: m.mediaDurationSeconds,
    };
  });

  // Sanidade: thread deve estar em ordem cronológica crescente.
  messages.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  // 2. Aplicar `unreadCount` nas últimas N inbound (sem readAt) — pré-existente
  // sempre tem readAt (vendor leu). Só as últimas `unreadCount` mensagens inbound
  // ficam não-lidas.
  const inboundIds = messages.filter((m) => m.direction === 'in').map((m) => m.id);
  const unreadStart = Math.max(0, inboundIds.length - seed.unreadCount);
  const unreadIds = new Set(inboundIds.slice(unreadStart));

  const messagesWithReadAt = messages.map((m) => {
    if (m.direction !== 'in') return m;
    if (unreadIds.has(m.id)) return m; // mantém sem readAt
    // Lido: marcou ~5s depois (vendor abriu rápido)
    return { ...m, readAt: addSeconds(parseISO(m.createdAt), 5).toISOString() };
  });

  // 3. Calcular agregados da conversa. Toda seed tem >=1 mensagem; o `??`
  // existe só pra satisfazer o `noUncheckedIndexedAccess` do tsconfig strict.
  const last = messagesWithReadAt[messagesWithReadAt.length - 1];
  if (!last) {
    throw new Error(`conversation ${seed.id}: thread vazio — seed inválido`);
  }
  const lastNonNote = [...messagesWithReadAt].reverse().find((m) => m.kind !== 'internal_note');

  let status: ConversationStatus;
  if (seed.archivedDaysAgo !== undefined) {
    status = 'archived';
  } else if (lastNonNote && lastNonNote.direction === 'in') {
    status = 'responded';
  } else {
    status = 'awaiting';
  }

  const archivedAt =
    seed.archivedDaysAgo !== undefined
      ? subDays(NOW, seed.archivedDaysAgo).toISOString()
      : undefined;

  // `createdAt` da conversa = primeira mensagem (proxy da abertura do canal)
  const createdAt = messagesWithReadAt[0]?.createdAt ?? NOW.toISOString();

  const conversation: Conversation = {
    id: seed.id,
    workspaceId: WORKSPACE_ID,
    leadId: seed.leadId,
    vendorId: seed.vendorId,
    whatsappNumber: WHATSAPP_NUMBER,
    contactPhone: seed.contactPhone,
    status,
    lastMessageAt: last.createdAt,
    lastMessagePreview: formatMessagePreview(last),
    lastMessageDirection: last.direction,
    unreadCount: seed.unreadCount,
    // Mock: toda conversa começa com IA habilitada (M11#6). Handoff é runtime.
    aiEnabled: true,
    archivedAt,
    createdAt,
  };

  return { conversation, messages: messagesWithReadAt };
}

// ─── Build + exports ──────────────────────────────────────────────────────

const _BUILT = SEEDS.map(buildConversation);

export const FAKE_CONVERSATIONS: Conversation[] = _BUILT.map((b) => b.conversation);
export const FAKE_MESSAGES: Message[] = _BUILT.flatMap((b) => b.messages);

/**
 * Conexão WhatsApp mockada do workspace. Status `connected` por default —
 * em M9 vem do heartbeat real (Edge Function `whatsapp-heartbeat`).
 */
export const FAKE_WHATSAPP_CONNECTION: WhatsAppConnection = {
  id: 'wa_default',
  workspaceId: WORKSPACE_ID,
  number: WHATSAPP_NUMBER,
  health: 'connected',
  lastSeenAt: subMinutes(NOW, 1).toISOString(),
};

export function getConversation(id: string): Conversation | undefined {
  return FAKE_CONVERSATIONS.find((c) => c.id === id);
}

export function getConversationByLead(leadId: string): Conversation | undefined {
  return FAKE_CONVERSATIONS.find((c) => c.leadId === leadId);
}
