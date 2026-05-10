import { Card, CardContent } from '@papopro/ui';
import {
  type LucideIcon,
  Clock,
  Flame,
  MessageCircle,
  ThermometerSnowflake,
} from '@papopro/ui/icons';

/**
 * Seção de problema. Mostra 4 estatísticas que justificam o produto:
 * leads sem follow-up, vendedores que desistem cedo, peso do WhatsApp no Brasil
 * e perda de leads qualificados por falta de cadência.
 *
 * As fontes são as referências de mercado mais citadas para cada claim. Se o PO
 * trocar a metodologia ou ajustar números, basta editar `STATS` — nenhum dos
 * valores está hardcoded em outro lugar.
 */

interface Stat {
  /** Percentual destacado em grande. */
  value: string;
  /** Frase principal explicando o número (1 linha). */
  headline: string;
  /** Fonte citada — exibida como caption em cinza. */
  source: string;
  icon: LucideIcon;
  /** Cor do bloco do ícone — token semântico. */
  tone: 'destructive' | 'warning' | 'success' | 'primary';
}

const STATS: ReadonlyArray<Stat> = [
  {
    value: '48%',
    headline: 'dos leads inbound nunca recebem um único follow-up depois do primeiro contato.',
    source: 'InsideSales / Velocify, 2023',
    icon: ThermometerSnowflake,
    tone: 'destructive',
  },
  {
    value: '80%',
    headline:
      'das vendas exigem 5 ou mais follow-ups — mas 44% dos vendedores desistem após o primeiro.',
    source: 'Marketing Donut, 2022',
    icon: Clock,
    tone: 'warning',
  },
  {
    value: '92%',
    headline:
      'dos consumidores brasileiros usam o WhatsApp e esperam ser atendidos por ele todos os dias.',
    source: 'Opinion Box · Panorama Mobile Time, 2024',
    icon: MessageCircle,
    tone: 'success',
  },
  {
    value: '79%',
    headline:
      'dos leads qualificados nunca viram venda — quase sempre por falta de cadência e nutrição.',
    source: 'MarketingSherpa B2B Benchmark, 2023',
    icon: Flame,
    tone: 'primary',
  },
];

const TONE_CLASSES: Record<Stat['tone'], { bg: string; text: string }> = {
  destructive: { bg: 'bg-destructive/10', text: 'text-destructive' },
  warning: { bg: 'bg-warning/15', text: 'text-warning' },
  success: { bg: 'bg-success/10', text: 'text-success' },
  primary: { bg: 'bg-primary/10', text: 'text-primary' },
};

export function ProblemSection() {
  return (
    <section id="problema" className="bg-muted/30 py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-foreground text-3xl font-bold tracking-tight md:text-4xl">
            Lead bom não falta. O que falta é{' '}
            <span className="text-primary">processo pra dar conta</span>.
          </h2>
          <p className="text-muted-foreground text-body-lg mt-4">
            Vendedor consultivo brasileiro vive de relacionamento — e o relacionamento mora no
            WhatsApp. Os quatro furos mais comuns que custam vendas:
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2">
          {STATS.map((stat) => {
            const tone = TONE_CLASSES[stat.tone];
            const Icon = stat.icon;
            return (
              <Card key={stat.value} className="bg-card border-border">
                <CardContent className="flex items-start gap-4 p-6">
                  <div className={`${tone.bg} ${tone.text} shrink-0 rounded-lg p-3`}>
                    <Icon className="size-6" aria-hidden />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p
                      className={`${tone.text} text-3xl font-bold leading-none tracking-tight md:text-4xl`}
                    >
                      {stat.value}
                    </p>
                    <p className="text-foreground text-body leading-snug">{stat.headline}</p>
                    <p className="text-muted-foreground text-caption">Fonte: {stat.source}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
