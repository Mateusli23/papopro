'use client';

import * as React from 'react';

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
  Skeleton,
  StatusDot,
  TemperatureBadge,
} from '@papopro/ui';
import {
  ArrowRight,
  CheckCircle2,
  Inbox,
  PlusCircle,
  Smartphone,
  Sparkles,
  Upload,
  Zap,
} from '@papopro/ui/icons';

import { useAuthMock } from '@/lib/auth/auth-mock-provider';

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

/**
 * Dashboard com 2 variantes:
 *  - **pré-onboarding** (`wizardCompleted=false`): cards orientadores
 *    instruindo o próximo passo. Princípio CLAUDE.md §8: "Estado vazio
 *    sempre orienta o próximo passo. Sem tela em branco."
 *  - **pós-onboarding** (`wizardCompleted=true`): KPIs + listas — versão
 *    atual (era o único conteúdo até PR #5).
 *
 * Enquanto `loading=true` (cookie ainda hidratando) mostramos skeletons —
 * evita flash entre as duas variantes na 1ª render.
 */
export function DashboardContent() {
  const { loading, user, wizardCompleted } = useAuthMock();

  if (loading) {
    return <DashboardSkeleton />;
  }

  // `user` sempre existe aqui (o middleware bloqueia o acesso sem login),
  // mas mantemos o fallback pra TypeScript não reclamar e proteger contra
  // race conditions em dev (cookie removido manual no DevTools).
  const greeting = user?.name ? `Bem-vindo, ${user.name.split(' ')[0]}` : 'Bem-vindo de volta';

  if (!wizardCompleted) {
    return <PreOnboardingDashboard greeting={greeting} />;
  }

  return <PostOnboardingDashboard greeting={greeting} />;
}

function DashboardSkeleton() {
  return (
    <div className="container mx-auto flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

interface ChecklistCard {
  icon: typeof Sparkles;
  title: string;
  description: string;
  cta: string;
  tone: 'primary' | 'success' | 'warning' | 'info';
  done?: boolean;
}

const PRE_ONBOARDING_CARDS: ChecklistCard[] = [
  {
    icon: Smartphone,
    title: 'Conecte o WhatsApp',
    description:
      'Sem o WhatsApp ligado, o motor de cadência não dispara — esse é o próximo passo crítico.',
    cta: 'Conectar agora',
    tone: 'success',
  },
  {
    icon: Sparkles,
    title: 'Crie seu primeiro agente IA',
    description: 'Escolha um template (qualificação, atendimento, recuperação) e ajuste o tom.',
    cta: 'Criar agente',
    tone: 'primary',
  },
  {
    icon: Upload,
    title: 'Importe seus leads',
    description: 'Suba um CSV com até 1.000 linhas e seu funil já começa cheio.',
    cta: 'Importar CSV',
    tone: 'info',
  },
  {
    icon: PlusCircle,
    title: 'Adicione um lead manualmente',
    description: 'Quando precisar cadastrar um contato ponto-a-ponto, entra por aqui.',
    cta: 'Adicionar lead',
    tone: 'warning',
  },
];

const TONE_BG: Record<ChecklistCard['tone'], string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-warning',
  info: 'bg-info/15 text-info',
};

function PreOnboardingDashboard({ greeting }: { greeting: string }) {
  return (
    <div className="container mx-auto flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={greeting}
        description="Falta pouco pro seu workspace ficar operacional. Comece pelos próximos passos abaixo."
      />

      <section
        aria-label="Próximos passos"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2"
      >
        {PRE_ONBOARDING_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-md ${TONE_BG[card.tone]}`}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <CardTitle className="text-title">{card.title}</CardTitle>
                    <CardDescription>{card.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between gap-2 pt-0">
                <Badge variant="secondary">Em breve</Badge>
                <Button variant="ghost" size="sm" disabled>
                  {card.cta} <ArrowRight />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-primary size-5" />
            <CardTitle className="text-title">Bem-vindo ao seu novo CRM</CardTitle>
          </div>
          <CardDescription>
            Você pode reabrir os passos a qualquer hora pelo menu de configurações. Quando terminar
            o setup, esse painel fica com seus indicadores em tempo real.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function PostOnboardingDashboard({ greeting }: { greeting: string }) {
  return (
    <div className="container mx-auto flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={greeting}
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
