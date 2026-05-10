import type { Metadata, Viewport } from 'next';

import { ThemeProvider } from '@papopro/ui';

import { Toaster } from '@/components/toaster';

import './globals.css';

/*
 * Tipografia: Poppins (CLAUDE.md §8) carregada via `@fontsource/poppins` em
 * `globals.css` (pesos 400/500/600/700). A escolha de `@fontsource` em vez de
 * `next/font/google` é deliberada: a build em rede com TLS strict não acessa
 * `fonts.googleapis.com`. `@fontsource` distribui a fonte como pacote npm,
 * funciona offline e mantém zero CLS via `font-display: swap` interno.
 *
 * `--font-sans` é definida em `globals.css` (no :root) e referenciada pelo
 * preset Tailwind em `font-sans`.
 */

export const metadata: Metadata = {
  title: {
    default: 'PapoPro — CRM com WhatsApp, cadência automática e IA',
    template: '%s · PapoPro',
  },
  description:
    'CRM brasileiro pra times de vendas consultivas que vivem no WhatsApp. Motor de cadência, alertas de lead frio, agentes IA e caixa unificada com camada anti-bloqueio.',
  applicationName: 'PapoPro',
};

/*
 * `themeColor` casa com o `--background` dos tokens em light/dark. O browser
 * usa pra colorir a barra de status mobile (Chrome Android, Safari iOS), e
 * a transição entre web e PWA fica invisível.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0F1C' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
