'use client';

import * as React from 'react';

import Link from 'next/link';

import { Button, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@papopro/ui';
import { ArrowLeft, MessageCircle, Phone, Sparkles } from '@papopro/ui/icons';

import { LeadDetailCard } from '@/features/leads/components/lead-detail-card';
import { LeadNextActions } from '@/features/leads/components/lead-next-actions';
import { LeadTimeline } from '@/features/leads/components/lead-timeline';
import { useLead } from '@/features/leads/store';

/**
 * Layout de 3 colunas no desktop (ficha 28% / timeline 44% / ações 28%);
 * em mobile (<lg) vira tabs ("Ficha" / "Histórico" / "Ações") pra evitar
 * scroll vertical infinito num único viewport apertado (CLAUDE.md §8 —
 * mobile-first onde o vendedor usa em campo).
 */
interface LeadDetailViewProps {
  leadId: string;
}

export function LeadDetailView({ leadId }: LeadDetailViewProps) {
  const lead = useLead(leadId);

  // Não deveria acontecer (server checa antes), mas como o store é mutável
  // no client (poderíamos deletar o lead em runtime), protegemos.
  if (!lead) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="outline" asChild>
          <Link href="/leads">
            <ArrowLeft /> Voltar para leads
          </Link>
        </Button>
        <p className="text-muted-foreground mt-4">Esse lead não está mais disponível.</p>
      </div>
    );
  }

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

      {/* Desktop: 3 colunas */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(280px,360px)_1fr_minmax(280px,360px)]">
        <LeadDetailCard lead={lead} />
        <LeadTimeline leadId={leadId} />
        <LeadNextActions leadId={leadId} />
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
            <LeadDetailCard lead={lead} />
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            <LeadTimeline leadId={leadId} />
          </TabsContent>
          <TabsContent value="acoes" className="mt-4">
            <LeadNextActions leadId={leadId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
