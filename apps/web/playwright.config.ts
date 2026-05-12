import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — M7#6 (Frente A).
 *
 * **Escopo:** 3 specs ponta-a-ponta cobrindo o fluxo crítico de auth +
 * convite + gestão de time. Substitui os smoke tests `/api/smoke-test/*`
 * pra validar o fluxo real no browser, não só helpers/transforms puros.
 *
 * **webServer:** sobe `pnpm dev` automaticamente. Em CI, `reuseExistingServer`
 * é `false` pra forçar uma instância fresca; localmente, reusa se já estiver
 * rodando (mais rápido pra debug).
 *
 * **fullyParallel: false:** os 3 specs assumem ordem (signup → invite →
 * team) compartilhando o mesmo projeto Supabase E2E. Paralelizar exigiria
 * fixtures isoladas por spec — fica pra polimento se virar gargalo.
 *
 * **Single project (chromium):** cobertura firefox/webkit fica pra
 * polimento. Beachhead do produto (vendedores SMB Brasil) usa
 * majoritariamente Chrome — começamos por onde dói mais.
 *
 * **Variáveis de ambiente necessárias** (ver `docs/SETUP.md` §"Rodar E2E"):
 * - `RESEND_MODE=outbox` — desvia emails Resend pro arquivo local.
 * - `E2E_SUPABASE_URL` / `E2E_SUPABASE_SERVICE_ROLE_KEY` — projeto
 *   Supabase dedicado pra testes (NÃO o de produção).
 * - `E2E_BASE_URL` (opcional, default `http://localhost:3000`).
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/helpers/**', '**/.tmp/**'],

  // Ordem determinística — specs compartilham estado de banco entre si.
  fullyParallel: false,
  workers: 1,

  // CI: nenhuma retry (queremos failure determinístico). Local: 1 retry
  // pra tolerar flakes raros de timing do Next dev server.
  retries: process.env.CI ? 0 : 1,

  timeout: 60_000,
  expect: { timeout: 5_000 },

  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Encaminha env vars do shell de quem chamou `pnpm e2e` pro Next dev
    // (RESEND_MODE, E2E_SUPABASE_*, SUPABASE_*, DATABASE_URL, etc.).
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
