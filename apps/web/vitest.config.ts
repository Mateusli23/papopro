import path from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Vitest config para unit tests de domínio em `apps/web`.
 *
 * Cobertura inicial (M10 followup): transforms puras e schemas Zod do feature
 * `cadences`. E2E (Playwright) continua em `e2e/` rodando via `pnpm e2e`.
 *
 * Escolhas:
 *  - `environment: 'node'` — transforms são JS puro; sem JSDOM dá testes 3-5x
 *    mais rápidos e remove dependência de DOM polyfill.
 *  - `include` restrito a `**\/*.test.{ts,tsx}` dentro de `features/` e `lib/`
 *    pra não colidir com Playwright em `e2e/**`.
 *  - Alias `@` espelha `tsconfig.paths` (`@/foo` → `apps/web/foo`).
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['features/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
    reporters: 'default',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
