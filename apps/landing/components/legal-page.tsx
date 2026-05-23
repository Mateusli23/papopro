import * as React from 'react';

import { LogoFull } from '@papopro/ui';

import { Footer } from './footer';

/**
 * Chrome compartilhado das páginas legais (M13#3) — `/legal/terms`,
 * `/legal/privacy`, `/legal/cookies`.
 *
 * Barra de topo mínima (só o logo, voltando pra `/`) em vez do `<Header>` da
 * landing: o Header tem links-âncora (`#funcionalidades`) que não resolvem
 * fora da home. O `<Footer>` é reusado — seus links de produto já são
 * absolutos (`/#secao`).
 *
 * Server Component — conteúdo legal é HTML estático.
 */

/** Data única de "última atualização" das três páginas legais. */
export const LEGAL_UPDATED_AT = '20 de maio de 2026';

/**
 * Sinaliza ao usuário final que o conteúdo legal está em revisão jurídica.
 * Desligar (`draft={false}`) somente após a revisão de um advogado para o
 * trial público. Banner é defense-in-depth pro disclaimer JSDoc presente em
 * `terms/privacy/cookies/page.tsx` (que o usuário final não vê).
 */
const LEGAL_DRAFT_DEFAULT = true;

interface LegalPageProps {
  title: string;
  /** Data de última revisão (use `LEGAL_UPDATED_AT`). */
  updatedAt: string;
  /** Se `true` (default), exibe banner avisando que o conteúdo está em revisão. */
  draft?: boolean;
  children: React.ReactNode;
}

export function LegalPage({
  title,
  updatedAt,
  draft = LEGAL_DRAFT_DEFAULT,
  children,
}: LegalPageProps) {
  return (
    <>
      <header className="border-border bg-background border-b">
        <div className="container mx-auto flex h-16 items-center">
          <a
            href="/"
            aria-label="Voltar para a página inicial"
            className="focus-visible:ring-ring rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <LogoFull size={24} />
          </a>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12 md:py-16">
        <h1 className="text-foreground text-3xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-caption mt-2">Última atualização: {updatedAt}</p>
        {draft ? (
          <div
            role="note"
            className="border-warning/40 bg-warning/10 text-foreground text-body mt-6 rounded-md border p-4"
          >
            <strong className="text-foreground">Versão preliminar.</strong> Este texto está em
            revisão jurídica e pode ser atualizado antes do lançamento público. Em caso de dúvida,
            fale com{' '}
            <a
              href="mailto:privacidade@pipeflow.com.br"
              className="text-primary underline underline-offset-2"
            >
              privacidade@pipeflow.com.br
            </a>
            .
          </div>
        ) : null}
        <div className="mt-8 flex flex-col gap-8">{children}</div>
      </main>

      <Footer />
    </>
  );
}

interface LegalSectionProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Seção de uma página legal — `<h2>` + corpo. Estiliza os elementos filhos
 * (`<p>`, `<ul>`, `<a>`) via arbitrary variants pra que as páginas escrevam
 * HTML semântico puro, sem repetir classes.
 */
export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-foreground text-xl font-semibold">{title}</h2>
      <div className="text-body [&_a]:text-primary [&_li]:text-muted-foreground [&_p]:text-muted-foreground [&_strong]:text-foreground flex flex-col gap-3 [&_a]:underline [&_a]:underline-offset-2 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
