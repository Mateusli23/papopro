/**
 * Verificação HMAC de webhooks uazapi (M9#3).
 *
 * uazapi envia `X-Uazapi-Signature: sha256=<hex>` em cada webhook. O hex é
 * `HMAC-SHA256(rawBody, UAZAPI_WEBHOOK_SECRET)`. Verificamos antes de tocar
 * qualquer DB pra rejeitar requests forjados imediatamente.
 *
 * **`timingSafeEqual`** evita timing attacks — comparação de tempo constante
 * mesmo quando lengths batem. Quando lengths diferem, retornamos `ok:false`
 * de forma rápida porque o ataque já se diferencia pelo length (nenhuma
 * informação secreta vaza).
 *
 * **Dev mode:** se o secret vier vazio (env não configurada), retornamos
 * `{ ok: true, skipped: true }` — facilita curl manual em dev local sem env
 * uazapi. Em produção o secret é obrigatório; documentado em `.env.example`.
 *
 * **Server-only.** Usa `node:crypto`. Nunca importar em `'use client'`.
 */
import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_PREFIX = 'sha256=';

export type VerifyResult = { ok: true; skipped?: boolean } | { ok: false; reason: string };

/**
 * Verifica a assinatura HMAC do webhook. Aceita header com ou sem o prefixo
 * `sha256=` (uazapi varia entre implementações).
 */
export function verifyUazapiSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
): VerifyResult {
  return verifyUazapiSignaturePure(secret, rawBody, signatureHeader);
}

/**
 * Versão pura (sem side effects) usada também no smoke test. Recebe os mesmos
 * argumentos e retorna o mesmo shape — separação só pra deixar claro que essa
 * função é deterministicamente testável.
 */
export function verifyUazapiSignaturePure(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
): VerifyResult {
  if (!secret || secret.trim() === '') {
    // Em produção falha fechada — webhook sem secret = aceitar payload forjado.
    // Em dev seguimos permitindo `curl` manual sem env configurada.
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, reason: 'secret_not_configured' };
    }
    return { ok: true, skipped: true };
  }

  if (!signatureHeader || signatureHeader.trim() === '') {
    return { ok: false, reason: 'signature_missing' };
  }

  const provided = signatureHeader.trim().startsWith(SIGNATURE_PREFIX)
    ? signatureHeader.trim().slice(SIGNATURE_PREFIX.length)
    : signatureHeader.trim();

  // hex válido? (`HMAC-SHA256` produz 64 chars hex)
  if (!/^[0-9a-f]{64}$/i.test(provided)) {
    return { ok: false, reason: 'signature_malformed' };
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided.toLowerCase(), 'hex');

  if (expectedBuf.length !== providedBuf.length) {
    return { ok: false, reason: 'signature_invalid' };
  }

  return timingSafeEqual(expectedBuf, providedBuf)
    ? { ok: true }
    : { ok: false, reason: 'signature_invalid' };
}
