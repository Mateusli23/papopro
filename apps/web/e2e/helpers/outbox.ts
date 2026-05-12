import { readOutbox, clearOutbox, type OutboxEntry } from '../../lib/email/outbox';

/**
 * Helpers de leitura do Resend outbox pelos specs Playwright (M7#6).
 *
 * Wrapping fino sobre `lib/email/outbox.ts` (server-side) adicionando:
 *  - `waitForEmail(predicate, options)` — polling até timeout, retorna
 *    primeiro match.
 *  - `extractInviteToken(html)` — parseia link `/invite/accept?token=…`
 *    do HTML do email de convite.
 *
 * **Por que esses helpers vivem em `e2e/helpers/`:** `lib/email/outbox.ts`
 * é o lado server (escrita); `e2e/helpers/outbox.ts` é o lado test
 * (leitura + parsing). Mantemos os dois separados pra deixar claro
 * que o módulo server não importa Playwright e o módulo test não
 * importa `server-only`.
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_INTERVAL_MS = 100;

export interface WaitForEmailOptions {
  /** Timeout em ms. Default 10s. */
  timeoutMs?: number;
  /** Intervalo de polling em ms. Default 100ms. */
  pollIntervalMs?: number;
}

/**
 * `waitForEmail` — polling do outbox até `predicate(entry)` retornar true
 * em alguma entry. Útil pra "espera o email de convite chegar pro user X".
 *
 * Lança se timeout estourar — spec falha com mensagem clara.
 */
export async function waitForEmail(
  predicate: (entry: OutboxEntry) => boolean,
  options: WaitForEmailOptions = {},
): Promise<OutboxEntry> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS } = options;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const entries = await readOutbox();
    const match = entries.find(predicate);
    if (match) return match;
    await sleep(pollIntervalMs);
  }

  // Diagnóstico no timeout: lista todos os emails no outbox pra ajudar
  // a debugar "esperei email pro X@example.com mas só tem emails pra Y".
  const all = await readOutbox();
  const summary = all.map((e) => `  - ${e.to}: ${e.subject}`).join('\n') || '  (outbox vazio)';
  throw new Error(
    `waitForEmail: predicate não satisfeita em ${timeoutMs}ms. Outbox atual:\n${summary}`,
  );
}

/**
 * `waitForEmailTo` — atalho comum: "espera email pra `email`". Retorna
 * o último (mais recente) caso múltiplos satisfaçam o filtro.
 */
export async function waitForEmailTo(
  email: string,
  options: WaitForEmailOptions = {},
): Promise<OutboxEntry> {
  const target = email.toLowerCase().trim();
  return waitForEmail((entry) => entry.to.toLowerCase() === target, options);
}

/**
 * `extractInviteToken` — parseia o link `/invite/accept?token=…` do HTML
 * do email de convite. Retorna só o token (UUID), não a URL completa,
 * pra spec poder construir URLs com baseURL próprio.
 *
 * Regex tolerante a:
 *  - encode parcial (`&amp;` em vez de `&`)
 *  - URL absoluta vs relativa
 *  - aspas duplas ou simples no `href`
 */
export function extractInviteToken(html: string): string {
  const match = html.match(/\/invite\/accept\?(?:amp;)?token=([0-9a-f-]{36})/i);
  if (!match) {
    throw new Error(
      `extractInviteToken: link /invite/accept?token=<uuid> não encontrado no HTML.\n` +
        `Primeiros 500 chars: ${html.slice(0, 500)}`,
    );
  }
  return match[1]!;
}

/**
 * `extractInviteUrl` — variante que retorna a URL completa do magic link.
 * Útil quando o spec navega via `page.goto(url)` direto.
 */
export function extractInviteUrl(html: string): string {
  const match = html.match(/href="([^"]*?\/invite\/accept\?[^"]*token=[0-9a-f-]{36}[^"]*)"/i);
  if (!match) {
    throw new Error(
      `extractInviteUrl: href com /invite/accept?token=… não encontrado.\n` +
        `Primeiros 500 chars: ${html.slice(0, 500)}`,
    );
  }
  // Decodifica `&amp;` → `&` (HTML entity escaping comum em templates).
  return match[1]!.replace(/&amp;/g, '&');
}

export { clearOutbox, readOutbox };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
