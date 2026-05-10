'use client';

import * as React from 'react';

import { Badge, Button, EmptyState, Input, PageHeader } from '@papopro/ui';
import { PlusCircle, Repeat, Search } from '@papopro/ui/icons';

import { CadenceCreateDialog } from '@/features/cadences/components/cadence-create-dialog';
import { CadenceList } from '@/features/cadences/components/cadence-list';
import { useCadences } from '@/features/cadences/store';
import {
  countCadences,
  filterCadences,
  groupCadencesByStage,
  sumActiveEnrollments,
} from '@/features/cadences/transforms';

/**
 * `/cadences` — central de cadências do workspace.
 *
 * Layout: header com KPI de cadências ativas + busca por nome + CTA de
 * criação; corpo agrupado por etapa do funil (Novo → Em contato →
 * Proposta → Negociação). Etapas terminais (`ganho`/`perdido`) são
 * excluídas pelo `groupCadencesByStage` — cadência ali não faz sentido.
 *
 * Quando o workspace não tem nenhuma cadência cadastrada, mostramos
 * EmptyState grande no centro com CTA pra criar a primeira.
 *
 * Em M8 vira Server Component lendo `cadences` via Prisma + RLS; este
 * componente fica "use client" só pra busca/dialog/atalhos.
 */
export function CadencesView() {
  const cadences = useCadences();
  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [defaultStage, setDefaultStage] = React.useState<string | undefined>();

  const filtered = React.useMemo(
    () => filterCadences(cadences, { search: search || undefined }),
    [cadences, search],
  );

  const groups = React.useMemo(() => groupCadencesByStage(filtered), [filtered]);
  const counts = React.useMemo(() => countCadences(cadences), [cadences]);
  const activeEnrollments = React.useMemo(() => sumActiveEnrollments(cadences), [cadences]);

  function openCreate(stageId?: string) {
    setDefaultStage(stageId);
    setCreateOpen(true);
  }

  const isEmptyWorkspace = cadences.length === 0;
  const isEmptySearch = !isEmptyWorkspace && filtered.length === 0;

  return (
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Cadências"
        description="Sequências automáticas que mantêm o lead aquecido sem depender da memória do vendedor."
        actions={
          <Button size="sm" onClick={() => openCreate()}>
            <PlusCircle /> Nova cadência
          </Button>
        }
      />

      {!isEmptyWorkspace && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-caption gap-1">
              <Repeat className="size-3" />
              <span className="tabular-nums">{counts.active}</span>
              <span>ativas</span>
            </Badge>
            {counts.paused > 0 && (
              <Badge variant="outline" className="text-caption gap-1">
                <span className="tabular-nums">{counts.paused}</span>
                <span>pausadas</span>
              </Badge>
            )}
            {activeEnrollments > 0 && (
              <Badge variant="outline" className="text-caption gap-1">
                <span className="tabular-nums">{activeEnrollments}</span>
                <span>leads em sequência</span>
              </Badge>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome…"
              className="pl-9"
              data-shortcut-search
            />
          </div>
        </div>
      )}

      {isEmptyWorkspace ? (
        <EmptyState
          icon={Repeat}
          title="Sem cadências por enquanto"
          description="Comece com um template pronto (Imobiliário, B2B ou Alto Ticket) ou monte do zero. Em segundos seus leads novos passam a receber follow-up automático."
          action={
            <Button onClick={() => openCreate()}>
              <PlusCircle /> Criar primeira cadência
            </Button>
          }
        />
      ) : isEmptySearch ? (
        <EmptyState
          icon={Search}
          title="Nenhuma cadência bate com a busca"
          description={`Nenhum resultado pra "${search}". Limpe a busca pra ver todas.`}
          action={
            <Button variant="outline" onClick={() => setSearch('')}>
              Limpar busca
            </Button>
          }
        />
      ) : (
        <CadenceList groups={groups} onCreateForStage={openCreate} />
      )}

      <CadenceCreateDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setDefaultStage(undefined);
        }}
        defaultStageId={defaultStage}
      />
    </div>
  );
}
