import { ImageResponse } from 'next/og';

/**
 * Favicon dinâmico (32×32) gerado via `next/og`. Aparece na aba do browser,
 * bookmarks e search results. Espelha o `LogoMark` do `@papopro/ui`:
 * quadrado primário com a letra "P" branca.
 *
 * Por que dinâmico em vez de `.ico` estático:
 *  - Tokens da marca (primary `#367BEC`) ficam centralizados — uma única
 *    paleta vive em `tokens.css`, e o favicon respeita o canônico.
 *  - Sem asset binário no repo.
 *  - Mesma técnica do `opengraph-image.tsx`, então só uma stack pra
 *    aprender e manter.
 *
 * Next 14 mapeia esse arquivo pra `/icon` automaticamente e injeta o
 * `<link rel="icon">` no `<head>` — sem código adicional no layout.
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
