/*
 * Service worker do PapoPro (M13#1).
 *
 * Hand-rolled de propósito — sem `next-pwa`/`serwist`/Workbox: zero dependência
 * nova, zero wrapper no `next.config`, e o comportamento é pequeno o bastante
 * pra auditar à mão.
 *
 * Estratégia (conservadora — o produto é todo dado vivo + auth + RLS):
 *  - `/_next/static/*`, `/icon.svg`, `/manifest.json` → cache-first (assets
 *    hasheados/imutáveis; repeat-load instantâneo).
 *  - Navegações (`mode: 'navigate'`) → network-first; se a rede cair, serve
 *    `/offline.html`.
 *  - `/api/*` e todo o resto → NÃO interceptado (passa direto pra rede).
 *    Nunca cacheamos dado/JSON/auth — evita servir lead stale ou sessão furada.
 *
 * Registrado só em produção (ver `components/pwa/pwa-provider.tsx`).
 */

const VERSION = 'v1';
const STATIC_CACHE = `papopro-static-${VERSION}`;
const SHELL_CACHE = `papopro-shell-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // Limpa caches de versões antigas e assume o controle das abas abertas.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Só GET same-origin é elegível. POST/PUT, cross-origin e afins passam direto.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API e dados — nunca interceptados (auth/RLS/dado vivo).
  if (url.pathname.startsWith('/api/')) return;

  // Assets imutáveis — cache-first.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/icon.svg' ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navegações — network-first com fallback offline.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Asset não-cacheado e sem rede — não há fallback útil.
    return Response.error();
  }
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline ?? Response.error();
  }
}
