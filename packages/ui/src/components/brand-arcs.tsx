import * as React from 'react';

import { cn } from '../utils/cn';

/**
 * Arcos decorativos da marca — referência visual derivada do guia que
 * inspirou a paleta (curvas que sugerem movimento). Uso restrito a superfícies
 * de marketing e onboarding (CLAUDE.md §8): landing, login/signup, estados
 * vazios grandes ("conecte o WhatsApp", "primeiro lead"). NÃO usar em
 * superfícies densas do produto (Kanban, inbox, tabelas).
 *
 * Implementação:
 *  - SVG inline com `viewBox` 400×400 — escala via container.
 *  - Cores via `stroke-primary` / `stroke-accent` / `stroke-foreground`,
 *    então o componente respeita tema (light/dark) automaticamente.
 *  - `aria-hidden` + `pointer-events-none`: puramente decorativo.
 *  - Posicionamento é responsabilidade do consumidor — o componente vem
 *    com `absolute inset-0` por default; embrulhe num container `relative`.
 */

type BrandArcsVariant = 'login' | 'empty-state' | 'landing-hero';

interface BrandArcsProps extends React.SVGAttributes<SVGSVGElement> {
  /**
   * Densidade e disposição dos arcos:
   *  - `login`: 3 arcos discretos nos cantos, não compete com o formulário.
   *  - `empty-state`: 2 arcos sutis, baixa opacidade — só sugere a marca.
   *  - `landing-hero`: 4 arcos com presença, ocupa o frame.
   */
  variant?: BrandArcsVariant;
  /**
   * Por padrão o componente posiciona absolute (consumidor controla via
   * container `relative`). Passe `false` se quiser posicionar manualmente.
   */
  absolute?: boolean;
}

interface ArcSpec {
  /** Centro X do arco no viewBox 400×400. */
  cx: number;
  cy: number;
  /** Raio do arco. */
  r: number;
  /** Espessura da linha. */
  width: number;
  /** Ângulo inicial e final em graus (0 = leste, sentido horário no SVG). */
  start: number;
  end: number;
  /** Token semântico aplicado via `stroke-*`. */
  tone: 'primary' | 'accent' | 'foreground';
  /** Opacidade final do arco (0–1). */
  opacity?: number;
}

const VARIANT_ARCS: Record<BrandArcsVariant, ArcSpec[]> = {
  login: [
    { cx: 50, cy: 60, r: 90, width: 14, start: 240, end: 330, tone: 'primary', opacity: 0.55 },
    { cx: 360, cy: 80, r: 70, width: 12, start: 90, end: 200, tone: 'accent', opacity: 0.7 },
    { cx: 380, cy: 360, r: 110, width: 16, start: 160, end: 270, tone: 'primary', opacity: 0.4 },
  ],
  'empty-state': [
    { cx: 60, cy: 80, r: 70, width: 10, start: 270, end: 350, tone: 'primary', opacity: 0.35 },
    { cx: 340, cy: 320, r: 80, width: 10, start: 130, end: 220, tone: 'accent', opacity: 0.45 },
  ],
  'landing-hero': [
    { cx: 80, cy: 100, r: 130, width: 18, start: 230, end: 340, tone: 'primary', opacity: 0.7 },
    { cx: 320, cy: 80, r: 90, width: 16, start: 70, end: 180, tone: 'accent', opacity: 0.85 },
    {
      cx: 360,
      cy: 340,
      r: 120,
      width: 18,
      start: 150,
      end: 260,
      tone: 'foreground',
      opacity: 0.25,
    },
    { cx: 120, cy: 360, r: 70, width: 14, start: 320, end: 50, tone: 'accent', opacity: 0.6 },
  ],
};

const TONE_CLASS: Record<ArcSpec['tone'], string> = {
  primary: 'stroke-primary',
  accent: 'stroke-accent',
  foreground: 'stroke-foreground',
};

/**
 * Converte um arco (centro, raio, ângulos) em `d` de `<path>`. SVG usa Y para
 * baixo, então mantemos os ângulos no sistema "0=leste, sentido horário" — é
 * o mesmo que o leitor humano espera ao ler `start`/`end` em graus.
 */
function arcPath({ cx, cy, r, start, end }: ArcSpec): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(start));
  const y1 = cy + r * Math.sin(toRad(start));
  const x2 = cx + r * Math.cos(toRad(end));
  const y2 = cy + r * Math.sin(toRad(end));
  // Sweep do arco: se a varredura passar de 180°, marca `large-arc-flag`.
  const sweep = (end - start + 360) % 360 > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${sweep} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function BrandArcs({
  variant = 'empty-state',
  absolute = true,
  className,
  ...props
}: BrandArcsProps) {
  const arcs = VARIANT_ARCS[variant];
  return (
    <svg
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={cn(
        'pointer-events-none select-none',
        absolute && 'absolute inset-0 size-full',
        className,
      )}
      {...props}
    >
      {arcs.map((arc, i) => (
        <path
          key={i}
          d={arcPath(arc)}
          className={TONE_CLASS[arc.tone]}
          fill="none"
          strokeWidth={arc.width}
          strokeLinecap="round"
          opacity={arc.opacity ?? 1}
        />
      ))}
    </svg>
  );
}

export type { BrandArcsVariant, BrandArcsProps };
