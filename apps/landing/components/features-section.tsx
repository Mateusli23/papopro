import { Badge, Card, CardContent } from '@papopro/ui';
import {
  type LucideIcon,
  Bot,
  Check,
  KanbanSquare,
  MessageCircle,
  Repeat,
  Sparkles,
  ThermometerSun,
  Zap,
} from '@papopro/ui/icons';

/**
 * Seção de funcionalidades. 4 blocos em zigue-zague (imagem alterna esquerda
 * e direita) — padrão visual clássico de landing SaaS que mantém o leitor
 * engajado ao quebrar o ritmo.
 *
 * Cada bloco usa um "mockup" sintético (sem screenshot externo) — coerente
 * com o Bloco A (UI mockada). Quando vierem os screenshots reais do produto,
 * basta trocar o `mockup` de cada item por `<Image>` do `next/image`.
 */

interface Feature {
  id: string;
  badgeLabel: string;
  badgeIcon: LucideIcon;
  title: string;
  description: string;
  /** 3-4 bullets curtos (1 frase cada). */
  bullets: ReadonlyArray<string>;
  /** Mockup renderizado ao lado do texto. Server Component. */
  mockup: React.ReactNode;
}

const FEATURES: ReadonlyArray<Feature> = [
  {
    id: 'kanban',
    badgeLabel: 'Pipeline visual',
    badgeIcon: KanbanSquare,
    title: 'Kanban que vendedor entende em 5 segundos',
    description:
      'Arraste o lead pela etapa, defina cores, configure colunas como quiser. Cada card mostra valor, origem e temperatura — sem precisar abrir.',
    bullets: [
      'Drag-and-drop fluido em qualquer dispositivo',
      'Etapas 100% customizáveis por funil',
      'Indicador de temperatura quente / morno / frio',
      'Filtros salvos por vendedor e por equipe',
    ],
    mockup: <KanbanMockup />,
  },
  {
    id: 'whatsapp',
    badgeLabel: 'Canal principal',
    badgeIcon: MessageCircle,
    title: 'Caixa de WhatsApp unificada do time',
    description:
      'Todas as conversas em um só lugar, vinculadas ao lead. Múltiplos atendentes no mesmo número, sem briga de quem responde primeiro.',
    bullets: [
      'Conexão por QR Code em menos de 1 minuto',
      'Anti-bloqueio: rate-limit, jitter e janela horária',
      'Templates, anexos, áudio e notas internas',
      'Histórico atrelado ao lead, mesmo que o vendedor saia',
    ],
    mockup: <InboxMockup />,
  },
  {
    id: 'ia',
    badgeLabel: 'Inteligência',
    badgeIcon: Bot,
    title: 'Agentes IA que conhecem sua empresa',
    description:
      'Configure até 3 agentes com personalidades e gatilhos próprios. Cada um lembra do lead, da última conversa e da base de conhecimento da empresa.',
    bullets: [
      'Memória em 3 camadas: sessão, lead e empresa',
      'Cérebro da Empresa em pgvector — agente cita seu material',
      'Handoff automático pra humano quando necessário',
      'Variação de templates pra reduzir risco de bloqueio',
    ],
    mockup: <AgentMockup />,
  },
  {
    id: 'cadencia',
    badgeLabel: 'Automação',
    badgeIcon: Repeat,
    title: 'Cadência que dispara sem você lembrar',
    description:
      'Defina a sequência uma vez. Todo lead que cair na etapa recebe os toques certos nos dias certos — D+0, D+1, D+3, D+7, D+14, D+30.',
    bullets: [
      'Templates por etapa de funil',
      'Alertas de lead frio antes do negócio esfriar',
      'Pausa automática quando o lead responde',
      'Pausa inteligente em domingo, feriado e fora do horário',
    ],
    mockup: <CadenceMockup />,
  },
];

export function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="size-3.5" />
            Quatro pilares
          </Badge>
          <h2 className="text-foreground mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Tudo que um time consultivo precisa,{' '}
            <span className="text-primary">sem 5 ferramentas penduradas</span>.
          </h2>
          <p className="text-muted-foreground text-body-lg mt-4">
            CRM, caixa de WhatsApp, motor de cadência e agentes IA — em um produto só, com a mesma
            base de dados e sem integração frágil entre serviços.
          </p>
        </div>

        <div className="mx-auto mt-16 flex max-w-6xl flex-col gap-20 md:gap-28">
          {FEATURES.map((feature, idx) => {
            const reversed = idx % 2 === 1;
            const BadgeIcon = feature.badgeIcon;
            return (
              <div
                key={feature.id}
                className={`grid items-center gap-10 md:grid-cols-2 md:gap-16 ${
                  reversed ? 'md:[&>div:first-child]:order-2' : ''
                }`}
              >
                <div className="flex flex-col items-start gap-4">
                  <Badge variant="secondary" className="gap-1.5">
                    <BadgeIcon className="size-3.5" />
                    {feature.badgeLabel}
                  </Badge>
                  <h3 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-body-lg">{feature.description}</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {feature.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
                        <span className="text-foreground text-body">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>{feature.mockup}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Mockups sintéticos (sem assets externos) ----------------------- */

function KanbanMockup() {
  return (
    <Card className="bg-card border-border shadow-lg">
      <CardContent className="p-5">
        <div className="border-border mb-3 flex items-center gap-2 border-b pb-2">
          <KanbanSquare className="text-primary size-4" />
          <span className="text-foreground text-body font-semibold">Funil · SDR</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Novo', tone: 'bg-primary', count: 18 },
            { label: 'Qualificado', tone: 'bg-warning', count: 9 },
            { label: 'Ganho', tone: 'bg-success', count: 4 },
          ].map((col) => (
            <div key={col.label} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${col.tone}`} aria-hidden />
                <span className="text-foreground text-caption font-semibold">{col.label}</span>
                <span className="text-muted-foreground text-caption">{col.count}</span>
              </div>
              <div className="bg-background border-border h-14 rounded-md border p-2 shadow-sm">
                <div className="bg-muted h-1.5 w-2/3 rounded-full" />
                <div className="bg-muted mt-1.5 h-1.5 w-1/2 rounded-full" />
              </div>
              <div className="bg-background border-border h-14 rounded-md border p-2 shadow-sm">
                <div className="bg-muted h-1.5 w-3/4 rounded-full" />
                <div className="bg-muted mt-1.5 h-1.5 w-2/5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InboxMockup() {
  const messages: ReadonlyArray<{
    from: 'them' | 'me';
    body: string;
    time: string;
  }> = [
    { from: 'them', body: 'Oi! Vocês têm o apartamento de 3 quartos no Tatuapé?', time: '09:14' },
    { from: 'me', body: 'Bom dia, Marina! Tenho sim — posso te mandar o vídeo?', time: '09:15' },
    { from: 'them', body: 'Manda por favor 🙏', time: '09:15' },
    { from: 'me', body: 'Vou ligar pra alinhar visita amanhã, 10h serve?', time: '09:18' },
  ];

  return (
    <Card className="bg-card border-border shadow-lg">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="border-border flex items-center gap-3 border-b pb-3">
          <div className="bg-success/15 text-success rounded-full p-1.5">
            <MessageCircle className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-body truncate font-semibold">Marina Reis</p>
            <p className="text-muted-foreground text-caption truncate">+55 11 9 8765 4321</p>
          </div>
          <span className="bg-success/15 text-success text-caption rounded-full px-2 py-0.5 font-medium">
            Online
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                  m.from === 'me'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="text-caption">{m.body}</p>
                <p
                  className={`text-caption mt-0.5 text-right ${
                    m.from === 'me' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}
                >
                  {m.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AgentMockup() {
  return (
    <Card className="bg-card border-border shadow-lg">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary rounded-full p-2">
            <Bot className="size-5" />
          </div>
          <div>
            <p className="text-foreground text-body font-semibold">Vera · Agente SDR</p>
            <p className="text-muted-foreground text-caption">Ativa · 3 conversas agora</p>
          </div>
        </div>

        <div className="bg-muted/40 border-border rounded-lg border p-3">
          <p className="text-muted-foreground text-caption font-medium">Memória recuperada</p>
          <ul className="text-foreground text-caption mt-1.5 flex flex-col gap-1">
            <li className="flex items-center gap-1.5">
              <ThermometerSun className="text-warning size-3.5" /> Lead morno · último contato há 4
              dias
            </li>
            <li className="flex items-center gap-1.5">
              <Sparkles className="text-primary size-3.5" /> Interessou em 3 quartos · Tatuapé
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="text-success size-3.5" /> Base: Tabela de imóveis em destaque
            </li>
          </ul>
        </div>

        <div className="border-border bg-background rounded-lg border p-3">
          <p className="text-foreground text-caption italic leading-relaxed">
            &quot;Oi Marina! Vi que você curtiu o 3 quartos no Tatuapé semana passada. Tenho dois
            novos no mesmo bairro com varanda gourmet — quer dar uma olhada?&quot;
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CadenceMockup() {
  const steps: ReadonlyArray<{
    when: string;
    label: string;
    done: boolean;
  }> = [
    { when: 'D+0', label: 'Mensagem de boas-vindas', done: true },
    { when: 'D+1', label: 'Áudio com proposta', done: true },
    { when: 'D+3', label: 'Lembrete + 2 imóveis novos', done: false },
    { when: 'D+7', label: 'Convite pra visita', done: false },
    { when: 'D+14', label: 'Reaproximação · alerta de frio', done: false },
  ];

  return (
    <Card className="bg-card border-border shadow-lg">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Zap className="text-warning size-4" />
          <span className="text-foreground text-body font-semibold">Cadência · Pós-visita</span>
          <span className="bg-success/15 text-success text-caption ml-auto rounded-full px-2 py-0.5 font-medium">
            Ativa
          </span>
        </div>
        <ul className="flex flex-col">
          {steps.map((s, i) => (
            <li key={s.when} className="flex items-start gap-3 py-2">
              <div className="flex flex-col items-center">
                <span
                  className={`text-caption flex size-6 items-center justify-center rounded-full font-semibold ${
                    s.done
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground border-border border'
                  }`}
                >
                  {s.done ? <Check className="size-3.5" /> : i + 1}
                </span>
                {i < steps.length - 1 && <span className="bg-border h-6 w-px" aria-hidden />}
              </div>
              <div className="flex flex-1 items-baseline justify-between gap-2">
                <span className="text-foreground text-body">{s.label}</span>
                <span className="text-muted-foreground text-caption shrink-0">{s.when}</span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
