'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@papopro/ui';
import { MoreHorizontal, Search, UserPlus } from '@papopro/ui/icons';

import { inviteMemberAction } from '@/features/invitations/actions';
import {
  INVITABLE_ROLES,
  invitationCreateSchema,
  type InvitationCreateInput,
} from '@/features/invitations/schemas';
import { changeRoleAction, removeMemberAction, resendInviteAction } from '@/features/team/actions';
import { memberDisplayName, memberInitials } from '@/features/team/presentation';
import type { PendingInviteRow, Role, TeamMemberRow } from '@/features/team/types';

interface TeamViewProps {
  initialMembers: TeamMemberRow[];
  initialPendingInvitations: PendingInviteRow[];
  callerRole: Role;
  callerUserId: string;
}

/**
 * `/settings/team` — gestão de membros e convites do workspace (M7#5).
 *
 * **State.** Props vêm Server Component; Client mantém UI state (filtros,
 * dialog open). Toda mutação chama Server Action e depois `router.refresh()`
 * pra recarregar dados — sem otimistic update por enquanto (UX clara: "click
 * → loading → tela atualizada"). Otimistic updates ficam pra M8+ quando o
 * volume de mutações justificar a complexidade.
 *
 * **RBAC visual.** Owner/Admin veem ações ("Convidar", "Mudar papel",
 * "Remover", "Reenviar"). Manager/Vendedor/Viewer veem só leitura. As
 * Server Actions revalidam permissões server-side — UI esconder não é
 * segurança, é UX.
 */
export function TeamView({
  initialMembers,
  initialPendingInvitations,
  callerRole,
  callerUserId,
}: TeamViewProps) {
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const canManage = callerRole === 'Owner' || callerRole === 'Admin';

  const filteredMembers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialMembers;
    return initialMembers.filter(
      (m) => (m.name ?? '').toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [initialMembers, search]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Time"
        description="Gerencie membros, papéis e convites pendentes do workspace."
        actions={
          canManage ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus /> Convidar membro
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" className="gap-1">
          <span className="tabular-nums">{initialMembers.length}</span>
          <span>{initialMembers.length === 1 ? 'membro' : 'membros'}</span>
        </Badge>
        {initialPendingInvitations.length > 0 && (
          <Badge variant="warning" className="gap-1">
            <span className="tabular-nums">{initialPendingInvitations.length}</span>
            <span>
              {initialPendingInvitations.length === 1 ? 'convite pendente' : 'convites pendentes'}
            </span>
          </Badge>
        )}
      </div>

      {initialPendingInvitations.length > 0 && (
        <PendingInvitesSection invitations={initialPendingInvitations} canManage={canManage} />
      )}

      <div className="flex flex-col gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="pl-9"
          />
        </div>

        <MembersSection
          members={filteredMembers}
          canManage={canManage}
          callerUserId={callerUserId}
        />
      </div>

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

// =============================================================================
// Convites pendentes
// =============================================================================

function PendingInvitesSection({
  invitations,
  canManage,
}: {
  invitations: PendingInviteRow[];
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-foreground text-body font-semibold">Convites pendentes</h2>
      <div className="border-border overflow-hidden rounded-md border">
        <table className="w-full text-left">
          <thead className="bg-muted/50">
            <tr className="text-caption text-muted-foreground">
              <th className="px-4 py-2 font-semibold">E-mail</th>
              <th className="hidden px-4 py-2 font-semibold sm:table-cell">Papel</th>
              <th className="hidden px-4 py-2 font-semibold md:table-cell">Enviado</th>
              <th className="px-4 py-2" aria-label="Ações" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {invitations.map((invite) => (
              <PendingInviteRowItem key={invite.id} invite={invite} canManage={canManage} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PendingInviteRowItem({
  invite,
  canManage,
}: {
  invite: PendingInviteRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleResend() {
    setPending(true);
    const r = await resendInviteAction({ invitationId: invite.id });
    setPending(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`Convite reenviado para ${invite.email}`);
    router.refresh();
  }

  async function handleRevoke() {
    setPending(true);
    // `revokeInvitationAction` está em features/invitations — import dinâmico
    // evita ciclo de import e mantém o bundle do team-view enxuto.
    const { revokeInvitationAction } = await import('@/features/invitations/actions');
    const r = await revokeInvitationAction({ invitationId: invite.id });
    setPending(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`Convite para ${invite.email} cancelado`);
    router.refresh();
  }

  return (
    <tr className="text-body">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-foreground font-medium">{invite.email}</span>
          <span className="text-caption text-muted-foreground sm:hidden">
            {invite.role} ·{' '}
            {formatDistanceToNow(new Date(invite.createdAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        </div>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <Badge variant="outline">{invite.role}</Badge>
      </td>
      <td className="text-muted-foreground hidden px-4 py-3 md:table-cell">
        {formatDistanceToNow(new Date(invite.createdAt), {
          addSuffix: true,
          locale: ptBR,
        })}
      </td>
      <td className="px-4 py-3 text-right">
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Ações para convite de ${invite.email}`}
                disabled={pending}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleResend}>Reenviar email</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleRevoke}
                className="text-destructive focus:text-destructive"
              >
                Cancelar convite
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </td>
    </tr>
  );
}

// =============================================================================
// Membros
// =============================================================================

function MembersSection({
  members,
  canManage,
  callerUserId,
}: {
  members: TeamMemberRow[];
  canManage: boolean;
  callerUserId: string;
}) {
  if (members.length === 0) {
    return (
      <div className="border-border bg-muted/30 rounded-md border px-4 py-12 text-center">
        <p className="text-body text-muted-foreground">
          Nenhum membro encontrado para esses filtros.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border-border hidden overflow-hidden rounded-md border md:block">
        <table className="w-full text-left">
          <thead className="bg-muted/50">
            <tr className="text-caption text-muted-foreground">
              <th className="px-4 py-2 font-semibold">Membro</th>
              <th className="px-4 py-2 font-semibold">Papel</th>
              <th className="px-4 py-2 font-semibold">Entrou</th>
              <th className="px-4 py-2 font-semibold">Último acesso</th>
              <th className="px-4 py-2" aria-label="Ações" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                canManage={canManage}
                isSelf={m.userId === callerUserId}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {members.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            canManage={canManage}
            isSelf={m.userId === callerUserId}
          />
        ))}
      </div>
    </>
  );
}

function MemberRow({
  member,
  canManage,
  isSelf,
}: {
  member: TeamMemberRow;
  canManage: boolean;
  isSelf: boolean;
}) {
  return (
    <tr className="text-body">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{memberInitials(member)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-foreground font-medium">
              {memberDisplayName(member)}
              {isSelf && (
                <span className="text-muted-foreground text-caption ml-1 font-normal">(você)</span>
              )}
            </span>
            <span className="text-caption text-muted-foreground">{member.email}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={member.role === 'Owner' ? 'default' : 'outline'}>{member.role}</Badge>
      </td>
      <td className="text-muted-foreground px-4 py-3">{formatRelative(member.joinedAt)}</td>
      <td className="text-muted-foreground px-4 py-3">{formatRelative(member.lastSeenAt)}</td>
      <td className="px-4 py-3 text-right">
        <MemberActions member={member} canManage={canManage} isSelf={isSelf} />
      </td>
    </tr>
  );
}

function MemberCard({
  member,
  canManage,
  isSelf,
}: {
  member: TeamMemberRow;
  canManage: boolean;
  isSelf: boolean;
}) {
  return (
    <div className="border-border flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9">
          <AvatarFallback>{memberInitials(member)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="text-body text-foreground truncate font-medium">
            {memberDisplayName(member)}
            {isSelf && (
              <span className="text-muted-foreground text-caption ml-1 font-normal">(você)</span>
            )}
          </span>
          <span className="text-caption text-muted-foreground truncate">{member.email}</span>
          <div className="mt-1">
            <Badge variant={member.role === 'Owner' ? 'default' : 'outline'}>{member.role}</Badge>
          </div>
        </div>
      </div>
      <MemberActions member={member} canManage={canManage} isSelf={isSelf} />
    </div>
  );
}

const CHANGEABLE_ROLES: Role[] = ['Admin', 'Manager', 'Vendedor', 'Viewer'];

function MemberActions({
  member,
  canManage,
  isSelf,
}: {
  member: TeamMemberRow;
  canManage: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  // Owner do workspace nunca aparece como alvo de remoção/role-change pela
  // UI — o flow é "Transferir propriedade" (M8). Self-edits também escondem
  // ações (Owner não rebaixa a si mesmo por engano).
  const isOwner = member.role === 'Owner';
  const showMenu = canManage && !isOwner && !isSelf;

  if (!showMenu) {
    return <span className="text-muted-foreground text-caption">—</span>;
  }

  async function onChangeRole(role: Role) {
    setPending(true);
    const r = await changeRoleAction({ memberId: member.id, role });
    setPending(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`Papel atualizado para ${role}`);
    router.refresh();
  }

  async function onRemove() {
    setPending(true);
    const r = await removeMemberAction({ memberId: member.id });
    setPending(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`${memberDisplayName(member)} removido do workspace`);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Ações para ${memberDisplayName(member)}`}
          disabled={pending}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {CHANGEABLE_ROLES.filter((r) => r !== member.role).map((role) => (
          <DropdownMenuItem key={role} onSelect={() => onChangeRole(role)}>
            Mudar para {role}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
          Remover do workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================================================
// Dialog de convite
// =============================================================================

const ROLE_DESCRIPTIONS: Record<(typeof INVITABLE_ROLES)[number], string> = {
  Admin: 'Acesso total exceto cobrança.',
  Manager: 'Vê leads do time, edita pipeline e cadências; não convida usuários.',
  Vendedor: 'Acesso apenas aos próprios leads.',
  Viewer: 'Somente leitura — sócio, mentor, contador.',
};

function InviteMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<InvitationCreateInput>({
    resolver: zodResolver(invitationCreateSchema),
    defaultValues: { email: '', role: 'Vendedor' },
  });

  React.useEffect(() => {
    if (open) form.reset({ email: '', role: 'Vendedor' });
  }, [open, form]);

  async function onSubmit(values: InvitationCreateInput) {
    const r = await inviteMemberAction(values);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`Convite enviado para ${values.email}`);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
          <DialogDescription>
            Enviamos um link mágico por e-mail. Quando aceito, o membro entra direto.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      autoComplete="email"
                      placeholder="colaborador@empresa.com.br"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INVITABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          <span className="flex flex-col">
                            <span className="text-body font-medium">{role}</span>
                            <span className="text-caption text-muted-foreground">
                              {ROLE_DESCRIPTIONS[role]}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Enviar convite
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}
