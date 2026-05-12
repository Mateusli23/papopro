import 'server-only';

import { headers } from 'next/headers';

/**
 * Contexto request-time pra audit log (M7#5).
 *
 * **O que captura.** `ipAddress` extraído de `x-forwarded-for` (Vercel/proxy)
 * com fallback pra `x-real-ip`; `userAgent` do header direto.
 *
 * **Por que helper compartilhado.** Toda action que registra `audit_logs`
 * agora deve incluir ip + UA — vira ruído se cada call faz `headers().get(...)`
 * inline. Um lugar só com a convenção do XFF (pega o primeiro IP da lista,
 * que é o cliente real; os subsequentes são proxies).
 *
 * **`x-forwarded-for` na Vercel.** A doc oficial garante que o primeiro IP da
 * lista é o do cliente (Vercel sanitiza spoofing). Em dev local sem proxy o
 * header não existe — `ipAddress` retorna `null` e a coluna `audit_logs.ip_address`
 * fica `NULL` (já é `@db.Inet` nullable no schema).
 *
 * **Mascaramento futuro (LGPD §5).** Em produção pode ser interessante
 * truncar o último octeto (IPv4) / últimos 80 bits (IPv6) por padrão e só
 * gravar IP completo em workspaces Enterprise. Não fazemos isso ainda — fica
 * como TODO pro M7#6 ou primeira sessão LGPD com cliente real.
 */

export interface RequestAuditContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export function getRequestAuditContext(): RequestAuditContext {
  const h = headers();
  const xff = h.get('x-forwarded-for') ?? '';
  const ipAddress = xff.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const userAgent = h.get('user-agent') ?? null;
  return { ipAddress, userAgent };
}
