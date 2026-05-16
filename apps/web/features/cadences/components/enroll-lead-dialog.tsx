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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@papopro/ui';

import { enrollLeadAction } from '../actions';

import type { AvailableCadence } from './lead-enrollments-section';

/**
 * Dialog "Inscrever em cadência" — usado no detalhe do lead.
 *
 * Mostra um select com cadências ATIVAS do workspace, idealmente na mesma
 * etapa do lead (Server Component decide o filtro inicial). UI também
 * sugere quais cadências já estão em uso pra o lead (`alreadyEnrolledIds`).
 */

interface EnrollLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  availableCadences: AvailableCadence[];
  /** IDs de cadências em que o lead já está inscrito (ativos ou pausados) — desabilita o item. */
  alreadyEnrolledIds: ReadonlySet<string>;
}

export function EnrollLeadDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  availableCadences,
  alreadyEnrolledIds,
}: EnrollLeadDialogProps) {
  const [selectedId, setSelectedId] = React.useState<string>('');
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) setSelectedId('');
  }, [open]);

  async function handleSubmit() {
    if (!selectedId || pending) return;
    setPending(true);
    const loadingId = toast.loading('Inscrevendo lead na cadência…');
    const result = await enrollLeadAction({ cadenceId: selectedId, leadId });
    toast.dismiss(loadingId);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const cadenceName = availableCadences.find((c) => c.id === selectedId)?.name;
    toast.success(`${leadName} inscrito em "${cadenceName ?? 'cadência'}".`, { duration: 4000 });
    onOpenChange(false);
  }

  const eligible = availableCadences.filter((c) => !alreadyEnrolledIds.has(c.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inscrever em cadência</DialogTitle>
          <DialogDescription>
            Escolha uma cadência ativa. O primeiro passo é disparado em até 5 minutos pelo motor.
          </DialogDescription>
        </DialogHeader>

        {eligible.length === 0 ? (
          <p className="text-muted-foreground text-body">
            Nenhuma cadência ativa disponível.{' '}
            {availableCadences.length > 0
              ? 'O lead já está inscrito em todas as cadências ativas.'
              : 'Ative uma cadência em /cadences antes de inscrever leads.'}
          </p>
        ) : (
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma cadência" />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedId || pending}>
            {pending ? 'Inscrevendo…' : 'Inscrever'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
