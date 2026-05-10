'use client';

import * as React from 'react';

import Link from 'next/link';

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  EmptyState,
  ScrollArea,
  Separator,
  TemperatureBadge,
} from '@papopro/ui';
import { ArrowUpRight, Building2, Calendar, Mail, Phone, Tag, User } from '@papopro/ui/icons';

import { ActivityIcon, ACTIVITY_META } from '@/features/leads/components/activity-icon';
import { RepAvatar } from '@/features/leads/components/rep-avatar';
import { StagePill } from '@/features/leads/components/stage-pill';
import type { Activity } from '@/features/leads/types';
import { getActivitiesForLead } from '@/lib/fixtures/activities';
import { getLead } from '@/lib/fixtures/leads';
import { formatCents, formatDateShort, formatDateTime, initialsOf } from '@/lib/utils/format';

import { useDistanceToNow } from '../hooks/use-distance-to-now';
import { useConversation } from '../store';

/**
 * Painel direito da Inbox: ficha resumida do lead da conversa atual.
 *
 * Read-only em M5#4a; em M5#4c ganha quick actions (mover etapa, atribuir
 * vendedor, arquivar conversa, marcar como não lida, adicionar tarefa).
 *
 * Princípios:
 *  - Reusa primitivos já existentes em `features/leads/components/`
 *    (`StagePill`, `RepAvatar`, `ActivityIcon`) — não duplica.
 *  - Mostra **só o essencial pro vendedor responder bem**: identificação,
 *    etapa do funil, vendedor, valor, próxima ação, e 3 últimas atividades.
 *  - Botão "Ver lead completo" leva pra ficha integral (`/leads/[id]`)
 *    quando precisa editar campos.
 *
 * Empty state quando nenhuma conversa selecionada — sem ficha sem contexto.
 */
interface LeadFichaPanelProps {
  conversationId: string | undefined;
}

export function LeadFichaPanel({ conversationId }: LeadFichaPanelProps) {
  const conversation = useConversation(conversationId);

  if (!conversation) {
    return (
      <aside
        aria-label="Ficha do lead"
        className="border-border bg-card hidden h-full flex-col border-l p-6 lg:flex"
      >
        <EmptyState
          icon={User}
          title="Sem ficha"
          description="A ficha do lead aparece aqui quando você abre uma conversa."
        />
      </aside>
    );
  }

  return <PanelContent leadId={conversation.leadId} />;
}

function PanelContent({ leadId }: { leadId: string }) {
  const lead = getLead(leadId);
  // `getActivitiesForLead` é Map.get + slice — O(1). Sem `useMemo`,
  // que custaria mais que o trabalho real.
  const recentActivities = getActivitiesForLead(leadId).slice(0, 4);

  if (!lead) {
    return (
      <aside
        aria-label="Ficha do lead"
        className="border-border bg-card flex h-full flex-col border-l p-6"
      >
        <EmptyState
          icon={User}
          title="Lead não disponível"
          description="O lead vinculado a essa conversa não foi encontrado. Recarregue a inbox; se persistir, fale com o suporte."
        />
      </aside>
    );
  }

  return (
    <aside
      aria-label={`Ficha de ${lead.name}`}
      className="border-border bg-card flex h-full flex-col border-l"
    >
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-5">
          <header className="flex items-start gap-3">
            <Avatar className="size-12 shrink-0">
              <AvatarFallback className="bg-primary/15 text-primary text-title font-semibold">
                {initialsOf(lead.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-title text-foreground truncate">{lead.name}</span>
              {lead.position && (
                <span className="text-caption text-muted-foreground truncate">{lead.position}</span>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <StagePill stageId={lead.stageId} />
                <TemperatureBadge temperature={lead.temperature} />
              </div>
            </div>
          </header>

          <Separator />

          <dl className="flex flex-col gap-3">
            <Field icon={Phone} label="Telefone">
              <a
                href={`tel:${lead.phone.replace(/\s/g, '')}`}
                className="text-body text-foreground hover:text-primary tabular-nums"
              >
                {lead.phone}
              </a>
            </Field>

            {lead.email && (
              <Field icon={Mail} label="Email">
                <a
                  href={`mailto:${lead.email}`}
                  className="text-body text-primary truncate hover:underline"
                >
                  {lead.email}
                </a>
              </Field>
            )}

            {lead.company && (
              <Field icon={Building2} label="Empresa">
                <span className="text-body text-foreground truncate">{lead.company}</span>
              </Field>
            )}

            <Field icon={User} label="Vendedor">
              <RepAvatar repId={lead.assignedTo} withName />
            </Field>

            <Field label="Valor estimado">
              <span className="text-body text-foreground font-medium tabular-nums">
                {formatCents(lead.valueCents)}
              </span>
            </Field>

            {lead.nextActionAt && lead.nextActionLabel && (
              <Field icon={Calendar} label="Próxima ação">
                <div className="flex flex-col gap-0.5">
                  <span className="text-body text-foreground">{lead.nextActionLabel}</span>
                  <span className="text-caption text-muted-foreground">
                    {formatDateShort(lead.nextActionAt)}
                  </span>
                </div>
              </Field>
            )}
          </dl>

          {lead.tags.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <span className="text-caption text-muted-foreground inline-flex items-center gap-1.5 font-medium">
                  <Tag className="size-3.5" /> Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="h-5 px-2">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {recentActivities.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <span className="text-caption text-muted-foreground font-medium">
                  Atividade recente
                </span>
                <ul className="flex flex-col gap-2">
                  {recentActivities.map((a) => (
                    <RecentActivityItem key={a.id} activity={a} />
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <Separator />
      <div className="bg-card p-4">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/leads/${lead.id}`}>
            Ver lead completo
            <ArrowUpRight className="ml-1 size-3.5" />
          </Link>
        </Button>
      </div>
    </aside>
  );
}

/**
 * Item da lista de "Atividade recente". Componente separado pra cada hook
 * `useDistanceToNow` poder rodar dentro do React rules — não dá pra chamar
 * hook em loop no PanelContent.
 */
function RecentActivityItem({ activity }: { activity: Activity }) {
  const relative = useDistanceToNow(activity.createdAt);
  return (
    <li className="flex items-start gap-2">
      <ActivityIcon type={activity.type} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption text-foreground truncate">
          {ACTIVITY_META[activity.type].label}
        </span>
        <time
          className="text-caption text-muted-foreground"
          dateTime={activity.createdAt}
          title={formatDateTime(activity.createdAt)}
        >
          {relative}
        </time>
      </div>
    </li>
  );
}

interface FieldProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}

function Field({ icon: Icon, label, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-muted-foreground inline-flex items-center gap-1.5 font-medium">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
