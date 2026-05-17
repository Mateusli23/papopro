'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import { Badge, Button, Input, PageHeader, Switch } from '@papopro/ui';
import { Snowflake } from '@papopro/ui/icons';

import { updateColdThresholdAction } from '@/features/cadences/actions';
import type { ColdThresholdUI } from '@/features/cadences/queries';

/**
 * `/settings/cadences/cold-thresholds` view (M10#3).
 *
 * Tabela editável com 5 thresholds default seedados por M10#1. Auto-save
 * em blur (input numérico) e em toggle (switch enabled). Owner/Admin only —
 * o Server Component pai já redireciona quem não tem permissão.
 *
 * **Sem confirmação de salvar**: cada edit dispara a action. Toast informa
 * sucesso/erro. Padrão "configuração inline" alinhado com Linear / Notion
 * (PRD §6 / CLAUDE.md §8). Em caso de erro, valor volta ao último válido
 * via `React.useState` local.
 */

interface ColdThresholdsViewProps {
  initialThresholds: ColdThresholdUI[];
}

export function ColdThresholdsView({ initialThresholds }: ColdThresholdsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lead frio"
        description={
          'Defina quantos dias sem interação um lead deve ficar antes do sistema disparar alerta. ' +
          'O cold-lead-detector roda de hora em hora; o threshold global (sem etapa) é fallback.'
        }
      />

      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-caption text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide">
                Etapa do funil
              </th>
              <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide">
                Dias sem interação
              </th>
              <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {initialThresholds.map((t) => (
              <ThresholdRow key={t.id} threshold={t} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-caption flex items-center gap-2">
        <Snowflake className="size-3.5" />
        Os defaults seguem o PRD §2.2: 7d Novo, 14d Em Contato, 7d Proposta, 5d Negociação, 30d
        Global. O detector real entra em M10#4.
      </p>
    </div>
  );
}

interface ThresholdRowProps {
  threshold: ColdThresholdUI;
}

function ThresholdRow({ threshold }: ThresholdRowProps) {
  const [days, setDays] = React.useState(String(threshold.daysInactive));
  const [enabled, setEnabled] = React.useState(threshold.enabled);
  const [savingDays, setSavingDays] = React.useState(false);
  const [savingEnabled, setSavingEnabled] = React.useState(false);

  async function saveDays() {
    const parsed = Number(days);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
      toast.error('Informe um número inteiro entre 1 e 365.');
      setDays(String(threshold.daysInactive));
      return;
    }
    if (parsed === threshold.daysInactive) return;

    setSavingDays(true);
    const result = await updateColdThresholdAction({ id: threshold.id, daysInactive: parsed });
    setSavingDays(false);
    if (!result.ok) {
      toast.error(result.error);
      setDays(String(threshold.daysInactive));
      return;
    }
    toast.success(
      `${threshold.stageName ?? 'Global'} agora alerta em ${parsed} ${parsed === 1 ? 'dia' : 'dias'}.`,
      { duration: 3000 },
    );
  }

  async function saveEnabled(next: boolean) {
    setSavingEnabled(true);
    const result = await updateColdThresholdAction({ id: threshold.id, enabled: next });
    setSavingEnabled(false);
    if (!result.ok) {
      toast.error(result.error);
      setEnabled(threshold.enabled);
      return;
    }
    setEnabled(next);
    toast.success(next ? 'Threshold ativado.' : 'Threshold desativado.', { duration: 2500 });
  }

  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-medium">{threshold.stageName ?? 'Global'}</span>
          {threshold.stageId === null && (
            <Badge variant="outline" className="text-caption">
              fallback
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            onBlur={saveDays}
            disabled={savingDays || !enabled}
            className="w-20"
          />
          <span className="text-muted-foreground text-caption">dias</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <Switch
          checked={enabled}
          onCheckedChange={saveEnabled}
          disabled={savingEnabled}
          aria-label={`${enabled ? 'Desativar' : 'Ativar'} threshold de ${threshold.stageName ?? 'Global'}`}
        />
      </td>
    </tr>
  );
}

// Silencia "Button declarado mas não usado" — fica disponível pra extensions
// futuras (ex: criar threshold por etapa nova).
void Button;
