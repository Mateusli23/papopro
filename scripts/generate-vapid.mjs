#!/usr/bin/env node
/**
 * generate-vapid.mjs
 *
 * Gera um par de chaves VAPID (ECDSA P-256) para Web Push compatível com
 * todos os browsers e com o protocolo descrito em RFC 8292.
 *
 * Uso:
 *   node scripts/generate-vapid.mjs
 *   node scripts/generate-vapid.mjs --env  # imprime no formato pronto pra .env
 *
 * Saída: chave pública (65 bytes uncompressed → base64url) e privada
 * (32 bytes raw → base64url). Idêntico ao que `web-push generate-vapid-keys`
 * produz, mas sem dependência externa.
 */
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

const pubJwk = publicKey.export({ format: 'jwk' });
const privJwk = privateKey.export({ format: 'jwk' });

// Public: 0x04 (uncompressed prefix) + X (32B) + Y (32B) → 65B → base64url
const x = Buffer.from(pubJwk.x, 'base64url');
const y = Buffer.from(pubJwk.y, 'base64url');
const rawPublic = Buffer.concat([Buffer.from([0x04]), x, y]);
const publicKeyBase64Url = rawPublic.toString('base64url');

// Private: D (32B) → base64url
const rawPrivate = Buffer.from(privJwk.d, 'base64url');
const privateKeyBase64Url = rawPrivate.toString('base64url');

if (process.argv.includes('--env')) {
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKeyBase64Url}"`);
  console.log(`VAPID_PRIVATE_KEY="${privateKeyBase64Url}"`);
} else {
  console.log('VAPID keypair (P-256, RFC 8292):');
  console.log('');
  console.log(`  Public  (${rawPublic.length}B):  ${publicKeyBase64Url}`);
  console.log(`  Private (${rawPrivate.length}B):  ${privateKeyBase64Url}`);
  console.log('');
  console.log('Cole a pública em NEXT_PUBLIC_VAPID_PUBLIC_KEY e a privada em');
  console.log('VAPID_PRIVATE_KEY no .env.local do app/web e no Vercel em prod.');
}
