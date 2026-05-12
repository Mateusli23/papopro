import 'server-only';

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/**
 * Outbox file-based — modo de teste do cliente Resend (M7#6).
 *
 * **Por quê:** Playwright E2E precisa interceptar emails enviados pelo
 * fluxo de convite sem disparar Resend real (consome cota + spam pro
 * destinatário). Mockar `fetch` via `page.route()` não funciona porque
 * o `sendEmail()` roda **server-side** dentro de uma Server Action —
 * fora do escopo do browser context do Playwright.
 *
 * **Solução:** quando `process.env.RESEND_MODE === 'outbox'`,
 * `sendEmail()` desvia o payload pra um arquivo JSONL local em vez de
 * tocar HTTP. Specs leem o arquivo, extraem o magic link, prosseguem
 * com o fluxo de aceite. Fora desse modo (dev/prod) o arquivo nunca é
 * tocado — comportamento normal.
 *
 * **Por que JSONL e não JSON:** múltiplos emails podem ser enviados em
 * sequência (Owner convida 2 pessoas no mesmo spec). Append é simples
 * com JSONL; em JSON puro daria parse + rewrite a cada call.
 *
 * **Caminho:** `apps/web/e2e/.tmp/outbox.jsonl` (gitignored em [.gitignore]).
 * Hardcoded propositalmente — env var customizando o path adiciona vetor
 * de "alguém setou RESEND_MODE=outbox em prod com path apontado pra /tmp/
 * world-readable e vazou tokens de convite". Modo outbox é estritamente
 * teste local.
 *
 * **Defense in depth:** mesmo com `RESEND_MODE=outbox` em produção
 * (cenário de bug de operador), os tokens de convite têm TTL 7d e cada
 * envio sucessivo regenera token só em re-invite pós-revoke — risco
 * residual baixo. Ainda assim, comentário no SETUP.md grita que
 * `RESEND_MODE` deve ficar UNSET em prod.
 */

export interface OutboxEntry {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** ISO 8601 timestamp do momento do envio. */
  sentAt: string;
  /** Id sintético retornado pelo `sendEmail` mock — formato `outbox-<uuid>`. */
  id: string;
}

const OUTBOX_REL_PATH = 'e2e/.tmp/outbox.jsonl';

function resolveOutboxPath(): string {
  // `cwd()` no contexto do Next dev server é a raiz do `apps/web`. Em
  // CI ou outras config esse pressuposto pode quebrar; daí o `path.resolve`
  // explícito + log de erro silente em `writeOutbox` se o write falhar.
  return path.resolve(process.cwd(), OUTBOX_REL_PATH);
}

/**
 * `writeOutbox` — anexa 1 entrada ao outbox JSONL. Cria o diretório
 * se não existir. Falha silente (apenas console.error) — não queremos
 * que um erro de filesystem quebre o fluxo do `sendEmail()` mockado.
 */
export async function writeOutbox(entry: Omit<OutboxEntry, 'sentAt' | 'id'>): Promise<
  | {
      ok: true;
      id: string;
    }
  | { ok: false; error: string }
> {
  const id = `outbox-${randomUUID()}`;
  const full: OutboxEntry = {
    ...entry,
    sentAt: new Date().toISOString(),
    id,
  };

  try {
    const filePath = resolveOutboxPath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(full)}\n`, 'utf8');
    return { ok: true, id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[outbox] writeOutbox failed (non-fatal in test mode)', msg);
    return { ok: false, error: msg };
  }
}

/**
 * `readOutbox` — lê todas as entradas no JSONL. Retorna `[]` se o
 * arquivo não existir (estado "ainda nenhum envio neste spec").
 */
export async function readOutbox(): Promise<OutboxEntry[]> {
  try {
    const filePath = resolveOutboxPath();
    const content = await fs.readFile(filePath, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as OutboxEntry);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return [];
    }
    console.error('[outbox] readOutbox failed', err);
    return [];
  }
}

/**
 * `clearOutbox` — apaga o JSONL inteiro. Chamado por fixtures Playwright
 * em `beforeEach` pra garantir estado limpo entre specs.
 */
export async function clearOutbox(): Promise<void> {
  try {
    const filePath = resolveOutboxPath();
    await fs.unlink(filePath);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return;
    }
    console.error('[outbox] clearOutbox failed', err);
  }
}

/**
 * `isOutboxMode` — helper canônico pra checar se estamos em modo teste.
 * Centraliza a regra pra `sendEmail()` e specs não divergirem.
 */
export function isOutboxMode(): boolean {
  return process.env.RESEND_MODE === 'outbox';
}
