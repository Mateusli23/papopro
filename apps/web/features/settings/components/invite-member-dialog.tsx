'use client';

import * as React from 'react';

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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@papopro/ui';

import { INVITE_ROLES, inviteMemberSchema, type InviteMemberInput } from '../schemas';
import { inviteMember } from '../store';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_LABELS: Record<(typeof INVITE_ROLES)[number], { label: string; description: string }> = {
  admin: {
    label: 'Admin',
    description: 'Acesso total exceto cobrança.',
  },
  manager: {
    label: 'Manager',
    description: 'Vê todos os leads do time, edita pipeline e cadências; não convida usuários.',
  },
  vendedor: {
    label: 'Vendedor',
    description: 'Acesso apenas aos próprios leads.',
  },
  viewer: {
    label: 'Viewer',
    description: 'Somente leitura — sócio, mentor, contador.',
  },
};

/**
 * Form de convite de membro. Email + papel (Owner não disponível — só via
 * transferência). Em M5 cria linha com status `'invited'` instantaneamente;
 * em M7 dispara magic link real via Resend.
 */
export function InviteMemberDialog({ open, onOpenChange }: InviteMemberDialogProps) {
  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '', role: 'vendedor' },
  });

  React.useEffect(() => {
    if (open) form.reset({ email: '', role: 'vendedor' });
  }, [open, form]);

  function onSubmit(values: InviteMemberInput) {
    const r = inviteMember(values);
    if (r.alreadyExists) {
      toast.error(`${values.email} já está no workspace`);
      return;
    }
    toast.success(`Convite enviado para ${values.email}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
          <DialogDescription>
            Enviamos um link mágico por e-mail. Quando aceito, o membro entra direto.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      autoComplete="email"
                      placeholder="colaborador@empresa.com.br"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INVITE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          <span className="flex flex-col">
                            <span className="text-body font-medium">{ROLE_LABELS[role].label}</span>
                            <span className="text-caption text-muted-foreground">
                              {ROLE_LABELS[role].description}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Enviar convite
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
