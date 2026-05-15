'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@papopro/ui';
import { Download, FileText, MoreVertical, Paperclip, Trash2, Upload } from '@papopro/ui/icons';

import {
  deleteAttachmentAction,
  getAttachmentDownloadUrlAction,
  uploadAttachmentAction,
} from '@/features/attachments/actions';
import type { AttachmentUI } from '@/features/attachments/transforms';

/**
 * `LeadAttachmentsCard` (M8#6) — seção da ficha do lead com lista de
 * anexos + upload via drag-and-drop ou clique.
 *
 * **RBAC visível:**
 *  - Botão "Anexar" só aparece se `canUpload` (Owner/Admin/Manager/Vendedor).
 *  - "Excluir" em cada item aparece se o caller é Manager+ OU é o autor do
 *    upload (compara `attachment.uploadedById === callerUserId`).
 *
 * **Upload:** envia File via FormData → `uploadAttachmentAction`. Validação
 * client (mime/size) acontece *antes* da chamada pra dar mensagem rápida;
 * a Server Action valida de novo (defense-in-depth).
 */

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ACCEPT_ATTR = ACCEPTED_MIME_TYPES.join(',');
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Role = 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer';

interface LeadAttachmentsCardProps {
  leadId: string;
  initialAttachments: AttachmentUI[];
  callerUserId: string;
  callerRole: Role;
}

export function LeadAttachmentsCard({
  leadId,
  initialAttachments,
  callerUserId,
  callerRole,
}: LeadAttachmentsCardProps) {
  const router = useRouter();
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const canUpload = callerRole !== 'Viewer';
  const isManagerOrAbove =
    callerRole === 'Owner' || callerRole === 'Admin' || callerRole === 'Manager';

  async function handleFile(file: File) {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      toast.error('Tipo de arquivo não suportado. Aceitamos PDF, imagens e Word.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Arquivo muito grande (máx. 10 MB).');
      return;
    }

    const formData = new FormData();
    formData.append('leadId', leadId);
    formData.append('file', file);

    setUploading(true);
    try {
      const result = await uploadAttachmentAction(formData);
      if (result.ok) {
        toast.success(`${file.name} anexado.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="size-4" /> Anexos
            <span className="text-caption text-muted-foreground font-normal">
              ({initialAttachments.length})
            </span>
          </CardTitle>
          <CardDescription>Propostas, contratos, fotos. Máx. 10 MB por arquivo.</CardDescription>
        </div>
        {canUpload && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Upload /> {uploading ? 'Enviando…' : 'Anexar'}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                // Reset pra permitir mesmo arquivo de novo se necessário.
                e.target.value = '';
              }}
            />
          </>
        )}
      </CardHeader>
      <CardContent
        onDragOver={(e) => {
          if (!canUpload) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!canUpload) return;
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={cn(
          'flex flex-col gap-2 rounded-md transition-colors',
          dragOver && 'bg-primary/5',
        )}
      >
        {initialAttachments.length === 0 ? (
          <div className="border-border text-caption text-muted-foreground flex flex-col items-center gap-1 rounded-md border border-dashed py-6 text-center">
            <Paperclip className="size-5 opacity-50" aria-hidden />
            {canUpload ? (
              <span>Arraste um arquivo aqui ou clique em "Anexar".</span>
            ) : (
              <span>Nenhum anexo neste lead.</span>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {initialAttachments.map((att) => (
              <AttachmentRow
                key={att.id}
                attachment={att}
                canDelete={isManagerOrAbove || att.uploadedById === callerUserId}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AttachmentRow({
  attachment,
  canDelete,
}: {
  attachment: AttachmentUI;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function handleDownload() {
    setBusy(true);
    try {
      const result = await getAttachmentDownloadUrlAction({ attachmentId: attachment.id });
      if (result.ok) {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Excluir "${attachment.fileName}"?`)) return;
    setBusy(true);
    try {
      const result = await deleteAttachmentAction({ attachmentId: attachment.id });
      if (result.ok) {
        toast.success('Anexo excluído.');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border-border bg-card flex items-center justify-between gap-2 rounded-md border px-3 py-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="flex flex-1 items-center gap-3 text-left hover:opacity-80 disabled:opacity-50"
      >
        <span className="bg-info/15 text-info flex size-9 shrink-0 items-center justify-center rounded">
          <FileText className="size-4" aria-hidden />
        </span>
        <span className="flex flex-1 flex-col gap-0.5 overflow-hidden">
          <span className="text-body text-foreground truncate font-medium">
            {attachment.fileName}
          </span>
          <span className="text-caption text-muted-foreground">
            {attachment.sizeLabel}
            {attachment.uploadedByName && ` · subido por ${attachment.uploadedByName}`}
            {' · '}
            {format(new Date(attachment.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}
          </span>
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Ações do anexo" disabled={busy}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDownload} disabled={busy}>
            <Download className="mr-2 size-4" /> Baixar
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem
              onClick={handleDelete}
              disabled={busy}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" /> Excluir
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
