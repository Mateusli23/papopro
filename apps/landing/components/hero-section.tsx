import { Badge, BrandArcs, Button } from '@papopro/ui';
import { ArrowRight, CheckCircle2, KanbanSquare, MessageCircle, Sparkles } from '@papopro/ui/icons';

/**
 * Hero da landing. Estrutura em 2 colunas no desktop (copy à esquerda, mockup
 * à direita) e empilhada no mobile. `BrandArcs variant="landing-hero"` ocupa o
 * fundo da seção — única superfície fora de marketing/onboarding em que os
 * arcos aparecem (CLAUDE.md §8 autoriza explicitamente).
 *
 * Os 3 trust signals (sem cartão, 7 dias, dados Brasil) ficam abaixo dos CTAs
 * pra reduzir a fricção declarada no PRD: usuário SMB hesita em testar SaaS
 * por medo de cobrança automática.
 */

const TRUST_SIGNALS: ReadonlyArray<string> = [
  'Sem cartão de crédito',
  '7 dias grátis',
  'Dados hospedados no Brasil',
];

export function HeroSection() {
  return (
    <section id="hero" className="relative overflow-hidden pt-24 md:pt-32">
      {/* Arcos decorativos posicionados absolute via prop default. */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 md:opacity-100">
        <BrandArcs variant="landing-hero" />
      </div>

      <div className="container mx-auto grid items-center gap-12 px-4 py-12 md:grid-cols-2 md:gap-16 md:py-20">
        {/* Copy */}
        <div className="flex flex-col items-start gap-6">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="size-3.5" />
            Novo · Agentes IA com memória por lead
          </Badge>

          <h1 className="text-foreground text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
            Pare de perder lead por <span className="text-primary">esquecer de dar follow-up</span>.
          </h1>

          <p className="text-muted-foreground text-body-lg max-w-xl">
            PapoPro é o CRM brasileiro pra times que vivem no WhatsApp. Cadência automática, alertas
            antes do lead esfriar e caixa unificada com proteção anti-bloqueio — pra você fechar
            mais sem depender da memória do vendedor.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href="#cta-final">
                Começar grátis 7 dias <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#demo">Ver demonstração</a>
            </Button>
          </div>

          <ul className="text-muted-foreground text-caption flex flex-wrap items-center gap-x-4 gap-y-2">
            {TRUST_SIGNALS.map((signal) => (
              <li key={signal} className="flex items-center gap-1.5">
                <CheckCircle2 className="text-success size-4" aria-hidden />
                <span>{signal}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mockup à direita — Kanban estilizado, 100% Tailwind (sem screenshot externo). */}
        <div className="relative" aria-hidden>
          <div className="bg-card border-border rounded-xl border p-4 shadow-lg md:p-6">
            {/* Barra superior simulando tabs do produto. */}
            <div className="border-border mb-4 flex items-center gap-2 border-b pb-3">
              <KanbanSquare className="text-primary size-4" />
              <span className="text-foreground text-body font-semibold">Pipeline · Vendas SMB</span>
              <span className="text-muted-foreground text-caption ml-auto">Atualizado agora</span>
            </div>

            {/* 3 colunas Kanban mockadas com cards. */}
            <div className="grid grid-cols-3 gap-3">
              <KanbanColumn
                title="Novo"
                count={12}
                tone="primary"
                cards={[
                  { name: 'João Silva', subtitle: 'R$ 12.500 · Indicação' },
                  { name: 'Ana Costa', subtitle: 'R$ 8.300 · Meta Ads' },
                ]}
              />
              <KanbanColumn
                title="Contato"
                count={7}
                tone="warning"
                cards={[
                  { name: 'Pedro Souza', subtitle: 'R$ 45.000 · WhatsApp' },
                  { name: 'Marina Reis', subtitle: 'R$ 18.700 · Site' },
                ]}
              />
              <KanbanColumn
                title="Proposta"
                count={4}
                tone="success"
                cards={[{ name: 'Carlos Lima', subtitle: 'R$ 92.000 · Indicação' }]}
              />
            </div>

            {/* WhatsApp peek — mini-card no rodapé do mockup. */}
            <div className="bg-muted/50 border-border mt-4 flex items-center gap-3 rounded-lg border p-3">
              <div className="bg-success/15 text-success rounded-full p-1.5">
                <MessageCircle className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-caption truncate font-semibold">
                  Marina Reis · WhatsApp
                </p>
                <p className="text-muted-foreground text-caption truncate">
                  &quot;Bom dia! Recebi a proposta, posso ligar agora?&quot;
                </p>
              </div>
              <span className="bg-primary text-primary-foreground text-caption rounded-full px-2 py-0.5 font-semibold">
                3
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface KanbanCard {
  name: string;
  subtitle: string;
}

interface KanbanColumnProps {
  title: string;
  count: number;
  tone: 'primary' | 'warning' | 'success';
  cards: ReadonlyArray<KanbanCard>;
}

const TONE_DOT: Record<KanbanColumnProps['tone'], string> = {
  primary: 'bg-primary',
  warning: 'bg-warning',
  success: 'bg-success',
};

function KanbanColumn({ title, count, tone, cards }: KanbanColumnProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
        <span className="text-foreground text-caption font-semibold">{title}</span>
        <span className="text-muted-foreground text-caption">{count}</span>
      </div>
      {cards.map((card) => (
        <div
          key={card.name}
          className="bg-background border-border rounded-md border p-2 shadow-sm"
        >
          <p className="text-foreground text-caption truncate font-semibold">{card.name}</p>
          <p className="text-muted-foreground text-caption truncate">{card.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
