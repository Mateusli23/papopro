'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
} from '@papopro/ui';
import {
  ArrowRight,
  CheckCircle2,
  PlusCircle,
  Smartphone,
  Sparkles,
  Upload,
} from '@papopro/ui/icons';

import { PostWizardDashboard } from '@/features/dashboard/components/post-wizard-dashboard';
import { useWorkspaceMock } from '@/features/workspace/workspace-mock-provider';
import { useUser } from '@/lib/auth/use-user';

/**
 * Dashboard com 2 variantes:
 *  - **pré-onboarding** (`wizardCompleted=false`): cards orientadores
 *    instruindo o próximo passo. Princípio CLAUDE.md §8: "Estado vazio
 *    sempre orienta o próximo passo. Sem tela em branco."
 *  - **pós-onboarding** (`wizardCompleted=true`): dashboard real com KPIs
 *    derivados das fixtures.
 *
 * Em M7#3 a auth virou Supabase real (`useUser`), mas `wizardCompleted` segue
 * mock até M7#4 ligar o wizard a workspace_members real. Os dois loadings
 * são distintos — mostramos skeleton se qualquer um ainda não resolveu.
 */
export function DashboardContent() {
  const { loading: userLoading, displayName } = useUser();
  const { loading: wsLoading, wizardCompleted } = useWorkspaceMock();

  if (userLoading || wsLoading) {
    return <DashboardSkeleton />;
  }

  const greeting = displayName ? `Bem-vindo, ${displayName.split(' ')[0]}` : 'Bem-vindo de volta';

  if (!wizardCompleted) {
    return <PreOnboardingDashboard greeting={greeting} />;
  }

  return <PostWizardDashboard greeting={greeting} />;
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
