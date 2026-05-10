'use client';

import { Badge, cn } from '@papopro/ui';
import { Lock } from '@papopro/ui/icons';

import { getRepName } from '@/lib/fixtures/sales-reps';
import { formatDateTime } from '@/lib/utils/format';

import { useDistanceToNow } from '../hooks/use-distance-to-now';
import type { Message } from '../types';

/**
 * Bubble de nota interna (PRD §3.8 — "visíveis apenas para o time, fundo
 * amarelo na thread, ícone de cadeado"). NÃO vai pro lead; é um lembrete
 * do time dentro da conversa.
 *
 * Visualmente largura cheia (não alinhada como bubble normal) pra não
 * confundir com mensagem real, e cor `bg-accent/10 + border-accent/30`
 * — mesmo padrão de [`lead-timeline.tsx`](../../leads/components/lead-timeline.tsx).
 */
interface InternalNoteBubbleProps {
  message: Message;
}

export function InternalNoteBubble({ message }: InternalNoteBubbleProps) {
  const author = message.authorId ? getRepName(message.authorId) : 'Sistema';
  const relativeTime = useDistanceToNow(message.createdAt);
  return (
    <div
      className={cn(
        'border-accent/30 bg-accent/10 flex flex-col gap-1.5 rounded-md border px-4 py-3',
      )}
      role="note"
      aria-label="Nota interna"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Lock className="text-foreground size-3.5" aria-hidden />
        <Badge variant="warning" className="h-5 px-1.5">
          interno · só o time vê
        </Badge>
        <span className="text-caption text-muted-foreground">por {author}</span>
        <time
          className="text-caption text-muted-foreground ml-auto"
          dateTime={message.createdAt}
          title={formatDateTime(message.createdAt)}
        >
          {relativeTime}
        </time>
      </div>
      {message.body && (
        <p className="text-body text-foreground whitespace-pre-line">{message.body}</p>
      )}
    </div>
  );
}
