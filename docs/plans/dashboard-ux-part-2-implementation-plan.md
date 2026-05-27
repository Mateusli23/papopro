# Dashboard UX Part 2 — Plano de Implementação

> **Para Hermes:** Use `subagent-driven-development` para implementar este plano task-by-task. Para cada task: implementar em branch própria, rodar checks, revisar diff, subir em `dev/staging`, pedir validação do Mateus e só promover para `main` depois de aprovação explícita.

**Goal:** melhorar a navegação lateral do PapoPro deixando a sidebar mais flexível, mais escaneável e menos pesada visualmente no desktop.

**Architecture:** a sidebar desktop atual é Server Component em `components/app-shell/sidebar.tsx`, mas navegação e estado visual ficam em Client Components. A Parte 2 deve criar um wrapper client para controlar `collapsed/expanded`, persistir preferência no navegador e adaptar `SidebarNav`, `SidebarFooter` e `WorkspaceSwitcher` sem mexer em rotas, banco ou permissões.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, Tailwind, `@papopro/ui`, cookies/localStorage client-side, pnpm/Turborepo.

---

## Escopo da Parte 2

Implementar agora:

1. Sidebar desktop recolhível.
2. Preferência salva no navegador.
3. Menu lateral agrupado por valor para o cliente:
   - Principal
   - Automação
   - Gestão
4. Tooltip/label acessível quando a sidebar estiver recolhida.
5. Ajuste do rodapé para não fingir WhatsApp conectado se não houver conexão real.
6. Validação desktop/mobile para garantir que o drawer mobile não quebrou.

Fora do escopo:

- WhatsApp real.
- Nova tela ou nova rota.
- Mudança de banco.
- Permissões/RBAC.
- Reorganizar Cmd+K.
- Redesign completo do app shell.

---

## Estado atual encontrado no código

Arquivos principais:

- `apps/web/components/app-shell/sidebar.tsx`
  - Server Component.
  - Renderiza `<aside>` com largura fixa `w-sidebar`.
  - Carrega `workspaces`, `activeWorkspaceId` e `coldAlertsCount`.
  - Renderiza logo, `WorkspaceSwitcher`, `SidebarNav` e `SidebarFooter`.

- `apps/web/components/app-shell/sidebar-nav.tsx`
  - Client Component.
  - Renderiza `NAV_GROUPS`.
  - Já calcula item ativo por `pathname`.
  - Já injeta badge dinâmica para `/inbox` e `/leads`.

- `apps/web/components/app-shell/nav-config.ts`
  - Config declarativa dos itens do menu.
  - Hoje tem grupo principal único com quase tudo e grupo `Sistema`.

- `apps/web/components/app-shell/sidebar-footer.tsx`
  - Mostra mock fixo: `WhatsApp conectado` + número fake.
  - Isso entra em conflito com a decisão de não criar expectativa falsa de WhatsApp.

- `apps/web/app/(dashboard)/layout.tsx`
  - Renderiza `<Sidebar />`, `<Topbar />`, `TrialBanner`, children e `CmdKPalette`.

---

## Decisões de produto

### Decisão 1 — Sidebar recolhível só no desktop

No mobile já existe navegação via drawer/topbar. A alteração deve focar `lg+`.

Comportamento esperado:

- Expandida: logo completo, workspace visível, ícone + texto nos itens.
- Recolhida: largura menor, só ícones, labels via tooltip/aria-label.
- Conteúdo principal ganha espaço horizontal.

### Decisão 2 — Preferência salva localmente

Usar `localStorage` para MVP:

- Chave sugerida: `papopro.sidebar.collapsed`.
- Valor: `'1'` para recolhida, `'0'` ou ausência para expandida.

Motivo: é preferência visual do browser; não precisa de banco nem Server Action agora.

### Decisão 3 — Agrupar por jornada do usuário

Trocar grupos atuais por:

```txt
Principal
- Dashboard
- Leads
- Kanban
- Tarefas
- Inbox

Automação
- Cadências
- Agentes IA

Gestão
- Relatórios
- Configurações
```

`Notificações` deve sair do grupo principal e ficar acessível por `Configurações` ou permanecer como item de Gestão apenas se houver forte motivo. Recomendação MVP: remover da sidebar principal e deixar dentro de Settings, para reduzir peso visual.

### Decisão 4 — WhatsApp não deve parecer conectado se estiver mockado

Na Parte 2, ajustar o footer para:

```txt
WhatsApp
Não configurado
```

ou esconder o bloco quando recolhido.

Não implementar conexão real agora.

---

## Task 1 — Criar branch e baseline

**Objective:** começar a Parte 2 sem mexer direto em `main`.

**Files:** nenhum.

**Step 1: Atualizar base**

```bash
git fetch origin main dev
git checkout dev
git pull origin dev
```

**Step 2: Criar branch**

```bash
git checkout -b ux/dashboard-part-2-sidebar
```

**Step 3: Rodar baseline rápido**

```bash
PNPM_HOME=/opt/data/bin /opt/data/bin/pnpm typecheck
PNPM_HOME=/opt/data/bin /opt/data/bin/pnpm lint
```

Expected: ambos passam.

**Commit:** nenhum.

---

## Task 2 — Reorganizar `NAV_GROUPS`

**Objective:** deixar a navegação mais escaneável e menos intimidante para cliente novo.

**Files:**

- Modify: `apps/web/components/app-shell/nav-config.ts`

**Step 1: Ajustar comentários do arquivo**

Trocar o comentário inicial para explicar os grupos por jornada:

```ts
/**
 * Configuração declarativa do menu lateral.
 *
 * Grupos organizados por valor para o usuário:
 * - Principal: operação diária do CRM.
 * - Automação: recursos avançados que ampliam o atendimento.
 * - Gestão: análise e configuração.
 */
```

**Step 2: Ajustar item Agentes para label consistente**

Hoje está:

```ts
{ label: 'Agentes', href: '/agents', icon: Bot },
```

Trocar para:

```ts
{ label: 'Agentes IA', href: '/agents', icon: Bot },
```

**Step 3: Reorganizar `NAV_GROUPS`**

Substituir a constante por:

```ts
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Leads', href: '/leads', icon: Users },
      { label: 'Kanban', href: '/kanban', icon: KanbanSquare },
      { label: 'Tarefas', href: '/tasks', icon: ListChecks },
      { label: 'Inbox', href: '/inbox', icon: Inbox },
    ],
  },
  {
    title: 'Automação',
    items: [
      { label: 'Cadências', href: '/cadences', icon: Repeat },
      { label: 'Agentes IA', href: '/agents', icon: Bot },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { label: 'Relatórios', href: '/reports', icon: PieChart },
      { label: 'Configurações', href: '/settings', icon: Settings },
    ],
  },
];
```

**Step 4: Remover import não usado**

Se `Bell` deixar de ser usado, remover do import.

**Verification:**

```bash
PNPM_HOME=/opt/data/bin /opt/data/bin/pnpm --filter @papopro/web typecheck
PNPM_HOME=/opt/data/bin /opt/data/bin/pnpm --filter @papopro/web lint
```

Expected: passa.

**Commit:**

```bash
git add apps/web/components/app-shell/nav-config.ts
git commit -m "feat(sidebar): group navigation by user journey"
```

---

## Task 3 — Criar estado client da sidebar

**Objective:** permitir sidebar desktop recolhida/expandida com preferência local.

**Files:**

- Create: `apps/web/components/app-shell/sidebar-state.tsx`
- Modify: `apps/web/components/app-shell/sidebar.tsx`

**Step 1: Criar Client Component wrapper**

Criar arquivo:

```tsx
'use client';

import * as React from 'react';

import { cn } from '@papopro/ui';

const STORAGE_KEY = 'papopro.sidebar.collapsed';

interface SidebarStateProps {
  children: (state: { collapsed: boolean; toggleCollapsed: () => void }) => React.ReactNode;
}

export function SidebarState({ children }: SidebarStateProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1');
    setHydrated(true);
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground border-sidebar-border hidden h-screen shrink-0 flex-col border-r transition-[width] duration-200 lg:flex',
        collapsed ? 'w-16' : 'w-sidebar',
        !hydrated && 'w-sidebar',
      )}
      aria-label="Barra lateral"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      {children({ collapsed, toggleCollapsed })}
    </aside>
  );
}
```

**Rationale:** mantém `Sidebar` como Server Component para buscar dados, mas move somente o estado visual para client.

**Step 2: Usar wrapper em `sidebar.tsx`**

Importar:

```ts
import { SidebarState } from './sidebar-state';
```

Trocar o `<aside ...>` atual por:

```tsx
return (
  <SidebarState>
    {({ collapsed, toggleCollapsed }) => (
      <>
        {/* header/logo */}
        {/* workspace */}
        <SidebarNav collapsed={collapsed} coldAlertsCount={coldAlertsCount} />
        <SidebarFooter collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </>
    )}
  </SidebarState>
);
```

**Verification:**

```bash
PNPM_HOME=/opt/data/bin /opt/data/bin/pnpm --filter @papopro/web typecheck
```

Expected: inicialmente falha porque `SidebarNav` e `SidebarFooter` ainda não aceitam props novas. Isso é esperado até as próximas tasks.

**Commit:** não commitar ainda se typecheck estiver quebrado.

---

## Task 4 — Adaptar header/logo e workspace para modo recolhido

**Objective:** impedir que logo e workspace switcher quebrem layout em `w-16`.

**Files:**

- Modify: `apps/web/components/app-shell/sidebar.tsx`

**Step 1: Importar ícone para botão de toggle**

Usar ícones disponíveis do pacote UI. Sugestão:

```ts
import { PanelLeftClose, PanelLeftOpen } from '@papopro/ui/icons';
```

Se esses ícones não existirem no pacote, procurar equivalente:

```bash
grep -R "PanelLeft" packages/ui apps/web -n
```

Fallback: `ChevronLeft` / `ChevronRight`.

**Step 2: Header expandido/recolhido**

Substituir bloco atual:

```tsx
<div className="border-sidebar-border flex h-14 items-center border-b px-4">
  <LogoFull />
</div>
```

por estrutura com botão:

```tsx
<div className="border-sidebar-border flex h-14 items-center justify-between border-b px-3">
  {!collapsed && <LogoFull />}
  <button
    type="button"
    onClick={toggleCollapsed}
    className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors"
    aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
  >
    {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
  </button>
</div>
```

Se recolhido ficar vazio demais, pode mostrar apenas um ícone/logo pequeno se existir `LogoMark`. Não criar logo novo nesta parte.

**Step 3: WorkspaceSwitcher no modo recolhido**

Para MVP, esconder switcher quando recolhido:

```tsx
{
  !collapsed && (
    <div className="border-sidebar-border border-b p-2">
      <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />
    </div>
  );
}
```

**Product trade-off:** o usuário ainda pode trocar workspace expandindo a sidebar; simples e seguro para Parte 2.

**Verification:**

- Sidebar expandida mostra logo + workspace.
- Sidebar recolhida não quebra com o switcher.

**Commit:** ainda não, se props seguintes faltarem.

---

## Task 5 — Adaptar `SidebarNav` para modo recolhido

**Objective:** mostrar só ícones quando recolhido, mantendo acessibilidade e badges.

**Files:**

- Modify: `apps/web/components/app-shell/sidebar-nav.tsx`

**Step 1: Atualizar props**

```ts
interface SidebarNavProps {
  onNavigate?: () => void;
  coldAlertsCount?: number;
  collapsed?: boolean;
}
```

Assinatura:

```ts
export function SidebarNav({ onNavigate, coldAlertsCount = 0, collapsed = false }: SidebarNavProps) {
```

**Step 2: Ajustar container**

Trocar:

```tsx
<ScrollArea className="flex-1 px-3 py-4">
```

por:

```tsx
<ScrollArea className={cn('flex-1 py-4', collapsed ? 'px-2' : 'px-3')}>
```

**Step 3: Esconder títulos dos grupos quando recolhido**

```tsx
{
  group.title && !collapsed && (
    <div className="text-caption text-muted-foreground px-3 pb-1 font-semibold uppercase tracking-wide">
      {group.title}
    </div>
  );
}
```

Opcional: quando recolhido, separar grupos com linha curta:

```tsx
{
  group.title && collapsed && gi > 0 && (
    <div className="bg-sidebar-border mx-auto my-2 h-px w-8" aria-hidden />
  );
}
```

**Step 4: Link recolhido**

Ajustar className do link:

```tsx
className={cn(
  'text-body group relative flex items-center rounded-md py-2 transition-colors',
  collapsed ? 'justify-center px-2' : 'gap-3 px-3',
  isActive
    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
)}
```

Adicionar:

```tsx
aria-label={collapsed ? item.label : undefined}
title={collapsed ? item.label : undefined}
```

**Step 5: Esconder label e soon no modo recolhido**

```tsx
{
  !collapsed && <span className="flex-1 truncate">{item.label}</span>;
}
```

```tsx
{item.soon && !collapsed && (...)}
```

**Step 6: Badge no modo recolhido**

Manter badge, mas posicionar absoluta para não quebrar:

```tsx
{
  item.badge !== undefined && (
    <Badge
      variant="default"
      className={cn(
        'h-5 px-1.5',
        collapsed && 'absolute right-0 top-0 h-4 min-w-4 px-1 text-[10px]',
      )}
    >
      {item.badge}
    </Badge>
  );
}
```

**Verification:**

```bash
PNPM_HOME=/opt/data/bin /opt/data/bin/pnpm --filter @papopro/web typecheck
PNPM_HOME=/opt/data/bin /opt/data/bin/pnpm --filter @papopro/web lint
```

Expected: pode ainda falhar por `SidebarFooter` props.

**Commit:** não commitar até typecheck completo passar.

---

## Task 6 — Adaptar `SidebarFooter` e corrigir WhatsApp mockado

**Objective:** rodapé funcionar nos dois modos e parar de vender WhatsApp como conectado sem conexão real.

**Files:**

- Modify: `apps/web/components/app-shell/sidebar-footer.tsx`

**Step 1: Transformar em Client Component se necessário**

Como terá botão de toggle, adicionar no topo:

```tsx
'use client';
```

**Step 2: Atualizar imports**

```tsx
import { KbdShortcut, StatusDot, cn } from '@papopro/ui';
import { PanelLeftClose, PanelLeftOpen } from '@papopro/ui/icons';
```

Ajustar ícones conforme disponibilidade.

**Step 3: Props**

```tsx
interface SidebarFooterProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function SidebarFooter({ collapsed = false, onToggleCollapsed }: SidebarFooterProps) {
```

**Step 4: Alterar texto do WhatsApp**

Expandido:

```tsx
<span className="text-caption text-foreground font-medium">WhatsApp</span>
<span className="text-caption text-muted-foreground truncate">Não configurado</span>
```

Status:

```tsx
<StatusDot tone="offline" />
```

Se `offline` não existir no tipo, usar o tom mais neutro existente após conferir `StatusDot`.

**Step 5: Render recolhido**

Quando `collapsed`, mostrar só botão de expandir/recolher e talvez status dot com `title="WhatsApp não configurado"`.

Estrutura sugerida:

```tsx
<div
  className={cn(
    'border-sidebar-border flex flex-col gap-3 border-t p-3',
    collapsed && 'items-center px-2',
  )}
>
  {!collapsed && (
    <div className="flex items-center gap-2.5 px-1.5">
      <StatusDot tone="offline" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption text-foreground font-medium">WhatsApp</span>
        <span className="text-caption text-muted-foreground truncate">Não configurado</span>
      </div>
    </div>
  )}

  <button
    type="button"
    onClick={onToggleCollapsed}
    className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground inline-flex h-9 items-center justify-center gap-2 rounded-md px-2 transition-colors"
    aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
  >
    {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
    {!collapsed && <span className="text-caption">Recolher menu</span>}
  </button>

  {!collapsed && (
    <div className="text-muted-foreground text-caption flex items-center justify-between px-1.5">
      <span>Buscar</span>
      <KbdShortcut keys={['Ctrl', 'K']} />
    </div>
  )}
</div>
```

**Product note:** Se já existir botão no header, pode remover o botão duplicado do footer. Recomendação final: manter toggle no header e no footer só se não ficar poluído. Para MVP, prefira **um único toggle no header**. Se escolher isso, `SidebarFooter` recebe apenas `collapsed` e não `onToggleCollapsed`.

**Verification:**

- Footer expandido mostra `WhatsApp / Não configurado`.
- Footer recolhido não estoura largura.
- Não aparece mais número fake.

**Commit:** depois do typecheck passar junto com tasks 3–6:

```bash
git add apps/web/components/app-shell/sidebar.tsx \
        apps/web/components/app-shell/sidebar-state.tsx \
        apps/web/components/app-shell/sidebar-nav.tsx \
        apps/web/components/app-shell/sidebar-footer.tsx

git commit -m "feat(sidebar): add collapsible desktop navigation"
```

---

## Task 7 — Testar persistência da preferência

**Objective:** garantir que o estado recolhido sobrevive a reload sem piscar de forma grosseira.

**Files:**

- Modify: `apps/web/components/app-shell/sidebar-state.tsx`, se necessário.

**Manual QA:**

1. Abrir `/dashboard` desktop.
2. Clicar em recolher menu.
3. Recarregar a página.
4. Confirmar que a sidebar volta recolhida.
5. Expandir.
6. Recarregar.
7. Confirmar que volta expandida.

**Technical check via browser console:**

```js
localStorage.getItem('papopro.sidebar.collapsed');
```

Expected:

- Recolhida: `'1'`
- Expandida: `'0'` ou `null`, conforme implementação final.

**Automated test:** não obrigatório nesta parte, pois depende de layout/browser. Não criar teste frágil se o projeto não tiver Testing Library já preparada para app shell.

---

## Task 8 — QA visual desktop

**Objective:** confirmar que a sidebar melhora sem quebrar navegação.

**Checklist desktop:**

- [ ] Sidebar expandida mostra logo completo.
- [ ] Sidebar expandida mostra workspace switcher.
- [ ] Sidebar expandida mostra grupos: Principal, Automação, Gestão.
- [ ] Item ativo continua destacado corretamente.
- [ ] Badge de Leads frios continua aparecendo em `/leads` quando houver contagem.
- [ ] Badge de Inbox continua aparecendo quando houver mensagens não lidas.
- [ ] Clicar em cada item navega para a rota correta.
- [ ] Sidebar recolhida mostra só ícones.
- [ ] Sidebar recolhida mostra `title`/tooltip nativo ou tooltip visual com nome do item.
- [ ] Sidebar recolhida não corta badges.
- [ ] Conteúdo principal ganha espaço.
- [ ] Recarregar mantém estado recolhido/expandido.

---

## Task 9 — QA mobile/regressão

**Objective:** garantir que a mudança desktop não quebrou drawer mobile.

**Checklist mobile:**

- [ ] Em largura mobile, sidebar desktop continua escondida.
- [ ] Topbar/mobile nav continua abrindo.
- [ ] Itens do menu mobile continuam com texto visível.
- [ ] Clicar em item no mobile fecha drawer se esse comportamento já existia.
- [ ] Criar lead no celular ainda permite scroll até o final.
- [ ] Dashboard mobile continua com KPIs ajustados.

**Atenção:** não aplicar `collapsed` no mobile nav. Se `SidebarNav` for reusado no mobile, o default `collapsed = false` preserva comportamento.

---

## Task 10 — Validações finais e push para staging

**Objective:** preparar handoff para teste do Mateus em staging.

**Commands:**

```bash
PNPM_HOME=/opt/data/bin /opt/data/bin/pnpm typecheck
PNPM_HOME=/opt/data/bin /opt/data/bin/pnpm lint
PNPM_HOME=/opt/data/bin /opt/data/bin/pnpm build
git diff --check
```

Expected:

- typecheck passa.
- lint passa.
- build passa.
- `git diff --check` sem whitespace errors.

**Push:**

```bash
git push -u origin ux/dashboard-part-2-sidebar
```

Depois, abrir PR ou merge para `dev`, conforme fluxo escolhido.

Recomendação para este projeto:

```bash
git checkout dev
git pull origin dev
git merge --ff-only ux/dashboard-part-2-sidebar
git push origin dev
```

Só promover para `main` depois de validação visual do Mateus.

---

## Critérios de aceite finais da Parte 2

A Parte 2 está pronta quando:

- [ ] Sidebar desktop pode ser recolhida e expandida.
- [ ] Preferência persiste após reload.
- [ ] Sidebar recolhida mostra ícones navegáveis.
- [ ] Itens recolhidos têm `aria-label` e `title`/tooltip.
- [ ] Grupos aparecem no modo expandido: Principal, Automação, Gestão.
- [ ] Menu fica mais simples para cliente novo.
- [ ] `WhatsApp conectado` fake não aparece mais.
- [ ] Drawer mobile não quebrou.
- [ ] `pnpm typecheck` passa.
- [ ] `pnpm lint` passa.
- [ ] `pnpm build` passa.
- [ ] Mateus testou em staging e aprovou antes de produção.

---

## Riscos e mitigação

### Risco 1 — Hydration/layout flash

Como `localStorage` só existe no client, a sidebar pode renderizar expandida e depois recolher.

Mitigação MVP:

- Aceitar pequeno flash se for imperceptível.
- Usar `hydrated` para controlar transição.
- Não mover preferência para cookie/server agora, a menos que o flash fique ruim.

### Risco 2 — `WorkspaceSwitcher` não cabe recolhido

Mitigação:

- Esconder no modo recolhido.
- Usuário expande para trocar workspace.

### Risco 3 — Tooltip visual pode exigir componente extra

Mitigação:

- Primeiro usar `title` + `aria-label`.
- Se o UI kit tiver Tooltip pronto e barato, usar depois.

### Risco 4 — Remover Notificações da sidebar pode incomodar

Mitigação:

- Configurações continua acessível.
- Se Mateus quiser manter, colocar `Notificações` dentro de Gestão abaixo de Configurações.

---

## Handoff para teste do Mateus

Quando estiver em staging, pedir para testar:

1. Abrir Dashboard no desktop.
2. Recolher menu.
3. Navegar por Dashboard, Leads, Kanban, Tarefas, Inbox.
4. Recarregar e confirmar que continuou recolhido.
5. Expandir e confirmar grupos novos.
6. Abrir no celular e confirmar que menu mobile continua normal.
7. Confirmar que não aparece mais `WhatsApp conectado` fake.

Mensagem de aprovação esperada:

```txt
Aprovado Parte 2
```

Só depois disso promover para produção.
