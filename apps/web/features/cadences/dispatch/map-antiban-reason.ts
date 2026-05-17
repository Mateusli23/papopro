/**
 * Mapeamento puro `AntiBanReason` → `CadenceStepRunSkipReason` (M10#2).
 *
 * O enum `cadence_step_run_skip_reason` do M10#1 tem 8 valores; o
 * `AntiBanReason` do M9#3 tem 6. A intersection traduz semântica de
 * envio bloqueado pra registro em `cadence_step_runs.skip_reason`.
 *
 * **Mapeamento decidido** (ver plano M10#2):
 *  - blacklisted            → blacklist        (permanente: opt-out LGPD)
 *  - instance_disconnected  → workspace_paused (workspace todo parado)
 *  - instance_unhealthy     → unhealthy
 *  - instance_paused        → rate_limit       (burst pause = 50 envios)
 *  - outside_business_hours → outside_business_hours
 *  - rate_limit_24h         → rate_limit
 *
 * `isPermanentBlock` é o predicado que decide entre **cancel enrollment**
 * (permanente — lead nunca mais recebe nada da cadência) vs **backoff
 * +30min** (transiente — runner tenta de novo no próximo tick). Só
 * `blacklisted` é permanente neste motor; `no_phone` e `lead_deleted`
 * são tratados na rota dispatch antes do anti-ban (não vêm por aqui).
 */
import type { AntiBanReason } from '@/lib/whatsapp/anti-ban';

import type { CadenceStepRunSkipReason } from './types';

export function mapAntiBanToSkipReason(reason: AntiBanReason): CadenceStepRunSkipReason {
  switch (reason) {
    case 'blacklisted':
      return 'blacklist';
    case 'instance_disconnected':
      return 'workspace_paused';
    case 'instance_unhealthy':
      return 'unhealthy';
    case 'instance_paused':
      return 'rate_limit';
    case 'outside_business_hours':
      return 'outside_business_hours';
    case 'rate_limit_24h':
      return 'rate_limit';
  }
}

export function isPermanentBlock(reason: AntiBanReason): boolean {
  return reason === 'blacklisted';
}
