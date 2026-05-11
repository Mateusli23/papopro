import 'server-only';

/**
 * Cliente Resend — implementação via `fetch` nativo (M7#4 Onda 2).
 *
 * **Por que sem o SDK oficial:** o `node_modules` deste ambiente roda com
 * TLS strict que bloqueia `registry.npmjs.org` em vários cenários (mesmo
 * sintoma do `binaries.prisma.sh` em M7#1). A API REST do Resend é um único
 * `POST /emails` com JSON — escrever 30 linhas de wrapper economiza uma dep
 * e dá controle total sobre timeout/retry/parsing de erro.
 *
 * **Quando promover pro SDK:** se a gente passar de 5+ templates ou começar
 * a usar features avançadas (batch send, audiences, attachments), vale o
 * `@resend/node`. Hoje é só `sendEmail`.
 *
 * **Erros e retry:** Resend tem boas chances de transient 5xx em horários de
 * pico. `sendEmail` faz 1 retry com backoff 500ms após o primeiro fail. Não
 * fazemos mais que isso pra não bloquear a Server Action — fora do happy
 * path, a UX é "tente reenviar manualmente" (botão no /settings/team).
 *
 * **Configuração:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, opcionalmente
 * `RESEND_REPLY_TO`. Sem `RESEND_API_KEY` o cliente lança no boot — fail-fast
 * é melhor que silenciosamente não enviar email.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const RETRY_BACKOFF_MS = 500;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Texto pra clientes que não renderizam HTML (gmail no offline, anti-spam). */
  text?: string;
  /** Reply-to opcional sobrescreve o `RESEND_REPLY_TO` do env. */
  replyTo?: string;
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status?: number };

/**
 * `sendEmail` — envia 1 email transacional via Resend.
 *
 * Retorna `{ ok: true, id }` em sucesso ou `{ ok: false, error }` em falha.
 * **Não** lança erro — quem chama decide o que fazer (registrar audit log,
 * tentar de novo, mostrar UI). Resend rate limit é 100/s — improvável de
 * estourar fora de campanha em massa (M9).
 *
 * **Anti-padrão evitado:** não importamos `RESEND_API_KEY` em top-level. Server
 * Actions são bundled juntas; um throw em top-level quebra todo o bundle.
 * Lazy-read no ato da chamada concentra o erro no caller específico.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    console.error('[resend] RESEND_API_KEY ausente — email não enviado');
    return { ok: false, error: 'Email não configurado no servidor.' };
  }
  if (!from) {
    console.error('[resend] RESEND_FROM_EMAIL ausente — email não enviado');
    return { ok: false, error: 'Email não configurado no servidor.' };
  }

  const replyTo = input.replyTo ?? process.env.RESEND_REPLY_TO ?? undefined;

  const payload = {
    from,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    ...(input.text ? { text: input.text } : {}),
    // Resend aceita `reply_to` como string ou array; mandamos como array pra
    // alinhar com a doc oficial.
    ...(replyTo ? { reply_to: [replyTo] } : {}),
  };

  const attempt = async (): Promise<SendEmailResult> => {
    try {
      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        // Timeout via AbortController — Resend SLA é < 1s, 10s já é defensivo.
        signal: AbortSignal.timeout(10_000),
      });

      const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

      if (!res.ok) {
        const message = body?.message ?? `Resend respondeu ${res.status}`;
        return { ok: false, error: message, status: res.status };
      }

      if (!body?.id) {
        return { ok: false, error: 'Resend não retornou id do email.' };
      }

      return { ok: true, id: body.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido ao enviar email';
      return { ok: false, error: message };
    }
  };

  const first = await attempt();
  if (first.ok) return first;

  // Só tenta de novo em 5xx ou erro de rede (sem status). 4xx significa que
  // o payload está errado — retry não resolve.
  const transient = !first.status || first.status >= 500;
  if (!transient) return first;

  await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
  return attempt();
}
