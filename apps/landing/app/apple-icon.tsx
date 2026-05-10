import { ImageResponse } from 'next/og';

/**
 * Apple touch icon (180×180) — usado no "Adicionar à tela inicial" do iOS
 * Safari e como ícone do PWA quando a landing for instalada. Mesma
 * identidade do `icon.tsx` mas em tamanho maior e cantos mais arredondados
 * (iOS aplica máscara própria, mas dar 28px de raio já dá um look polido
 * quando o sistema não mascara — ex: Android adicionar à tela).
 *
 * Next 14 detecta esse arquivo e injeta `<link rel="apple-touch-icon">`
 * automaticamente — zero código adicional no layout.
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
