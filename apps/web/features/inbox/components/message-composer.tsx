'use client';

import * as React from 'react';

import toast from 'react-hot-toast';

import { Button, Tabs, TabsList, TabsTrigger, cn } from '@papopro/ui';
import { Lock, Paperclip, Send } from '@papopro/ui/icons';

import { getLead } from '@/lib/fixtures/leads';

import { sendInternalNote, sendMessage, attachMedia } from '../store';
import type { PlaceholderContext } from '../transforms';

import { AudioRecordButton } from './audio-record-button';
import { AutoResizeTextarea } from './auto-resize-textarea';
import { EmojiPicker } from './emoji-picker';
import { QuickReplyPicker } from './quick-reply-picker';

/**
 * Composer da Inbox WhatsApp (M5#4b).
 *
 * Layout: Tabs `Mensagem | Nota interna` no topo, textarea auto-resize no
 * meio, toolbar de ações (emoji / anexo / quick reply / áudio / enviar)
 * embaixo. Em modo nota interna ganha tinta amarela e header com cadeado.
 *
 * Estado controlado por React puro (não RHF) — composer é input simples
 * e instantâneo, RHF + zodResolver adicionariam ~200ms de overhead em cada
 * submit sem ganho real (validação Zod é manual e direta no submit). Schemas
 * em [../schemas.ts](../schemas.ts) ficam pra Server Actions de M9.
 *
 * Atalhos:
 *  - `Enter` → envia (se não composing IME, se não Shift)
 *  - `Shift+Enter` → quebra linha
 *  - `Esc` → esvazia draft (se houver) ou perde foco
 *
 * IME-safe: `event.nativeEvent.isComposing` evita enviar enquanto user
 * tá compondo caracteres acentuados/japoneses/chineses. Sem isso, digitar
 * "ção" engata Enter no meio.
 *
 * Conversa arquivada: composer fica desabilitado com hint orientador
 * (PRD §3.6 — sem tela morta). Desarquivar entra em M5#4c.
 */

interface MessageComposerProps {
  conversationId: string;
  /** Lead vinculado — pra resolver placeholders das quick replies. */
  leadId: string;
  /** True se a conversa atual está arquivada (composer fica readonly). */
  archived?: boolean;
}

type ComposerMode = 'message' | 'note';

export function MessageComposer({ conversationId, leadId, archived }: MessageComposerProps) {
  const [mode, setMode] = React.useState<ComposerMode>('message');
  const [draft, setDraft] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Ref espelha `draft` pra que callbacks memoizados (`handleSubmit`,
  // `handleKeyDown`) leiam o valor atual sem depender de closure stale —
  // assim suas referências ficam estáveis entre renders e
  // `<EmojiPicker>`/`<QuickReplyPicker>` podem virar `React.memo` no futuro
  // sem quebrar a memo. Atualizado em layout effect (síncrono pré-paint).
  // Decisão alinhada com HIGH #2 do review M5#4b.
  const draftRef = React.useRef(draft);
  React.useLayoutEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Limpa draft ao trocar de conversa.
  //
  // **Limitação consciente:** drafts NÃO são preservados por conversa —
  // se o vendedor estava redigindo em conv_001 e clica em conv_002, o texto
  // some sem confirmação. Diverge do WhatsApp Web (que mantém drafts).
  // Decisão para M5: priorizar simplicidade do mock; em M5#4c ou M9
  // entra `Map<conversationId, draft>` se feedback indicar atrito.
  React.useEffect(() => {
    setDraft('');
  }, [conversationId]);

  // Contexto pra placeholders {nome}/{empresa} das quick replies. Lookup
  // memoizado via leadId — `getLead` é O(N) sobre 50 leads, mas sem useMemo
  // rodaria em cada keystroke do textarea.
  const placeholderContext = React.useMemo<PlaceholderContext>(() => {
    const lead = getLead(leadId);
    return {
      nome: lead?.name.split(' ')[0], // primeiro nome — mais natural em pt-BR
      empresa: lead?.company,
    };
  }, [leadId]);

  // `handleSubmit` lê o draft via `draftRef.current` (sempre o valor mais
  // recente sem invalidar o memo). Deps intencionalmente mínimas — só o
  // que **muda o comportamento** entre renders.
  // (HIGH #1 do review M5#4b: deps anteriores incluíam `trimmed` que era
  //  nova string a cada render, invalidando o memo.)
  const handleSubmit = React.useCallback(() => {
    if (archived) return;
    const trimmed = draftRef.current.trim();
    if (trimmed.length === 0) return;

    setSubmitting(true);
    try {
      if (mode === 'message') {
        if (trimmed.length > 4096) {
          toast.error('Mensagem muito longa.', { duration: 4000 });
          return;
        }
        sendMessage(conversationId, { body: trimmed });
        toast.success('Mensagem enviada.', { duration: 2500 });
      } else {
        if (trimmed.length > 2000) {
          toast.error('Nota muito longa.', { duration: 4000 });
          return;
        }
        sendInternalNote(conversationId, { body: trimmed });
        toast.success('Nota interna salva.', { duration: 2500 });
      }
      setDraft('');
      // Re-foca textarea pra continuação de digitação (UX WhatsApp Web).
      requestAnimationFrame(() => textareaRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  }, [archived, conversationId, mode]);

  // `canSubmit` é só pra UI (disabled do botão); recomputado em cada render
  // mas não afeta callbacks memoizados.
  const canSubmit = draft.trim().length > 0 && !submitting && !archived;

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ignora Enter enquanto IME tá compondo (acentos pt-BR, japonês, chinês).
      // Sem isso, digitar "ção" submete a mensagem no meio da composição.
      if (event.nativeEvent.isComposing) return;

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
        return;
      }

      if (event.key === 'Escape') {
        // Lê draft atual via ref (estável entre renders).
        if (draftRef.current.length > 0) {
          event.preventDefault();
          setDraft('');
        }
        // Se draft já vazio, deixa Esc fluir (ex: fecha popover/dropdown
        // aberto sobre o composer).
      }
    },
    [handleSubmit],
  );

  // `insertAtCursor` estável — usa functional setter + DOM ref direto pra
  // posição do cursor. Sem deps de `draft` ⇒ referência estável entre
  // renders ⇒ `<EmojiPicker>` pode ser `React.memo` no futuro sem quebrar.
  // (HIGH #2 do review M5#4b)
  const insertAtCursor = React.useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      // Fallback: append no fim com espaço de cortesia.
      setDraft((curr) =>
        curr.endsWith(' ') || curr.length === 0 ? curr + text : curr + ' ' + text,
      );
      return;
    }
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    setDraft((curr) => curr.slice(0, start) + text + curr.slice(end));
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const cursor = start + text.length;
      el.setSelectionRange(cursor, cursor);
    });
  }, []);

  const handleQuickReply = React.useCallback((resolvedBody: string) => {
    // Quick reply substitui o draft inteiro — comportamento padrão de
    // WhatsApp Business e Slack (vendedor pode editar antes de enviar).
    setDraft(resolvedBody);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      // Cursor no fim pra editar continuamente.
      const len = resolvedBody.length;
      el.setSelectionRange(len, len);
    });
  }, []);

  async function handleFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Detecção de kind por mime-type. Audio aqui só se vendedor escolher um
    // .mp3/.ogg via "Anexar"; o caminho normal é o `<AudioRecordButton>`.
    const kind: 'image' | 'audio' | 'document' = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'document';

    const mediaSizeKb = Math.max(1, Math.round(file.size / 1024));

    // CRITICAL #3 do review: schema exige `mediaDurationSeconds` quando
    // `kind === 'audio'`. Lemos a duração via `<audio>` em memória; se
    // falhar (formato inválido, browser sem suporte), degradamos pra
    // `document` em vez de criar mensagem inconsistente.
    if (kind === 'audio') {
      try {
        const duration = await readAudioDurationSeconds(file);
        attachMedia(conversationId, {
          kind: 'audio',
          mediaName: file.name,
          mediaSizeKb,
          mediaDurationSeconds: Math.max(1, Math.round(duration)),
        });
      } catch {
        // Fallback: trata como documento. UX honesta — preview muda de
        // 🎤 pra 📄 mas a mensagem é registrada e o vendedor pode reenviar.
        attachMedia(conversationId, {
          kind: 'document',
          mediaName: file.name,
          mediaSizeKb,
        });
      }
    } else {
      attachMedia(conversationId, { kind, mediaName: file.name, mediaSizeKb });
    }

    toast.success(`${file.name} anexado.`, { duration: 2500 });

    // Reset do input pra permitir anexar o MESMO arquivo de novo (sem o
    // reset, `onChange` não dispara segunda vez).
    event.target.value = '';
  }

  if (archived) {
    return (
      <div
        className="bg-muted/30 border-border flex items-center justify-center gap-2 border-t px-4 py-4 text-center"
        role="region"
        aria-label="Conversa arquivada"
      >
        <span className="text-caption text-muted-foreground max-w-md">
          Conversa arquivada. Desarquive na lista pra responder.
        </span>
      </div>
    );
  }

  const isNote = mode === 'note';

  return (
    <div
      className={cn(
        'border-border flex flex-col border-t transition-colors',
        isNote ? 'bg-accent/10' : 'bg-card',
      )}
      // Container do composer: atalhos globais (g+i, /, n) ficam suspensos
      // enquanto user tá digitando aqui — `useGlobalShortcuts` já ignora
      // textarea, mas marcar explícito blinda contra futuras adições.
      data-shortcut-ignore
    >
      <Tabs value={mode} onValueChange={(v) => setMode(v as ComposerMode)} className="px-4 pt-3">
        <TabsList className="bg-muted/60 h-8">
          <TabsTrigger value="message" className="text-caption px-3 py-1">
            Mensagem
          </TabsTrigger>
          <TabsTrigger value="note" className="text-caption flex items-center gap-1.5 px-3 py-1">
            <Lock className="size-3" />
            Nota interna
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-2 px-4 py-3">
        <AutoResizeTextarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isNote
              ? 'Nota interna — visível só pro time. Use pra contexto, próximas ações, observações.'
              : 'Mensagem para o WhatsApp do lead. Enter envia, Shift+Enter quebra linha.'
          }
          className={cn(
            // Borda transparente: o card já tem cor; deixar a textarea sem
            // borda visível dá impressão de painel único (WhatsApp/iMessage).
            'border-transparent bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
            isNote ? 'placeholder:text-accent-foreground/50' : '',
          )}
          aria-label={isNote ? 'Nota interna' : 'Nova mensagem'}
          maxLength={isNote ? 2000 : 4096}
          disabled={submitting}
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <EmojiPicker onSelect={insertAtCursor} disabled={submitting} />
            <AttachmentButton onPick={handleFilePicked} disabled={submitting} />
            {!isNote && (
              <>
                <QuickReplyPicker
                  context={placeholderContext}
                  onSelect={handleQuickReply}
                  disabled={submitting}
                />
                <AudioRecordButton conversationId={conversationId} disabled={submitting} />
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isNote && (
              <span className="text-caption text-accent-foreground/70 hidden sm:inline">
                Só o time vê
              </span>
            )}
            <Button
              type="button"
              size="sm"
              variant={isNote ? 'secondary' : 'default'}
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-label={isNote ? 'Salvar nota interna' : 'Enviar mensagem'}
            >
              <Send className="size-4" />
              <span className="hidden sm:inline">{isNote ? 'Salvar nota' : 'Enviar'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Botão de anexo (input file escondido) ────────────────────────────────

interface AttachmentButtonProps {
  onPick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Lê duração (segundos) de um arquivo de áudio via `<audio>` em memória.
 * Resolve com NaN-safe ou rejeita se o browser não conseguir decodificar.
 * Usado pra cumprir o invariante do `attachMediaSchema` (CRITICAL #3 do
 * review M5#4b: kind=audio sem duração viola o schema).
 */
function readAudioDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement('audio');
    function cleanup() {
      URL.revokeObjectURL(url);
      el.remove();
    }
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const d = el.duration;
      cleanup();
      if (!Number.isFinite(d) || d <= 0) {
        reject(new Error('Duração inválida'));
        return;
      }
      resolve(d);
    };
    el.onerror = () => {
      cleanup();
      reject(new Error('Não foi possível decodificar o áudio'));
    };
    el.src = url;
  });
}

function AttachmentButton({ onPick, disabled }: AttachmentButtonProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        // image/* + audio/* + comuns de documento. Sem `application/*` aberto
        // pra evitar .exe/.bat sendo "anexados" (UX, não segurança — o real
        // mime check fica em M9 no Storage).
        accept="image/*,audio/*,application/pdf,.doc,.docx,.txt,.xlsx,.csv"
        className="sr-only"
        onChange={onPick}
        // Mark explícito pra que screen readers anunciem "Anexar arquivo"
        // pelo aria-label do botão (input file nativo tem cópia do navegador).
        aria-hidden
        tabIndex={-1}
        disabled={disabled}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-9 shrink-0 p-0"
        aria-label="Anexar arquivo"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        <Paperclip className="size-4" />
      </Button>
    </>
  );
}
