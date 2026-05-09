import * as React from 'react';

import { Flame, ThermometerSnowflake, ThermometerSun } from '../icons';
import { cn } from '../utils/cn';

export type LeadTemperature = 'hot' | 'warm' | 'cold';

const COPY: Record<LeadTemperature, { label: string; tone: string; Icon: React.ElementType }> = {
  hot: { label: 'Quente', tone: 'bg-success/15 text-success', Icon: Flame },
  warm: { label: 'Morno', tone: 'bg-warning/20 text-warning', Icon: ThermometerSun },
  cold: { label: 'Frio', tone: 'bg-destructive/15 text-destructive', Icon: ThermometerSnowflake },
};

interface TemperatureBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  temperature: LeadTemperature;
  /** Esconde texto e mostra só o ícone (Kanban denso). */
  iconOnly?: boolean;
}

/**
 * Indicador de temperatura do lead. Cor segue tokens semânticos do design system.
 */
export function TemperatureBadge({
  temperature,
  iconOnly = false,
  className,
  ...props
}: TemperatureBadgeProps) {
  const { label, tone, Icon } = COPY[temperature];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium',
        tone,
        iconOnly && 'p-1',
        className,
      )}
      aria-label={`Lead ${label.toLowerCase()}`}
      {...props}
    >
      <Icon className="size-3.5" aria-hidden />
      {!iconOnly && <span>{label}</span>}
    </span>
  );
}
