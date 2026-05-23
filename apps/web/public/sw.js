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
 *
 * M13#2 acrescenta os listeners de push (`push`, `notificationclick`,
 * `pushsubscriptionchange`) — a entrega real chega via Web Push criptografado
 * (ver `lib/notifications/web-push.ts`).
 */

const VERSION = 'v2';
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

/*
 * ── Push notifications (M13#2) ──────────────────────────────────────────────
 *
 * O payload é o JSON cifrado por `lib/notifications/web-push.ts`:
 * `{ title, body, url?, tag? }`. Defensivo — payload ausente/corrompido cai
 * num default em vez de derrubar o handler (Chrome mostra "site atualizado"
 * genérico se `showNotification` não for chamado).
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'PapoPro';
  const options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    // `tag` igual substitui a notificação anterior — evita pilha de avisos
    // repetidos do mesmo tipo de evento.
    tag: data.tag || undefined,
    data: { url: data.url || '/dashboard' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/*
 * Clique na notificação → foca uma aba já aberta do app (navegando pro
 * deep-link) ou abre uma nova. `includeUncontrolled` pega abas que ainda não
 * são controladas por este SW.
 */
/**
 * Sanitiza `targetUrl` para garantir caminho relativo same-origin. Atacante
 * que entregar um push (cenário: subscription roubada ou bug no dispatcher)
 * NÃO pode redirecionar o usuário pra `https://evil.com` ou `javascript:...`.
 * Aceita apenas paths começando com `/` e sem `//` (protocolo-relativo).
 */
function safeNotificationUrl(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return '/dashboard';
  if (!raw.startsWith('/')) return '/dashboard';
  if (raw.startsWith('//')) return '/dashboard';
  // Bloqueia CRLF / control chars (header smuggling em casos exóticos).
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 32 || code === 127) return '/dashboard';
  }
  return raw;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = safeNotificationUrl(event.notification.data && event.notification.data.url);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl);
          return undefined;
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

/*
 * O push service pode rotacionar a subscription. Re-assinamos com a mesma
 * VAPID key pra o objeto continuar existindo; a re-persistência no servidor
 * acontece no próximo load do app (`lib/pwa/push.ts` re-sincroniza o
 * endpoint). Best-effort — sem sessão/tab aberta não há como persistir aqui.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const appServerKey =
          event.oldSubscription &&
          event.oldSubscription.options &&
          event.oldSubscription.options.applicationServerKey;
        if (appServerKey) {
          await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: appServerKey,
          });
        }
      } catch {
        // Re-assinatura falhou — o app re-sincroniza no próximo load.
      }
    })(),
  );
});
