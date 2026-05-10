'use client';

import * as React from 'react';

import { Button, Popover, PopoverContent, PopoverTrigger, cn } from '@papopro/ui';
import { Smile } from '@papopro/ui/icons';

/**
 * Emoji picker minimal — 48 emojis curados pra contexto vendas/WhatsApp BR.
 *
 * **Por que não emoji-mart?** Picker completo pesa ~450KB (data + UI) e
 * carrega 1800+ emojis com search/skin tones. Pra demo M5 e mesmo pro MVP
 * vendedor brasileiro usa esse subset 90% do tempo. Quando beta pedir
 * emoji exótico, troca por emoji-mart sem refactor (mesma assinatura
 * `onSelect(emoji)`).
 *
 * Curadoria: reações (👍 ❤️ 🙏), expressões (😂 😊 😍 🤝), comerciais
 * (📞 📧 💼 💰 📅), positivos (🎉 🔥 🚀 ✨ ✅), neutros (📌 🔔 ⏰).
 *
 * Inserção: clica no emoji → `onSelect(char)` é chamado. O composer cuida
 * de injetar na posição do cursor (ver `insertAtCursor` em
 * [message-composer.tsx](./message-composer.tsx)).
 */

export const COMMON_EMOJIS: readonly string[] = [
  // Linha 1 — reações primárias
  '👍',
  '❤️',
  '👏',
  '🙏',
  '🤝',
  '👌',
  '✅',
  '🎯',
  // Linha 2 — emoções positivas
  '😀',
  '😊',
  '😂',
  '😍',
  '🥰',
  '😎',
  '🤩',
  '😉',
  // Linha 3 — emoções neutras/dúvida
  '🤔',
  '😅',
  '🙂',
  '🫡',
  '🙌',
  '💪',
  '🫶',
  '👋',
  // Linha 4 — comerciais / contexto vendas
  '📞',
  '📧',
  '💬',
  '📅',
  '⏰',
  '📌',
  '📎',
  '🔔',
  // Linha 5 — produto / status
  '💼',
  '💰',
  '🏠',
  '🚗',
  '🛒',
  '📊',
  '📈',
  '💡',
  // Linha 6 — celebração / energia
  '🎉',
  '🔥',
  '🚀',
  '✨',
  '⭐',
  '🏆',
  '💯',
  '🎁',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  /** Disabled enquanto não há conversa selecionada / submitting. */
  disabled?: boolean;
}

export function EmojiPicker({ onSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = React.useState(false);

  function handleSelect(emoji: string) {
    onSelect(emoji);
    // Mantém aberto se o user quiser inserir mais de um — fecha só ao
    // clicar fora ou com Esc. Padrão WhatsApp Web.
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-9 shrink-0 p-0"
          aria-label="Inserir emoji"
          disabled={disabled}
        >
          <Smile className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-auto p-2"
        // Impede atalhos globais (Enter, Esc) de vazarem pro composer
        // enquanto o picker tá aberto.
        data-shortcut-ignore
      >
        {/* Lista de botões plana — Tab navega 1-a-1, screen readers anunciam
            "Inserir 😀" via aria-label. ARIA `grid` exigiria `role="row"` no
            meio + roving tabindex (Setas para navegar) — fora do escopo
            do M5; trocamos por padrão simples e correto. Fix do HIGH #4
            do review M5#4b. */}
        <div aria-label="Emojis comuns" className="grid grid-cols-8 gap-1">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSelect(emoji)}
              className={cn(
                'hover:bg-muted focus-visible:bg-muted focus-visible:ring-ring',
                'flex size-8 items-center justify-center rounded text-lg transition',
                'focus-visible:outline-none focus-visible:ring-2',
              )}
              aria-label={`Inserir ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
