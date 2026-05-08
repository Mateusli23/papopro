/**
 * Página raiz do produto — placeholder de M1.
 *
 * M3 substitui pelo redirect do middleware (logado → /dashboard, senão → /login)
 * e pelas telas reais de auth e dashboard.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6 py-16">
      <span className="bg-primary/10 text-caption text-primary rounded-full px-3 py-1">
        M1 — Setup do monorepo
      </span>
      <h1 className="text-title-lg">PapoPro · web</h1>
      <p className="text-body-lg text-muted-foreground">
        Esqueleto pronto. Próximas telas (auth, dashboard, leads, kanban, inbox) chegam a partir de
        M3 conforme o plano de execução.
      </p>
      <ul className="text-body text-muted-foreground flex flex-col gap-2">
        <li>
          <code className="bg-muted rounded px-1.5 py-0.5">pnpm dev</code> sobe esse app na porta
          3000.
        </li>
        <li>
          <code className="bg-muted rounded px-1.5 py-0.5">pnpm lint</code> e{' '}
          <code className="bg-muted rounded px-1.5 py-0.5">pnpm typecheck</code> rodam em todos os
          pacotes.
        </li>
      </ul>
    </main>
  );
}
