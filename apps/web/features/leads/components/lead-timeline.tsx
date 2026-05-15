'use client';

import * as React from 'react';

import { Badge, Button, cn, EmptyState } from '@papopro/ui';
import { Activity as ActivityIconLucide, PlusCircle } from '@papopro/ui/icons';

import { NoteCreateDialog } from '@/features/activities/components/note-create-dialog';
import { enrichStageChangeMeta, type ActivityWithAuthor } from '@/features/activities/transforms';
import { formatDateTime, formatRelative } from '@/lib/utils/format';

import type { ActivityType, PipelineStage } from '../types';

import { ActivityIcon, ACTIVITY_META } from './activity-icon';

/**
 * Timeline cronológica reversa do lead (M8#4 — server-fed).
 *
 * Recebe `initialActivities` (com `authorName` resolvido) + `stages`
 * (pra resolver `stage_change` em nomes) por prop do parent server-fed.
 *
 * **M8#4 changes:**
 *  - Não usa mais `getActivitiesForLead` fixture
 *  - Botão "Adicionar nota" abre `NoteCreateDialog` → `createNoteActivityAction`
 *  - `stage_change` mostra "De X para Y" usando `enrichStageChangeMeta`
 *  - `task` activities mostram "Tarefa criada"/"Tarefa concluída" baseado em meta.eventKind
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

interface LeadTimelineProps {
  leadId: string;
  initialActivities: ActivityWithAuthor[];
  stages: PipelineStage[];
  /** Quando true, mostra botão "Adicionar nota". Viewer recebe false. */
  canAddNote: boolean;
}

export function LeadTimeline({ leadId, initialActivities, stages, canAddNote }: LeadTimelineProps) {
  const [filter, setFilter] = React.useState<FilterValue>('all');
  const [noteOpen, setNoteOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const allowed = new Set(FILTER_GROUPS[filter]);
    return initialActivities.filter((a) => allowed.has(a.type));
  }, [initialActivities, filter]);

  return (
    <>
      <section
        aria-label="Histórico do lead"
        className="border-border bg-card flex flex-col rounded-lg border"
      >
        <header className="border-border flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-title text-foreground">Histórico</h2>
            <span className="text-caption text-muted-foreground">
              {initialActivities.length} eventos · ordem cronológica reversa
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            {canAddNote && (
              <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>
                <PlusCircle /> Adicionar nota
              </Button>
            )}
          </div>
        </header>

        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ActivityIconLucide}
              title="Sem eventos nesse filtro"
              description={
                canAddNote
                  ? 'Troque o filtro acima ou adicione uma nota pra começar o histórico.'
                  : 'Troque o filtro acima.'
              }
            />
          </div>
        ) : (
          <ol className="flex flex-col gap-3 p-4">
            {filtered.map((activity) => (
              <ActivityListItem key={activity.id} activity={activity} stages={stages} />
            ))}
          </ol>
        )}
      </section>

      {canAddNote && (
        <NoteCreateDialog open={noteOpen} onOpenChange={setNoteOpen} leadId={leadId} />
      )}
    </>
  );
}

interface ActivityListItemProps {
  activity: ActivityWithAuthor;
  stages: PipelineStage[];
}

function ActivityListItem({ activity, stages }: ActivityListItemProps) {
  const isNote = activity.type === 'note';
  const isWhatsAppIn = activity.type === 'whatsapp_in';
  const isStageChange = activity.type === 'stage_change';
  const isTask = activity.type === 'task';

  const author = activity.authorName ?? 'Sistema';
  const meta = ACTIVITY_META[activity.type];

  // Label dinâmico pra activities com sub-eventos.
  const dynamicLabel = React.useMemo(() => {
    if (isTask && activity.meta?.eventKind === 'completed') return 'Tarefa concluída';
    if (isTask && activity.meta?.eventKind === 'created') return 'Tarefa criada';
    return meta.label;
  }, [isTask, activity.meta, meta.label]);

  // Resolve stage_change meta pra "De X para Y".
  const stageChangeText = React.useMemo(() => {
    if (!isStageChange) return null;
    const enriched = enrichStageChangeMeta(activity.meta, stages);
    if (!enriched) return null;
    return `${enriched.fromStageName} → ${enriched.toStageName}`;
  }, [isStageChange, activity.meta, stages]);

  return (
    <li
      className={cn(
        'border-border bg-background flex gap-3 rounded-md border p-3',
        isNote && 'bg-accent/10 border-accent/30',
      )}
    >
      <ActivityIcon type={activity.type} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-body text-foreground font-medium">{dynamicLabel}</span>
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
        {stageChangeText && <p className="text-body text-foreground">{stageChangeText}</p>}
        {activity.body && !isStageChange && (
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
          <span className="text-caption text-muted-foreground">📍 {activity.meta.location}</span>
        )}
      </div>
    </li>
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
