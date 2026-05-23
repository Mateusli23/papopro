'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { toast } from 'react-hot-toast';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@papopro/ui';
import { Download, Loader2, ShieldCheck, Trash2 } from '@papopro/ui/icons';

import { eraseLeadDataAction } from '@/features/leads/lgpd-actions';

/**
 * Card de LGPD na ficha do lead (M13#3) — direitos do titular (Art. 18).
 *
 * **Exportar dados** (Owner/Admin): baixa o dump JSON completo via
 * `POST /api/exports/leads/[id]/lgpd`. `fetch` em vez de `<a download>` pra
 * ter loading + toast de erro propositivo.
 *
 * **Excluir dados** (Owner only): abre dialog com confirmação por digitação
 * do nome — apagamento irreversível. Sucesso → volta pra `/leads`.
 *
 * O componente só é montado pra Owner/Admin (o pai filtra por `callerRole`).
 */
interface LeadLgpdCardProps {
  leadId: string;
  leadName: string;
  canErase: boolean;
}

export function LeadLgpdCard({ leadId, leadName, canErase }: LeadLgpdCardProps) {
  const router = useRouter();
  const [exporting, setExporting] = React.useState(false);
  const [eraseOpen, setEraseOpen] = React.useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/exports/leads/${leadId}/lgpd`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error ?? 'Não foi possível exportar os dados agora.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        `lgpd-lead-${leadId.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Exportação concluída — download iniciado.');
    } catch {
      toast.error('Não foi possível exportar os dados agora. Tente em instantes.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="text-primary size-4" />
          Privacidade e LGPD
        </CardTitle>
        <CardDescription>
          Atenda solicitações do titular dos dados — portabilidade e eliminação.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            Exportar dados do lead
          </Button>
          <p className="text-caption text-muted-foreground">
            Baixa um arquivo com tudo que o workspace guarda sobre este lead. A exportação fica
            registrada na auditoria.
          </p>
        </div>

        {canErase && (
          <div className="border-border flex flex-col gap-1 border-t pt-3">
            <Button variant="destructive" onClick={() => setEraseOpen(true)}>
              <Trash2 />
              Excluir dados do lead
            </Button>
            <p className="text-caption text-muted-foreground">
              Apaga em definitivo o lead e tudo vinculado — negócios, conversas, anexos. Ação
              irreversível; só o registro de auditoria é mantido.
            </p>
          </div>
        )}
      </CardContent>

      {canErase && (
        <EraseLeadDialog
          open={eraseOpen}
          onOpenChange={setEraseOpen}
          leadId={leadId}
          leadName={leadName}
          onErased={() => {
            toast.success('Dados do lead excluídos definitivamente.');
            router.push('/leads');
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

interface EraseLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  onErased: () => void;
}

/**
 * Confirmação dupla — espelha `DeleteWorkspaceDialog`. O Owner digita o nome
 * exato do lead pra habilitar o botão; o nome também é revalidado no servidor
 * (`eraseLeadDataAction`) como defense-in-depth.
 */
function EraseLeadDialog({ open, onOpenChange, leadId, leadName, onErased }: EraseLeadDialogProps) {
  const [confirm, setConfirm] = React.useState('');
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setConfirm('');
      setPending(false);
    }
  }, [open]);

  const matches = confirm.trim() === leadName;

  async function handleConfirm() {
    if (!matches || pending) return;
    setPending(true);
    const result = await eraseLeadDataAction({ leadId, confirmName: confirm });
    if (!result.ok) {
      toast.error(result.error);
      setPending(false);
      return;
    }
    if (result.storageWarning) {
      toast('Alguns arquivos podem não ter sido removidos do armazenamento.', { icon: '⚠️' });
    }
    onOpenChange(false);
    onErased();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir dados do lead</DialogTitle>
          <DialogDescription>
            Esta ação apaga em definitivo{' '}
            <span className="text-foreground font-medium">{leadName}</span> e todos os dados
            vinculados — negócios, tarefas, histórico, conversas e anexos. Não há como desfazer.
            Apenas o registro de auditoria (sem dado pessoal) é mantido.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="confirm-lead-name">
            Digite <span className="text-foreground font-mono">{leadName}</span> para confirmar
          </Label>
          <Input
            id="confirm-lead-name"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={leadName}
            autoComplete="off"
            disabled={pending}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!matches || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
