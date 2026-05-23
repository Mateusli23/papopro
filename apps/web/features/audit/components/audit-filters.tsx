'use client';

import * as React from 'react';

import { usePathname, useRouter } from 'next/navigation';

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@papopro/ui';
import { Filter } from '@papopro/ui/icons';

import { AUDIT_ACTION_GROUPS, auditActionLabel } from '../labels';
import type { AuditActorOption, AuditFilters } from '../types';

/**
 * Barra de filtros da auditoria (M13#3) — autor, tipo de evento e período.
 *
 * Estado mora na URL (`searchParams`): o Server Component da página re-busca
 * a cada mudança. Por isso o componente client só monta a query e dá
 * `router.push` — nenhum estado de servidor em React state.
 *
 * `'all'` é o sentinel de "sem filtro" (Radix Select não aceita item com
 * value vazio). Trocar qualquer filtro zera a paginação.
 */
const ALL = 'all';

interface AuditFiltersProps {
  actors: AuditActorOption[];
  current: AuditFilters;
}

export function AuditFilters({ actors, current }: AuditFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  const apply = React.useCallback(
    (patch: Partial<Record<'actorId' | 'action' | 'from' | 'to', string | undefined>>) => {
      const next: AuditFilters = { ...current, ...patch, page: 0 };
      const params = new URLSearchParams();
      if (next.actorId) params.set('actorId', next.actorId);
      if (next.action) params.set('action', next.action);
      if (next.from) params.set('from', next.from);
      if (next.to) params.set('to', next.to);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [current, pathname, router],
  );

  const hasFilters = Boolean(current.actorId || current.action || current.from || current.to);

  return (
    <div className="border-border bg-muted/30 flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-end gap-4">
        {/* Autor */}
        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <Label htmlFor="audit-actor">Autor</Label>
          <Select
            value={current.actorId ?? ALL}
            onValueChange={(v) => apply({ actorId: v === ALL ? undefined : v })}
          >
            <SelectTrigger id="audit-actor">
              <SelectValue placeholder="Todos os autores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os autores</SelectItem>
              {actors.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tipo de evento */}
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <Label htmlFor="audit-action">Tipo de evento</Label>
          <Select
            value={current.action ?? ALL}
            onValueChange={(v) => apply({ action: v === ALL ? undefined : v })}
          >
            <SelectTrigger id="audit-action">
              <SelectValue placeholder="Todos os eventos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os eventos</SelectItem>
              {AUDIT_ACTION_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {auditActionLabel(action)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Período */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-from">De</Label>
          <Input
            id="audit-from"
            type="date"
            value={current.from ?? ''}
            max={current.to || undefined}
            onChange={(e) => apply({ from: e.target.value || undefined })}
            className="w-[160px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-to">Até</Label>
          <Input
            id="audit-to"
            type="date"
            value={current.to ?? ''}
            min={current.from || undefined}
            onChange={(e) => apply({ to: e.target.value || undefined })}
            className="w-[160px]"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
            <Filter />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
