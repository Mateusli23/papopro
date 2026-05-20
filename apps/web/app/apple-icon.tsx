import { ImageResponse } from 'next/og';

/**
 * Apple touch icon (180×180) do app `apps/web`. É o ícone que o iOS Safari usa
 * no "Adicionar à Tela de Início" — ou seja, o ícone do PapoPro instalado como
 * PWA no iPhone/iPad (iOS usa `apple-touch-icon`, não os `icons` do manifest).
 *
 * Next 14 detecta o arquivo e injeta `<link rel="apple-touch-icon">` — zero
 * código no layout. Raio 28px dá um look polido onde o sistema não mascara.
 */

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const PRIMARY = '#367BEC';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: PRIMARY,
        borderRadius: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: '120px',
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      P
    </div>,
    { ...size },
  );
}
