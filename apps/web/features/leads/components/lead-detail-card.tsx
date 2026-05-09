'use client';

import * as React from 'react';

import {
  Avatar,
  AvatarFallback,
  Badge,
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
import { Building2, Mail, Phone, Tag, User } from '@papopro/ui/icons';

import { ACTIVE_STAGES, DEFAULT_STAGES } from '@/lib/fixtures/pipelines';
import { SALES_REPS } from '@/lib/fixtures/sales-reps';
import { formatCents, formatDateShort, initialsOf } from '@/lib/utils/format';

import { LEAD_ORIGINS } from '../schemas';
import { updateLead } from '../store';
import type { Lead, LeadOrigin } from '../types';

/**
 * Ficha do lead — coluna esquerda da página de detalhe. Cada campo tem
 * edição inline: hover mostra um sutil indicador, click vira input e blur
 * salva. Sem botão "Editar" — fluxo Notion/Attio, ganha velocidade.
 *
 * Princípios:
 *  - **Optimistic update**: a mutação no `updateLead` é síncrona (in-memory);
 *    em M8, a Server Action retorna a nova versão e a UI já mostrou o valor
 *    novo desde o blur (TanStack Query invalida em background).
 *  - **Acessível**: cada `EditableField` é um `<button>` que abre input;
 *    Esc cancela, Enter salva.
 *  - **Sem layout shift**: o "modo display" e o "modo edit" têm a mesma
 *    altura (input herda padding do span).
 */
interface LeadDetailCardProps {
  lead: Lead;
}

export function LeadDetailCard({ lead }: LeadDetailCardProps) {
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
            renderDisplay={(v) => <span className="text-title text-foreground truncate">{v}</span>}
            onSave={(v) => updateLead(lead.id, { name: v })}
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
          {DEFAULT_STAGES.find((s) => s.id === lead.stageId)?.name ?? lead.stageId}
        </Badge>
        <Badge variant="outline" className="h-6 px-2">
          {LEAD_ORIGINS.find((o) => o.value === lead.origin)?.label ?? lead.origin}
        </Badge>
      </div>

      <Separator />

      <dl className="flex flex-col gap-3">
        <Row icon={Phone} label="Telefone">
          <EditableField
            ariaLabel="Telefone"
            value={lead.phone}
            renderDisplay={(v) => <span className="text-body text-foreground">{v}</span>}
            onSave={(v) => updateLead(lead.id, { phone: v })}
          />
        </Row>

        <Row icon={Mail} label="Email">
          <EditableField
            ariaLabel="Email"
            value={lead.email ?? ''}
            placeholder="contato@empresa.com"
            renderDisplay={(v) =>
              v ? (
                <a href={`mailto:${v}`} className="text-body text-primary hover:underline">
                  {v}
                </a>
              ) : (
                <span className="text-muted-foreground italic">não informado</span>
              )
            }
            onSave={(v) => updateLead(lead.id, { email: v || undefined })}
          />
        </Row>

        <Row icon={Building2} label="Empresa">
          <EditableField
            ariaLabel="Empresa"
            value={lead.company ?? ''}
            placeholder="Razão social"
            renderDisplay={(v) =>
              v ? (
                <span className="text-body text-foreground">{v}</span>
              ) : (
                <span className="text-muted-foreground italic">não informada</span>
              )
            }
            onSave={(v) => updateLead(lead.id, { company: v || undefined })}
          />
        </Row>

        <Row icon={User} label="Cargo">
          <EditableField
            ariaLabel="Cargo"
            value={lead.position ?? ''}
            placeholder="ex: Diretor de Compras"
            renderDisplay={(v) =>
              v ? (
                <span className="text-body text-foreground">{v}</span>
              ) : (
                <span className="text-muted-foreground italic">—</span>
              )
            }
            onSave={(v) => updateLead(lead.id, { position: v || undefined })}
          />
        </Row>
      </dl>

      <Separator />

      <dl className="flex flex-col gap-3">
        <Row label="Etapa do funil">
          <SelectField
            value={lead.stageId}
            options={ACTIVE_STAGES.concat(DEFAULT_STAGES.filter((s) => s.terminal)).map((s) => ({
              value: s.id,
              label: s.name,
            }))}
            onChange={(v) => updateLead(lead.id, { stageId: v })}
          />
        </Row>

        <Row label="Vendedor">
          <SelectField
            value={lead.assignedTo}
            options={SALES_REPS.map((r) => ({ value: r.id, label: r.name }))}
            onChange={(v) => updateLead(lead.id, { assignedTo: v })}
          />
        </Row>

        <Row label="Origem">
          <SelectField
            value={lead.origin}
            options={LEAD_ORIGINS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(v) => updateLead(lead.id, { origin: v as LeadOrigin })}
          />
        </Row>

        <Row label="Valor estimado">
          <ValueField lead={lead} />
        </Row>
      </dl>

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-caption text-muted-foreground inline-flex items-center gap-1.5 font-medium">
          <Tag className="size-3.5" /> Tags
        </span>
        <TagsField lead={lead} />
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-caption text-muted-foreground font-medium">Observação</span>
        <NotesField lead={lead} />
      </div>

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
  onSave: (next: string) => void;
  renderDisplay: (value: string) => React.ReactNode;
}

function EditableField({
  value,
  ariaLabel,
  placeholder,
  onSave,
  renderDisplay,
}: EditableFieldProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    if (draft !== value) onSave(draft);
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
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
      onClick={() => setEditing(true)}
      aria-label={`Editar ${ariaLabel}`}
      className={cn(
        '-mx-1.5 -my-1 flex w-full items-center rounded-md px-1.5 py-1 text-left',
        'hover:bg-muted/40 transition-colors',
      )}
    >
      {renderDisplay(value)}
    </button>
  );
}

interface SelectFieldProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
}

function SelectField({ value, options, onChange }: SelectFieldProps) {
  return (
    <Select value={value} onValueChange={onChange}>
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

function ValueField({ lead }: { lead: Lead }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState((lead.valueCents / 100).toFixed(0));

  React.useEffect(() => {
    setDraft((lead.valueCents / 100).toFixed(0));
  }, [lead.valueCents]);

  function commit() {
    const reais = parseInt(draft.replace(/\D/g, ''), 10) || 0;
    if (reais * 100 !== lead.valueCents) updateLead(lead.id, { valueCents: reais * 100 });
    setEditing(false);
  }

  if (editing) {
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
            commit();
          } else if (e.key === 'Escape') {
            setDraft((lead.valueCents / 100).toFixed(0));
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
      onClick={() => setEditing(true)}
      className="hover:bg-muted/40 -mx-1.5 -my-1 rounded-md px-1.5 py-1 text-left transition-colors"
    >
      <span className="text-body text-foreground font-medium tabular-nums">
        {formatCents(lead.valueCents)}
      </span>
    </button>
  );
}

function TagsField({ lead }: { lead: Lead }) {
  const [draft, setDraft] = React.useState('');

  function addTag() {
    const t = draft.trim().toLowerCase();
    if (!t) return;
    if (lead.tags.includes(t)) {
      setDraft('');
      return;
    }
    if (lead.tags.length >= 8) return;
    updateLead(lead.id, { tags: [...lead.tags, t] });
    setDraft('');
  }

  function removeTag(t: string) {
    updateLead(lead.id, { tags: lead.tags.filter((x) => x !== t) });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {lead.tags.map((t) => (
        <Badge key={t} variant="secondary" className="gap-1 pr-1">
          {t}
          <button
            type="button"
            onClick={() => removeTag(t)}
            className="hover:bg-foreground/10 size-4 rounded-full"
            aria-label={`Remover tag ${t}`}
          >
            ×
          </button>
        </Badge>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
          }
        }}
        onBlur={addTag}
        placeholder={lead.tags.length === 0 ? 'Adicionar tag…' : '+'}
        className="h-7 max-w-[120px]"
      />
    </div>
  );
}

function NotesField({ lead }: { lead: Lead }) {
  const [draft, setDraft] = React.useState(lead.notes ?? '');

  React.useEffect(() => {
    setDraft(lead.notes ?? '');
  }, [lead.notes]);

  function commit() {
    if ((lead.notes ?? '') !== draft) updateLead(lead.id, { notes: draft || undefined });
  }

  return (
    <Textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      placeholder="Anote o que ajuda o time a fechar — decisor, restrições, contexto."
      rows={3}
      className="text-body"
    />
  );
}
