import { Badge, Button, Card, CardContent } from '@papopro/ui';
import { Check, MessageCircle, Sparkles } from '@papopro/ui/icons';

/**
 * Tabela de planos. 3 cards lado a lado em desktop, empilhados em mobile.
 *
 * Estrutura intencional:
 *  - **Pro** (R$ 197) à esquerda: o "plano de entrada" — quem está testando
 *    cadência + WhatsApp pela primeira vez.
 *  - **Pro IA** (R$ 497) ao centro, com badge "Mais popular": destacado
 *    visualmente (border-primary, ring, scale 1.02 no md+). Numa landing, a
 *    posição central + destaque sobe a conversão pro plano que queremos
 *    vender — Pro IA é o que reflete melhor o produto (memória 3 camadas,
 *    Cérebro da Empresa, multi-agente).
 *  - **Enterprise** (sob consulta) à direita: CTA `wa.me` parametrizado por
 *    env. Quando o número não está setado, escondemos só o link e
 *    substituímos por `mailto:` (fallback seguro).
 *
 * Bullets usam `Check` com `text-success` pra trazer continuidade visual
 * com a "validação" dos trust signals no hero.
 *
 * Server Component — sem estado nem listeners.
 */

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  priceSubtitle: string;
  description: string;
  highlighted: boolean;
  ctaLabel: string;
  /** href do CTA. Se começa com `#`, é âncora interna; se com `http` ou `mailto:`/`https://wa.me`, link externo. */
  ctaHref: string;
  features: ReadonlyArray<string>;
  badge?: { icon: React.ReactNode; label: string };
}

const PLANS: ReadonlyArray<PricingPlan> = [
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$ 197',
    priceSubtitle: 'por usuário · por mês',
    description: 'Para times que querem trocar planilha + WhatsApp solto por um pipeline real.',
    highlighted: false,
    ctaLabel: 'Começar 7 dias grátis',
    ctaHref: '#cta-final',
    features: [
      'CRM completo: Kanban, leads, deals e pipelines customizáveis',
      'Caixa de WhatsApp unificada com anti-bloqueio (1 número)',
      'Motor de cadência ilimitado por etapa de funil',
      'Alertas de lead frio por etapa',
      'Até 5 vendedores; relatórios completos',
      'Suporte por WhatsApp em horário comercial',
    ],
  },
  {
    id: 'pro-ia',
    name: 'Pro IA',
    price: 'R$ 497',
    priceSubtitle: 'por usuário · por mês',
    description: 'Pro IA + agentes que conhecem sua empresa e respondem no WhatsApp por você.',
    highlighted: true,
    badge: { icon: <Sparkles className="size-3.5" />, label: 'Mais popular' },
    ctaLabel: 'Começar 7 dias grátis',
    ctaHref: '#cta-final',
    features: [
      'Tudo do plano Pro',
      'Até 3 agentes IA configuráveis (prompt + roteamento)',
      'Cérebro da Empresa — base de conhecimento em pgvector',
      'Memória em 3 camadas: sessão, lead e empresa',
      'Handoff automático agente → humano',
      'Até 10 vendedores; suporte prioritário',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Sob consulta',
    priceSubtitle: 'a partir de 15 vendedores',
    description: 'Para operações maiores que precisam de SLA, customização e onboarding guiado.',
    highlighted: false,
    ctaLabel: 'Falar com vendas',
    ctaHref: '__WA_FALLBACK__', // resolvido em render
    features: [
      'Tudo do plano Pro IA + sem limite de vendedores',
      'WhatsApp Cloud API (Meta) — múltiplos números',
      'SLA contratual e onboarding com Customer Success',
      'Integrações sob demanda (HubSpot, RD, ERP)',
      'Retenção de logs 24 meses (LGPD)',
      'SSO via Google / Microsoft',
    ],
  },
];

function resolveEnterpriseCta(): string {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim();
  if (phone) {
    const text = encodeURIComponent(
      'Oi! Vim da landing do PapoPro e quero falar sobre o plano Enterprise.',
    );
    return `https://wa.me/${phone}?text=${text}`;
  }
  // Fallback: e-mail comercial. Quando o número for setado, troca pra wa.me.
  return 'mailto:comercial@pipeflow.com.br?subject=PapoPro%20Enterprise';
}

export function PricingSection() {
  const enterpriseCta = resolveEnterpriseCta();

  return (
    <section id="planos" className="bg-muted/30 py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-foreground text-3xl font-bold tracking-tight md:text-4xl">
            Preço honesto, <span className="text-primary">sem pegadinha de upsell</span>.
          </h2>
          <p className="text-muted-foreground text-body-lg mt-4">
            7 dias grátis sem cartão em qualquer plano. Cancele em 1 clique pelo Customer Portal —
            sem ligação, sem "vou transferir pro time de retenção".
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-6xl gap-6 lg:grid-cols-3 lg:items-stretch lg:gap-4">
          {PLANS.map((plan) => {
            const href = plan.id === 'enterprise' ? enterpriseCta : plan.ctaHref;
            const isExternal = href.startsWith('http') || href.startsWith('mailto:');
            return (
              <Card
                key={plan.id}
                className={
                  plan.highlighted
                    ? 'border-primary ring-primary/30 bg-card relative ring-2 lg:scale-[1.02]'
                    : 'border-border bg-card relative'
                }
              >
                {plan.badge && (
                  <Badge
                    variant="default"
                    className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1.5"
                  >
                    {plan.badge.icon}
                    {plan.badge.label}
                  </Badge>
                )}

                <CardContent className="flex h-full flex-col gap-6 p-6 md:p-8">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-foreground text-2xl font-bold tracking-tight">
                      {plan.name}
                    </h3>
                    <p className="text-muted-foreground text-body min-h-[2.5rem]">
                      {plan.description}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-foreground text-4xl font-bold tracking-tight md:text-5xl">
                      {plan.price}
                    </p>
                    <p className="text-muted-foreground text-caption">{plan.priceSubtitle}</p>
                  </div>

                  <ul className="flex flex-1 flex-col gap-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
                        <span className="text-foreground text-body">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    size="lg"
                    variant={plan.highlighted ? 'default' : 'outline'}
                    className="w-full"
                  >
                    <a
                      href={href}
                      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {plan.id === 'enterprise' && <MessageCircle className="size-4" aria-hidden />}
                      {plan.ctaLabel}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-muted-foreground text-caption mx-auto mt-8 max-w-2xl text-center">
          Valores em reais. Os 3 planos rodam em servidores hospedados no Brasil (LGPD).
        </p>
      </div>
    </section>
  );
}
