/**
 * Schemas Zod do contrato `/api/internal/cadence-dispatch` (M10#2).
 *
 * Edge Function `cadence-runner` POSTa este payload pra rota Next; rota
 * valida na borda. `.strict()` rejeita props extras (defense-in-depth — se
 * a Edge for comprometida e injetar campos, eles caem aqui).
 */
import { z } from 'zod';

export const dispatchPayloadSchema = z
  .object({
    workspace_id: z.string().uuid(),
    enrollment_id: z.string().uuid(),
    lead_id: z.string().uuid(),
    cadence_id: z.string().uuid(),
    step_id: z.string().uuid(),
    step_run_id: z.string().uuid(),
    scheduled_for: z.string().datetime(),
  })
  .strict();

export type DispatchPayload = z.infer<typeof dispatchPayloadSchema>;
