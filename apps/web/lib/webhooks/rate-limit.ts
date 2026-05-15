import 'server-only';

/**
 * Rate-limit in-memory simples por chave (M8#5 webhook `/api/webhooks/leads/[token]`).
 *
 * **Por que in-memory:** o webhook é "lead chegou via Zapier/Make/N8N";
 * volume MVP cabe num único worker Node. Quando o produto crescer pra
 * múltiplas instâncias Vercel ou pra um adapter Cloudflare Workers, a gente
 * promove pra Redis/Upstash via mesma assinatura.
 *
 * **Bucket por chave:** `{ count, resetAt }`. Cada chamada incrementa `count`.
 * Se `now > resetAt`, reseta o bucket. Excedeu `limit` → retorna `retryAfterMs`.
 *
 * **Cleanup:** buckets expirados são limpos preguiçosamente — a próxima
 * chamada na mesma key reseta. Pra evitar growth ilimitado se tokens
 * espalham e somem, o `cleanupExpired()` é exposto pra ser chamado
 * periodicamente (TODO M8#7+).
 *
 * **Tests:** versão pura `checkRateLimitPure` recebe `Map` externo + `now`
 * injetável — usada no smoke test sem mexer no estado global.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

export function checkRateLimit(key: string, limit = 100, windowMs = 60_000): RateLimitResult {
  return checkRateLimitPure(buckets, key, Date.now(), limit, windowMs);
}

export function checkRateLimitPure(
  store: Map<string, Bucket>,
  key: string,
  now: number,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const bucket = store.get(key);
  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterMs: Math.max(bucket.resetAt - now, 0) };
  }
  bucket.count += 1;
  return { ok: true };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

export function cleanupExpired(now: number = Date.now()): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}
