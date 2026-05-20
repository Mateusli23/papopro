import { ImageResponse } from 'next/og';

/**
 * Favicon dinâmico (32×32) do app `apps/web`, gerado via `next/og`. Espelha o
 * `icon.tsx` da `apps/landing` e o `LogoMark` do `@papopro/ui`: quadrado
 * primário com a letra "P" branca.
 *
 * Next 14 mapeia esse arquivo pra `/icon` e injeta `<link rel="icon">` no
 * `<head>` — sem código no layout. `public/icon.svg` (M13#1) é a versão usada
 * no `manifest.json`; este aqui é só a aba do browser.
 */

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

const PRIMARY = '#367BEC';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: PRIMARY,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: '22px',
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      P
    </div>,
    { ...size },
  );
}
