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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@papopro/ui';

import { transferOwnership, useMembers } from '../store';

interface TransferOwnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog de transferência de propriedade. Lista todos os membros ativos exceto
 * o Owner atual; ao confirmar, o transform troca os papéis (Owner → Admin,
 * destino → Owner).
 *
 * Confirmação dupla: precisa selecionar um membro E clicar "Transferir agora".
 * Botão destrutivo (`variant="destructive"`) — operação irreversível pelo
 * usuário antigo (precisa do novo Owner pra reverter).
 */
export function TransferOwnershipDialog({ open, onOpenChange }: TransferOwnershipDialogProps) {
  const members = useMembers();
  const [selected, setSelected] = React.useState<string>('');

  const eligible = members.filter((m) => m.role !== 'owner' && m.status === 'active');

  // Reseta seleção sempre que abrir o dialog.
  React.useEffect(() => {
    if (open) setSelected('');
  }, [open]);

  function handleConfirm() {
    if (!selected) return;
    const r = transferOwnership({ newOwnerId: selected });
    if (!r.ok) {
      toast.error(r.reason ?? 'Não foi possível transferir agora');
      return;
    }
    toast.success('Propriedade transferida — você agora é Admin');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir propriedade</DialogTitle>
          <DialogDescription>
            O novo Owner ganha acesso total ao workspace, inclusive cobrança. Você passa
            automaticamente para Admin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="new-owner">Escolha o novo Owner</Label>
          {eligible.length === 0 ? (
            <p className="text-body text-muted-foreground">
              Nenhum membro ativo elegível. Convide alguém antes de transferir.
            </p>
          ) : (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger id="new-owner">
                <SelectValue placeholder="Selecione um membro ativo" />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} <span className="text-muted-foreground">· {m.email}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!selected}>
            Transferir agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
