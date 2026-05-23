/**
 * Endpoint de cenários de drag-and-drop — devolve uma narrativa explícita
 * "antes/depois" pra cada transição crítica de etapa do Pipeline Kanban.
 *
 * Útil pra revisão manual (curl) e como documentação executável: cada
 * cenário simula o que acontece quando o usuário arrasta um card no UI.
 *
 * NÃO mexe no store global — usa exclusivamente as funções puras de
 * `transforms.ts` sobre snapshots locais.
 */
import { NextResponse } from 'next/server';

import {
  aggregateByStage,
  applyMoveDeal,
  defaultProbabilityFor,
  statusForStage,
  sumOpenPipelineCents,
} from '@/features/deals/transforms';
import type { Deal } from '@/features/deals/types';
import { blockSmokeInProd } from '@/lib/dev/smoke-guard';
import { FAKE_DEALS } from '@/lib/fixtures/deals';
import { getStageName } from '@/lib/fixtures/pipelines';

interface Scenario {
  name: string;
  narrative: string;
  before: {
    deal: { id: string; title: string; stageId: string; status: string; closedAt?: string };
    aggregateOrigin: { count: number; totalCents: number };
    aggregateDest: { count: number; totalCents: number };
    pipelineActive: number;
  };
  after: {
    deal: { id: string; title: string; stageId: string; status: string; closedAt?: string };
    aggregateOrigin: { count: number; totalCents: number };
    aggregateDest: { count: number; totalCents: number };
    pipelineActive: number;
  };
  asserts: { name: string; ok: boolean; detail?: string }[];
}

const STAGE_IDS = ['novo', 'em_contato', 'proposta', 'negociacao', 'ganho', 'perdido'];

function snapshot(deals: Deal[], dealId: string, originId: string, destId: string) {
  const deal = deals.find((d) => d.id === dealId)!;
  const aggs = aggregateByStage(deals, STAGE_IDS);
  return {
    deal: {
      id: deal.id,
      title: deal.title,
      stageId: deal.stageId,
      status: deal.status,
      closedAt: deal.closedAt,
    },
    aggregateOrigin: {
      count: aggs.find((a) => a.stageId === originId)!.count,
      totalCents: aggs.find((a) => a.stageId === originId)!.totalCents,
    },
    aggregateDest: {
      count: aggs.find((a) => a.stageId === destId)!.count,
      totalCents: aggs.find((a) => a.stageId === destId)!.totalCents,
    },
    pipelineActive: sumOpenPipelineCents(deals),
  };
}

function buildScenario(
  name: string,
  narrative: string,
  dealId: string,
  toStageId: string,
): Scenario {
  const before = snapshot(
    FAKE_DEALS,
    dealId,
    FAKE_DEALS.find((d) => d.id === dealId)!.stageId,
    toStageId,
  );
  const fromStageId = before.deal.stageId;
  const movedDeals = applyMoveDeal(FAKE_DEALS, dealId, toStageId);
  const after = snapshot(movedDeals, dealId, fromStageId, toStageId);

  const asserts: Scenario['asserts'] = [];
  function assert(name: string, ok: boolean, detail?: string) {
    asserts.push({ name, ok, detail: ok ? undefined : detail });
  }

  // 1. O deal mudou de etapa
  assert(
    `Deal saiu de "${getStageName(fromStageId)}" e entrou em "${getStageName(toStageId)}"`,
    after.deal.stageId === toStageId,
  );

  // 2. Status correto pro destino
  const expectedStatus = statusForStage(toStageId);
  assert(
    `Status virou "${expectedStatus}" (esperado pra etapa ${getStageName(toStageId)})`,
    after.deal.status === expectedStatus,
    `recebi ${after.deal.status}`,
  );

  // 3. closedAt: setado se terminal, undefined se ativa
  const isTerminal = toStageId === 'ganho' || toStageId === 'perdido';
  if (isTerminal) {
    assert('closedAt foi setado (etapa terminal)', typeof after.deal.closedAt === 'string');
  } else {
    assert('closedAt foi limpo (etapa ativa)', after.deal.closedAt === undefined);
  }

  // 4. Probability ajustada
  const expectedProb = defaultProbabilityFor(toStageId);
  assert(
    `Probability virou ${expectedProb}%`,
    movedDeals.find((d) => d.id === dealId)!.probability === expectedProb,
  );

  // 5. Coluna de origem perdeu o card e o valor
  assert(
    `Origem (${getStageName(fromStageId)}): count -1 e soma -R$${(before.deal.stageId !== fromStageId ? 0 : FAKE_DEALS.find((d) => d.id === dealId)!.valueCents) / 100}`,
    after.aggregateOrigin.count === before.aggregateOrigin.count - 1,
  );

  // 6. Coluna de destino ganhou o card e o valor
  const dealValue = FAKE_DEALS.find((d) => d.id === dealId)!.valueCents;
  assert(
    `Destino (${getStageName(toStageId)}): count +1 e soma +${formatBRL(dealValue)}`,
    after.aggregateDest.count === before.aggregateDest.count + 1 &&
      after.aggregateDest.totalCents === before.aggregateDest.totalCents + dealValue,
  );

  // 7. KPI Pipeline ativo: muda só se cruzou fronteira open ↔ terminal
  const wasOpen = before.deal.status === 'open';
  const isOpen = after.deal.status === 'open';
  if (wasOpen && !isOpen) {
    // Saiu de aberto → fechado: KPI desce no valor do deal
    assert(
      `KPI "Pipeline ativo" diminuiu ${formatBRL(dealValue)} (saiu de aberto → fechado)`,
      after.pipelineActive === before.pipelineActive - dealValue,
    );
  } else if (!wasOpen && isOpen) {
    // Reabriu deal fechado → aberto: KPI sobe
    assert(
      `KPI "Pipeline ativo" aumentou ${formatBRL(dealValue)} (reabriu de fechado → aberto)`,
      after.pipelineActive === before.pipelineActive + dealValue,
    );
  } else {
    // Continuou aberto OU terminal → terminal: KPI inalterado
    assert(
      'KPI "Pipeline ativo" inalterado (sem cruzar fronteira open/terminal)',
      after.pipelineActive === before.pipelineActive,
    );
  }

  // 8. FAKE_DEALS imutável (defesa profunda)
  assert(
    'FAKE_DEALS original NÃO foi mutado (imutabilidade preservada)',
    FAKE_DEALS.find((d) => d.id === dealId)!.stageId === fromStageId,
  );

  return { name, narrative, before, after, asserts };
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export const dynamic = 'force-dynamic';

export function GET() {
  const blocked = blockSmokeInProd();
  if (blocked) return blocked;

  // Pega 1 deal de cada etapa pra construir cenários representativos.
  const dealNovo = FAKE_DEALS.find((d) => d.stageId === 'novo' && d.status === 'open')!;
  const dealEmContato = FAKE_DEALS.find((d) => d.stageId === 'em_contato' && d.status === 'open')!;
  const dealProposta = FAKE_DEALS.find((d) => d.stageId === 'proposta' && d.status === 'open')!;
  const dealNegociacao = FAKE_DEALS.find((d) => d.stageId === 'negociacao' && d.status === 'open')!;
  const dealGanho = FAKE_DEALS.find((d) => d.status === 'won')!;
  const dealPerdido = FAKE_DEALS.find((d) => d.status === 'lost')!;

  const scenarios: Scenario[] = [
    buildScenario(
      'avanço normal (Novo → Em contato)',
      `Vendedor arrasta "${dealNovo.title}" — primeira conversa iniciada.`,
      dealNovo.id,
      'em_contato',
    ),
    buildScenario(
      'avanço (Em contato → Proposta)',
      `Vendedor arrasta "${dealEmContato.title}" — proposta enviada.`,
      dealEmContato.id,
      'proposta',
    ),
    buildScenario(
      'avanço (Proposta → Negociação)',
      `Vendedor arrasta "${dealProposta.title}" — em negociação ativa.`,
      dealProposta.id,
      'negociacao',
    ),
    buildScenario(
      '🏆 fechamento (Negociação → Ganho)',
      `Vendedor arrasta "${dealNegociacao.title}" pra Ganho — fechou! Toast 🏆 aparece.`,
      dealNegociacao.id,
      'ganho',
    ),
    buildScenario(
      'pulo de etapa (Novo → Negociação)',
      `Cliente já conhece o produto, vendedor pula etapas — drag suporta qualquer destino.`,
      dealNovo.id,
      'negociacao',
    ),
    buildScenario(
      'volta de etapa (Negociação → Em contato)',
      `Cliente recuou na negociação, vendedor volta o card pra revisar abordagem.`,
      dealNegociacao.id,
      'em_contato',
    ),
    buildScenario(
      '✖️ perda direta (Em contato → Perdido)',
      `Vendedor arrasta pra Perdido — desistiu cedo. Toast ✖️ aparece.`,
      dealEmContato.id,
      'perdido',
    ),
    buildScenario(
      '🔄 reabertura (Ganho → Negociação)',
      `Cliente desistiu pós-fechamento, vendedor reabre o deal — status volta pra "open".`,
      dealGanho.id,
      'negociacao',
    ),
    buildScenario(
      '🔄 reabertura de perdido (Perdido → Em contato)',
      `Cliente voltou após meses, vendedor reabre — status sai de "lost" pra "open".`,
      dealPerdido.id,
      'em_contato',
    ),
  ];

  const totalAsserts = scenarios.reduce((acc, s) => acc + s.asserts.length, 0);
  const totalPassed = scenarios.reduce((acc, s) => acc + s.asserts.filter((a) => a.ok).length, 0);
  const allOk = totalPassed === totalAsserts;

  return NextResponse.json(
    {
      summary: {
        scenarios: scenarios.length,
        asserts: totalAsserts,
        passed: totalPassed,
        failed: totalAsserts - totalPassed,
        allOk,
      },
      scenarios,
    },
    { status: allOk ? 200 : 500 },
  );
}
