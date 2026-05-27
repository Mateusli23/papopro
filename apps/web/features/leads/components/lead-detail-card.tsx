'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { toast } from 'react-hot-toast';

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  TemperatureBadge,
  Textarea,
} from '@papopro/ui';
import { Archive, Building2, Loader2, Mail, Phone, Tag, User } from '@papopro/ui/icons';

import {
  formatCents,
  formatCentsForCurrencyInput,
  formatDateShort,
  initialsOf,
  parseCurrencyInputToCents,
} from '@/lib/utils/format';

import {
  archiveLeadAction,
  assignLeadAction,
  moveLeadToStageAction,
  updateLeadAction,
} from '../actions';
import { LEAD_ORIGINS } from '../schemas';
import type { Lead, LeadOrigin, PipelineStage, SalesRep } from '../types';

type Role = 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer';

/**
 * Ficha do lead — coluna esquerda da página de detalhe (M8#2).
 *
 * Edição inline: cada campo abre input no click, commit on blur/Enter. O
 * commit dispara a Server Action correspondente:
 *  - text/textarea/number → `updateLeadAction`
 *  - select de etapa → `moveLeadToStageAction` (grava activity `stage_change`)
 *  - select de vendedor → `assignLeadAction` (RBAC: Owner/Admin/Manager)
 *  - botão arquivar → `archiveLeadAction` (RBAC: Owner/Admin/Manager)
 *
 * Após sucesso, `router.refresh()` força o Server Component `/leads/[id]/page.tsx`
 * a re-fetch — UI atualiza com o estado canônico do banco.
 *
 * **Sem optimistic update agressivo nesta versão.** Latência percebida
 * (200-500ms) é aceitável; otimização vira polimento se sentirmos UX lenta.
 */
interface LeadDetailCardProps {
  lead: Lead;
  salesReps: SalesRep[];
  /** TODAS as etapas do pipeline default (active + terminal), ordenadas. */
  stages: PipelineStage[];
  callerRole: Role;
}

export function LeadDetailCard({ lead, salesReps, stages, callerRole }: LeadDetailCardProps) {
  const router = useRouter();
  const [isArchiving, startArchiveTransition] = React.useTransition();

  const canAssign = callerRole === 'Owner' || callerRole === 'Admin' || callerRole === 'Manager';
  const canArchive = canAssign;
  const canEdit = callerRole !== 'Viewer';

  async function patchField(patch: Record<string, unknown>): Promise<void> {
    const result = await updateLeadAction({ leadId: lead.id, ...patch });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function changeStage(newStageId: string): Promise<void> {
    if (newStageId === lead.stageId) return;
    const result = await moveLeadToStageAction({ leadId: lead.id, stageId: newStageId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function reassign(newAssigneeId: string): Promise<void> {
    if (newAssigneeId === lead.assignedTo) return;
    const result = await assignLeadAction({ leadId: lead.id, assignedToId: newAssigneeId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Lead reassignado.');
    router.refresh();
  }

  function onArchive(): void {
    if (
      !window.confirm(
        'Arquivar este lead? Ele some da lista padrão mas continua acessível com filtro.',
      )
    ) {
      return;
    }
    startArchiveTransition(async () => {
      const result = await archiveLeadAction({ leadId: lead.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Lead arquivado.');
      router.refresh();
    });
  }

  return (
    <aside
      aria-label="Ficha do lead"
      className="border-border bg-card flex flex-col gap-4 rounded-lg border p-5"
    >
      <header className="flex items-center gap-3">
        <Avatar className="size-12">
          <AvatarFallback className="bg-primary/15 text-primary text-title font-semibold">
            {initialsOf(lead.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <EditableField
            ariaLabel="Nome do lead"
            value={lead.name}
            disabled={!canEdit}
            renderDisplay={(v) => <span className="text-title text-foreground truncate">{v}</span>}
            onSave={(v) => patchField({ name: v })}
          />
          <span className="text-caption text-muted-foreground truncate">
            {lead.position && `${lead.position} · `}
            {lead.company ?? 'Sem empresa cadastrada'}
          </span>
        </div>
        <TemperatureBadge temperature={lead.temperature} />
      </header>

      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="h-6 px-2">
          {stages.find((s) => s.id === lead.stageId)?.name ?? '—'}
        </Badge>
        <Badge variant="outline" className="h-6 px-2">
          {LEAD_ORIGINS.find((o) => o.value === lead.origin)?.label ?? lead.origin}
        </Badge>
        {lead.status === 'arquivado' && (
          <Badge variant="outline" className="h-6 px-2">
            Arquivado
          </Badge>
        )}
      </div>

      <Separator />

      <dl className="flex flex-col gap-3">
        <Row icon={Phone} label="Telefone">
          <EditableField
            ariaLabel="Telefone"
            value={lead.phone}
            disabled={!canEdit}
            renderDisplay={(v) => <span className="text-body text-foreground">{v}</span>}
            onSave={(v) => patchField({ phone: v })}
          />
        </Row>

        <Row icon={Mail} label="Email">
          <EditableField
            ariaLabel="Email"
            value={lead.email ?? ''}
            placeholder="contato@empresa.com"
            disabled={!canEdit}
            renderDisplay={(v) =>
              v ? (
                <a href={`mailto:${v}`} className="text-body text-primary hover:underline">
                  {v}
                </a>
              ) : (
                <span className="text-muted-foreground italic">não informado</span>
              )
            }
            onSave={(v) => patchField({ email: v || undefined })}
          />
        </Row>

        <Row icon={Building2} label="Empresa">
          <EditableField
            ariaLabel="Empresa"
            value={lead.company ?? ''}
            placeholder="Razão social"
            disabled={!canEdit}
            renderDisplay={(v) =>
              v ? (
                <span className="text-body text-foreground">{v}</span>
              ) : (
                <span className="text-muted-foreground italic">não informada</span>
              )
            }
            onSave={(v) => patchField({ company: v || undefined })}
          />
        </Row>

        <Row icon={User} label="Cargo">
          <EditableField
            ariaLabel="Cargo"
            value={lead.position ?? ''}
            placeholder="ex: Diretor de Compras"
            disabled={!canEdit}
            renderDisplay={(v) =>
              v ? (
                <span className="text-body text-foreground">{v}</span>
              ) : (
                <span className="text-muted-foreground italic">—</span>
              )
            }
            onSave={(v) => patchField({ position: v || undefined })}
          />
        </Row>
      </dl>

      <Separator />

      <dl className="flex flex-col gap-3">
        <Row label="Etapa do funil">
          <SelectField
            value={lead.stageId}
            disabled={!canEdit}
            options={stages.map((s) => ({ value: s.id, label: s.name }))}
            onChange={(v) => changeStage(v)}
          />
        </Row>

        <Row label="Vendedor">
          <SelectField
            value={lead.assignedTo}
            disabled={!canAssign}
            options={salesReps.map((r) => ({ value: r.id, label: r.name }))}
            onChange={(v) => reassign(v)}
          />
        </Row>

        <Row label="Origem">
          <SelectField
            value={lead.origin}
            disabled={!canEdit}
            options={LEAD_ORIGINS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(v) => patchField({ origin: v as LeadOrigin })}
          />
        </Row>

        <Row label="Valor estimado">
          <ValueField
            lead={lead}
            disabled={!canEdit}
            onSave={(valueCents) => patchField({ valueCents })}
          />
        </Row>
      </dl>

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-caption text-muted-foreground inline-flex items-center gap-1.5 font-medium">
          <Tag className="size-3.5" /> Tags
        </span>
        <TagsField lead={lead} disabled={!canEdit} onSave={(tags) => patchField({ tags })} />
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-caption text-muted-foreground font-medium">Observação</span>
        <NotesField lead={lead} disabled={!canEdit} onSave={(notes) => patchField({ notes })} />
      </div>

      {canArchive && lead.status === 'ativo' && (
        <>
          <Separator />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onArchive}
            disabled={isArchiving}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive justify-start"
          >
            {isArchiving ? <Loader2 className="animate-spin" /> : <Archive />}
            Arquivar lead
          </Button>
        </>
      )}

      <Separator />

      <div className="text-caption text-muted-foreground flex flex-col gap-1">
        <span>Criado em {formatDateShort(lead.createdAt)}</span>
        <span>Atualizado em {formatDateShort(lead.updatedAt)}</span>
      </div>
    </aside>
  );
}

interface RowProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}

function Row({ icon: Icon, label, children }: RowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-muted-foreground inline-flex items-center gap-1.5 font-medium">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

// ─── Editable text ─────────────────────────────────────────────────────────

interface EditableFieldProps {
  value: string;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  onSave: (next: string) => void | Promise<void>;
  renderDisplay: (value: string) => React.ReactNode;
}

function EditableField({
  value,
  ariaLabel,
  placeholder,
  disabled,
  onSave,
  renderDisplay,
}: EditableFieldProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  async function commit() {
    if (draft !== value) await onSave(draft);
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing && !disabled) {
    return (
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          } else if (e.key === 'Escape') {
            cancel();
          }
        }}
        placeholder={placeholder}
        autoFocus
        aria-label={ariaLabel}
        className="h-8"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      aria-label={`Editar ${ariaLabel}`}
      className={cn(
        '-mx-1.5 -my-1 flex w-full items-center rounded-md px-1.5 py-1 text-left',
        !disabled && 'hover:bg-muted/40 transition-colors',
        disabled && 'cursor-default',
      )}
    >
      {renderDisplay(value)}
    </button>
  );
}

interface SelectFieldProps {
  value: string;
  disabled?: boolean;
  options: { value: string; label: string }[];
  onChange: (next: string) => void | Promise<void>;
}

function SelectField({ value, disabled, options, onChange }: SelectFieldProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ValueField({
  lead,
  disabled,
  onSave,
}: {
  lead: Lead;
  disabled?: boolean;
  onSave: (valueCents: number) => void | Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(formatCentsForCurrencyInput(lead.valueCents));

  React.useEffect(() => {
    setDraft(formatCentsForCurrencyInput(lead.valueCents));
  }, [lead.valueCents]);

  async function commit() {
    const valueCents = parseCurrencyInputToCents(draft);
    if (valueCents !== lead.valueCents) await onSave(valueCents);
    setEditing(false);
  }

  if (editing && !disabled) {
    return (
      <Input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          } else if (e.key === 'Escape') {
            setDraft(formatCentsForCurrencyInput(lead.valueCents));
            setEditing(false);
          }
        }}
        autoFocus
        className="h-8"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      className={cn(
        '-mx-1.5 -my-1 rounded-md px-1.5 py-1 text-left',
        !disabled && 'hover:bg-muted/40 transition-colors',
      )}
    >
      <span className="text-body text-foreground font-medium tabular-nums">
        {formatCents(lead.valueCents)}
      </span>
    </button>
  );
}

function TagsField({
  lead,
  disabled,
  onSave,
}: {
  lead: Lead;
  disabled?: boolean;
  onSave: (tags: string[]) => void | Promise<void>;
}) {
  const [draft, setDraft] = React.useState('');

  async function addTag() {
    const t = draft.trim().toLowerCase();
    if (!t) return;
    if (lead.tags.includes(t)) {
      setDraft('');
      return;
    }
    if (lead.tags.length >= 8) return;
    await onSave([...lead.tags, t]);
    setDraft('');
  }

  async function removeTag(t: string) {
    await onSave(lead.tags.filter((x) => x !== t));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {lead.tags.map((t) => (
        <Badge key={t} variant="secondary" className="gap-1 pr-1">
          {t}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="hover:bg-foreground/10 size-4 rounded-full"
              aria-label={`Remover tag ${t}`}
            >
              ×
            </button>
          )}
        </Badge>
      ))}
      {!disabled && (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void addTag();
            }
          }}
          onBlur={addTag}
          placeholder={lead.tags.length === 0 ? 'Adicionar tag…' : '+'}
          className="h-7 max-w-[120px]"
        />
      )}
    </div>
  );
}

function NotesField({
  lead,
  disabled,
  onSave,
}: {
  lead: Lead;
  disabled?: boolean;
  onSave: (notes: string | undefined) => void | Promise<void>;
}) {
  const [draft, setDraft] = React.useState(lead.notes ?? '');

  React.useEffect(() => {
    setDraft(lead.notes ?? '');
  }, [lead.notes]);

  async function commit() {
    if ((lead.notes ?? '') !== draft) await onSave(draft || undefined);
  }

  return (
    <Textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      placeholder="Anote o que ajuda o time a fechar — decisor, restrições, contexto."
      rows={3}
      className="text-body"
      disabled={disabled}
    />
  );
}
