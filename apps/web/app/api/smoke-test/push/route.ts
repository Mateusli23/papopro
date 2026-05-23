/**
 * Smoke test de Push Notifications (M13#2).
 *
 * Valida a criptografia de Web Push sem precisar de browser nem de um push
 * service real — gera um par de chaves na hora e exercita as primitivas:
 *
 *  - **VAPID JWT (RFC 8292):** assina com `signVapidJwt` e verifica a
 *    assinatura ES256 com a chave pública (round-trip de assinatura).
 *  - **Payload aes128gcm (RFC 8291):** cifra com `encryptPayload` e decifra
 *    de volta no papel do browser — valida toda a cadeia ECDH → HKDF → AES.
 *
 * Service worker, permissão e entrega real só dá pra validar manualmente
 * (instalar o PWA num device) ou via E2E (M13#5).
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/push` → JSON. HTTP 200 se
 * `failed === 0`, 500 caso contrário.
 */
import {
  createDecipheriv,
  createECDH,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  verify as cryptoVerify,
} from 'node:crypto';

import { NextResponse } from 'next/server';

import { blockSmokeInProd } from '@/lib/dev/smoke-guard';
import {
  type WebPushSubscription,
  encryptPayload,
  isWebPushConfigured,
  signVapidJwt,
} from '@/lib/notifications/web-push';

interface CheckResult {
  group: string;
  name: string;
  ok: boolean;
  detail?: string;
}

function run(group: string, results: CheckResult[]) {
  return (name: string, fn: () => boolean | string) => {
    try {
      const r = fn();
      if (r === true) results.push({ group, name, ok: true });
      else
        results.push({
          group,
          name,
          ok: false,
          detail: typeof r === 'string' ? r : 'returned false',
        });
    } catch (err) {
      results.push({ group, name, ok: false, detail: (err as Error).message });
    }
  };
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Gera um par VAPID no formato base64url que `signVapidJwt` consome. */
function generateVapidKeys(): {
  publicKey: string;
  privateKey: string;
  publicKeyObject: ReturnType<typeof generateKeyPairSync>['publicKey'];
} {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pubJwk = publicKey.export({ format: 'jwk' });
  const privJwk = privateKey.export({ format: 'jwk' });
  const rawPublic = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(pubJwk.x ?? '', 'base64url'),
    Buffer.from(pubJwk.y ?? '', 'base64url'),
  ]);
  return {
    publicKey: rawPublic.toString('base64url'),
    privateKey: privJwk.d ?? '',
    publicKeyObject: publicKey,
  };
}

/**
 * Decifra um corpo `aes128gcm` no papel do browser — oráculo de verificação
 * do `encryptPayload`. Espelha a derivação RFC 8291/8188 do lado da UA.
 */
function decryptAes128gcm(
  body: Buffer,
  uaEcdh: ReturnType<typeof createECDH>,
  uaPublic: Buffer,
  uaAuth: Buffer,
): Buffer {
  const salt = body.subarray(0, 16);
  const idlen = body[20]!;
  const asPublic = body.subarray(21, 21 + idlen);
  const ciphertext = body.subarray(21 + idlen);

  const shared = uaEcdh.computeSecret(asPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, uaAuth, keyInfo, 32));
  const cek = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16),
  );
  const nonce = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12),
  );

  const tag = ciphertext.subarray(ciphertext.length - 16);
  const ct = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(tag);
  const padded = Buffer.concat([decipher.update(ct), decipher.final()]);
  // Remove o delimitador 0x02 do último record.
  return padded.subarray(0, padded.length - 1);
}

export function GET() {
  const blocked = blockSmokeInProd();
  if (blocked) return blocked;

  const results: CheckResult[] = [];

  // ── isWebPushConfigured ─────────────────────────────────────────────────
  let t = run('web-push-config-m13-2', results);
  t('isWebPushConfigured retorna boolean', () => typeof isWebPushConfigured() === 'boolean');

  // ── VAPID JWT (RFC 8292) ────────────────────────────────────────────────
  t = run('vapid-jwt-m13-2', results);
  const vapid = generateVapidKeys();
  const jwt = signVapidJwt({
    audience: 'https://fcm.googleapis.com',
    vapidPublicKey: vapid.publicKey,
    vapidPrivateKey: vapid.privateKey,
    subject: 'mailto:smoke@pipeflow.com.br',
  });
  const segments = jwt.split('.');

  t('JWT tem 3 segmentos', () => segments.length === 3 || `segmentos=${segments.length}`);
  t('header decodifica pra { typ: JWT, alg: ES256 }', () => {
    const header = JSON.parse(Buffer.from(segments[0]!, 'base64url').toString('utf8'));
    return (header.typ === 'JWT' && header.alg === 'ES256') || JSON.stringify(header);
  });
  t('payload tem aud, exp e sub', () => {
    const payload = JSON.parse(Buffer.from(segments[1]!, 'base64url').toString('utf8'));
    return (
      (typeof payload.aud === 'string' &&
        typeof payload.exp === 'number' &&
        typeof payload.sub === 'string') ||
      JSON.stringify(payload)
    );
  });
  t('exp está no futuro e dentro de 24h (RFC 8292)', () => {
    const payload = JSON.parse(Buffer.from(segments[1]!, 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);
    return (payload.exp > nowSec && payload.exp <= nowSec + 24 * 60 * 60) || `exp=${payload.exp}`;
  });
  t('assinatura ES256 verifica com a chave pública', () => {
    const signature = Buffer.from(segments[2]!, 'base64url');
    return cryptoVerify(
      'sha256',
      Buffer.from(`${segments[0]}.${segments[1]}`),
      { key: vapid.publicKeyObject, dsaEncoding: 'ieee-p1363' },
      signature,
    );
  });

  // ── Criptografia de payload (RFC 8291 — aes128gcm) ──────────────────────
  t = run('payload-encryption-m13-2', results);

  // Par ECDH + auth secret no papel do browser.
  const uaEcdh = createECDH('prime256v1');
  uaEcdh.generateKeys();
  const uaPublic = uaEcdh.getPublicKey();
  const uaAuth = randomBytes(16);
  const subscription: WebPushSubscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/smoke-test',
    p256dh: uaPublic.toString('base64url'),
    auth: uaAuth.toString('base64url'),
  };

  const original = JSON.stringify({
    title: 'Lead esfriando',
    body: 'Maria Souza passou do prazo da etapa.',
    url: '/leads/abc',
  });
  const encrypted = encryptPayload(subscription, Buffer.from(original, 'utf8'));

  t('corpo aes128gcm maior que header (86B) + tag (16B)', () => {
    return encrypted.length > 86 + 16 || `length=${encrypted.length}`;
  });
  t('idlen do header (byte 20) === 65 (chave efêmera não-comprimida)', () => {
    return encrypted[20] === 65 || `idlen=${encrypted[20]}`;
  });
  t('round-trip cifrar→decifrar devolve o payload original', () => {
    const decrypted = decryptAes128gcm(encrypted, uaEcdh, uaPublic, uaAuth).toString('utf8');
    return decrypted === original || `decrypted=${decrypted.slice(0, 60)}`;
  });
  t('tag GCM adulterada faz a decifragem falhar', () => {
    const tampered = Buffer.from(encrypted);
    const last = tampered.length - 1;
    tampered[last] = ((tampered[last] ?? 0) ^ 0xff) & 0xff; // corrompe 1 byte da tag
    try {
      decryptAes128gcm(tampered, uaEcdh, uaPublic, uaAuth);
      return 'decifrou um corpo adulterado';
    } catch {
      return true;
    }
  });

  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const failed = total - passed;
  return NextResponse.json(
    { summary: { total, passed, failed, allOk: failed === 0 }, results },
    { status: failed === 0 ? 200 : 500 },
  );
}
