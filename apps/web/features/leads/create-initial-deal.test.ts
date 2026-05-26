import { describe, expect, it } from 'vitest';

import { buildInitialDealData, statusFromStageTone } from './create-initial-deal';

describe('statusFromStageTone', () => {
  it('mantém oportunidade aberta para etapas não terminais', () => {
    expect(statusFromStageTone('default')).toBe('open');
    expect(statusFromStageTone(null)).toBe('open');
  });

  it('fecha oportunidade como ganha ou perdida para etapas terminais', () => {
    expect(statusFromStageTone('success')).toBe('won');
    expect(statusFromStageTone('destructive')).toBe('lost');
  });
});

describe('buildInitialDealData', () => {
  it('cria dados de oportunidade inicial a partir do lead', () => {
    const result = buildInitialDealData({
      workspaceId: 'workspace-id',
      leadId: 'lead-id',
      leadName: ' Mariana Costa ',
      stageId: 'stage-id',
      stageTone: 'default',
      ownerId: 'member-id',
      valueCents: 85000000,
      orderInStage: 1000,
      userId: 'user-id',
    });

    expect(result).toEqual({
      workspaceId: 'workspace-id',
      title: 'Mariana Costa',
      leadId: 'lead-id',
      stageId: 'stage-id',
      valueCents: 85000000,
      ownerId: 'member-id',
      status: 'open',
      orderInStage: 1000,
      closedAt: null,
      createdById: 'user-id',
    });
  });

  it('marca closedAt quando a etapa inicial já é terminal', () => {
    const now = new Date('2026-05-26T03:00:00.000Z');

    const result = buildInitialDealData({
      workspaceId: 'workspace-id',
      leadId: 'lead-id',
      leadName: 'Lead ganho',
      stageId: 'stage-ganho',
      stageTone: 'success',
      ownerId: 'member-id',
      valueCents: 1000,
      orderInStage: 2000,
      userId: 'user-id',
      now,
    });

    expect(result.status).toBe('won');
    expect(result.closedAt).toBe(now);
  });
});
