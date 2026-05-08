/**
 * Tailwind preset compartilhado do PapoPro (placeholder de M1).
 *
 * M1 expõe apenas os tokens semânticos (cores, radius, fontes) via valores estáticos
 * pra desbloquear o consumo nos apps. M2 substitui por CSS custom properties com
 * dark mode de primeira classe (paleta de [CLAUDE.md §8]) e adiciona o plugin
 * `tailwindcss-animate`.
 *
 * Regra do projeto: nenhum hex pode aparecer em componente — só aqui no preset.
 */
import type { Config } from 'tailwindcss';

const preset = {
  darkMode: ['class'],
  content: [],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Marca
        primary: {
          DEFAULT: '#4F46E5',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#6C5CE7',
          foreground: '#FFFFFF',
        },

        // Texto e fundos
        foreground: '#0F172A',
        background: '#FFFFFF',
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#475569',
        },
        border: '#E2E8F0',
        input: '#E2E8F0',
        ring: '#4F46E5',

        // Status (semânticos)
        success: {
          DEFAULT: '#10B981',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#F59E0B',
          foreground: '#0F172A',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        info: {
          DEFAULT: '#3B82F6',
          foreground: '#FFFFFF',
        },

        // Card / popover (necessários pro shadcn/ui em M2)
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
        },

        // Temperatura de lead
        lead: {
          hot: '#10B981',
          warm: '#F59E0B',
          cold: '#EF4444',
        },
      },
      borderRadius: {
        lg: '12px',
        md: '10px',
        sm: '8px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Tipografia CLAUDE.md §8
        caption: ['12px', { lineHeight: '16px', fontWeight: '500' }],
        body: ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        title: ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'title-lg': ['24px', { lineHeight: '32px', fontWeight: '600' }],
      },
      spacing: {
        // Múltiplos de 4px (CLAUDE.md §8)
        '18': '4.5rem',
        sidebar: '240px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.05)',
      },
    },
  },
  plugins: [],
} satisfies Partial<Config>;

export default preset;
