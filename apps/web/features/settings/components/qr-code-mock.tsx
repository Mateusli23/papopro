'use client';

import * as React from 'react';

import { cn } from '@papopro/ui';

interface QrCodeMockProps {
  /** Seed determinística — mesmo seed gera mesmo padrão. */
  seed?: string;
  /** Tamanho em pixels. Default 200. */
  size?: number;
  className?: string;
}

/**
 * QR Code mockado — SVG procedural com módulos pseudo-aleatórios determinísticos
 * pela seed. Não é um QR escaneável, é só um placeholder visual com o "look"
 * de QR code (cantos quadrados de finder + grid de módulos pretos/brancos).
 *
 * Por que mock procedural e não imagem PNG fixa?
 *  - Roda sem assets externos / sem dependência de lib (`qrcode.react` etc).
 *  - Cor adapta a dark mode automaticamente via `currentColor`.
 *  - Dá pra mudar o seed pra simular "QR novo" no fluxo de reconectar.
 *
 * Em M9 substitui por `<QRCode>` real apontando pro pairing endpoint da uazapi.
 */
export function QrCodeMock({ seed = 'papopro', size = 200, className }: QrCodeMockProps) {
  const modules = React.useMemo(() => generateModules(seed, 25), [seed]);

  return (
    <svg
      role="img"
      aria-label="QR Code de conexão (mockado)"
      width={size}
      height={size}
      viewBox="0 0 25 25"
      className={cn('text-foreground', className)}
    >
      {/* Fundo branco do QR — conserva contraste em dark mode. */}
      <rect width="25" height="25" fill="white" />
      {/* Módulos */}
      {modules.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
      {/* Finder squares (3 cantos): topo-esq, topo-dir, baixo-esq */}
      <FinderSquare cx={3} cy={3} />
      <FinderSquare cx={21} cy={3} />
      <FinderSquare cx={3} cy={21} />
    </svg>
  );
}

function FinderSquare({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <rect x={cx - 3} y={cy - 3} width="7" height="7" fill="currentColor" />
      <rect x={cx - 2} y={cy - 2} width="5" height="5" fill="white" />
      <rect x={cx - 1} y={cy - 1} width="3" height="3" fill="currentColor" />
    </g>
  );
}

/**
 * Gera lista de módulos `(x, y)` preenchidos. Usa hash simples + LCG pra
 * resultado determinístico por seed sem libs externas. Evita os 7×7 dos finder
 * squares (cantos do QR).
 */
function generateModules(seed: string, gridSize: number): Array<{ x: number; y: number }> {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = (() => {
    let s = h >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  })();

  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if (isInFinderArea(x, y, gridSize)) continue;
      if (rand() < 0.45) out.push({ x, y });
    }
  }
  return out;
}

function isInFinderArea(x: number, y: number, gridSize: number) {
  const inTL = x < 8 && y < 8;
  const inTR = x >= gridSize - 8 && y < 8;
  const inBL = x < 8 && y >= gridSize - 8;
  return inTL || inTR || inBL;
}
