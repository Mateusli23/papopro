import * as React from 'react';

import { cn } from '../utils/cn';

interface LogoProps extends React.SVGAttributes<SVGSVGElement> {
  /** Tamanho em px (lado quadrado). Default: 24. */
  size?: number;
}

/**
 * Marca PapoPro — placeholder visual coeso com a paleta. Quando vier o logo
 * final do designer, substituir aqui mantendo a mesma API.
 */
export function LogoMark({ size = 24, className, ...props }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="PapoPro"
      className={cn('text-primary', className)}
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" />
      <path
        d="M7 8.5C7 7.67 7.67 7 8.5 7H14C16.21 7 18 8.79 18 11C18 13.21 16.21 15 14 15H10L8 17.5C7.5 18.12 6.5 17.77 6.5 17V14H7V8.5Z"
        fill="white"
      />
    </svg>
  );
}

interface LogoFullProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
}

export function LogoFull({ size = 22, className, ...props }: LogoFullProps) {
  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      <LogoMark size={size} />
      <span className="text-foreground text-title font-semibold tracking-tight">PapoPro</span>
    </div>
  );
}
