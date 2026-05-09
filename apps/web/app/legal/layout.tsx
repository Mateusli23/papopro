import Link from 'next/link';

import { LogoFull, ThemeToggle } from '@papopro/ui';

/**
 * Layout das páginas legais — placeholder até o conteúdo definitivo de
 * Termos e Política de Privacidade entrar no M13.
 *
 * Mínimo: header com logo + toggle de tema, conteúdo centralizado, footer
 * com data de atualização. Sem `BrandArcs` aqui — superfícies legais devem
 * priorizar legibilidade, não decoração.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" aria-label="PapoPro">
            <LogoFull />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto flex flex-1 px-4 py-12 sm:px-6">
        <article className="mx-auto w-full max-w-3xl">{children}</article>
      </main>

      <footer className="border-border text-muted-foreground border-t">
        <div className="text-caption container mx-auto px-4 py-6 sm:px-6">
          © {new Date().getFullYear()} PapoPro · Documentos atualizados periodicamente.
        </div>
      </footer>
    </div>
  );
}
