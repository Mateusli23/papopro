'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { toast } from 'react-hot-toast';

import { Button, cn } from '@papopro/ui';
import { Loader2, Upload } from '@papopro/ui/icons';

import { uploadKnowledgeDocumentAction } from '../knowledge-actions';

/**
 * Dropzone de upload do Cérebro (M11#4) — funcional.
 *
 * Aceita PDF, TXT, MD até 10 MB. Cada upload faz tudo na request:
 * upload Storage → extração → chunking → embedding → persist. Tipos
 * extras (DOC/DOCX) entram no Storage mas processing retorna `failed`
 * (lib de extração em follow-up).
 *
 * **Custo:** cada upload consome embeddings OpenAI (~\$0.0003 pra ~50KB
 * texto). UI mostra disclaimer.
 *
 * **Não desabilita pra non-Owner/Admin no client** — Server Action
 * `requireRole(['Owner','Admin'])` rejeita; UI mostra toast com a mensagem
 * propositiva. Mesmo padrão de outras actions sensíveis.
 */

const ACCEPT_ATTR = '.pdf,.txt,.md';
const MAX_BYTES = 10 * 1024 * 1024;

interface KnowledgeUploadZoneProps {
  className?: string;
}

export function KnowledgeUploadZone({ className }: KnowledgeUploadZoneProps) {
  const router = useRouter();
  const [dragOver, setDragOver] = React.useState(false);
  const [processing, setProcessing] = React.useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  async function processFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error(`${file.name}: arquivo muito grande (máx 10 MB).`, { duration: 4000 });
      return;
    }

    setProcessing((prev) => [...prev, file.name]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await uploadKnowledgeDocumentAction(formData);
      if (!result.ok) {
        toast.error(result.error, { duration: 5000 });
        return;
      }
      if (result.status === 'failed') {
        toast.error(`${file.name}: ${result.errorDetail ?? 'não foi possível processar.'}`, {
          duration: 6000,
        });
        return;
      }
      toast.success(`${file.name} indexado — disponível pros agentes via RAG.`, {
        duration: 4000,
      });
      router.refresh();
    } catch (err) {
      toast.error(`${file.name}: erro inesperado — recarregue e tente novamente.`, {
        duration: 5000,
      });
      console.error('[knowledge.upload]', err);
    } finally {
      setProcessing((prev) => prev.filter((n) => n !== file.name));
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((f) => {
      void processFile(f);
    });
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => {
      void processFile(f);
    });
    // Reset pra permitir upload sucessivo do mesmo arquivo.
    e.target.value = '';
  }

  return (
    <div className={className}>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        className={cn(
          'border-border bg-muted/20 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition',
          dragOver && 'border-primary bg-primary/5',
        )}
      >
        <Upload
          className={cn('size-6', dragOver ? 'text-primary' : 'text-muted-foreground')}
          aria-hidden
        />
        <p className="text-body text-foreground font-medium">
          Arraste arquivos ou{' '}
          <Button
            type="button"
            variant="link"
            className="text-body px-0"
            onClick={() => fileInputRef.current?.click()}
          >
            clique pra escolher
          </Button>
        </p>
        <p className="text-caption text-muted-foreground/80">
          PDF, TXT, MD até 10 MB. Cada arquivo é extraído, chunkeado e indexado em pgvector — fica
          disponível pra todos os agentes do workspace via RAG. Cada upload consome embeddings
          OpenAI (~\$0.0003 / 50KB texto).
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          onChange={handleFilePick}
          className="sr-only"
          aria-label="Escolher arquivos pra Cérebro da Empresa"
        />
      </div>

      {processing.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1" aria-live="polite">
          {processing.map((name) => (
            <li
              key={name}
              className="text-caption text-muted-foreground bg-muted/40 inline-flex items-center gap-2 rounded-md px-3 py-1"
            >
              <Loader2 className="size-3 animate-spin" />
              <span>Processando {name}…</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
