import 'server-only';

import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  hkdfSync,
  randomBytes,
  sign as cryptoSign,
} from 'node:crypto';

/**
 * Web Push hand-rolled (M13#2) — VAPID (RFC 8292) + criptografia de payload
 * `aes128gcm` (RFC 8291 + RFC 8188), 100% com `node:crypto`.
 *
 * **Por que sem o pacote `web-push`:** mesma decisão do service worker do
 * M13#1 e do cliente Resend (`lib/email/resend.ts`) — instalar dependência
 * nova nessa máquina tem fricção de antivírus/TLS, e o `node:crypto` cobre
 * tudo: ECDH P-256, HKDF-SHA256, AES-128-GCM e assinatura ES256. ~120 linhas
 * auditáveis valem mais que a dep.
 *
 * **Roda no Node runtime** (Server Action / Route Handler `runtime = 'nodejs'`)
 * — `node:crypto` não existe no Edge runtime.
 *
 * **Fluxo de uma entrega:**
 *  1. `buildVapidJwt` — JWT ES256 assinado com a chave privada VAPID.
 *  2. `encryptPayload` — gera par ECDH efêmero, deriva CEK/nonce e cifra o
 *     JSON com AES-128-GCM no formato `aes128gcm` (header + 1 record).
 *  3. POST pro endpoint do push service. 404/410 = subscription morta.
 *
 * **Config:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
 * `VAPID_SUBJECT`. Gere o par com `node scripts/generate-vapid.mjs --env`.
 */

/** Subscription persistida (espelha `push_subscriptions`). */
export interface WebPushSubscription {
  endpoint: string;
  /** Chave pública ECDH do browser, base64url (ponto não-comprimido, 65B). */
  p256dh: string;
  /** Segredo de autenticação do browser, base64url (16B). */
  auth: string;
}

/** Payload que o service worker recebe no evento `push` (ver `public/sw.js`). */
export interface WebPushPayload {
  title: string;
  body: string;
  /** Deep-link aberto no `notificationclick`. */
  url?: string;
  /** Agrupa notificações — uma `tag` igual substitui a anterior. */
  tag?: string;
}

export type WebPushResult =
  | { ok: true; status: number }
  /** `expired: true` → 404/410: a subscription morreu, o caller deve apagá-la. */
  | { ok: false; status: number; expired: boolean; error: string };

const DEFAULT_TTL_SECONDS = 86_400; // 24h — notificação operacional perde valor depois.
const RECORD_SIZE = 4096;
const REQUEST_TIMEOUT_MS = 10_000;

/** Há chaves VAPID configuradas? Usado pra degradar sem quebrar (UI/smoke). */
export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );
}

/**
 * `sendWebPush` — entrega 1 push criptografado. Nunca lança: retorna
 * `{ ok: false, expired }` em qualquer falha pra o caller decidir (apagar a
 * subscription expirada, logar, seguir).
 */
export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: WebPushPayload,
  options: { ttlSeconds?: number } = {},
): Promise<WebPushResult> {
  if (!isWebPushConfigured()) {
    return { ok: false, status: 0, expired: false, error: 'vapid_not_configured' };
  }

  let payloadBody: Buffer;
  let jwt: string;
  try {
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    payloadBody = encryptPayload(subscription, plaintext);
    jwt = signVapidJwt({
      audience: new URL(subscription.endpoint).origin,
      vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY!,
      subject: process.env.VAPID_SUBJECT!,
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      expired: false,
      error: err instanceof Error ? err.message : 'encrypt_failed',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(options.ttlSeconds ?? DEFAULT_TTL_SECONDS),
      },
      // Cópia em Uint8Array sobre ArrayBuffer "puro" — `Buffer<ArrayBufferLike>`
      // não casa com o tipo `BodyInit` do `fetch`.
      body: new Uint8Array(payloadBody),
      signal: controller.signal,
    });

    if (res.ok) return { ok: true, status: res.status };

    // 404/410 — endpoint morto (browser desinstalado, permissão revogada).
    const expired = res.status === 404 || res.status === 410;
    return {
      ok: false,
      status: res.status,
      expired,
      error: expired ? 'subscription_expired' : `push_service_${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      expired: false,
      error: err instanceof Error ? err.message : 'network_error',
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── VAPID JWT (RFC 8292) ───────────────────────────────────────────────────

export interface VapidJwtParams {
  /** Origem do push service (`aud` do JWT). */
  audience: string;
  /** Chave pública VAPID base64url (`0x04 || X || Y`, 65B). */
  vapidPublicKey: string;
  /** Chave privada VAPID base64url (`D`, 32B). */
  vapidPrivateKey: string;
  /** `mailto:` ou URL de contato (`sub` do JWT). */
  subject: string;
}

/**
 * Monta um JWT ES256 assinado com a chave privada VAPID. `aud` é a origem do
 * push service; `exp` máx 24h (usamos 12h). Parametrizado (sem ler `env`) pra
 * ser exercitável no smoke test com um par de chaves gerado na hora.
 */
export function signVapidJwt(params: VapidJwtParams): string {
  const header = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        aud: params.audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: params.subject,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;

  // Chave privada VAPID = D (32B raw, base64url). Reconstruímos o JWK com
  // x/y extraídos da chave pública (`0x04 || X || Y`, 65B) pra o `node:crypto`
  // aceitar — `createPrivateKey` exige a curva completa.
  const publicKey = b64urlDecode(params.vapidPublicKey);
  const privateKey = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: publicKey.subarray(1, 33).toString('base64url'),
      y: publicKey.subarray(33, 65).toString('base64url'),
      d: params.vapidPrivateKey,
    },
    format: 'jwk',
  });

  // `ieee-p1363` força a assinatura raw R||S (64B) que o JWT exige — sem isso
  // o Node devolve DER e o push service rejeita.
  const signature = cryptoSign('sha256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  return `${signingInput}.${b64url(signature)}`;
}

// ─── Criptografia de payload (RFC 8291 / RFC 8188 — aes128gcm) ──────────────

/**
 * Cifra o payload no formato `aes128gcm`: 1 record AES-128-GCM precedido do
 * header com salt + record size + chave pública efêmera. CEK e nonce derivam
 * de HKDF-SHA256 sobre o segredo ECDH (RFC 8291 §3).
 *
 * Exportada pra o smoke test (`/api/smoke-test/push`) fazer o round-trip
 * cifrar → decifrar e validar a cadeia HKDF/AES.
 */
export function encryptPayload(subscription: WebPushSubscription, plaintext: Buffer): Buffer {
  const uaPublic = b64urlDecode(subscription.p256dh); // 65B
  const uaAuth = b64urlDecode(subscription.auth); // 16B
  const salt = randomBytes(16);

  // Par ECDH efêmero do servidor + segredo compartilhado com o browser.
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(); // 65B não-comprimido
  const sharedSecret = ecdh.computeSecret(uaPublic); // 32B

  // RFC 8291 §3.4 — IKM combina o segredo ECDH com o `auth` do browser.
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', sharedSecret, uaAuth, keyInfo, 32));

  // RFC 8188 §2.1 — content encryption key (16B) + nonce (12B).
  const cek = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16),
  );
  const nonce = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12),
  );

  // Record único: payload + delimitador 0x02 (marca "último record").
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.concat([plaintext, Buffer.from([0x02])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  // Header aes128gcm: salt(16) || rs(uint32 BE) || idlen(uint8) || keyid.
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(RECORD_SIZE, 0);
  const header = Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic]);

  return Buffer.concat([header, ciphertext]);
}

// ─── base64url ──────────────────────────────────────────────────────────────

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function b64urlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}
