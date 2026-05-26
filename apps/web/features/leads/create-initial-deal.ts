import type { DealStatus } from '../deals/types';

export type StageTone = 'default' | 'success' | 'destructive';

export interface BuildInitialDealDataInput {
  workspaceId: string;
  leadId: string;
  leadName: string;
  stageId: string;
  stageTone: StageTone | null | undefined;
  ownerId: string;
  valueCents: number;
  orderInStage: number;
  userId: string;
  now?: Date;
}

export interface InitialDealData {
  workspaceId: string;
  title: string;
  leadId: string;
  stageId: string;
  valueCents: number;
  ownerId: string;
  status: DealStatus;
  orderInStage: number;
  closedAt: Date | null;
  createdById: string;
}

export function statusFromStageTone(tone: StageTone | null | undefined): DealStatus {
  if (tone === 'success') return 'won';
  if (tone === 'destructive') return 'lost';
  return 'open';
}

export function buildInitialDealData(input: BuildInitialDealDataInput): InitialDealData {
  const status = statusFromStageTone(input.stageTone);
  return {
    workspaceId: input.workspaceId,
    title: input.leadName.trim(),
    leadId: input.leadId,
    stageId: input.stageId,
    valueCents: input.valueCents,
    ownerId: input.ownerId,
    status,
    orderInStage: input.orderInStage,
    closedAt: status === 'open' ? null : (input.now ?? new Date()),
    createdById: input.userId,
  };
}
