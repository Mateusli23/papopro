/**
 * Sentry server config — M7#6 (Frente B, "cirúrgico").
 *
 * **Escopo intencionalmente mínimo:**
 *  - Só runtime Node.js (sem client.config / edge.config separados).
 *  - Sem `withSentryConfig` em `next.config.mjs` (sem source map upload —
 *    operador roda `pnpm build` sem precisar de `SENTRY_AUTH_TOKEN`).
 *  - Sem tracing (custo paid; só error capture).
 *  - Sem replays (paid; sensível a LGPD).
 *
 * **Valor entregue:** os 11 `console.error('[scope] message', err)`
 * non-fatal de Server Actions (audit log fail, email fail, slug exhausted,
 * transaction fail) viram alerts no Sentry com stack trace + contexto.
 * Sem isso, operador precisa varrer Vercel logs manualmente.
 *
 * **DSN vazio em dev = no-op silente.** `Sentry.init` sem DSN nem registra
 * o cliente — chamadas a `captureException` são no-op. Operador popula
 * `NEXT_PUBLIC_SENTRY_DSN_WEB` no Vercel antes do release.
 *
 * **Por que `NEXT_PUBLIC_` no server:** essa var já existe em
 * `.env.local.example` (provisionada em M2 pro futuro Sentry). DSN é
 * tecnicamente seguro pra expor — é um identificador público com rate
 * limits do lado do Sentry. Reusar a var existente em vez de criar mais
 * uma `SENTRY_DSN` server-side mantém o env enxuto.
 */
import * as Sentry from '@sentry/nextjs';

import { scrubPiiFromEvent } from './lib/observability/scrubber';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_WEB;

if (dsn) {
  Sentry.init({
    dsn,
    // M7#6 não usa tracing — só error capture. tracesSampleRate=0 evita
    // qualquer envio de spans/transactions (que custam separado no plano
    // Sentry e adicionam overhead).
    tracesSampleRate: 0,
    // Captura de release vincula errors ao deploy específico via Git SHA
    // (Vercel injeta VERCEL_GIT_COMMIT_SHA). Útil pra "esse erro saiu no
    // deploy de DD-mai".
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    // Scrubber LGPD — strip de password/token/email/service_role_key antes
    // de qualquer event chegar nos servidores Sentry. Defense in depth
    // contra leak de PII via stack trace ou breadcrumbs.
    beforeSend: scrubPiiFromEvent,
    // Captura console.error como breadcrumb (já tinha sido a UX antes do
    // Sentry — preservar). Não envia como evento separado.
    integrations: [],
  });
}
