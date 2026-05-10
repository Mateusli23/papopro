'use client';

import * as React from 'react';

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Badge, Button, EmptyState, cn } from '@papopro/ui';
import { File, FileText, Trash2 } from '@papopro/ui/icons';

import { showUndoableToast } from '@/lib/utils/show-undoable-toast';

import { addKbFile, deleteKbFile } from '../store';
import type { KnowledgeFile } from '../types';

/**
 * Lista de arquivos do Cérebro da Empresa. Cada linha mostra ícone por kind,
 * nome do arquivo, size formatado, status, timestamp de upload e botão
 * remover (com Desfazer 5s no toast).
 *
 * Estado vazio = EmptyState orientador. Em M11 vira tabela paginável quando
 * o workspace passar de 50 arquivos.
 */

const KIND_ICON = {
  pdf: FileText,
  doc: FileText,
  txt: File,
} as const;

interface KnowledgeFileListProps {
  files: KnowledgeFile[];
}

export function KnowledgeFileList({ files }: KnowledgeFileListProps) {
  if (files.length === 0) {
    return (
      <EmptyState
        icon={File}
        title="Nenhum arquivo enviado"
        description="Aceita PDF, DOC e TXT até 10 MB. Em M11 viram embeddings pra busca semântica."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {files.map((file) => (
        <FileRow key={file.id} file={file} />
      ))}
    </ul>
  );
}

interface FileRowProps {
  file: KnowledgeFile;
}

function FileRow({ file }: FileRowProps) {
  const Icon = KIND_ICON[file.kind];

  function handleDelete() {
    const snapshot = file;
    deleteKbFile(file.id);
    showUndoableToast(
      <span>
        <strong>{file.name}</strong> removido
      </span>,
      () => {
        // Desfazer = re-adicionar com mesmos metadados.
        addKbFile({
          name: snapshot.name,
          sizeBytes: snapshot.sizeBytes,
          kind: snapshot.kind,
        });
      },
    );
  }

  const uploadedAtAbs = format(parseISO(file.uploadedAt), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  return (
    <li className="border-border bg-card flex items-center gap-3 rounded-md border px-3 py-2">
      <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
        <Icon className="size-4" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-body text-foreground truncate font-medium">{file.name}</span>
          <Badge
            variant={file.status === 'processed' ? 'success' : 'secondary'}
            className="text-caption shrink-0"
          >
            {file.status === 'processed' ? 'Processado' : 'Processando'}
          </Badge>
        </div>
        <div className="text-caption text-muted-foreground/80 flex flex-wrap items-center gap-x-2">
          <span>{formatSize(file.sizeBytes)}</span>
          <span aria-hidden>·</span>
          <span className="uppercase">{file.kind}</span>
          <span aria-hidden>·</span>
          <time dateTime={file.uploadedAt}>{uploadedAtAbs}</time>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        aria-label={`Remover ${file.name}`}
        className={cn('text-muted-foreground hover:text-destructive size-8 shrink-0')}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
