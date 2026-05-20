import type { Metadata, Viewport } from 'next';

import { ThemeProvider } from '@papopro/ui';

import { PwaProvider } from '@/components/pwa/pwa-provider';
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
    default: 'PapoPro',
    template: '%s · PapoPro',
  },
  description: 'CRM com WhatsApp, motor de cadência e agentes IA para times de vendas consultivas.',
  applicationName: 'PapoPro',
  // PWA (M13#1) — `manifest` injeta `<link rel="manifest">`; `appleWebApp`
  // injeta as meta tags que o iOS Safari lê no "Adicionar à Tela de Início".
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'PapoPro',
    statusBarStyle: 'default',
  },
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
          {/*
           * Sem Providers de auth/workspace aqui. Sessão real Supabase é
           * gerida via cookies httpOnly (@supabase/ssr) e lida pelos hooks
           * `useUser` / helpers server-side `getCurrentUser` /
           * `getCurrentUserContext`. Workspace ativo + wizard flag vivem em
           * cookies httpOnly server-only (`papopro_workspace_id`,
           * `papopro_wizard_completed`). Sem provider envolvendo a árvore —
           * cada consumer pega o que precisa direto da fonte canônica.
           *
           * `WorkspaceMockProvider` foi removido em M7#4 Onda 3.
           *
           * `PwaProvider` (M13#1) é a exceção: registra o service worker e
           * segura o evento `beforeinstallprompt` (que dispara cedo e some).
           */}
          <PwaProvider>
            {children}
            <Toaster />
          </PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
