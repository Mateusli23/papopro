/**
 * Configuração declarativa do sub-nav lateral de `/settings`.
 *
 * Reusada pelo `<SettingsSubNav>` (desktop) e pelo `<SettingsMobileSelect>`
 * (mobile) — ambos rendam a mesma lista, layouts diferentes. Manter aqui
 * evita drift entre as duas superfícies.
 *
 * `ownerOnly` é hint visual em M5 (todos os usuários demo são Owner). Em M7+
 * vira filtro real baseado no papel do usuário logado.
 */
import {
  Bell,
  Building2,
  CreditCard,
  Download,
  History,
  Lock,
  type LucideIcon,
  Plug,
  Smartphone,
  Snowflake,
  Users,
} from '@papopro/ui/icons';

export interface SettingsNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  ownerOnly?: boolean;
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    label: 'Workspace',
    href: '/settings/workspace',
    icon: Building2,
    description: 'Nome da empresa, segmento, logotipo e fuso',
  },
  {
    label: 'Time',
    href: '/settings/team',
    icon: Users,
    description: 'Membros, convites e papéis',
  },
  {
    label: 'Cobrança',
    href: '/settings/billing',
    icon: CreditCard,
    description: 'Plano, faturas e método de pagamento',
    ownerOnly: true,
  },
  {
    label: 'Notificações',
    href: '/settings/notifications',
    icon: Bell,
    description: 'Preferências por evento × canal',
  },
  {
    label: 'Segurança',
    href: '/settings/security',
    icon: Lock,
    description: 'Trocar senha e gerenciar sessão',
  },
  {
    label: 'Auditoria',
    href: '/settings/audit',
    icon: History,
    description: 'Histórico de eventos do workspace (LGPD)',
  },
  {
    label: 'Conexões',
    href: '/settings/connections',
    icon: Smartphone,
    description: 'WhatsApp e saúde da conexão',
  },
  {
    label: 'Integrações',
    href: '/settings/integrations',
    icon: Plug,
    description: 'Calendar, webhooks, ads e CRMs externos',
  },
  {
    label: 'Instalar app',
    href: '/settings/app',
    icon: Download,
    description: 'Instale o PapoPro como aplicativo no celular ou desktop',
  },
  {
    label: 'Lead frio',
    href: '/settings/cadences/cold-thresholds',
    icon: Snowflake,
    description: 'Defina prazos sem interação por etapa do funil',
    ownerOnly: true,
  },
];
