'use client';

import * as React from 'react';

import { Badge, Button, cn, EmptyState } from '@papopro/ui';
import { Activity as ActivityIconLucide } from '@papopro/ui/icons';

import { getActivitiesForLead } from '@/lib/fixtures/activities';
import { getRepName, SYSTEM_AUTHOR } from '@/lib/fixtures/sales-reps';
import { formatDateTime, formatRelative } from '@/lib/utils/format';

import type { ActivityType } from '../types';

import { ActivityIcon, ACTIVITY_META } from './activity-icon';

/**
 * Timeline cronológica reversa do lead. Cada item tem ícone + corpo + autor +
 * timestamp relativo. Filtro no topo permite ver só notas, só WhatsApp, etc.
 *
 * Notas internas têm fundo `accent` sutil (amarelo da marca) — sinaliza que
 * é informação interna, fora da conversa com o lead. Mensagens WhatsApp
 * recebidas vs enviadas usam alinhamento diferente (left vs left, mas com
 * indicador "→" / "←") sem virar bolha de chat — esta é a timeline, não
 * a inbox (essa vem em M5 com layout de 3 painéis).
 */

type FilterValue = 'all' | 'comm' | 'meeting' | 'note' | 'system';

const FILTER_GROUPS: Record<FilterValue, ActivityType[]> = {
  all: Object.keys(ACTIVITY_META) as ActivityType[],
  comm: ['whatsapp_in', 'whatsapp_out', 'call', 'email'],
  meeting: ['meeting'],
  note: ['note'],
  system: ['stage_change', 'attachment', 'task', 'lead_created'],
};

const FILTER_LABEL: Record<FilterValue, string> = {
  all: 'Tudo',
  comm: 'Conversas',
  meeting: 'Reuniões',
  note: 'Notas',
  system: 'Sistema',
};

export function LeadTimeline({ leadId }: { leadId: string }) {
  const all = React.useMemo(() => getActivitiesForLead(leadId), [leadId]);
  const [filter, setFilter] = React.useState<FilterValue>('all');

  const filtered = React.useMemo(() => {
    const allowed = new Set(FILTER_GROUPS[filter]);
    return all.filter((a) => allowed.has(a.type));
  }, [all, filter]);

  return (
    <section
      aria-label="Histórico do lead"
      className="border-border bg-card flex flex-col rounded-lg border"
    >
      <header className="border-border flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-title text-foreground">Histórico</h2>
          <span className="text-caption text-muted-foreground">
            {all.length} eventos · ordem cronológica reversa
          </span>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrar por tipo">
          {(Object.keys(FILTER_LABEL) as FilterValue[]).map((f) => (
            <Button
              key={f}
              role="tab"
              aria-selected={filter === f}
              variant={filter === f ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
              className="h-7 px-2.5"
            >
              {FILTER_LABEL[f]}
            </Button>
          ))}
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={ActivityIconLucide}
            title="Sem eventos nesse filtro"
            description="Troque o filtro acima ou crie uma nota/atividade pra começar o histórico."
          />
        </div>
      ) : (
        <ol className="flex flex-col gap-3 p-4">
          {filtered.map((activity) => {
            const isNote = activity.type === 'note';
            const isWhatsAppIn = activity.type === 'whatsapp_in';
            const author =
              activity.authorId === 'system' ? SYSTEM_AUTHOR.name : getRepName(activity.authorId);
            return (
              <li
                key={activity.id}
                className={cn(
                  'border-border bg-background flex gap-3 rounded-md border p-3',
                  isNote && 'bg-accent/10 border-accent/30',
                )}
              >
                <ActivityIcon type={activity.type} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-body text-foreground font-medium">
                        {ACTIVITY_META[activity.type].label}
                      </span>
                      {isWhatsAppIn && (
                        <Badge variant="secondary" className="h-5 px-1.5">
                          recebida
                        </Badge>
                      )}
                      {isNote && (
                        <Badge variant="warning" className="h-5 px-1.5">
                          interno · só o time vê
                        </Badge>
                      )}
                      <span className="text-caption text-muted-foreground">por {author}</span>
                    </div>
                    <time
                      className="text-caption text-muted-foreground"
                      dateTime={activity.createdAt}
                      title={formatDateTime(activity.createdAt)}
                    >
                      {formatRelative(activity.createdAt)}
                    </time>
                  </div>
                  {activity.body && (
                    <p className="text-body text-foreground whitespace-pre-line">{activity.body}</p>
                  )}
                  {activity.meta?.fileName && (
                    <span className="text-caption text-muted-foreground inline-flex items-center gap-1">
                      📎 {activity.meta.fileName}
                      {activity.meta.fileSizeKb && ` · ${formatFileSize(activity.meta.fileSizeKb)}`}
                    </span>
                  )}
                  {activity.meta?.durationSeconds && (
                    <span className="text-caption text-muted-foreground">
                      Duração: {formatDuration(activity.meta.durationSeconds)}
                    </span>
                  )}
                  {activity.meta?.location && (
                    <span className="text-caption text-muted-foreground">
                      📍 {activity.meta.location}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function formatFileSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}
