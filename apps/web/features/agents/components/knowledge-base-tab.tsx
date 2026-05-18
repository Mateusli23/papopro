'use client';

import * as React from 'react';

import { Card, cn } from '@papopro/ui';
import { Brain } from '@papopro/ui/icons';

import type { KnowledgeBase } from '../types';

import { KnowledgeFileList } from './knowledge-file-list';
import { KnowledgeSectionEditor } from './knowledge-section-editor';
import { KnowledgeUploadZone } from './knowledge-upload-zone';

/**
 * Aba "Cérebro da Empresa" — 5 seções estruturadas (PRD §3.9) + upload de
 * arquivos. Layout Notion-like: âncoras laterais sticky no `lg:`, seções
 * empilhadas no corpo principal.
 *
 * Por que seções empilhadas e não Tabs aninhadas?
 *  - Tabs dentro de Tabs gera a11y confusa (`role=tab` dentro de
 *    `role=tabpanel`) e fadiga visual.
 *  - Stack natural permite ler tudo de uma vez (paridade Notion). Vendedor
 *    não precisa "lembrar" em qual Tab estava o que.
 *
 * Em M11 vira pgvector + RAG. Shape do KnowledgeBase fica igual; muda
 * só a fonte (mock → Postgres + extração de PDF + embeddings).
 */

const SECTIONS = [
  {
    anchor: 'kb-about',
    sectionKey: 'about' as const,
    title: 'Sobre a empresa',
    description:
      'Quem é a empresa, ano de fundação, time, diferenciais. O agente menciona quando lead pergunta "quem é vocês?".',
    placeholder:
      'Ex: Somos a Lar Brasil, imobiliária boutique fundada em 2014. Atendemos clientes que buscam imóveis na zona sul de SP...',
  },
  {
    anchor: 'kb-products',
    sectionKey: 'products' as const,
    title: 'Produtos',
    description:
      'Catálogo, faixas de preço, regiões/categorias. O agente consulta quando lead pergunta "quanto custa" ou "que opções vocês têm".',
    placeholder:
      'Ex: **Apartamentos 2-3 quartos** · 65-110m² · Vila Olímpia, Pinheiros · ticket R$ 850k-1,2M\n\n**Casas em condomínio** · ...',
  },
  {
    anchor: 'kb-faq',
    sectionKey: 'faq' as const,
    title: 'FAQ',
    description: 'Perguntas frequentes com respostas curtas. Agente usa pra triagem operacional.',
    placeholder:
      'Ex: **Como funciona a primeira visita?**\nA primeira visita é gratuita e dura 45min...\n\n**Vocês cobram comissão?**\n...',
  },
  {
    anchor: 'kb-scripts',
    sectionKey: 'scripts' as const,
    title: 'Scripts de objeção',
    description:
      'Como responder a "está caro", "vou pensar", "vi mais barato". Agente puxa quando detecta a objeção.',
    placeholder:
      'Ex: **Cliente diz "está caro"**\nReconheça: "Entendo, é um valor alto mesmo." Reformule em parcela mensal...',
  },
  {
    anchor: 'kb-policy',
    sectionKey: 'policy' as const,
    title: 'Política comercial',
    description:
      'SLA, regras de negociação, política de comunicação, casos especiais. Define limites do que o agente pode prometer.',
    placeholder:
      'Ex: **Política de exclusividade**: assumimos contratos exclusivos por 90 dias...\n\n**LGPD**: dados ficam por 24 meses...',
  },
];

interface KnowledgeBaseTabProps {
  initialKb: KnowledgeBase | null;
  callerRole: string;
}

export function KnowledgeBaseTab({ initialKb, callerRole }: KnowledgeBaseTabProps) {
  // Workspace sem KB → começa com 5 campos vazios (UI já trata).
  const kb: KnowledgeBase = initialKb ?? {
    workspaceId: '',
    about: '',
    products: '',
    faq: '',
    scripts: '',
    policy: '',
    files: [],
    updatedAt: new Date().toISOString(),
  };

  // Owner/Admin podem editar; outros papéis só leem.
  const canEdit = callerRole === 'Owner' || callerRole === 'Admin';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
      {/* Sidebar âncoras (sticky em lg+) */}
      <aside className="hidden lg:block">
        <nav className="sticky top-4 flex flex-col gap-1" aria-label="Seções do Cérebro da Empresa">
          <span className="text-caption text-muted-foreground/80 mb-1 inline-flex items-center gap-1 font-medium">
            <Brain className="size-3" />
            Navegar
          </span>
          {SECTIONS.map((s) => (
            <a
              key={s.anchor}
              href={`#${s.anchor}`}
              className={cn(
                'text-caption text-muted-foreground rounded-md px-2 py-1.5 transition',
                'hover:bg-muted hover:text-foreground',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
              )}
            >
              {s.title}
            </a>
          ))}
          <a
            href="#kb-files"
            className={cn(
              'text-caption text-muted-foreground rounded-md px-2 py-1.5 transition',
              'hover:bg-muted hover:text-foreground',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
            )}
          >
            Arquivos
          </a>
        </nav>
      </aside>

      <div className="flex flex-col gap-4">
        {SECTIONS.map((s) => (
          <KnowledgeSectionEditor
            key={s.sectionKey}
            anchor={s.anchor}
            sectionKey={s.sectionKey}
            title={s.title}
            description={s.description}
            placeholder={s.placeholder}
            value={kb[s.sectionKey]}
            disabled={!canEdit}
          />
        ))}

        <Card id="kb-files" className="flex scroll-mt-4 flex-col gap-4 p-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-body font-semibold">Arquivos</h3>
            <p className="text-caption text-muted-foreground/80">
              Documentos do workspace — extração + chunking + embedding em pgvector. Todos os
              agentes consultam via RAG no chat de simulação e (em M11#5) no atendimento real.
            </p>
          </div>

          {canEdit && <KnowledgeUploadZone />}
          <KnowledgeFileList files={kb.files} />
        </Card>
      </div>
    </div>
  );
}
