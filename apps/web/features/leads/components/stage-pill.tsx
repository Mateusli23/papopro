import { cn } from '@papopro/ui';

import { getStage } from '@/lib/fixtures/pipelines';

/**
 * Pill compacto pra exibir a etapa do funil em tabelas e cards. Cor segue
 * a etapa terminal (success/destructive) ou tom neutro pras intermediárias.
 *
 * Em M8 a etapa vem do servidor (com `stage.color` opcional); aqui derivamos
 * de `getStage`.
 */
interface StagePillProps {
  stageId: string;
  className?: string;
}

const TONE_CLASS: Record<string, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/15 text-success',
  destructive: 'bg-destructive/15 text-destructive',
};

export function StagePill({ stageId, className }: StagePillProps) {
  const stage = getStage(stageId);
  const tone = stage?.tone ?? 'default';
  return (
    <span
      className={cn(
        'text-caption inline-flex items-center rounded-full px-2 py-0.5 font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      {stage?.name ?? stageId}
    </span>
  );
}
