'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import { Button, cn } from '@papopro/ui';
import { Upload } from '@papopro/ui/icons';

import { kbFileUploadSchema } from '../schemas';
import { addKbFile } from '../store';
import type { KnowledgeFile } from '../types';

/**
 * Zona de drag-and-drop pra upload de arquivos do Cérebro. **Mock total** —
 * lemos só `name`/`size`/`type` do `File`, **nunca** chamamos `FileReader`
 * ou `Blob.text()`. O conteúdo real vai ser processado em M11 com extração
 * de texto + chunking + embeddings via pgvector.
 *
 * Fluxo:
 *  1. Usuário arrasta arquivo (ou clica → file picker)
 *  2. Validamos via Zod (size, kind permitido)
 *  3. Mock processing 1.5s (status `'processing'`)
 *  4. Chama `addKbFile` no store (status `'processed'`)
 *  5. Toast confirmando
 */

const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt'] as const;
const ACCEPT_ATTR = '.pdf,.doc,.docx,.txt';

interface KnowledgeUploadZoneProps {
  className?: string;
}

export function KnowledgeUploadZone({ className }: KnowledgeUploadZoneProps) {
  const [dragOver, setDragOver] = React.useState(false);
  const [processing, setProcessing] = React.useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  function processFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
      toast.error(`Tipo de arquivo não suportado: ${ext}. Aceita PDF, DOC, TXT.`, {
        duration: 4000,
      });
      return;
    }

    // Normaliza extensão pra `kind` — `docx` vira `doc` no schema.
    const kind: KnowledgeFile['kind'] = ext === 'pdf' ? 'pdf' : ext === 'txt' ? 'txt' : 'doc';

    const parsed = kbFileUploadSchema.safeParse({
      name: file.name,
      sizeBytes: file.size,
      kind,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Arquivo inválido', { duration: 4000 });
      return;
    }

    // Mock processing 1.5s — vendedor vê o feedback "{file} processando…"
    setProcessing((prev) => [...prev, file.name]);
    setTimeout(() => {
      addKbFile(parsed.data);
      setProcessing((prev) => prev.filter((n) => n !== file.name));
      toast.success(`${file.name} processado e disponível pros agentes.`, { duration: 4000 });
    }, 1500);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(processFile);
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach(processFile);
    // Reset input pra permitir uploads sucessivos do mesmo arquivo.
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
          Aceita PDF, DOC e TXT até 10 MB. Cada arquivo é processado e fica disponível pra todos os
          agentes do workspace.
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
              <span className="animate-spin">↻</span>
              <span>Processando {name}…</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
