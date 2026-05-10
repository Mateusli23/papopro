'use client';

import * as React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@papopro/ui';

import { workspaceUpdateSchema, type WorkspaceUpdateInput } from '../schemas';
import { updateWorkspace, useWorkspaceSettings } from '../store';

const SEGMENT_LABELS: Record<WorkspaceUpdateInput['segment'], string> = {
  imobiliario: 'Imobiliário',
  b2b: 'B2B / Vendas consultivas',
  servicos: 'Serviços',
  outro: 'Outro',
};

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Recife',
  'America/Fortaleza',
];

/**
 * Form principal de `/settings/workspace`. Espelha as 4 entidades editáveis do
 * PRD §3.11: nome, segmento, fuso, logotipo (logo é mock leve — só metadata).
 *
 * Botão "Salvar" só habilita com `isDirty` — paridade com Linear/Notion.
 * Cancelar reseta pro snapshot do store.
 */
export function WorkspaceForm() {
  const workspace = useWorkspaceSettings();

  const form = useForm<WorkspaceUpdateInput>({
    resolver: zodResolver(workspaceUpdateSchema),
    defaultValues: {
      name: workspace.name,
      segment: workspace.segment,
      timezone: workspace.timezone,
    },
  });

  // Sempre que o snapshot do store muda (ex: outro form salva), refletir aqui.
  React.useEffect(() => {
    form.reset({
      name: workspace.name,
      segment: workspace.segment,
      timezone: workspace.timezone,
    });
  }, [workspace.name, workspace.segment, workspace.timezone, form]);

  function onSubmit(values: WorkspaceUpdateInput) {
    updateWorkspace(values);
    toast.success('Workspace atualizado');
    form.reset(values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados da empresa</CardTitle>
        <CardDescription>
          Esses dados aparecem nos seus relatórios, convites e e-mails transacionais.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da empresa</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Imobiliária Vista Mar" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="segment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Segmento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um segmento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(SEGMENT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fuso horário</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/*
             * Idioma e logotipo ficam fora do RHF — readonly em M5 (idioma é
             * fixo pt-BR, logotipo é metadata da fixture). Usamos `<Label>`
             * direto pra não precisar de contexto `<FormField>`.
             */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="workspace-locale">Idioma</Label>
                <Input id="workspace-locale" value="Português (Brasil)" disabled readOnly />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="workspace-logo">Logotipo</Label>
                <Input
                  id="workspace-logo"
                  value={workspace.logo?.name ?? 'Sem logotipo enviado'}
                  disabled
                  readOnly
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={!form.formState.isDirty}
                onClick={() =>
                  form.reset({
                    name: workspace.name,
                    segment: workspace.segment,
                    timezone: workspace.timezone,
                  })
                }
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!form.formState.isDirty}>
                Salvar alterações
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
