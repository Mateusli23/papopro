'use client';

import * as React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@papopro/ui';
import { MoreHorizontal, Search } from '@papopro/ui/icons';

import { changeRole, removeMember, resendInvite, useMembers } from '../store';
import type { Member, MemberRole } from '../types';

import { RoleBadge } from './role-badge';

const ROLE_FILTER_OPTIONS: Array<{ value: 'all' | MemberRole; label: string }> = [
  { value: 'all', label: 'Todos os papéis' },
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'viewer', label: 'Viewer' },
];

const CHANGEABLE_ROLES: MemberRole[] = ['admin', 'manager', 'vendedor', 'viewer'];

/**
 * Lista de membros — tabela em desktop (≥md), cards empilhados em mobile.
 *
 * Filtros: busca por nome/email + filtro de papel. As ações por linha
 * (Mudar papel · Reenviar convite · Remover) ficam no `<DropdownMenu>` —
 * mantém a tabela limpa.
 */
export function TeamList() {
  const members = useMembers();
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<'all' | MemberRole>('all');

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });
  }, [members, search, roleFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as 'all' | MemberRole)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="border-border bg-muted/30 rounded-md border px-4 py-12 text-center">
          <p className="text-body text-muted-foreground">
            Nenhum membro encontrado para esses filtros.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="border-border hidden overflow-hidden rounded-md border md:block">
            <table className="w-full text-left">
              <thead className="bg-muted/50">
                <tr className="text-caption text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Membro</th>
                  <th className="px-4 py-2 font-semibold">Papel</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Último acesso</th>
                  <th className="px-4 py-2" aria-label="Ações" />
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {filtered.map((m) => (
                  <MemberRow key={m.id} member={m} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {filtered.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MemberRow({ member }: { member: Member }) {
  return (
    <tr className="text-body">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{member.avatarEmoji ?? initials(member.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-foreground font-medium">{member.name}</span>
            <span className="text-caption text-muted-foreground">{member.email}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={member.role} />
      </td>
      <td className="px-4 py-3">
        {member.status === 'active' ? (
          <Badge variant="success">Ativo</Badge>
        ) : (
          <Badge variant="warning">Convite pendente</Badge>
        )}
      </td>
      <td className="text-muted-foreground px-4 py-3">{formatLastSeen(member)}</td>
      <td className="px-4 py-3 text-right">
        <MemberActions member={member} />
      </td>
    </tr>
  );
}

function MemberCard({ member }: { member: Member }) {
  return (
    <div className="border-border flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9">
          <AvatarFallback>{member.avatarEmoji ?? initials(member.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="text-body text-foreground truncate font-medium">{member.name}</span>
          <span className="text-caption text-muted-foreground truncate">{member.email}</span>
          <div className="mt-1 flex items-center gap-1.5">
            <RoleBadge role={member.role} />
            {member.status === 'invited' && (
              <Badge variant="warning" className="text-[10px]">
                Pendente
              </Badge>
            )}
          </div>
        </div>
      </div>
      <MemberActions member={member} />
    </div>
  );
}

function MemberActions({ member }: { member: Member }) {
  function handleChangeRole(newRole: MemberRole) {
    const r = changeRole({ memberId: member.id, role: newRole });
    if (!r.ok) {
      toast.error(r.reason ?? 'Não foi possível mudar o papel');
      return;
    }
    toast.success(`Papel atualizado para ${newRole}`);
  }

  function handleResend() {
    const ok = resendInvite(member.id);
    if (ok) toast.success(`Convite reenviado para ${member.email}`);
    else toast.error('Não foi possível reenviar agora');
  }

  function handleRemove() {
    const r = removeMember(member.id);
    if (!r.ok) {
      toast.error(r.reason ?? 'Não foi possível remover');
      return;
    }
    toast.success(`${member.name} removido do workspace`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${member.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {CHANGEABLE_ROLES.filter((r) => r !== member.role).map((role) => (
          <DropdownMenuItem key={role} onSelect={() => handleChangeRole(role)}>
            Mudar para {role}
          </DropdownMenuItem>
        ))}
        {member.status === 'invited' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleResend}>Reenviar convite</DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleRemove}
          disabled={member.role === 'owner'}
          className="text-destructive focus:text-destructive"
        >
          Remover do workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function formatLastSeen(member: Member) {
  if (member.status === 'invited') {
    if (!member.invitedAt) return '—';
    return `Convidado ${formatDistanceToNow(new Date(member.invitedAt), {
      addSuffix: true,
      locale: ptBR,
    })}`;
  }
  if (!member.lastSeenAt) return '—';
  return formatDistanceToNow(new Date(member.lastSeenAt), {
    addSuffix: true,
    locale: ptBR,
  });
}
