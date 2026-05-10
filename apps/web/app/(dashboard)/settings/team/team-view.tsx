'use client';

import * as React from 'react';

import { Badge, Button, PageHeader } from '@papopro/ui';
import { UserPlus } from '@papopro/ui/icons';

import { InviteMemberDialog } from '@/features/settings/components/invite-member-dialog';
import { TeamList } from '@/features/settings/components/team-list';
import { useMembers } from '@/features/settings/store';
import { countMembers } from '@/features/settings/transforms';

/**
 * `/settings/team` — gestão de membros e convites.
 *
 * KPIs no header (total/ativos/pendentes) + CTA "Convidar membro" + lista
 * com filtros e ações por linha. Em M5 todas mutações são in-memory; em M7+
 * cada ação vira Server Action com magic link via Resend.
 */
export function TeamView() {
  const members = useMembers();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const counts = React.useMemo(() => countMembers(members), [members]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Time"
        description="Gerencie membros, papéis e convites pendentes do workspace."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus /> Convidar membro
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" className="gap-1">
          <span className="tabular-nums">{counts.active}</span>
          <span>ativos</span>
        </Badge>
        {counts.invited > 0 && (
          <Badge variant="warning" className="gap-1">
            <span className="tabular-nums">{counts.invited}</span>
            <span>convites pendentes</span>
          </Badge>
        )}
        <Badge variant="outline" className="gap-1">
          <span className="tabular-nums">{counts.total}</span>
          <span>no total</span>
        </Badge>
      </div>

      <TeamList />

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
