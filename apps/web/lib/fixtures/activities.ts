/**
 * Timelines mockadas para a página de detalhe do lead.
 *
 * Para a maioria dos leads geramos uma sequência sintética coerente com
 * a etapa atual; alguns leads "rico em conteúdo" recebem uma timeline
 * artesanal mais densa pra mostrar variedade de tipos (notas, reuniões,
 * mudanças de etapa, anexos).
 *
 * Em M8 a timeline vira agregação real de `activities` + `messages` +
 * `tasks` + `stage_change_log`. Aqui usamos uma única tabela pra simplificar.
 */
import { addHours, parseISO, subDays, subHours } from 'date-fns';

import type { Activity, ActivityType, Lead } from '@/features/leads/types';

import { FAKE_LEADS } from './leads';

let ID = 0;
function nextId(): string {
  ID += 1;
  return `act_${ID.toString().padStart(5, '0')}`;
}

interface BuilderArgs {
  leadId: string;
  authorId: string;
  baseDate: Date;
  type: ActivityType;
  body?: string;
  hoursOffset?: number;
  meta?: Activity['meta'];
}

function build({
  leadId,
  authorId,
  baseDate,
  type,
  body,
  hoursOffset = 0,
  meta,
}: BuilderArgs): Activity {
  return {
    id: nextId(),
    leadId,
    type,
    body,
    authorId,
    createdAt: addHours(baseDate, hoursOffset).toISOString(),
    meta,
  };
}

/** Timeline padrão (todo lead recebe): criação + última mensagem WhatsApp. */
function defaultTimeline(lead: Lead): Activity[] {
  const created = parseISO(lead.createdAt);
  const acts: Activity[] = [
    build({
      leadId: lead.id,
      authorId: 'system',
      baseDate: created,
      type: 'lead_created',
      body: `Lead criado via ${lead.origin.replace(/_/g, ' ')}.`,
    }),
  ];

  if (lead.lastInteractionAt) {
    acts.push(
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: parseISO(lead.lastInteractionAt),
        type: 'whatsapp_out',
        body: `Olá ${lead.name.split(' ')[0]}, tudo bem? Vi seu interesse e gostaria de entender melhor a sua necessidade.`,
      }),
    );
  }

  return acts;
}

/** Timelines artesanais para alguns leads "ricos" — exibem o range completo de tipos. */
const HANDCRAFTED: Record<string, (lead: Lead) => Activity[]> = {
  // Mariana Costa — Novo, recém criada com ação rápida
  lead_001: (lead) => {
    const created = parseISO(lead.createdAt);
    return [
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        type: 'lead_created',
        body: 'Lead criado via Meta Ads (campanha "Lançamento Vértice").',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 2,
        type: 'note',
        body: 'Lead premium — diretora de compras de construtora grande. Ticket alto provável.',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 4,
        type: 'whatsapp_out',
        body: 'Oi Mariana! Vi seu interesse no nosso material de lançamentos. Posso te ligar amanhã pra entender melhor?',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 16,
        type: 'whatsapp_in',
        body: 'Pode sim, melhor depois das 14h.',
      }),
    ];
  },

  // Roberto Esteves — Em contato, reunião marcada
  lead_016: (lead) => {
    const created = parseISO(lead.createdAt);
    return [
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        type: 'lead_created',
        body: 'Lead criado via Meta Ads.',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 4,
        type: 'whatsapp_out',
        body: 'Bom dia Roberto, sou o Mateus do PapoPro. Vi que você baixou o material de construtoras.',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 28,
        type: 'whatsapp_in',
        body: 'Bom dia, sim, queria entender como funcionaria pra times de obras.',
      }),
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        hoursOffset: 30,
        type: 'stage_change',
        body: 'Etapa: Novo → Em contato',
        meta: { fromStageId: 'novo', toStageId: 'em_contato' },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 48,
        type: 'call',
        body: 'Ligação de descoberta — 22 minutos. Tem 8 vendedores em campo, perde leads no WhatsApp.',
        meta: { durationSeconds: 1320 },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 50,
        type: 'note',
        body: 'Decisor: ele mesmo. Orçamento aprovado pra Q2. Time atual usa só planilha.',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 96,
        type: 'meeting',
        body: 'Demo do produto — sala virtual',
        meta: { location: 'meet.google.com/abc-defg-hij' },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 110,
        type: 'attachment',
        body: 'Apresentação enviada',
        meta: { fileName: 'PapoPro_demo_construtoras.pdf', fileSizeKb: 2840 },
      }),
      ...(lead.lastInteractionAt
        ? [
            build({
              leadId: lead.id,
              authorId: lead.assignedTo,
              baseDate: parseISO(lead.lastInteractionAt),
              type: 'whatsapp_out',
              body: 'Roberto, segue o resumo da reunião e próximos passos.',
            }),
          ]
        : []),
    ];
  },

  // Carolina Maranhão — Proposta enviada
  lead_029: (lead) => {
    const created = parseISO(lead.createdAt);
    return [
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        type: 'lead_created',
        body: 'Indicação do escritório DRA Arquitetura.',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 6,
        type: 'call',
        body: 'Primeira call — 35min. Quer estruturar comercial pra time de 6 arquitetos.',
        meta: { durationSeconds: 2100 },
      }),
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        hoursOffset: 24,
        type: 'stage_change',
        body: 'Etapa: Novo → Em contato',
        meta: { fromStageId: 'novo', toStageId: 'em_contato' },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 48,
        type: 'meeting',
        body: 'Reunião com sócia — apresentação ao vivo',
        meta: { location: 'Av. Paulista 1500, SP' },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 96,
        type: 'note',
        body: 'Sócia gostou da abordagem de IA. Pediu proposta com escopo de migração de planilha.',
      }),
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        hoursOffset: 168,
        type: 'stage_change',
        body: 'Etapa: Em contato → Proposta',
        meta: { fromStageId: 'em_contato', toStageId: 'proposta' },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 192,
        type: 'attachment',
        body: 'Proposta comercial v1',
        meta: { fileName: 'Proposta_Maranhao_v1.pdf', fileSizeKb: 1240 },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 200,
        type: 'email',
        body: 'Proposta enviada por email — escopo + cronograma + investimento.',
      }),
      ...(lead.lastInteractionAt
        ? [
            build({
              leadId: lead.id,
              authorId: lead.assignedTo,
              baseDate: parseISO(lead.lastInteractionAt),
              type: 'whatsapp_out',
              body: 'Oi Carol, conseguiu olhar a proposta? Posso ajudar com alguma dúvida?',
            }),
          ]
        : []),
    ];
  },

  // Letícia Bertoni — Negociação
  lead_037: (lead) => {
    const created = parseISO(lead.createdAt);
    return [
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        type: 'lead_created',
        body: 'Lead criado via Meta Ads.',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 8,
        type: 'whatsapp_out',
        body: 'Olá Letícia, vi seu interesse na automação de cadência.',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 30,
        type: 'call',
        body: 'Call de 40min. Time de 12 vendedores em energia solar.',
        meta: { durationSeconds: 2400 },
      }),
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        hoursOffset: 34,
        type: 'stage_change',
        body: 'Etapa: Novo → Em contato',
        meta: { fromStageId: 'novo', toStageId: 'em_contato' },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 96,
        type: 'meeting',
        body: 'Demo executiva',
      }),
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        hoursOffset: 168,
        type: 'stage_change',
        body: 'Etapa: Em contato → Proposta',
        meta: { fromStageId: 'em_contato', toStageId: 'proposta' },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 200,
        type: 'attachment',
        body: 'Proposta v1 enviada',
        meta: { fileName: 'Proposta_Bertoni.pdf', fileSizeKb: 980 },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 360,
        type: 'note',
        body: 'Pediram revisão de prazo e desconto de 10%.',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 480,
        type: 'attachment',
        body: 'Proposta v2 com revisão',
        meta: { fileName: 'Proposta_Bertoni_v2.pdf', fileSizeKb: 1024 },
      }),
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        hoursOffset: 600,
        type: 'stage_change',
        body: 'Etapa: Proposta → Negociação',
        meta: { fromStageId: 'proposta', toStageId: 'negociacao' },
      }),
      ...(lead.lastInteractionAt
        ? [
            build({
              leadId: lead.id,
              authorId: lead.assignedTo,
              baseDate: parseISO(lead.lastInteractionAt),
              type: 'whatsapp_in',
              body: 'Conseguimos um sim do board! Pode me mandar o contrato?',
            }),
          ]
        : []),
    ];
  },

  // Gustavo Beltrame — Ganho
  lead_042: (lead) => {
    const created = parseISO(lead.createdAt);
    return [
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        type: 'lead_created',
        body: 'Indicação direta.',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 4,
        type: 'whatsapp_out',
        body: 'Oi Gustavo, foi o Daniel que me passou seu contato.',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 24,
        type: 'call',
        body: 'Call rápida — já tinha referência do produto.',
        meta: { durationSeconds: 900 },
      }),
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        hoursOffset: 48,
        type: 'stage_change',
        body: 'Etapa: Novo → Em contato',
        meta: { fromStageId: 'novo', toStageId: 'em_contato' },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 168,
        type: 'meeting',
        body: 'Apresentação',
      }),
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        hoursOffset: 240,
        type: 'stage_change',
        body: 'Etapa: Em contato → Proposta',
        meta: { fromStageId: 'em_contato', toStageId: 'proposta' },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 360,
        type: 'attachment',
        body: 'Contrato enviado',
        meta: { fileName: 'Contrato_Beltrame.pdf', fileSizeKb: 320 },
      }),
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        hoursOffset: 720,
        type: 'stage_change',
        body: 'Etapa: Proposta → Ganho 🎉',
        meta: { fromStageId: 'proposta', toStageId: 'ganho' },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 720,
        type: 'note',
        body: 'Fechado! Onboarding agendado pra próxima quarta.',
      }),
    ];
  },

  // Matheus Galvão — Perdido
  lead_047: (lead) => {
    const created = parseISO(lead.createdAt);
    return [
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        type: 'lead_created',
        body: 'Lead RD Station.',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 6,
        type: 'whatsapp_out',
        body: 'Olá Matheus, posso te apresentar nossa solução pra corretoras de seguros?',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 30,
        type: 'whatsapp_in',
        body: 'Pode sim, manda o material.',
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 50,
        type: 'meeting',
        body: 'Reunião de 30min',
      }),
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        hoursOffset: 100,
        type: 'stage_change',
        body: 'Etapa: Novo → Proposta',
        meta: { fromStageId: 'novo', toStageId: 'proposta' },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 240,
        type: 'note',
        body: 'Cliente comparou com concorrente X. Preço ficou 30% acima.',
      }),
      build({
        leadId: lead.id,
        authorId: 'system',
        baseDate: created,
        hoursOffset: 480,
        type: 'stage_change',
        body: 'Etapa: Proposta → Perdido',
        meta: { fromStageId: 'proposta', toStageId: 'perdido' },
      }),
      build({
        leadId: lead.id,
        authorId: lead.assignedTo,
        baseDate: created,
        hoursOffset: 480,
        type: 'note',
        body: 'Motivo de perda: preço. Voltar a contatar daqui 6 meses.',
      }),
    ];
  },
};

/** Cache em memória (imutável neste fixture). */
const TIMELINE_BY_LEAD: Map<string, Activity[]> = new Map();

for (const lead of FAKE_LEADS) {
  const builder = HANDCRAFTED[lead.id];
  const items = builder ? builder(lead) : defaultTimeline(lead);
  // Ordem cronológica reversa pra UI consumir direto.
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  TIMELINE_BY_LEAD.set(lead.id, items);
}

export function getActivitiesForLead(leadId: string): Activity[] {
  return TIMELINE_BY_LEAD.get(leadId) ?? [];
}

/** Mais recente atividade do lead (usado pela tabela densa). */
export function getMostRecentActivity(leadId: string): Activity | undefined {
  const list = TIMELINE_BY_LEAD.get(leadId);
  return list?.[0];
}

// Helper interno usado pelas tasks fixtures abaixo.
export function _hoursAgo(h: number): string {
  return subHours(new Date('2026-05-09T14:00:00-03:00'), h).toISOString();
}

export function _daysAgo(d: number): string {
  return subDays(new Date('2026-05-09T14:00:00-03:00'), d).toISOString();
}
