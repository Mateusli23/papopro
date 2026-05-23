import type { Metadata, Viewport } from 'next';

import { ThemeProvider } from '@papopro/ui';

import { AnalyticsGate } from '@/components/analytics-gate';
import { CookieBanner } from '@/components/cookie-banner';
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

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://pipeflow.com.br';

/*
 * Metadata expandido pra SEO (M6#3). Next 14 cuida sozinho da geração de:
 *  - `<title>` e `<meta name="description">` no <head>
 *  - Open Graph tags (apontando pra `opengraph-image.tsx`)
 *  - Twitter Card tags
 *  - `<link rel="icon">` apontando pra `icon.tsx`
 *  - `<link rel="apple-touch-icon">` apontando pra `apple-icon.tsx`
 *  - `<link rel="canonical">` via `metadataBase` + `alternates`
 *
 * `verification` está com placeholders — preencher antes do go-live em M13
 * com os tokens dos painéis Google Search Console / Bing Webmaster.
 */
export const metadata: Metadata = {
  metadataBase: new URL(LANDING_URL),
  title: {
    default: 'PapoPro — CRM com WhatsApp, cadência automática e IA',
    template: '%s · PapoPro',
  },
  description:
    'CRM brasileiro pra times de vendas consultivas que vivem no WhatsApp. Motor de cadência, alertas de lead frio, agentes IA e caixa unificada com camada anti-bloqueio.',
  applicationName: 'PapoPro',
  keywords: [
    'CRM',
    'WhatsApp Business',
    'cadência de vendas',
    'agentes IA',
    'pipeline de vendas',
    'kanban de vendas',
    'CRM brasileiro',
    'CRM WhatsApp',
    'CRM SMB',
    'vendas consultivas',
  ],
  authors: [{ name: 'PapoPro' }],
  creator: 'PapoPro',
  publisher: 'PapoPro',
  category: 'business software',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: LANDING_URL,
    siteName: 'PapoPro',
    title: 'PapoPro — CRM com WhatsApp, cadência automática e IA',
    description:
      'O CRM brasileiro pra times que vivem no WhatsApp. Pare de perder lead por esquecer de dar follow-up.',
    // OG image vem de `opengraph-image.tsx` automaticamente.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PapoPro — CRM com WhatsApp, cadência automática e IA',
    description:
      'O CRM brasileiro pra times que vivem no WhatsApp. Pare de perder lead por esquecer de dar follow-up.',
    // Twitter image vem de `opengraph-image.tsx` (compartilhado com OG).
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  verification: {
    // Preencher em M13 antes do go-live público:
    // google: 'token-do-google-search-console',
    // other: { 'msvalidate.01': 'token-do-bing' },
  },
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
          {/*
           * Banner de consentimento de cookies (M13#3 — LGPD). Fixo no rodapé
           * até o visitante decidir.
           */}
          <CookieBanner />
        </ThemeProvider>
        {/*
         * AnalyticsGate no fim do body: só injeta os trackers (PostHog/GA4/
         * Meta) depois do consentimento do visitante (LGPD). Cada provider
         * ainda é condicionado a env — em dev sem chaves nada é renderizado.
         */}
        <AnalyticsGate />
      </body>
    </html>
  );
}
