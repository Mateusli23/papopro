'use client';

import * as React from 'react';

import Link from 'next/link';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

import { Badge, Button, Card, cn } from '@papopro/ui';
import { Pause, Play, PlusCircle, Repeat } from '@papopro/ui/icons';

import { pauseEnrollmentAction, resumeEnrollmentAction } from '../actions';
import type { LeadEnrollmentUI } from '../queries';

import { EnrollLeadDialog } from './enroll-lead-dialog';

/**
 * Seção "Cadências" da página do lead (M10#3).
 *
 * Mostra as inscrições do lead em cadências (ativas + pausadas) com ações
 * inline (pausar / reativar). Botão "Inscrever em cadência" abre dialog
 * com select das cadências ATIVAS do workspace que o lead ainda NÃO está.
 *
 * **Comportamento por status:**
 *  - `active` → mostra próximo disparo (`nextRunAt` relativo) + botão Pausar
 *  - `paused` → mostra razão da pausa + botão Reativar (exceto se
 *    `paused_reason='lead_replied'` — UI sugere que vendedor responda
 *    primeiro antes de retomar a cadência)
 *  - `completed`/`cancelled` → mostra como histórico read-only
 *
 * **RBAC**: ações chamam Server Actions que validam RBAC fino (Vendedor
 * só dos próprios leads). Erros chegam como toast.
 */

export interface AvailableCadence {
  id: string;
  name: string;
}

interface LeadEnrollmentsSectionProps {
  leadId: string;
  leadName: string;
  initialEnrollments: LeadEnrollmentUI[];
  availableCadences: AvailableCadence[];
  canEnroll: boolean;
}

const STATUS_LABEL: Record<LeadEnrollmentUI['status'], string> = {
  active: 'Em sequência',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const STATUS_VARIANT: Record<LeadEnrollmentUI['status'], 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  completed: 'outline',
  cancelled: 'outline',
};

const PAUSED_REASON_LABEL: Record<string, string> = {
  lead_replied: 'Lead respondeu — pause inteligente',
  manual: 'Pausada manualmente',
  stage_changed: 'Etapa do funil mudou',
  disconnected: 'WhatsApp desconectado',
  admin: 'Pausada pelo admin',
};

export function LeadEnrollmentsSection({
  leadId,
  leadName,
  initialEnrollments,
  availableCadences,
  canEnroll,
}: LeadEnrollmentsSectionProps) {
  const [enrollDialog, setEnrollDialog] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const alreadyEnrolledIds = React.useMemo(
    () =>
      new Set(
        initialEnrollments
          .filter((e) => e.status === 'active' || e.status === 'paused')
          .map((e) => e.cadenceId),
      ),
    [initialEnrollments],
  );

  async function handlePause(id: string) {
    if (pendingId) return;
    setPendingId(id);
    const loadingId = toast.loading('Pausando inscrição…');
    const result = await pauseEnrollmentAction(id);
    toast.dismiss(loadingId);
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Inscrição pausada.', { duration: 3000 });
  }

  async function handleResume(id: string) {
    if (pendingId) return;
    setPendingId(id);
    const loadingId = toast.loading('Reativando inscrição…');
    const result = await resumeEnrollmentAction(id);
    toast.dismiss(loadingId);
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Inscrição reativada.', { duration: 3000 });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <Repeat className="text-muted-foreground size-4" />
          Cadências
        </h3>
        {canEnroll && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEnrollDialog(true)}
            disabled={availableCadences.length === 0}
          >
            <PlusCircle className="size-3.5" />
            Inscrever
          </Button>
        )}
      </div>

      {initialEnrollments.length === 0 ? (
        <div className="border-border/60 bg-muted/30 flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-6 text-center">
          <Repeat className="text-muted-foreground/70 size-5" aria-hidden />
          <p className="text-body text-muted-foreground max-w-xs">
            Lead ainda não está em nenhuma cadência.{' '}
            {availableCadences.length === 0 && (
              <Link href="/cadences" className="text-primary hover:underline">
                Crie ou ative uma cadência
              </Link>
            )}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {initialEnrollments.map((enrollment) => (
            <li
              key={enrollment.id}
              className="border-border flex flex-col gap-1.5 rounded-md border p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/cadences/${enrollment.cadenceId}`}
                  className="text-body text-foreground hover:text-primary truncate font-medium hover:underline"
                >
                  {enrollment.cadenceName}
                </Link>
                <Badge
                  variant={STATUS_VARIANT[enrollment.status]}
                  className="text-caption shrink-0"
                >
                  {STATUS_LABEL[enrollment.status]}
                </Badge>
              </div>

              <div className="text-muted-foreground text-caption flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>
                  {enrollment.stepsSent} de {enrollment.stepsTotal} disparados
                </span>
                {enrollment.status === 'active' && (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      Próximo:{' '}
                      {formatDistanceToNow(new Date(enrollment.nextRunAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </>
                )}
                {enrollment.status === 'paused' && enrollment.pausedReason && (
                  <>
                    <span aria-hidden>·</span>
                    <span className={cn(enrollment.pausedReason === 'lead_replied' && 'text-info')}>
                      {PAUSED_REASON_LABEL[enrollment.pausedReason] ?? 'Pausada'}
                    </span>
                  </>
                )}
              </div>

              {(enrollment.status === 'active' || enrollment.status === 'paused') && canEnroll && (
                <div className="flex justify-end gap-1">
                  {enrollment.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => handlePause(enrollment.id)}
                      disabled={pendingId === enrollment.id}
                    >
                      <Pause className="size-3" />
                      Pausar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => handleResume(enrollment.id)}
                      disabled={pendingId === enrollment.id}
                    >
                      <Play className="size-3" />
                      Reativar
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <EnrollLeadDialog
        open={enrollDialog}
        onOpenChange={setEnrollDialog}
        leadId={leadId}
        leadName={leadName}
        availableCadences={availableCadences}
        alreadyEnrolledIds={alreadyEnrolledIds}
      />
    </Card>
  );
}
