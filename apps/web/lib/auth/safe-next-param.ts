/**
 * Guard de open-redirect (`?next=…`) compartilhado entre middleware Edge e
 * outras superfícies (smoke test, auth actions).
 *
 * **Por que aqui em vez de inline no middleware:** o smoke endpoint
 * `/api/smoke-test/supabase` cobre esse path (M7#5 CRÍTICO #1), e duplicar
 * a regex/regras entre 2 arquivos vira bug-magnet (alguém adiciona
 * "permite path com `?`" no middleware mas esquece no smoke). Helper único.
 *
 * **Regras (em ordem):**
 *  1. `null`/string vazia → `null`.
 *  2. `length > 512` → `null` (DoS de URL gigante; convite real cabe em ~80).
 *  3. Não começa com `/` → `null` (URLs absolutas viram open-redirect).
 *  4. Começa com `//` → `null` (protocolo-relativo é open-redirect).
 *  5. Tem control char (`\0`-`\x1f` ou `\x7f`) → `null` (CRLF smuggling).
 *  6. Caso contrário → retorna a string tal qual.
 *
 * **Não decodifica.** O input já vem decodificado de
 * `searchParams.get('next')` (URLSearchParams faz decode); fazer um segundo
 * decode aqui abriria pra `%252F%252Fevil.com` virar `//evil.com` depois do
 * primeiro decode da URL e do segundo do helper. Confiamos no
 * `URLSearchParams` upstream.
 */
export function safeNextParam(next: string | null): string | null {
  if (!next) return null;
  if (next.length > 512) return null;
  if (!next.startsWith('/')) return null;
  if (next.startsWith('//')) return null;
  for (let i = 0; i < next.length; i++) {
    const code = next.charCodeAt(i);
    if (code < 32 || code === 127) return null;
  }
  return next;
}
