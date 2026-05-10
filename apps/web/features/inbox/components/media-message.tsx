'use client';

import * as React from 'react';

import { Button } from '@papopro/ui';
import { Download, FileAudio, FileText, ImageIcon, Play } from '@papopro/ui/icons';

import type { Message } from '../types';

/**
 * Conteúdo de mídia dentro de uma `<MessageBubble>`. Variantes:
 *  - **image**: thumbnail placeholder + nome + tamanho. Em M9 carrega
 *    `mediaUrl` real do Supabase Storage.
 *  - **audio**: barra de progresso fake + duração + botão play (decorativo
 *    em M5; em M5#4b o composer cria áudios mock; em M9 toca o blob real).
 *  - **document**: ícone genérico + nome + tamanho + botão Baixar (sem
 *    ação por ora — só fluxo visual).
 *
 * Nada toca o sistema de arquivos ou áudio real em M5. Toda interação
 * é UI pura.
 */
interface MediaMessageProps {
  message: Message;
}

export function MediaMessage({ message }: MediaMessageProps) {
  if (message.kind === 'image') return <ImagePreview message={message} />;
  if (message.kind === 'audio') return <AudioPreview message={message} />;
  if (message.kind === 'document') return <DocumentPreview message={message} />;
  return null;
}

function ImagePreview({ message }: { message: Message }) {
  // Placeholder visual em M5 — em M9 vira <Image src={mediaUrl} ... />.
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="bg-muted flex aspect-[4/3] w-full items-center justify-center rounded-md"
        role="img"
        aria-label={`Imagem: ${message.mediaName ?? 'sem nome'}`}
      >
        <ImageIcon className="text-muted-foreground size-10" aria-hidden />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-muted-foreground truncate">
          {message.mediaName ?? 'imagem.jpg'}
        </span>
        {message.mediaSizeKb !== undefined && (
          <span className="text-caption text-muted-foreground tabular-nums">
            {formatFileSize(message.mediaSizeKb)}
          </span>
        )}
      </div>
    </div>
  );
}

function AudioPreview({ message }: { message: Message }) {
  // Decorativo: nada de Web Audio em M5 (decisão alinhada com plano).
  // Barra de progresso "0:00" estática + ícone play.
  const duration = message.mediaDurationSeconds ?? 0;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Reproduzir áudio (disponível ao conectar WhatsApp em M9)"
        disabled
        className="bg-foreground/10 hover:bg-foreground/15 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Play className="text-foreground ml-0.5 size-4" aria-hidden />
      </button>
      <div className="flex flex-1 items-center gap-2">
        <FileAudio className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <div className="bg-foreground/10 h-1 flex-1 overflow-hidden rounded-full">
          <div className="bg-foreground/30 h-full w-0" />
        </div>
        <span className="text-caption text-muted-foreground tabular-nums">
          {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}

function DocumentPreview({ message }: { message: Message }) {
  return (
    <div className="border-border flex items-center gap-3 rounded-md border p-2">
      <div className="bg-foreground/10 flex size-10 shrink-0 items-center justify-center rounded-md">
        <FileText className="text-foreground size-5" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-body text-foreground truncate font-medium">
          {message.mediaName ?? 'documento.pdf'}
        </span>
        {message.mediaSizeKb !== undefined && (
          <span className="text-caption text-muted-foreground">
            {formatFileSize(message.mediaSizeKb)}
          </span>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label="Baixar documento (mock)"
        className="size-8 shrink-0 p-0"
      >
        <Download className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatFileSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// React.memo otimiza thread longa — bubbles não re-render se props iguais.
export const MediaMessageMemo = React.memo(MediaMessage);
