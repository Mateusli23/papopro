# Dashboard UX Part 1 — Plano Detalhado de Implementação

> **Para Hermes:** implementar com mudança pequena, verificável e sem mexer em WhatsApp/IA/backend pesado.

**Goal:** limpar o topo do dashboard, simplificar o filtro de período, melhorar a copy dos KPIs/gráficos e suavizar o banner de trial para deixar a experiência mais clara para cliente novo.

**Architecture:** alterações concentradas em componentes client/server já existentes do dashboard e billing banner. Não criar nova modelagem nem rota nova. Reaproveitar `useDashboardRange`, `Popover`, `Button`, `DayPicker` e componentes de card existentes.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, `@papopro/ui`, `date-fns`, `react-day-picker`, pnpm.

---

## Escopo da Parte 1

Implementar agora:

1. Remover CTAs do topo do dashboard:
   - `Ativar agente IA`
   - `Adicionar lead`
2. Trocar o filtro atual em pills por seletor único:
   - `Período: Últimos 7 dias ▾`
3. Melhorar experiência do período personalizado.
4. Ajustar copy dos KPIs e gráficos.
5. Melhorar texto/CTA do banner de trial.
6. Atualizar testes/smoke se houver contrato textual afetado.
7. Rodar validação local: typecheck, lint, teste relevante, build.

Não implementar agora:

- sidebar recolhível;
- seção “Atenção hoje”;
- dashboard vazio completo;
- revisão do bloco WhatsApp;
- WhatsApp real;
- novas Server Actions;
- migrations.

---

## Estado atual encontrado no código

### Arquivos principais

- `apps/web/features/dashboard/components/post-wizard-dashboard.tsx`
  - Renderiza o header do dashboard.
  - Hoje coloca `DashboardRangePills` + botões `Ativar agente IA` e `Adicionar lead`.

- `apps/web/features/dashboard/components/dashboard-range-pills.tsx`
  - Renderiza pills: `Hoje`, `Esta semana`, `Este mês`, `Máximo`, `Personalizado`.
  - Já tem `DayPicker` para range customizado.

- `apps/web/features/dashboard/hooks/use-dashboard-range.ts`
  - Lê/escreve `?range=` na URL.
  - `week` é default e limpa `range` da URL.
  - Suporta `custom` com `from`/`to`.

- `apps/web/features/dashboard/components/kpi-grid.tsx`
  - Copy atual: `Leads novos`, `Tarefas pendentes`, `Pipeline`, `Taxa de conversão`, `Propostas`.

- `apps/web/features/dashboard/components/funnel-horizontal-chart.tsx`
  - Copy atual: `Funil de vendas`; descrição: `Negócios em cada etapa do pipeline — abertos e terminais.`

- `apps/web/features/dashboard/components/origin-donut.tsx`
  - Copy atual: `Leads por origem`; descrição: `De onde vêm os leads no período selecionado.`

- `apps/web/features/billing/components/trial-banner.tsx`
  - Copy atual: `Teste grátis do PapoPro — faltam X dias. Depois disso o workspace volta pro plano Free.`
  - CTA atual: `Assinar Pro`.

---

## Decisões de produto para esta implementação

### Decisão 1 — Topo do dashboard sem CTA operacional/avançado

O header deve ter só:

- saudação;
- data;
- seletor de período.

Motivo:

- `Ativar agente IA` é recurso avançado e distrai.
- `Adicionar lead` deve continuar existindo em `/leads`, não disputar atenção no dashboard.
- Dashboard vira tela de leitura/gestão, não uma mistura de ações.

### Decisão 2 — Filtro único em vez de pills

Trocar pills por um dropdown/select visual:

```txt
Período: Últimos 7 dias ▾
```

Opções:

- Hoje
- Últimos 7 dias
- Últimos 30 dias
- Este mês
- Todo o período
- Personalizado

Mapeamento com range existente:

- `today` → Hoje
- `week` → Últimos 7 dias
- `month` → Este mês
- `all` → Todo o período
- `custom` → Personalizado

Atenção: hoje não existe range `last30`/`30d` no contrato atual. Para não expandir escopo, existem duas opções:

- **Opção A, recomendada para Part 1:** não implementar `Últimos 30 dias` ainda; usar `Hoje`, `Últimos 7 dias`, `Este mês`, `Todo o período`, `Personalizado`.
- **Opção B:** adicionar novo `DashboardRange = 'last30'` em `types/range/transforms` se for barato e tiver teste.

Recomendação: **Opção A agora**, porque é UX cleanup sem mexer em lógica de range.

### Decisão 3 — “Máximo” vira “Todo o período”

Motivo:

- `Máximo` parece termo técnico.
- `Todo o período` é mais claro para cliente comum.

### Decisão 4 — Banner trial menos agressivo

Trocar CTA de `Assinar Pro` para `Ver planos`.

Copy sugerida:

```txt
Você está no teste grátis — faltam 7 dias. Continue usando todos os recursos Pro durante o teste.
[Ver planos]
```

Quando urgente, manter tom visual de warning, mas o texto continua claro.

---

## Task 1 — Remover CTAs do topo do dashboard

**Objective:** deixar o header do dashboard focado em saudação + período.

**Files:**

- Modify: `apps/web/features/dashboard/components/post-wizard-dashboard.tsx`

**Step 1: Remover imports não usados**

Remover:

```ts
import { Button } from '@papopro/ui';
import { PlusCircle, Sparkles } from '@papopro/ui/icons';
```

Se nenhum botão ficar no arquivo, `Button`, `PlusCircle` e `Sparkles` não devem sobrar.

**Step 2: Remover bloco dos botões**

Remover este trecho:

```tsx
<div className="flex shrink-0 items-center gap-2">
  <Button variant="outline" size="sm">
    <Sparkles /> Ativar agente IA
  </Button>
  <Button size="sm">
    <PlusCircle /> Adicionar lead
  </Button>
</div>
```

**Step 3: Ajustar layout do header**

Antes:

```tsx
<div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
  <DashboardRangePills />
  ...botões...
</div>
```

Depois:

```tsx
<div className="flex items-center">
  <DashboardRangeSelect />
</div>
```

ou, se mantiver nome temporário:

```tsx
<div className="flex items-center">
  <DashboardRangePills />
</div>
```

Mas a Task 2 recomenda renomear para `DashboardRangeSelect`.

**Step 4: Atualizar comentário do componente**

Remover do comentário antigo:

```txt
Os botões "Ativar agente IA" e "Adicionar lead" permanecem placeholders...
```

Substituir por:

```txt
Header fica deliberadamente limpo: saudação + seletor de período. Ações operacionais vivem nas telas específicas.
```

**Verification:**

- Dashboard não renderiza `Ativar agente IA`.
- Dashboard não renderiza `Adicionar lead` no topo.
- Não há import não usado.

---

## Task 2 — Trocar pills por seletor único de período

**Objective:** substituir vários botões por um controle compacto e mais claro.

**Files:**

- Rename/Modify: `apps/web/features/dashboard/components/dashboard-range-pills.tsx`
  - Sugestão: criar `dashboard-range-select.tsx` e depois remover/ignorar o antigo.
- Modify: `apps/web/features/dashboard/components/post-wizard-dashboard.tsx`

**Step 1: Criar novo componente `DashboardRangeSelect`**

Criar arquivo:

```txt
apps/web/features/dashboard/components/dashboard-range-select.tsx
```

Estrutura sugerida:

```tsx
'use client';

import * as React from 'react';
import 'react-day-picker/dist/style.css';

import { format as fmtDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayPicker, type DateRange } from 'react-day-picker';

import { Button, cn, Popover, PopoverContent, PopoverTrigger } from '@papopro/ui';
import { Calendar, Check, ChevronDown } from '@papopro/ui/icons';

import { useDashboardRange } from '../hooks/use-dashboard-range';
import { DASHBOARD_NOW } from '../range';
import type { DashboardRange } from '../types';

const OPTIONS: Array<{ key: Exclude<DashboardRange, 'custom'>; label: string }> = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Últimos 7 dias' },
  { key: 'month', label: 'Este mês' },
  { key: 'all', label: 'Todo o período' },
];

export function DashboardRangeSelect() {
  const { bounds, setRange } = useDashboardRange();
  const [open, setOpen] = React.useState(false);
  const [customOpen, setCustomOpen] = React.useState(false);

  const currentLabel =
    bounds.range === 'custom'
      ? bounds.label
      : (OPTIONS.find((o) => o.key === bounds.range)?.label ?? 'Últimos 7 dias');

  return (
    <div className="flex items-center gap-2">
      <span className="text-caption text-muted-foreground hidden sm:inline">Período</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="min-w-[180px] justify-between gap-2">
            <span className="truncate">{currentLabel}</span>
            <ChevronDown className="size-4 opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          <div className="flex flex-col">
            {OPTIONS.map((option) => {
              const active = bounds.range === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={cn(
                    'text-body flex items-center justify-between rounded-md px-3 py-2 text-left transition-colors',
                    active
                      ? 'bg-muted text-foreground font-medium'
                      : 'hover:bg-muted/70 text-foreground',
                  )}
                  onClick={() => {
                    setRange(option.key);
                    setOpen(false);
                  }}
                >
                  {option.label}
                  {active && <Check className="size-4" />}
                </button>
              );
            })}
            <button
              type="button"
              className={cn(
                'text-body flex items-center justify-between rounded-md px-3 py-2 text-left transition-colors',
                bounds.range === 'custom'
                  ? 'bg-muted text-foreground font-medium'
                  : 'hover:bg-muted/70 text-foreground',
              )}
              onClick={() => {
                setOpen(false);
                setCustomOpen(true);
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Calendar className="size-4" />
                Personalizado
              </span>
              {bounds.range === 'custom' && <Check className="size-4" />}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <span aria-hidden className="sr-only" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="end">
          <CustomRangePicker
            initial={bounds.range === 'custom' ? { from: bounds.start, to: bounds.end } : undefined}
            onApply={(range) => {
              if (range.from && range.to) {
                setRange('custom', { start: range.from, end: range.to });
                setCustomOpen(false);
              }
            }}
            onCancel={() => setCustomOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

**Important implementation note:** se o `PopoverTrigger` com `sr-only` não funcionar bem por causa de Radix exigir elemento clicável/medido, preferir abordagem mais simples: manter um único `Popover` para o menu e, quando clicar em `Personalizado`, renderizar o `CustomRangePicker` dentro do mesmo popover em vez da lista de opções. Exemplo de estado:

```ts
const [mode, setMode] = React.useState<'menu' | 'custom'>('menu');
```

Esse caminho é provavelmente mais robusto.

**Step 2: Reaproveitar `CustomRangePicker`**

Mover a função atual de `dashboard-range-pills.tsx` para o novo arquivo sem mudar muito.

Melhorias pequenas:

- texto auxiliar: `Selecione início e fim`;
- botão `Aplicar` só habilita quando `from` e `to` existem;
- ao aplicar, label do botão vira `d MMM yyyy – d MMM yyyy` pelo `bounds.label` atual.

**Step 3: Atualizar import no dashboard**

Em `post-wizard-dashboard.tsx` trocar:

```ts
import { DashboardRangePills } from './dashboard-range-pills';
```

por:

```ts
import { DashboardRangeSelect } from './dashboard-range-select';
```

E no JSX:

```tsx
<DashboardRangeSelect />
```

**Step 4: Decidir destino do arquivo antigo**

Opções:

- Remover `dashboard-range-pills.tsx` se não for usado.
- Ou deixar temporariamente, mas isso deixa código morto.

Recomendação: **remover arquivo antigo** depois de confirmar que nenhum import usa.

**Verification:**

- `?range=today` mostra `Hoje`.
- URL sem `range` mostra `Últimos 7 dias`.
- `?range=month` mostra `Este mês`.
- `?range=all` mostra `Todo o período`.
- Escolher `Personalizado` aplica `?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`.
- O browser back não é poluído com cada troca, porque `useDashboardRange` usa `router.replace`.

---

## Task 3 — Ajustar copy dos KPIs

**Objective:** deixar os cards menos técnicos e mais claros para cliente comum.

**Files:**

- Modify: `apps/web/features/dashboard/components/kpi-grid.tsx`

**Step 1: Trocar labels**

Trocas:

```txt
Leads novos → Novos leads
Tarefas pendentes → Tarefas pendentes  // manter, está claro
Pipeline → Valor em aberto
Taxa de conversão → Conversão no período
Propostas → Propostas em negociação
```

**Step 2: Trocar hints**

Sugestões:

- Novos leads:

```tsx
hint={
  k.hotLeadsCount > 0
    ? `${k.hotLeadsCount} ${k.hotLeadsCount === 1 ? 'lead quente' : 'leads quentes'} agora`
    : 'recebidos no período'
}
```

- Tarefas pendentes:

```tsx
hint={k.pendingTasksCount === 0 ? 'tudo em dia' : 'precisam de ação'}
```

- Valor em aberto:

```tsx
hint={
  k.openDealsCount > 0
    ? `${k.openDealsCount} ${k.openDealsCount === 1 ? 'oportunidade aberta' : 'oportunidades abertas'}`
    : 'nenhuma oportunidade aberta'
}
```

- Conversão no período:

```tsx
hint={
  k.closedInRange === 0
    ? 'nenhuma venda registrada neste período'
    : `${k.wonInRange} ${k.wonInRange === 1 ? 'venda ganha' : 'vendas ganhas'} · ${k.lostInRange} ${k.lostInRange === 1 ? 'perdida' : 'perdidas'}`
}
```

- Propostas em negociação:

```tsx
hint = 'oportunidades na etapa de proposta';
```

**Step 3: Conferir tamanho dos labels no card**

Labels maiores podem quebrar em mobile. Se necessário:

- aceitar quebra em 2 linhas;
- ou usar `text-caption` já existente no `KpiCard`.

**Verification:**

- Cards renderizam sem overflow no desktop.
- Cards renderizam legíveis em mobile 360px.
- Nenhum texto antigo principal permanece: `Pipeline`, `Taxa de conversão`, `Propostas` isolado.

---

## Task 4 — Ajustar copy dos gráficos

**Objective:** explicar valor para o usuário, não só o dado técnico.

**Files:**

- Modify: `apps/web/features/dashboard/components/funnel-horizontal-chart.tsx`
- Modify: `apps/web/features/dashboard/components/origin-donut.tsx`

**Step 1: Funil de vendas**

Trocar:

```tsx
<CardDescription>Negócios em cada etapa do pipeline — abertos e terminais.</CardDescription>
```

por:

```tsx
<CardDescription>Veja onde seus negócios estão parados.</CardDescription>
```

**Step 2: Empty state do funil**

Trocar:

```tsx
description = 'Adicione um negócio pra começar a popular o funil.';
```

por algo mais alinhado ao produto:

```tsx
description = 'Quando você criar oportunidades, elas aparecem aqui por etapa.';
```

**Step 3: Origem dos leads**

Trocar título:

```tsx
<CardTitle className="text-title">Leads por origem</CardTitle>
```

por:

```tsx
<CardTitle className="text-title">Origem dos leads</CardTitle>
```

Trocar descrição:

```tsx
<CardDescription>De onde vêm os leads no período selecionado.</CardDescription>
```

por:

```tsx
<CardDescription>Entenda quais canais estão trazendo oportunidades.</CardDescription>
```

**Step 4: Empty state da origem**

Trocar:

```tsx
description = 'Quando entrarem leads no range escolhido, a distribuição aparece aqui.';
```

por:

```tsx
description = 'Quando novos leads entrarem no período escolhido, você verá os canais aqui.';
```

**Verification:**

- Textos novos aparecem no dashboard.
- Cards continuam com mesma estrutura visual.

---

## Task 5 — Melhorar banner de trial

**Objective:** manter aviso de trial, mas sem pressão agressiva cedo demais.

**Files:**

- Modify: `apps/web/features/billing/components/trial-banner.tsx`

**Step 1: Ajustar `daysLabel` se necessário**

Atual:

```ts
const daysLabel = trial.daysLeft === 1 ? 'termina amanhã' : `faltam ${trial.daysLeft} dias`;
```

Pode manter.

**Step 2: Trocar copy principal**

Atual:

```tsx
<strong>Teste grátis do PapoPro</strong> — {daysLabel}. Depois disso o workspace volta pro plano Free.
```

Novo:

```tsx
<strong>Você está no teste grátis</strong> — {daysLabel}. Continue usando todos os recursos Pro durante o teste.
```

Para `urgent`, opcionalmente deixar mais direto:

```tsx
<strong>Seu teste grátis está acabando</strong> — {daysLabel}. Veja os planos para manter os recursos Pro.
```

Recomendação: manter uma copy única para reduzir branch:

```tsx
<strong>Você está no teste grátis</strong> — {daysLabel}. Continue usando todos os recursos Pro durante o teste.
```

**Step 3: Trocar CTA**

Atual:

```txt
Assinar Pro
```

Novo:

```txt
Ver planos
```

Manter link:

```tsx
<Link href="/settings/billing">
```

**Step 4: Ícone do CTA**

Pode manter `Sparkles`, mas se ficar com cara de IA, trocar por `ArrowRight` ou remover ícone. Para mínima mudança, manter `Sparkles`.

**Verification:**

- Banner mostra `Ver planos`.
- Banner não fala “Depois disso o workspace volta pro plano Free” no topo.
- Link continua indo para `/settings/billing`.

---

## Task 6 — Atualizar/Adicionar testes leves

**Objective:** proteger a lógica de range/copy sem criar teste frágil de snapshot visual.

**Files candidatos:**

- Search existing tests:
  - `apps/web/features/dashboard/**/*.test.ts`
  - `apps/web/app/api/smoke-test/dashboard/route.ts` se existir

**Step 1: Procurar testes existentes**

Comando:

```bash
/opt/data/bin/pnpm --filter @papopro/web test -- --runInBand
```

Mas antes procurar arquivos:

```txt
search_files("*.test.ts", target="files", path="apps/web/features/dashboard")
```

**Step 2: Se já houver teste de range**

Adicionar contratos puros em `range`/labels, se existir helper.

**Step 3: Se não houver teste simples**

Não criar teste de componente agora só para copy. Em vez disso, validar com:

- typecheck;
- lint;
- build;
- smoke manual visual no app.

Motivo: testes de componente podem exigir setup de Testing Library que talvez não exista para esse pacote.

**Verification mínima obrigatória:**

```bash
/opt/data/bin/pnpm --filter @papopro/web typecheck
/opt/data/bin/pnpm --filter @papopro/web lint
/opt/data/bin/pnpm --filter @papopro/web build
```

Se houver vitest configurado e rápido:

```bash
/opt/data/bin/pnpm --filter @papopro/web test
```

---

## Task 7 — QA visual/manual

**Objective:** garantir que a experiência ficou melhor no desktop e no mobile.

**Checklist manual:**

### Desktop

- Header mostra saudação + data + seletor de período.
- Não há `Ativar agente IA` no topo.
- Não há `Adicionar lead` no topo.
- Dropdown de período abre alinhado à direita.
- Ao escolher `Hoje`, dados mudam e URL vira `?range=today`.
- Ao escolher `Últimos 7 dias`, URL limpa `range`.
- Ao escolher `Este mês`, URL vira `?range=month`.
- Ao escolher `Todo o período`, URL vira `?range=all`.
- Ao escolher `Personalizado`, calendário abre e aplica `from/to`.
- KPIs estão com copy nova.
- Gráficos estão com descrições novas.
- Banner trial usa `Ver planos`.

### Mobile

- Header empilha sem quebrar.
- Seletor de período cabe na largura.
- Dropdown não fica cortado.
- Cards KPI continuam legíveis.

---

## Ordem de commits sugerida

### Commit 1

```bash
git add apps/web/features/dashboard/components/post-wizard-dashboard.tsx \
        apps/web/features/dashboard/components/dashboard-range-select.tsx \
        apps/web/features/dashboard/components/dashboard-range-pills.tsx

git commit -m "feat(dashboard): simplify header and period filter"
```

Se remover arquivo antigo, incluir `git rm`.

### Commit 2

```bash
git add apps/web/features/dashboard/components/kpi-grid.tsx \
        apps/web/features/dashboard/components/funnel-horizontal-chart.tsx \
        apps/web/features/dashboard/components/origin-donut.tsx \
        apps/web/features/billing/components/trial-banner.tsx

git commit -m "copy(dashboard): clarify KPI, chart and trial messages"
```

### Commit 3, se houver teste

```bash
git add apps/web/**/**.test.ts apps/web/app/api/smoke-test/**
git commit -m "test(dashboard): cover period filter contracts"
```

---

## Critérios de aceite finais da Parte 1

A Parte 1 só está pronta quando:

- [ ] Dashboard não tem os botões `Ativar agente IA` e `Adicionar lead` no topo.
- [ ] Filtro de período virou um seletor único.
- [ ] `Máximo` não aparece mais; aparece `Todo o período`.
- [ ] Período default aparece como `Últimos 7 dias`.
- [ ] Range personalizado continua funcionando.
- [ ] KPIs usam copy mais clara.
- [ ] Gráficos usam descrições orientadas a valor.
- [ ] Banner trial usa copy suave e CTA `Ver planos`.
- [ ] Typecheck passa.
- [ ] Lint passa.
- [ ] Build passa.
- [ ] QA visual desktop/mobile aprovado.

---

## Riscos e cuidados

### Risco 1 — `Popover` duplo para menu/custom

Se o calendário não abrir corretamente ao clicar em `Personalizado`, usar um único popover com `mode: 'menu' | 'custom'`.

### Risco 2 — Labels maiores quebram KPI card

Se `Conversão no período` ou `Propostas em negociação` quebrar feio, aceitar label em 2 linhas ou usar abreviação:

- `Conversão`
- `Propostas abertas`

### Risco 3 — Range `Últimos 7 dias` pode não ser exatamente “esta semana”

Hoje o código usa range `week`. Antes de alterar semântica, confirmar em `range.ts` se é semana calendário ou últimos 7 dias.

Se for semana calendário, copy mais correta seria:

```txt
Esta semana
```

A recomendação de UX era `Últimos 7 dias`, mas não devemos mentir sobre o dado.

**Ação obrigatória antes de implementar Task 2:** ler `apps/web/features/dashboard/range.ts` e confirmar a semântica de `week`.

### Risco 4 — Textos podem afetar smoke ou snapshots

Depois das mudanças, buscar strings antigas:

```txt
Ativar agente IA
Adicionar lead
Máximo
Taxa de conversão
Assinar Pro
```

Nem toda ocorrência é erro — pode aparecer em outras telas. Mas no dashboard/billing banner não deve aparecer onde foi removido.

---

## Próximo passo depois deste plano

Implementar a Parte 1 em uma branch de feature baseada em `dev`, rodar validações e entregar para teste no app de staging.

Branch sugerida:

```bash
git checkout dev
git pull origin dev
git checkout -b ux/dashboard-part-1-cleanup
```
