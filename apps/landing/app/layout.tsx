import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'PapoPro — CRM com WhatsApp, cadência automática e IA',
    template: '%s · PapoPro',
  },
  description:
    'CRM brasileiro pra times de vendas consultivas que vivem no WhatsApp. Motor de cadência, alertas de lead frio, agentes IA e caixa unificada com camada anti-bloqueio.',
  applicationName: 'PapoPro',
};

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
