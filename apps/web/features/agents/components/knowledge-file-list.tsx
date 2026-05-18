'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

import { Badge, Button, EmptyState, cn } from '@papopro/ui';
import { File, FileText, Trash2 } from '@papopro/ui/icons';

import { deleteKnowledgeDocumentAction } from '../knowledge-actions';
import type { KnowledgeFile } from '../types';

/**
 * Lista de arquivos do Cérebro (M11#4) — agora funcional.
 *
 * Cada linha mostra ícone por kind, nome, size formatado, status badge,
 * timestamp e botão remover. Remoção chama `deleteKnowledgeDocumentAction`
 * que soft-deleta a row (cascade limpa chunks + embeddings via FK).
 *
 * Estado vazio = EmptyState orientador (admin sobe no upload acima).
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
        description="Aceita PDF, TXT e MD até 10 MB. Cada arquivo vira chunks + embeddings em pgvector pra busca semântica."
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
  const router = useRouter();
  const Icon = KIND_ICON[file.kind];
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    if (
      !confirm(`Remover "${file.name}" do Cérebro? Chunks e embeddings também serão deletados.`)
    ) {
      return;
    }
    setDeleting(true);
    const result = await deleteKnowledgeDocumentAction(file.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error, { duration: 5000 });
      return;
    }
    toast.success(`${file.name} removido.`, { duration: 3000 });
    router.refresh();
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
            {file.status === 'processed' ? 'Indexado' : 'Processando…'}
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
        disabled={deleting}
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
