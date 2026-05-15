'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
  Textarea,
} from '@papopro/ui';
import { Loader2 } from '@papopro/ui/icons';

import { createNoteActivityAction } from '@/features/activities/actions';
import { createNoteSchema, type CreateNoteInput } from '@/features/activities/schemas';

/**
 * Dialog minimalista pra adicionar nota manual na timeline do lead (M8#4).
 *
 * Notas vão pra activity append-only com type `note`. Não há edição —
 * corrige-se adicionando nota nova (decisão arquitetural: timeline é
 * append-only por design, auditoria LGPD).
 */

interface NoteCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
}

export function NoteCreateDialog({ open, onOpenChange, leadId }: NoteCreateDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateNoteInput>({
    resolver: zodResolver(createNoteSchema),
    defaultValues: { leadId, body: '' },
  });

  React.useEffect(() => {
    if (open) {
      reset({ leadId, body: '' });
      setSubmitError(null);
    }
  }, [open, leadId, reset]);

  function onSubmit(data: CreateNoteInput) {
    setSubmitError(null);
    startTransition(async () => {
      const result = await createNoteActivityAction(data);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      toast.success('Nota adicionada.', { duration: 3000 });
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar nota</DialogTitle>
          <DialogDescription>
            Registre algo importante do contato — só seu time vê. Notas viram parte do histórico do
            lead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <input type="hidden" {...register('leadId')} />

          <div className="flex flex-col gap-1.5">
            <Label className="text-caption text-muted-foreground font-medium">Sua nota*</Label>
            <Textarea
              {...register('body')}
              placeholder="ex: Cliente pediu desconto, vai falar com o sócio antes."
              rows={5}
              autoFocus
              aria-invalid={Boolean(errors.body)}
            />
            {errors.body && (
              <span role="alert" className="text-caption text-destructive">
                {errors.body.message}
              </span>
            )}
          </div>

          {submitError && (
            <p role="alert" className="text-caption text-destructive">
              {submitError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Salvar nota
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
