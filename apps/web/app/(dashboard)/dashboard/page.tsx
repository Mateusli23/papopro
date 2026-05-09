import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatusDot,
  TemperatureBadge,
} from '@papopro/ui';
import { ArrowRight, Inbox, PlusCircle, Sparkles, Zap } from '@papopro/ui/icons';

/**
 * Dashboard placeholder — mostra que o app shell está vivo, tokens funcionam
 * em light/dark e os componentes de domínio renderizam. Substituído em M5
 * pela versão com gráficos, métricas e estado vazio orientando próximos passos.
 */
const KPIS = [
  { label: 'Leads ativos', value: '128', delta: '+12 esta semana', tone: 'default' as const },
  { label: 'Em negociação', value: 'R$ 84.300', delta: '+8 oportunidades', tone: 'info' as const },
  {
    label: 'Conversões (30d)',
    value: '14',
    delta: '+3 vs. período anterior',
    tone: 'success' as const,
  },
  { label: 'Esfriando', value: '6', delta: 'requer atenção', tone: 'warning' as const },
];

export default function DashboardPage() {
  return (
    <div className="container mx-auto flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Bem-vindo de volta"
        description="Visão rápida do funil e do que precisa do seu olhar agora."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Sparkles /> Ativar agente IA
            </Button>
            <Button size="sm">
              <PlusCircle /> Adicionar lead
            </Button>
          </>
        }
      />

      <section
        aria-label="Indicadores principais"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {KPIS.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle className="text-title-lg">{kpi.value}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Badge variant={kpi.tone}>{kpi.delta}</Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Conexão WhatsApp — vitrine do StatusDot e do tom semântico */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-title">Conexão WhatsApp</CardTitle>
              <StatusDot tone="online" pulse />
            </div>
            <CardDescription>+55 11 9 9999-0000 · saúde verde</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Badge variant="success">
              <Zap className="size-3" /> Health 92
            </Badge>
            <Badge variant="secondary">132 enviadas hoje</Badge>
          </CardContent>
        </Card>

        {/* Hot leads — vitrine do TemperatureBadge */}
        <Card>
          <CardHeader>
            <CardTitle className="text-title">Leads quentes</CardTitle>
            <CardDescription>3 oportunidades para você acionar primeiro.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[
              { name: 'Mariana Costa', stage: 'Proposta', temp: 'hot' as const },
              { name: 'João Silva', stage: 'Negociação', temp: 'hot' as const },
              { name: 'Luiza Mendes', stage: 'Em contato', temp: 'warm' as const },
            ].map((l) => (
              <div
                key={l.name}
                className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors"
              >
                <span className="bg-muted text-muted-foreground text-caption flex size-9 items-center justify-center rounded-full font-semibold">
                  {l.name
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-body text-foreground font-medium">{l.name}</span>
                  <span className="text-caption text-muted-foreground">{l.stage}</span>
                </span>
                <TemperatureBadge temperature={l.temp} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Caixa de entrada — empty state como vitrine */}
        <Card>
          <CardHeader>
            <CardTitle className="text-title">Caixa de entrada</CardTitle>
            <CardDescription>Sem mensagens não lidas — bom trabalho.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Inbox}
              title="Tudo em dia"
              description="Quando chegarem novas mensagens elas aparecem aqui e no menu Inbox."
              action={
                <Button variant="link" className="px-0">
                  Ir para a Inbox <ArrowRight />
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
