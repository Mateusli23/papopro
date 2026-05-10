'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import { Label, Textarea, cn } from '@papopro/ui';

import { updateKbSection } from '../store';
import type { KnowledgeBase } from '../types';

/**
 * Editor de uma seção do Cérebro da Empresa. Cada seção é um Textarea grande
 * com label + descrição + contador de caracteres.
 *
 * Salva no store em `onBlur` — escrever no Cérebro é gesto longo, salvar a
 * cada keystroke causa renders excessivos. Em M11 vira Server Action async
 * com optimistic update.
 *
 * `id` na seção (`anchor`) é usado pela sidebar âncoras pra scroll-into-view.
 */

type SectionKey = keyof Pick<KnowledgeBase, 'about' | 'products' | 'faq' | 'scripts' | 'policy'>;

const MAX_CHARS: Record<SectionKey, number> = {
  about: 4000,
  products: 8000,
  faq: 8000,
  scripts: 4000,
  policy: 4000,
};

interface KnowledgeSectionEditorProps {
  anchor: string;
  sectionKey: SectionKey;
  title: string;
  description: string;
  placeholder: string;
  value: string;
}

export function KnowledgeSectionEditor({
  anchor,
  sectionKey,
  title,
  description,
  placeholder,
  value,
}: KnowledgeSectionEditorProps) {
  const [draft, setDraft] = React.useState(value);

  // Sync com store quando muda externamente.
  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  function handleBlur() {
    if (draft === value) return;
    // Bloqueia save quando passa do limite — UI já estava pintando vermelho,
    // mas o valor era persistido silenciosamente (review MEDIUM M5#5).
    // Toast propositiva: fala o limite e pede ação.
    if (draft.length > MAX_CHARS[sectionKey]) {
      toast.error(`Reduza pra até ${MAX_CHARS[sectionKey]} caracteres antes de sair da seção.`, {
        duration: 4000,
      });
      return;
    }
    updateKbSection({ [sectionKey]: draft });
  }

  const len = draft.length;
  const max = MAX_CHARS[sectionKey];
  const nearLimit = len > max * 0.8;
  const overLimit = len > max;

  return (
    <section
      id={anchor}
      className="border-border bg-card flex scroll-mt-4 flex-col gap-2 rounded-lg border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={`kb-${sectionKey}`} className="text-body text-foreground font-semibold">
            {title}
          </Label>
          <p className="text-caption text-muted-foreground/80">{description}</p>
        </div>
        <span
          className={cn(
            'text-caption tabular-nums',
            overLimit
              ? 'text-destructive font-semibold'
              : nearLimit
                ? 'text-warning'
                : 'text-muted-foreground/60',
          )}
        >
          {len} / {max}
        </span>
      </div>

      <Textarea
        id={`kb-${sectionKey}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        rows={8}
        placeholder={placeholder}
        aria-invalid={overLimit ? true : undefined}
        className="text-body font-mono"
      />
    </section>
  );
}
