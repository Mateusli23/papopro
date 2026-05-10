'use client';

import * as React from 'react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@papopro/ui';
import { Zap } from '@papopro/ui/icons';

import { useQuickReplies } from '../store';
import { resolvePlaceholders, type PlaceholderContext } from '../transforms';

/**
 * Dropdown de respostas rápidas — vendedor escolhe um template e o body
 * vai pro composer com `{nome}`/`{empresa}` já resolvidos contra o lead
 * da conversa atual.
 *
 * Em M5 a lista vem de [fixtures/quick-replies.ts](../../../lib/fixtures/quick-replies.ts).
 * Em M9 vira `useQuery(['quickReplies'])` contra Postgres com RLS por
 * workspace; o componente não muda.
 *
 * Resolução: chamamos `resolvePlaceholders(reply.body, context)`. Tokens
 * sem match ficam literais no draft — vendedor vê `{empresa}` na tela,
 * lembra de preencher manualmente. Decisão consciente: melhor visível e
 * editável que silenciosamente vazio (PRD §3.6 — cópia propositiva).
 */

interface QuickReplyPickerProps {
  /** Contexto pra resolver placeholders. Vem do lead da conversa atual. */
  context: PlaceholderContext;
  /** Callback quando vendedor escolhe um template — recebe o body resolvido. */
  onSelect: (resolvedBody: string) => void;
  disabled?: boolean;
}

export function QuickReplyPicker({ context, onSelect, disabled }: QuickReplyPickerProps) {
  const replies = useQuickReplies();

  function handleSelect(rawBody: string) {
    const resolved = resolvePlaceholders(rawBody, context);
    onSelect(resolved);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-9 shrink-0 p-0"
          aria-label="Respostas rápidas"
          disabled={disabled || replies.length === 0}
        >
          <Zap className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[320px]"
        // Atalhos globais (Enter / Esc) ficam fora enquanto menu aberto.
        data-shortcut-ignore
      >
        <DropdownMenuLabel className="text-caption">Respostas rápidas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {replies.map((reply) => {
          const preview = resolvePlaceholders(reply.body, context);
          return (
            <DropdownMenuItem
              key={reply.id}
              onSelect={() => handleSelect(reply.body)}
              className="flex flex-col items-start gap-0.5 py-2"
            >
              <span className="text-body text-foreground font-medium">{reply.label}</span>
              <span className="text-caption text-muted-foreground line-clamp-2 text-left">
                {preview}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
