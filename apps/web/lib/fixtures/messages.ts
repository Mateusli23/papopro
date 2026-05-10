/**
 * Mensagens WhatsApp mockadas pra alimentar a Inbox.
 *
 * **Fonte da verdade está em [`./conversations.ts`](./conversations.ts)** — o
 * builder lá produz tanto `FAKE_CONVERSATIONS` quanto `FAKE_MESSAGES` a
 * partir do mesmo seed (cada conversa traz seu thread completo). Esse
 * arquivo é apenas um re-export pra preservar o caminho `@/lib/fixtures/messages`
 * que o plano descreveu — assim a inbox tem dois imports separados, mas
 * a única fonte de inconsistência possível é o seed único.
 *
 * Em M9 isso some: queries vão ler `messages` do Postgres com RLS.
 */
export { FAKE_MESSAGES } from './conversations';

export type { Message } from '@/features/inbox/types';
