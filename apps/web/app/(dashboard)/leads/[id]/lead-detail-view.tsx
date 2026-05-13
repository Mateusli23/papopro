'use client';

import * as React from 'react';

import Link from 'next/link';

import { Button, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@papopro/ui';
import { ArrowLeft, Info, MessageCircle, Phone, Sparkles } from '@papopro/ui/icons';

import { LeadDetailCard } from '@/features/leads/components/lead-detail-card';
import { LeadNextActions } from '@/features/leads/components/lead-next-actions';
import { LeadTimeline } from '@/features/leads/components/lead-timeline';
import type { LeadWithRelations } from '@/features/leads/queries';
import type { PipelineStage, SalesRep } from '@/features/leads/types';

/**
 * Layout de 3 colunas no desktop (ficha 28% / timeline 44% / ações 28%);
 * em mobile (<lg) vira tabs ("Ficha" / "Histórico" / "Ações") pra evitar
 * scroll vertical infinito num único viewport apertado (CLAUDE.md §8 —
 * mobile-first onde o vendedor usa em campo).
 *
 * **M8#2:** ficha (LeadDetailCard) lê dados reais via prop; **Timeline
 * e Próximas ações continuam mockadas** (fixtures de M5) até M8#4
 * substituir por `activities` + `tasks` reais. Banner abaixo avisa.
 */
type Role = 'Owner' | 'Admin' | 'Manager' | 'Vendedor' | 'Viewer';

interface LeadDetailViewProps {
  lead: LeadWithRelations;
  salesReps: SalesRep[];
  stages: PipelineStage[];
  callerRole: Role;
}

export function LeadDetailView({ lead, salesReps, stages, callerRole }: LeadDetailViewProps) {
  return (
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/leads">
            <ArrowLeft /> Voltar para leads
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <Phone /> Ligar
          </Button>
          <Button variant="outline" size="sm" disabled>
            <MessageCircle /> Mandar WhatsApp
          </Button>
          <Button size="sm" disabled>
            <Sparkles /> Atribuir IA
          </Button>
        </div>
      </div>

      <PageHeader
        title={lead.name}
        description={
          lead.company
            ? `${lead.company}${lead.position ? ` · ${lead.position}` : ''}`
            : 'Sem empresa cadastrada'
        }
      />

      {lead.openDeals.length > 0 && (
        <div className="bg-muted/40 border-border flex flex-col gap-2 rounded-lg border p-4">
          <span className="text-caption text-muted-foreground font-semibold uppercase tracking-wide">
            Negócios em aberto ({lead.openDeals.length})
          </span>
          <ul className="flex flex-col gap-1">
            {lead.openDeals.map((d) => (
              <li key={d.id} className="text-body flex items-center justify-between gap-2">
                <span className="text-foreground truncate">{d.title}</span>
                <span className="text-muted-foreground text-caption shrink-0">{d.stageName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MockedDataNotice />

      {/* Desktop: 3 colunas */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(280px,360px)_1fr_minmax(280px,360px)]">
        <LeadDetailCard lead={lead} salesReps={salesReps} stages={stages} callerRole={callerRole} />
        <LeadTimeline leadId={lead.id} />
        <LeadNextActions leadId={lead.id} />
      </div>

      {/* Mobile/Tablet: tabs */}
      <div className="lg:hidden">
        <Tabs defaultValue="ficha">
          <TabsList className="w-full">
            <TabsTrigger value="ficha" className="flex-1">
              Ficha
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex-1">
              Histórico
            </TabsTrigger>
            <TabsTrigger value="acoes" className="flex-1">
              Ações
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ficha" className="mt-4">
            <LeadDetailCard
              lead={lead}
              salesReps={salesReps}
              stages={stages}
              callerRole={callerRole}
            />
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            <LeadTimeline leadId={lead.id} />
          </TabsContent>
          <TabsContent value="acoes" className="mt-4">
            <LeadNextActions leadId={lead.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MockedDataNotice() {
  return (
    <div
      role="note"
      className="border-info/30 bg-info/5 text-info text-caption flex items-start gap-2 rounded-md border px-3 py-2"
    >
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>
        <strong>Timeline e Próximas ações</strong> ainda mostram dados de exemplo. Activities e
        tasks reais ficam disponíveis no M8#4.
      </span>
    </div>
  );
}
