'use client';

import { EmptyState } from '@papopro/ui';
import { File } from '@papopro/ui/icons';

import type { KnowledgeFile } from '../types';

/**
 * Lista de arquivos do Cérebro — **stub em M11#3** enquanto M11#4 não
 * entrega upload. Por contrato continua aceitando `files: KnowledgeFile[]`
 * (sempre vazio em M11#3 — queries.ts retorna `[]`).
 */

interface KnowledgeFileListProps {
  files: KnowledgeFile[];
}

export function KnowledgeFileList({ files }: KnowledgeFileListProps) {
  // files sempre vazio em M11#3 (M11#4 popula). Mantido pra contrato.
  void files;

  return (
    <EmptyState
      icon={File}
      title="Nenhum arquivo enviado"
      description="O upload de documentos do Cérebro entra em M11#4 — por enquanto, configure os 5 campos estruturados acima."
    />
  );
}
