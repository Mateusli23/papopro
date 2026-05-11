import 'server-only';

import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Cookie de workspace ativo — **httpOnly + server-only**.
 *
 * **Por que httpOnly:** o middleware lê esse cookie pra decidir entre
 * `/onboarding` e `/dashboard`. Se fosse acessível via `document.cookie`, um
 * XSS conseguiria trocar o tenant do user. httpOnly + SameSite=Lax fecha esse
 * vetor. O switcher (M7#4 Onda 3) troca workspace via Server Action, não
 * mexendo no cookie diretamente.
 *
 * **Por que separado do anon JWT:** o JWT identifica o usuário (uid); o
 * workspace ativo é uma escolha *ortogonal* (mesmo user, vários workspaces).
 * Cookies separados deixam a troca de workspace ser local — não precisa
 * regenerar a sessão Supabase.
 *
 * **Em produção** o cookie é Secure (HTTPS-only). Em dev/HTTP, omitimos a
 * flag pra evitar o "cookie silenciosamente ignorado pelo browser".
 *
 * **Cookie name:** `papopro_workspace_id` (sem o `_mock_` que o legacy usa
 * em `WorkspaceMockProvider` — o "mock" é resíduo de M3 que sai em Onda 3
 * de M7#4).
 */

export const WORKSPACE_COOKIE_NAME = 'papopro_workspace_id';
export const WIZARD_COMPLETED_COOKIE_NAME = 'papopro_wizard_completed';

const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias
const WIZARD_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano (flag de primeira visita)

/**
 * Server Action / Route Handler grava o cookie via `cookies()` de
 * `next/headers`. Esse helper centraliza as flags pra todo chamador setar
 * iguais (mismatch entre callers gera o sintoma clássico "funciona em login,
 * some no signup").
 */
export function setWorkspaceCookie(workspaceId: string): void {
  cookies().set(WORKSPACE_COOKIE_NAME, workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
  });
}

/**
 * Helper inverso — usado no `logoutAction` futuro e na hora de revogar
 * acesso a um workspace (M7#5).
 */
export function clearWorkspaceCookie(): void {
  cookies().delete(WORKSPACE_COOKIE_NAME);
}

/**
 * Leitura via `cookies()` (Server Components, Server Actions, Route Handlers).
 * Retorna `null` se ausente. O middleware **não usa esse helper** porque roda
 * no Edge runtime e lê via `req.cookies` — ver `readWorkspaceCookieFromRequest`.
 */
export function readWorkspaceCookie(): string | null {
  const value = cookies().get(WORKSPACE_COOKIE_NAME)?.value;
  return value ?? null;
}

/**
 * Edge middleware lê via `req.cookies.get(name)` em vez do `cookies()` de
 * `next/headers` (que não existe no Edge runtime).
 */
export function readWorkspaceCookieFromRequest(req: NextRequest): string | null {
  const value = req.cookies.get(WORKSPACE_COOKIE_NAME)?.value;
  return value ?? null;
}

/**
 * Edge middleware grava via `response.cookies.set` — usado quando o cache
 * miss obriga o middleware a popular o cookie após lookup de memberships.
 */
export function setWorkspaceCookieOnResponse(response: NextResponse, workspaceId: string): void {
  response.cookies.set(WORKSPACE_COOKIE_NAME, workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
  });
}

/**
 * Cookie de "primeira visita ao dashboard" — flag de UX local (M7#4 Onda 3).
 *
 * Substitui o `papopro_workspace_mock_wizard_completed` do legado mock. Vive
 * 1 ano; depois disso o wizard reabre (próximo big release UX). httpOnly pra
 * impedir manipulação trivial via devtools.
 */
export function setWizardCookie(): void {
  cookies().set(WIZARD_COMPLETED_COOKIE_NAME, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: WIZARD_COOKIE_MAX_AGE,
  });
}

export function readWizardCookie(): boolean {
  return cookies().get(WIZARD_COMPLETED_COOKIE_NAME)?.value === '1';
}
