import { describe, expect, it } from 'vitest';

import { acknowledgeColdAlertSchema, ackColdAlertWhereForRole } from './cold-alerts.helpers';

/**
 * Regressões de M10#4 cold-lead-detector.
 *
 * Cobertura intencionalmente fina (helpers puros). Lifecycle end-to-end
 * (detect → insert → ack) exige Docker Supabase rodando e fica pra smoke
 * manual em M10#5.
 */

describe('acknowledgeColdAlertSchema', () => {
  it('aceita UUID válido', () => {
    const r = acknowledgeColdAlertSchema.safeParse({
      alertId: '11111111-2222-4333-8444-555555555555',
    });
    expect(r.success).toBe(true);
  });

  it('rejeita string que não é UUID', () => {
    const r = acknowledgeColdAlertSchema.safeParse({ alertId: 'not-a-uuid' });
    expect(r.success).toBe(false);
  });

  it('rejeita undefined', () => {
    const r = acknowledgeColdAlertSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe('ackColdAlertWhereForRole (RBAC fino)', () => {
  const workspaceId = '11111111-2222-4333-8444-555555555551';
  const userId = '11111111-2222-4333-8444-555555555552';

  it('Vendedor filtra apenas leads próprios', () => {
    const where = ackColdAlertWhereForRole(workspaceId, userId, 'Vendedor');
    expect(where.workspaceId).toBe(workspaceId);
    expect(where.acknowledgedAt).toBeNull();
    // Vendedor adiciona filtro nested lead.assignedTo.userId
    expect(where.lead).toEqual({ assignedTo: { userId } });
  });

  it('Owner vê todos os alerts do workspace', () => {
    const where = ackColdAlertWhereForRole(workspaceId, userId, 'Owner');
    expect(where.workspaceId).toBe(workspaceId);
    expect(where.acknowledgedAt).toBeNull();
    expect(where.lead).toBeUndefined();
  });

  it('Admin vê todos os alerts do workspace', () => {
    const where = ackColdAlertWhereForRole(workspaceId, userId, 'Admin');
    expect(where.lead).toBeUndefined();
  });

  it('Manager vê todos os alerts do workspace', () => {
    const where = ackColdAlertWhereForRole(workspaceId, userId, 'Manager');
    expect(where.lead).toBeUndefined();
  });
});
