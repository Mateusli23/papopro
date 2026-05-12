/**
 * Next.js instrumentation hook (App Router) — M7#6.
 *
 * **Como funciona:** Next chama `register()` uma única vez no boot de
 * cada runtime (Node.js, Edge). Aqui carregamos só o config server-side
 * (`sentry.server.config.ts`) condicional ao runtime, evitando puxar a
 * SDK pesada pro Edge sem necessidade.
 *
 * **Por que `await import` (dinâmico):** o `sentry.server.config.ts` faz
 * `Sentry.init()` no top-level — importar estaticamente força a inicialização
 * em build-time, quebrando `pnpm build` em ambientes sem DSN. Dynamic import
 * roda só em runtime, depois do env estar populado.
 *
 * **Edge runtime:** sem config dedicado por enquanto. Middleware (auth gate)
 * e Edge routes não passam erros pelos `console.error` de Server Actions
 * que `lib/observability/report.ts` cobre. Se ficar precisando, adicionar
 * `sentry.edge.config.ts` em uma onda futura.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}

/**
 * Hook obrigatório do `@sentry/nextjs@^9+` pra capturar erros lançados
 * em React Server Components. Sem isso, RSC errors caem silenciosos.
 * Re-exporta `captureRequestError` da SDK; Next chama automaticamente.
 */
export { captureRequestError as onRequestError } from '@sentry/nextjs';
