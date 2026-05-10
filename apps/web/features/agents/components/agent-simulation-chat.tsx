'use client';

import * as React from 'react';

import { AutoResizeTextarea, Button, Card, cn } from '@papopro/ui';
import { Play, Send } from '@papopro/ui/icons';

import { useSimulationScript } from '../hooks/use-simulation-script';
import type { Agent } from '../types';

/**
 * Chat de simulação dentro do editor — vendedor testa o agente sem disparar
 * conversa real. Usa script canned do template (3-4 turnos pré-escritos)
 * via `useSimulationScript`.
 *
 * Layout: header com nome do agente e botão "Limpar"; corpo com bolhas
 * (estilo MessageBubble do Inbox); footer com AutoResizeTextarea +
 * botão enviar (Enter envia, Shift+Enter quebra linha).
 *
 * `data-shortcut-ignore` no container — bloqueia `g + a` e outros atalhos
 * globais quando o vendedor está digitando aqui.
 *
 * Layout vertical fixo de ~400px com scroll interno — não cresce indefinido.
 */

interface AgentSimulationChatProps {
  agent: Agent;
}

export function AgentSimulationChat({ agent }: AgentSimulationChatProps) {
  const { messages, isTyping, exhausted, send, reset } = useSimulationScript(agent);
  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-scroll pra última mensagem.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, isTyping]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // IME-safe: ignorar Enter durante composição de acentos pt-BR.
    // `nativeEvent.isComposing` é a fonte canônica (compatível com Inbox).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    if (!draft.trim()) return;
    send(draft);
    setDraft('');
  }

  return (
    <Card
      className="flex flex-col gap-0 overflow-hidden"
      data-shortcut-ignore
      role="region"
      aria-label="Chat de simulação"
    >
      <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Play className="text-success size-4" aria-hidden />
          <h3 className="text-body font-semibold">Testar no chat</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            reset();
            setDraft('');
          }}
          disabled={messages.length === 0}
          className="text-caption"
        >
          Limpar
        </Button>
      </header>

      <div ref={scrollRef} className="bg-muted/30 flex h-80 flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-caption text-muted-foreground/70 m-auto max-w-xs text-center">
            Digite uma mensagem como se fosse um lead — o agente responde com base no template atual
            ({agent.templateKey ?? 'em branco'}). Sem efeito real, é mock.
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex w-full', msg.direction === 'out' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'text-body max-w-[80%] whitespace-pre-line break-words rounded-2xl px-3 py-2',
                msg.direction === 'out'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-background text-foreground rounded-bl-sm border',
              )}
              role="article"
              aria-label={
                msg.direction === 'out' ? 'Você (lead simulado)' : `${agent.name} (agente)`
              }
            >
              {msg.body}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start" aria-live="polite">
            <div className="bg-background text-muted-foreground rounded-2xl rounded-bl-sm border px-3 py-2">
              <span className="text-caption inline-flex gap-1">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse [animation-delay:200ms]">●</span>
                <span className="animate-pulse [animation-delay:400ms]">●</span>
              </span>
            </div>
          </div>
        )}

        {exhausted && (
          <div className="text-caption text-muted-foreground/70 mt-2 text-center italic">
            Roteiro de simulação esgotado — clique em Limpar pra recomeçar.
          </div>
        )}
      </div>

      <footer className="border-border flex items-end gap-2 border-t p-3">
        <AutoResizeTextarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem como se fosse um lead…"
          aria-label="Mensagem de teste"
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!draft.trim() || isTyping}
          aria-label="Enviar mensagem"
        >
          <Send className="size-4" />
        </Button>
      </footer>
    </Card>
  );
}
