import { cn } from '@papopro/ui';

import { formatDateTime } from '@/lib/utils/format';

import { formatTimeBrt } from '../hooks/inbox-tz';
import type { Message } from '../types';

import { MediaMessage } from './media-message';
import { ReadReceiptIcon } from './read-receipt-icon';

/**
 * Bolha de mensagem WhatsApp.
 *
 * Convenções visuais (PRD §3.8):
 *  - **out** (vendor → lead): alinhada à direita, fundo `bg-primary/10`
 *  - **in** (lead → vendor): alinhada à esquerda, fundo `bg-muted`
 *  - **internal_note**: NÃO usar este componente — usar `<InternalNoteBubble>`
 *  - timestamp curto (HH:mm) inline; tooltip com data completa
 *  - read receipt apenas em outbound (1/2 cinza/2 azul)
 *  - mídia (image/audio/document) renderizada via `<MediaMessage>` no slot
 *
 * Mensagens com body podem ter mídia E texto (caption); mídia vai antes,
 * texto depois. Alinhamento via flex parent (`message-thread`).
 *
 * Nota: as classes de variante são `cn` simples — `cva` mora só em
 * `@papopro/ui`, mantendo `apps/web` sem dependência direta.
 */
const BUBBLE_BASE =
  'flex max-w-[85%] flex-col gap-1.5 rounded-lg px-3 py-2 text-body shadow-sm sm:max-w-[70%]';
const BUBBLE_OUT = 'bg-primary/10 text-foreground rounded-br-none ml-auto';
const BUBBLE_IN = 'bg-muted text-foreground rounded-bl-none mr-auto';

interface MessageBubbleProps {
  message: Message;
  className?: string;
}

export function MessageBubble({ message, className }: MessageBubbleProps) {
  const hasMedia = message.kind !== 'text' && message.kind !== 'internal_note';
  const time = formatTimeBrt(message.createdAt);

  return (
    <div className="flex w-full">
      <div
        className={cn(BUBBLE_BASE, message.direction === 'out' ? BUBBLE_OUT : BUBBLE_IN, className)}
        // role="article" pra leitor de tela tratar cada bubble como item
        role="article"
        aria-label={message.direction === 'out' ? 'Mensagem enviada' : 'Mensagem recebida'}
      >
        {hasMedia && <MediaMessage message={message} />}
        {message.body && <p className="whitespace-pre-line break-words">{message.body}</p>}
        <div className="text-caption text-muted-foreground -mb-0.5 flex items-center justify-end gap-1">
          <time
            dateTime={message.createdAt}
            title={formatDateTime(message.createdAt)}
            className="tabular-nums"
          >
            {time}
          </time>
          <ReadReceiptIcon message={message} />
        </div>
      </div>
    </div>
  );
}
