'use client';

import * as React from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@papopro/ui';
import { ArrowRight, KanbanSquare, MessageCircle, Play, Sparkles } from '@papopro/ui/icons';

/**
 * Seção de demo. Poster placeholder + botão Play que abre um Dialog "em
 * breve" — alinhado com o princípio "Estado vazio sempre orienta o próximo
 * passo" (CLAUDE.md §8). Em vez de uma área vazia frustrante, o click do play
 * encaminha o usuário pra começar o trial.
 *
 * O poster é construído inteiramente em Tailwind (sem screenshot externo) com
 * camadas que evocam a UI do produto: 3 chips no topo (Kanban / WhatsApp / IA),
 * gradient de fundo coerente com a marca, badge "1:24" simulando duração.
 * Quando o vídeo real for produzido, basta trocar pelo `<video>` mantendo o
 * mesmo container e o Dialog vira opcional.
 *
 * `'use client'` é necessário só pelo estado do Dialog. Tudo o mais é estático.
 */
export function DemoSection() {
  const [open, setOpen] = React.useState(false);

  return (
    <section id="demo" className="bg-muted/30 py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-foreground text-3xl font-bold tracking-tight md:text-4xl">
            Veja o PapoPro em <span className="text-primary">1 minuto e meio</span>.
          </h2>
          <p className="text-muted-foreground text-body-lg mt-4">
            Tour rápido pelas 4 frentes que o produto resolve — Kanban, WhatsApp, IA e cadência. Sem
            cadastro pra assistir.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-4xl">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Assistir vídeo de demonstração do PapoPro"
            className="focus-visible:ring-ring border-border group relative block w-full overflow-hidden rounded-xl border shadow-lg transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {/* Poster sintético — gradient + chips */}
            <div className="from-primary/10 via-background to-accent/10 aspect-video w-full bg-gradient-to-br">
              <div className="flex h-full flex-col p-6 md:p-10">
                <div className="flex flex-wrap items-center gap-2">
                  <PosterChip icon={<KanbanSquare className="size-3.5" />} label="Kanban" />
                  <PosterChip icon={<MessageCircle className="size-3.5" />} label="WhatsApp" />
                  <PosterChip icon={<Sparkles className="size-3.5" />} label="Agentes IA" />
                </div>

                <div className="flex flex-1 items-center justify-center">
                  <span className="bg-primary text-primary-foreground flex size-20 items-center justify-center rounded-full shadow-lg transition-transform group-hover:scale-110 md:size-24">
                    <Play className="size-8 translate-x-0.5 md:size-10" aria-hidden />
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-foreground text-body font-semibold">
                    PapoPro · Tour completo
                  </span>
                  <span className="bg-foreground/80 text-background text-caption rounded-full px-2 py-0.5 font-medium">
                    1:24
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vídeo em produção</DialogTitle>
            <DialogDescription>
              Tá quase pronto — gravamos junto com os primeiros clientes do beta fechado. Enquanto
              isso, dá pra explorar o PapoPro grátis por 7 dias sem cartão.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Voltar pra landing
            </Button>
            <Button asChild>
              <a href="#cta-final" onClick={() => setOpen(false)}>
                Começar grátis <ArrowRight className="size-4" />
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

interface PosterChipProps {
  icon: React.ReactNode;
  label: string;
}

function PosterChip({ icon, label }: PosterChipProps) {
  return (
    <span className="bg-background/80 text-foreground border-border text-caption flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium shadow-sm backdrop-blur">
      {icon}
      {label}
    </span>
  );
}
