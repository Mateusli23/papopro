/**
 * Tailwind preset compartilhado do PapoPro.
 *
 * Princípio: nenhum hex pode aparecer em componente — só aqui (e em
 * `packages/ui/styles/tokens.css`, que define as CSS vars usadas abaixo).
 *
 * Cores são referenciadas via CSS custom properties (formato HSL sem o `hsl()`)
 * pra suportar dark mode "de primeira classe" (CLAUDE.md §8) — um toggle de
 * `class="dark"` no `<html>` troca todos os tokens.
 *
 * Paleta canônica (light) em [CLAUDE.md §8]:
 *   primary #367BEC · accent #FFB715 · foreground #0F1C3E · muted #F1F5F9
 *   success #10B981 · warning #F59E0B · destructive #EF4444 · info #3B82F6
 *
 * `accent` é amarelo decorativo (CTAs, microcaixas, BrandArcs); `warning` é
 * estado semântico (lead morno) — não confundir.
 */
import type { Config } from 'tailwindcss';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — sem tipos no pacote, mas é o plugin oficial do shadcn.
import animate from 'tailwindcss-animate';

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
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },

        // Texto e fundos
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // Status semânticos (CLAUDE.md §8)
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },

        // Superfícies
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
        },

        // Temperatura de lead (alias semântico do trio success/warning/destructive)
        lead: {
          hot: 'hsl(var(--success))',
          warm: 'hsl(var(--warning))',
          cold: 'hsl(var(--destructive))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
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
        18: '4.5rem',
        sidebar: '240px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.05)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
} satisfies Partial<Config>;

export default preset;
