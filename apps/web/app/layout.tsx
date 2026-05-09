import type { Metadata, Viewport } from 'next';

import { ThemeProvider } from '@papopro/ui';

import { Toaster } from '@/components/toaster';
import { AuthMockProvider } from '@/lib/auth/auth-mock-provider';

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
    default: 'PapoPro',
    template: '%s · PapoPro',
  },
  description: 'CRM com WhatsApp, motor de cadência e agentes IA para times de vendas consultivas.',
  applicationName: 'PapoPro',
};

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
          <AuthMockProvider>
            {children}
            <Toaster />
          </AuthMockProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
