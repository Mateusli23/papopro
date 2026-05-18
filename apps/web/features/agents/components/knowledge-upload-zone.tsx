'use client';

import { cn } from '@papopro/ui';
import { Upload } from '@papopro/ui/icons';

/**
 * Zona de upload do Cérebro — **stub em M11#3** enquanto M11#4 não entrega
 * o pipeline (extração de texto + chunking + embedding em Edge Function).
 *
 * UI sem dropzone funcional, apenas microcopy "em breve" pra que admins
 * saibam que vai ser possível. Em M11#4 voltamos a habilitar.
 */

interface KnowledgeUploadZoneProps {
  className?: string;
}

export function KnowledgeUploadZone({ className }: KnowledgeUploadZoneProps) {
  return (
    <div className={className}>
      <div
        className={cn(
          'border-border bg-muted/20 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center',
          'opacity-60',
        )}
        aria-disabled
      >
        <Upload className="text-muted-foreground size-6" aria-hidden />
        <p className="text-body text-foreground font-medium">Upload de documentos em breve</p>
        <p className="text-caption text-muted-foreground/80">
          PDF, DOC, DOCX, TXT e MD com extração, chunking e busca semântica entram em M11#4. Por
          enquanto, use os 5 campos estruturados acima.
        </p>
      </div>
    </div>
  );
}
