import { cn } from '@papopro/ui';

import { getStage } from '@/lib/fixtures/pipelines';

import type { PipelineStage } from '../types';

/**
 * Pill compacto pra exibir a etapa do funil em tabelas e cards. Cor segue
 * a etapa terminal (success/destructive) ou tom neutro pras intermediárias.
 *
 * **Duas formas de uso:**
 *  - Server-fed (M8+): passar `stage` resolvido (`{ name, tone }`) — render direto.
 *  - Legacy fixture (M4-M7): passar `stageId` slug — faz lookup em `getStage`.
 *
 * O fallback `{stageId}` cru existia em M4 e mostrava algo legível ("novo");
 * agora com UUIDs do DB, mostraria o UUID na tela. A prop `stage` evita isso.
 */
interface StagePillProps {
  /** Stage resolvido (preferido em M8+). Quando passado, `stageId` é ignorado. */
  stage?: Pick<PipelineStage, 'name' | 'tone'>;
  /** Slug/ID legacy — só usado se `stage` não vier (compat fixtures). */
  stageId?: string;
  className?: string;
}

const TONE_CLASS: Record<string, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/15 text-success',
  destructive: 'bg-destructive/15 text-destructive',
};

export function StagePill({ stage, stageId, className }: StagePillProps) {
  // M8+: caller passa `stage` resolvido. Fallback: lookup nas fixtures M4
  // (legado — vai sumir quando todo consumer migrar). Último recurso: "—".
  const resolved = stage ?? (stageId ? getStage(stageId) : undefined);
  const tone = resolved?.tone ?? 'default';
  const label = resolved?.name ?? '—';
  return (
    <span
      className={cn(
        'text-caption inline-flex items-center rounded-full px-2 py-0.5 font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
