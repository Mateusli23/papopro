'use client';

import * as React from 'react';

import { Input, Label } from '@papopro/ui';

interface WorkspaceStepProps {
  value: string;
  onChange: (v: string) => void;
}

/**
 * Passo 1 — confirma/edita o nome do workspace.
 *
 * Hoje é input simples; em M7 vira chamada `createWorkspace` Server Action
 * que retorna o `workspace_id` e seta o cookie de workspace ativo.
 *
 * Validação visual fica no controller (o botão "Continuar" sempre avança;
 * estado vazio é aceitável porque o usuário pode "Pular este passo").
 */
export function WorkspaceStep({ value, onChange }: WorkspaceStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-foreground text-title font-semibold">
          Como vamos chamar seu workspace?
        </h3>
        <p className="text-muted-foreground text-body">
          Use o nome da empresa, do time ou da operação. Aparece pra você e pra equipe que você
          convidar depois.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wizard-workspace-name">Nome do workspace</Label>
        <Input
          id="wizard-workspace-name"
          autoFocus
          autoComplete="organization"
          placeholder="Ex: Imóvel Pro Vendas"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <p className="text-muted-foreground text-caption">
          Você pode criar mais workspaces depois nas configurações.
        </p>
      </div>
    </div>
  );
}
