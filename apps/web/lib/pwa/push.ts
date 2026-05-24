/**
 * Helpers de Web Push do lado do browser (M13#2).
 *
 * Puro client — usa `navigator.serviceWorker`, `Notification` e
 * `PushManager`, então só roda dentro de componentes client. As funções de
 * assinatura/cancelamento conversam com o service worker registrado no M13#1
 * (`public/sw.js`); a entrega real é feita pelo servidor
 * (`lib/notifications/web-push.ts`).
 *
 * **Dev:** o SW só é registrado em produção (decisão do M13#1), então push
 * não funciona em `pnpm dev` — `isPushSupported` segue `true` mas
 * `subscribeToPush` falha com `sw_not_registered`. Esperado: push é validado
 * instalando o PWA num device real.
 */

/** Subscription serializada — espelha o shape de `push_subscriptions`. */
export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushPermission = NotificationPermission | 'unsupported';

/** O browser suporta os 3 pilares de Web Push? */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Estado atual da permissão de notificação (`'unsupported'` sem o browser). */
export function getNotificationPermission(): PushPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Converte a chave pública VAPID (base64url) no `Uint8Array` que o
 * `pushManager.subscribe` exige em `applicationServerKey`.
 */
function vapidKeyToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** Extrai `{ endpoint, p256dh, auth }` de um `PushSubscription` nativo. */
function toPayload(subscription: PushSubscription): PushSubscriptionPayload | null {
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

/** Pega o service worker registrado, ou `null` se nenhum (ex: dev). */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ?? null;
}

/**
 * Assina push neste browser. Pede permissão se ainda não foi concedida,
 * registra a subscription no `pushManager` e devolve o payload pra persistir.
 *
 * Lança `Error` com mensagem-código (`unsupported`, `sw_not_registered`,
 * `permission_denied`, `subscribe_failed`) pra o caller traduzir em microcopy.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionPayload> {
  if (!isPushSupported()) throw new Error('unsupported');

  const registration = await getRegistration();
  if (!registration) throw new Error('sw_not_registered');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('permission_denied');

  // Reaproveita a subscription existente se já houver uma — re-subscribe com
  // a mesma VAPID key devolve o mesmo objeto.
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyToUint8Array(vapidPublicKey),
    }));

  const payload = toPayload(subscription);
  if (!payload) throw new Error('subscribe_failed');
  return payload;
}

/** Subscription ativa deste browser, ou `null` se não houver. */
export async function getCurrentPushSubscription(): Promise<PushSubscriptionPayload | null> {
  const registration = await getRegistration();
  if (!registration) return null;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? toPayload(subscription) : null;
}

/**
 * Cancela a assinatura push deste browser. Devolve o `endpoint` removido (pra
 * o caller apagar a linha no servidor) ou `null` se não havia subscription.
 */
export async function unsubscribeFromPush(): Promise<string | null> {
  const registration = await getRegistration();
  if (!registration) return null;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return endpoint;
}
