'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import { AutoResizeTextarea, Button, Card, cn } from '@papopro/ui';
import { Play, Send } from '@papopro/ui/icons';

import { endSimulationSessionAction, simulateAgentMessageAction } from '../actions';
import type { SimulationStateUI, SimulationMessageUI } from '../queries';
import type { Agent } from '../types';

/**
 * Chat de simulação dentro do editor — agora chama Claude REAL (M11#3).
 *
 * Vendedor testa o agente sem disparar conversa real. Persistido em
 * `agent_sessions kind='simulation'` (CHECK constraint M11#1 garante
 * isolamento de leads); `agent_messages` registra cada turno + tokens.
 *
 * **Custo:** cada mensagem consome Sonnet 4.6 (~3¢-30¢/turno). UI mostra
 * disclaimer no header. Sem API key, action retorna erro propositivo
 * "IA não configurada — verifique a chave Anthropic em Configurações."
 *
 * **Memória 3 camadas:** `assembleContext` é chamado server-side com
 * `leadId=undefined` (simulation) — então Cérebro + sessão entram, lead
 * summary fica null. Igual a um lead novo na primeira interação.
 *
 * **"Limpar"** chama `endSimulationSessionAction` que fecha a sessão atual;
 * próxima mensagem cria sessão nova.
 */

interface AgentSimulationChatProps {
  agent: Agent;
  initialState: SimulationStateUI | null;
}

export function AgentSimulationChat({ agent, initialState }: AgentSimulationChatProps) {
  const [messages, setMessages] = React.useState<SimulationMessageUI[]>(
    initialState?.messages ?? [],
  );
  const [draft, setDraft] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-scroll pra última mensagem.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, isTyping]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || isTyping) return;

    // Optimistic: adiciona msg do usuário imediatamente.
    const optimisticUser: SimulationMessageUI = {
      id: `local-${Date.now()}`,
      direction: 'in',
      body: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setDraft('');
    setIsTyping(true);

    const result = await simulateAgentMessageAction(agent.id, { userMessage: text });
    setIsTyping(false);

    if (!result.ok) {
      // Remove optimistic + mostra erro.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
      toast.error(result.error, { duration: 5000 });
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${Date.now()}`,
        direction: 'out',
        body: result.assistantText,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  async function handleReset() {
    setMessages([]);
    setDraft('');
    await endSimulationSessionAction(agent.id);
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
          <div className="flex flex-col">
            <h3 className="text-body font-semibold">Testar no chat</h3>
            <span className="text-caption text-muted-foreground/80">
              Chamada Claude real — não vai pro WhatsApp. Cada turno consome tokens (Sonnet 4.6).
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={messages.length === 0}
          className="text-caption"
        >
          Nova simulação
        </Button>
      </header>

      <div ref={scrollRef} className="bg-muted/30 flex h-80 flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-caption text-muted-foreground/70 m-auto max-w-xs text-center">
            Digite uma mensagem como se fosse um lead — o agente responde com Claude real usando o
            prompt e o Cérebro do workspace.
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex w-full', msg.direction === 'in' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'text-body max-w-[80%] whitespace-pre-line break-words rounded-2xl px-3 py-2',
                msg.direction === 'in'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-background text-foreground rounded-bl-sm border',
              )}
              role="article"
              aria-label={
                msg.direction === 'in' ? 'Você (lead simulado)' : `${agent.name} (agente)`
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
