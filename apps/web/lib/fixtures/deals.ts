/**
 * Deals derivados dos leads do M4. Regra:
 *
 *  - Cada lead com `status=ativo` ganha 1 deal "principal" na mesma etapa.
 *  - Leads "ricos" (lead_001, lead_013, lead_037, lead_038) ganham um
 *    segundo deal — simula clientes recorrentes/multi-projeto.
 *  - Leads `ganho` viram deals `status=won` na coluna Ganho.
 *  - Leads `perdido` viram deals `status=lost` na coluna Perdido (com
 *    `lostReason` herdado de `lead.notes` quando faz sentido).
 *
 * O título do deal é gerado a partir do contexto (empresa + segmento)
 * pra parecer natural — em produção (M8) cada vendedor escreve o título
 * que faz sentido pra ele.
 */
import { addDays, parseISO, subDays } from 'date-fns';

import type { Deal, DealStatus } from '@/features/deals/types';

import { FAKE_LEADS } from './leads';

const NOW = new Date('2026-05-09T14:00:00-03:00');

let dealCounter = 0;
function nextId(): string {
  dealCounter += 1;
  return `deal_${dealCounter.toString().padStart(3, '0')}`;
}

interface BuildArgs {
  leadId: string;
  title: string;
  stageId: string;
  valueCents: number;
  ownerId: string;
  /** Dias relativos a NOW (negativo = passado, positivo = futuro). */
  dueInDays?: number;
  /** Dias atrás desde a criação. */
  createdDaysAgo: number;
  status: DealStatus;
  probability?: number;
  description?: string;
  lostReason?: string;
  closedDaysAgo?: number;
}

function build(args: BuildArgs): Deal {
  const createdAt = subDays(NOW, args.createdDaysAgo);
  return {
    id: nextId(),
    title: args.title,
    leadId: args.leadId,
    stageId: args.stageId,
    valueCents: args.valueCents,
    ownerId: args.ownerId,
    probability: args.probability,
    dueAt: args.dueInDays !== undefined ? addDays(NOW, args.dueInDays).toISOString() : undefined,
    status: args.status,
    lostReason: args.lostReason,
    description: args.description,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    closedAt:
      args.closedDaysAgo !== undefined ? subDays(NOW, args.closedDaysAgo).toISOString() : undefined,
  };
}

/** Gera título plausível a partir do lead. */
function defaultTitle(leadName: string, company?: string, tags: string[] = []): string {
  if (tags.includes('imobiliário')) {
    return company
      ? `Lançamento ${company.split(' ').slice(0, 2).join(' ')}`
      : `Imóvel - ${leadName.split(' ')[0]}`;
  }
  if (tags.includes('alto-ticket')) {
    return company ? `Projeto ${company}` : `Proposta enterprise — ${leadName.split(' ')[0]}`;
  }
  if (tags.includes('saúde')) {
    return company ? `Implantação ${company}` : `Setup clínica — ${leadName.split(' ')[0]}`;
  }
  if (tags.includes('SaaS') || tags.includes('tecnologia')) {
    return company ? `Plataforma ${company}` : `SaaS — ${leadName.split(' ')[0]}`;
  }
  return company ? `${company} — onboarding` : `Negócio com ${leadName.split(' ')[0]}`;
}

/** Probabilidade default por etapa (heurística simples). */
function defaultProbability(stageId: string): number | undefined {
  switch (stageId) {
    case 'novo':
      return 10;
    case 'em_contato':
      return 25;
    case 'proposta':
      return 50;
    case 'negociacao':
      return 75;
    case 'ganho':
      return 100;
    case 'perdido':
      return 0;
    default:
      return undefined;
  }
}

const DEALS: Deal[] = [];

// Seed determinístico (LCG simples) — `Math.random()` em fixture quebraria
// SSR/hidratação porque server e client gerariam valores diferentes.
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

function leadSeed(leadId: string): number {
  let h = 0;
  for (let i = 0; i < leadId.length; i++) h = (h * 31 + leadId.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

for (const lead of FAKE_LEADS) {
  const isWon = lead.stageId === 'ganho';
  const isLost = lead.stageId === 'perdido';
  const status: DealStatus = isWon ? 'won' : isLost ? 'lost' : 'open';
  const rand = seededRand(leadSeed(lead.id));

  // Prazo: deals em Negociação têm prazo curto, Proposta médio,
  // Em contato/Novo prazo mais longo. Won/Lost não têm prazo ativo.
  let dueInDays: number | undefined;
  if (!isWon && !isLost) {
    if (lead.stageId === 'negociacao') dueInDays = Math.floor(rand() * 10) - 2;
    else if (lead.stageId === 'proposta') dueInDays = Math.floor(rand() * 20) + 3;
    else if (lead.stageId === 'em_contato') dueInDays = Math.floor(rand() * 30) + 7;
    else dueInDays = Math.floor(rand() * 45) + 15;
  }

  const created = Math.max(
    1,
    Math.floor((NOW.getTime() - parseISO(lead.createdAt).getTime()) / 86400000),
  );
  const closedDaysAgo = isWon || isLost ? Math.floor(rand() * 14) + 1 : undefined;

  DEALS.push(
    build({
      leadId: lead.id,
      title: defaultTitle(lead.name, lead.company, lead.tags),
      stageId: lead.stageId,
      valueCents: lead.valueCents,
      ownerId: lead.assignedTo,
      dueInDays,
      createdDaysAgo: Math.min(created, 90),
      status,
      probability: defaultProbability(lead.stageId),
      description: lead.notes,
      lostReason: isLost ? lead.notes : undefined,
      closedDaysAgo,
    }),
  );
}

// Deals adicionais ("ricos" — clientes com múltiplas oportunidades)
const EXTRAS: BuildArgs[] = [
  {
    leadId: 'lead_001',
    title: 'Apartamento Vértice Zona Sul - 2ª torre',
    stageId: 'em_contato',
    valueCents: 1_200_000_00,
    ownerId: 'user_mateus',
    dueInDays: 21,
    createdDaysAgo: 2,
    status: 'open',
    probability: 30,
    description: 'Mariana mostrou interesse na 2ª torre do empreendimento.',
  },
  {
    leadId: 'lead_013',
    title: 'Plantação Patrícia - segundo prédio',
    stageId: 'proposta',
    valueCents: 950_000_00,
    ownerId: 'user_renato',
    dueInDays: 10,
    createdDaysAgo: 5,
    status: 'open',
    probability: 60,
  },
  {
    leadId: 'lead_037',
    title: 'Bertoni Solar - filial Nordeste',
    stageId: 'novo',
    valueCents: 180_000_00,
    ownerId: 'user_juliana',
    dueInDays: 35,
    createdDaysAgo: 1,
    status: 'open',
    probability: 15,
  },
  {
    leadId: 'lead_038',
    title: 'Pires - obra residencial sócio',
    stageId: 'em_contato',
    valueCents: 220_000_00,
    ownerId: 'user_renato',
    dueInDays: 28,
    createdDaysAgo: 8,
    status: 'open',
    probability: 25,
  },
  {
    leadId: 'lead_042',
    title: 'Beltrame Auto - revenda 2ª loja',
    stageId: 'proposta',
    valueCents: 410_000_00,
    ownerId: 'user_juliana',
    dueInDays: 5,
    createdDaysAgo: 12,
    status: 'open',
    probability: 65,
    description: 'Cliente já fechou o primeiro deal. Quer expandir.',
  },
  {
    leadId: 'lead_017',
    title: 'Brandão Odonto - segundo consultório',
    stageId: 'novo',
    valueCents: 38_000_00,
    ownerId: 'user_juliana',
    dueInDays: 25,
    createdDaysAgo: 3,
    status: 'open',
    probability: 20,
  },
];

for (const extra of EXTRAS) {
  DEALS.push(build(extra));
}

export const FAKE_DEALS: Deal[] = DEALS;

export function getDeal(id: string): Deal | undefined {
  return DEALS.find((d) => d.id === id);
}

export function getDealsForLead(leadId: string): Deal[] {
  return DEALS.filter((d) => d.leadId === leadId);
}
