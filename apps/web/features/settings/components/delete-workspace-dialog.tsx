'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@papopro/ui';

import { useWorkspaceSettings } from '../store';

interface DeleteWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmação dupla — Owner precisa digitar o nome exato do workspace para
 * habilitar o botão destrutivo. Em M5 não persiste exclusão (toast e fecha);
 * em M7+ chama Server Action que marca workspace como `deleted_at` (soft
 * delete com 30 dias de retenção, CLAUDE.md §7.7).
 */
export function DeleteWorkspaceDialog({ open, onOpenChange }: DeleteWorkspaceDialogProps) {
  const workspace = useWorkspaceSettings();
  const [confirm, setConfirm] = React.useState('');

  React.useEffect(() => {
    if (open) setConfirm('');
  }, [open]);

  const matches = confirm.trim() === workspace.name;

  function handleConfirm() {
    toast.success(
      'Solicitação registrada — entraremos em contato em até 24h para confirmar a exclusão.',
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir workspace</DialogTitle>
          <DialogDescription>
            Essa ação remove todos os dados — leads, conversas, agentes, cadências, faturas. Os
            membros ativos perdem o acesso imediatamente. Operação irreversível após 30 dias.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="confirm-name">
            Digite <span className="text-foreground font-mono">{workspace.name}</span> para
            confirmar
          </Label>
          <Input
            id="confirm-name"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={workspace.name}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!matches}>
            Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
