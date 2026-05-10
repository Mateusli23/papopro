import { ImageResponse } from 'next/og';

/**
 * Imagem Open Graph (1200×630) gerada em runtime via `next/og`. Aparece
 * quando alguém compartilha `pipeflow.com.br` em WhatsApp, Twitter/X,
 * LinkedIn, Facebook, Slack, Discord etc.
 *
 * Por que dinâmica e não PNG estático no `public/`:
 *  - Tokens do design system funcionam aqui (CSS-in-JS via `style`).
 *  - Zero asset binário no repo — alterar copy = alterar TSX, não Figma.
 *  - Performance: Next cacheia o output, então o custo de gerar acontece
 *    uma vez por deploy.
 *
 * Limitações do `next/og` (importante saber):
 *  - **Sem Tailwind**: usar `style` inline (Satori não suporta classes).
 *  - **Fontes**: Poppins não carrega automático — uso `system-ui` que dá
 *    boa renderização em todos os OSes. Se virar problema, adicionar
 *    `fetch` da Poppins via `fetch('@fontsource/poppins/files/...')`.
 *  - **Cores como hex**: o componente roda fora do contexto CSS do app,
 *    então tokens via `hsl(var(--primary))` não resolvem. Hardcoding os
 *    valores canônicos (CLAUDE.md §8) — qualquer alteração de paleta
 *    precisa refletir aqui também.
 */

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'PapoPro — CRM com WhatsApp, cadência automática e IA';

// Paleta CLAUDE.md §8 (light mode — OG é universal, não respeita dark)
const COLORS = {
  background: '#FFFFFF',
  foreground: '#0F1C3E',
  primary: '#367BEC',
  accent: '#FFB715',
  muted: '#475569',
} as const;

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px',
        background: COLORS.background,
        backgroundImage: `radial-gradient(circle at 90% 10%, ${COLORS.accent}33 0%, transparent 50%), radial-gradient(circle at 10% 90%, ${COLORS.primary}26 0%, transparent 50%)`,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Logo + wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            background: COLORS.primary,
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: '32px',
            fontWeight: 700,
          }}
        >
          P
        </div>
        <span
          style={{
            fontSize: '36px',
            fontWeight: 600,
            color: COLORS.foreground,
            letterSpacing: '-0.02em',
          }}
        >
          PapoPro
        </span>
      </div>

      {/* Headline + sub */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1
          style={{
            fontSize: '76px',
            lineHeight: 1.05,
            fontWeight: 700,
            color: COLORS.foreground,
            margin: 0,
            letterSpacing: '-0.03em',
            maxWidth: '900px',
          }}
        >
          Pare de perder lead por{' '}
          <span style={{ color: COLORS.primary }}>esquecer de dar follow-up</span>.
        </h1>
        <p
          style={{
            fontSize: '28px',
            lineHeight: 1.3,
            color: COLORS.muted,
            margin: 0,
            maxWidth: '900px',
          }}
        >
          CRM brasileiro com WhatsApp, cadência automática e agentes IA — em um produto só.
        </p>
      </div>

      {/* Footer com chips de feature */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {['Kanban', 'WhatsApp', 'Agentes IA', 'Cadência'].map((label) => (
          <span
            key={label}
            style={{
              fontSize: '22px',
              fontWeight: 500,
              color: COLORS.foreground,
              background: '#F1F5F9',
              padding: '10px 20px',
              borderRadius: '999px',
            }}
          >
            {label}
          </span>
        ))}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '22px',
            fontWeight: 600,
            color: COLORS.primary,
          }}
        >
          pipeflow.com.br
        </span>
      </div>
    </div>,
    { ...size },
  );
}
