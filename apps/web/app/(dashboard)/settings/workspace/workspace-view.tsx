'use client';

import * as React from 'react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@papopro/ui';
import { LogOut, Trash2 } from '@papopro/ui/icons';

import { DeleteWorkspaceDialog } from '@/features/settings/components/delete-workspace-dialog';
import { TransferOwnershipDialog } from '@/features/settings/components/transfer-ownership-dialog';
import { WorkspaceForm } from '@/features/settings/components/workspace-form';

/**
 * `/settings/workspace` — primeira aba após o redirect de `/settings`.
 *
 * Estrutura: form principal + zona de perigo (transferir / excluir).
 * Form salva via store mock; danger zone abre dialogs com confirmação dupla.
 *
 * Em M7+ form vira Server Action `updateWorkspace` (mesmo schema Zod);
 * dialogs viram fluxos reais (transferOwnership envia email, deleteWorkspace
 * marca `deleted_at` com 30d de retenção).
 */
export function WorkspaceView() {
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Workspace"
        description="Configurações gerais da empresa que aparecem em e-mails, relatórios e convites."
      />

      <WorkspaceForm />

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">Zona de perigo</CardTitle>
          <CardDescription>Operações irreversíveis. Apenas o Owner pode executar.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="border-border flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-body font-medium">Transferir propriedade</span>
              <span className="text-body text-muted-foreground">
                Promove outro membro a Owner. Você passa para Admin.
              </span>
            </div>
            <Button variant="outline" onClick={() => setTransferOpen(true)}>
              <LogOut /> Transferir
            </Button>
          </div>

          <div className="border-destructive/30 bg-destructive/5 flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-body text-destructive font-medium">Excluir workspace</span>
              <span className="text-body text-muted-foreground">
                Remove leads, conversas, agentes, cadências e faturas. Sem volta após 30 dias.
              </span>
            </div>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 /> Excluir
            </Button>
          </div>
        </CardContent>
      </Card>

      <TransferOwnershipDialog open={transferOpen} onOpenChange={setTransferOpen} />
      <DeleteWorkspaceDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
