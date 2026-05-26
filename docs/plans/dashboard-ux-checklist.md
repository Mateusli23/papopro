# PapoPro — Checklist de Melhorias do Dashboard

> Objetivo: melhorar a experiência do cliente no dashboard antes de avançar com WhatsApp/automação pesada.

## Norte da decisão

O dashboard precisa responder rapidamente:

- O que está acontecendo no meu comercial?
- O que precisa da minha atenção hoje?
- Qual próximo passo eu devo tomar?

Nesta fase, o foco é deixar o CRM manual simples, confiável e claro.

---

## Fase 1 — Limpar o topo do dashboard

### 1. Remover CTA “Ativar agente IA” do topo

**Problema:**

- IA é recurso avançado.
- No dashboard inicial, ele distrai o usuário do básico: leads, tarefas e funil.

**Melhoria:**

- Remover o botão do header do dashboard.
- Manter acesso a IA somente pela página “Agentes”.
- No futuro, mostrar convite contextual para IA apenas quando fizer sentido.

**Critério de aceite:**

- Dashboard não mostra mais “Ativar agente IA” no topo.
- Página “Agentes” continua acessível pelo menu lateral.

---

### 2. Remover CTA “Adicionar lead” do topo do dashboard

**Problema:**

- O botão compete com filtros e KPIs.
- Criar lead é ação principal da tela de Leads, não necessariamente do dashboard.

**Melhoria:**

- Remover do topo do dashboard.
- Manter “Adicionar lead” na página `/leads`.
- Em dashboard vazio ou com poucos dados, usar um card de onboarding com “Adicionar primeiro lead”.

**Critério de aceite:**

- Header do dashboard fica limpo.
- Usuário ainda consegue criar lead facilmente pela tela Leads.
- Se o workspace estiver vazio, o dashboard orienta o usuário a criar o primeiro lead.

---

## Fase 2 — Melhorar filtro de período

### 3. Trocar botões de período por seletor único

**Problema atual:**

- Vários botões: Hoje, Esta semana, Este mês, Máximo, Personalizado.
- Ocupa muito espaço e parece mais complicado do que precisa.
- “Máximo” não é uma palavra clara para cliente comum.

**Melhoria:**

- Usar um único seletor:

```txt
Período: Últimos 7 dias ▾
```

Opções sugeridas:

- Hoje
- Últimos 7 dias
- Últimos 30 dias
- Este mês
- Todo o período
- Personalizado

**Critério de aceite:**

- Filtro ocupa menos espaço.
- “Máximo” vira “Todo o período”.
- Período selecionado fica claro no topo.

---

### 4. Melhorar experiência do filtro personalizado

**Problema:**

- “Personalizado” aparece como mais um botão, sem deixar claro o que acontece.

**Melhoria:**

- Dentro do seletor, ao escolher “Personalizado”, abrir calendário ou campos de data.
- Mostrar depois:

```txt
Período: 01/05/2026 — 26/05/2026
```

**Critério de aceite:**

- Usuário entende qual período está aplicado.
- Dá para voltar facilmente para “Últimos 7 dias” ou “Este mês”.

---

## Fase 3 — Menu lateral recolhível

### 5. Adicionar opção de diminuir/recolher o menu

**Problema:**

- Menu lateral ocupa bastante espaço.
- Em telas menores, o dashboard perde área útil.

**Melhoria:**

- Adicionar botão no topo ou rodapé da sidebar para alternar:
  - expandido: ícone + texto;
  - recolhido: só ícones.

**Critério de aceite:**

- Usuário consegue recolher e expandir o menu.
- No modo recolhido, os ícones continuam navegáveis.
- Tooltip mostra o nome do item ao passar o mouse.

---

### 6. Salvar preferência do menu

**Problema:**

- Se o usuário recolher o menu, ele não deve precisar repetir isso toda hora.

**Melhoria:**

- Salvar estado em cookie/localStorage ou preferência do usuário.

**Critério de aceite:**

- Ao recarregar o app, o menu permanece no último estado escolhido.

---

### 7. Organizar visualmente os grupos do menu

**Problema:**

- Tudo aparece no mesmo nível.
- Cliente novo vê muitas opções de uma vez.

**Melhoria sugerida:**

Grupo principal:

- Dashboard
- Leads
- Kanban
- Tarefas
- Inbox

Grupo automação:

- Cadências
- Agentes IA

Grupo gestão:

- Relatórios
- Configurações

**Critério de aceite:**

- Menu fica mais escaneável.
- Recursos avançados parecem secundários, não obrigatórios.

---

## Fase 4 — Transformar dashboard em tela de ação

### 8. Criar seção “Atenção hoje”

**Problema:**

- Dashboard mostra números, mas não deixa claro o que o usuário deve fazer.

**Melhoria:**

- Adicionar uma primeira seção com cards acionáveis:

```txt
Atenção hoje
- Leads sem resposta
- Tarefas atrasadas
- Leads frios
- Propostas abertas
```

**Critério de aceite:**

- Usuário bate o olho e sabe onde agir.
- Cada card leva para a tela filtrada correspondente.

---

### 9. Priorizar cards acionáveis acima dos KPIs genéricos

**Problema:**

- KPIs como “Leads novos” e “Taxa de conversão” são úteis, mas não indicam ação imediata.

**Melhoria:**

- Primeiro bloco: ação/prioridade.
- Segundo bloco: resumo comercial.

Ordem sugerida:

1. Atenção hoje
2. Resumo comercial
3. Funil e origem dos leads
4. Próximas tarefas / atividades

**Critério de aceite:**

- Dashboard fica mais útil para operação diária.
- Cliente entende o próximo passo.

---

## Fase 5 — Melhorar textos e nomes dos cards

### 10. Ajustar copy dos KPIs

**Problema:**

- Alguns textos parecem técnicos ou frios.

**Trocas sugeridas:**

- “Pipeline” → “Valor em aberto”
- “Taxa de conversão” → “Conversão no período”
- “Propostas” → “Propostas em negociação”
- “Leads novos” → “Novos leads recebidos”
- “sem fechamentos no período” → “Nenhuma venda registrada neste período”

**Critério de aceite:**

- Textos ficam mais humanos e fáceis de entender.
- Usuário não precisa conhecer jargão de CRM para entender a tela.

---

### 11. Melhorar descrições dos gráficos

**Problema:**

- Descrições atuais explicam tecnicamente o gráfico, mas não vendem o valor para o usuário.

**Melhorias sugeridas:**

Funil de vendas:

```txt
Veja onde seus negócios estão parados.
```

Origem dos leads:

```txt
Entenda quais canais estão trazendo oportunidades.
```

**Critério de aceite:**

- Cada bloco explica o benefício, não só o conteúdo.

---

## Fase 6 — Melhorar estado vazio e onboarding

### 12. Criar dashboard para workspace vazio

**Problema:**

- Se o cliente entra sem dados, KPIs zerados podem parecer app quebrado ou inútil.

**Melhoria:**

- Mostrar um onboarding contextual:

```txt
Seu CRM está quase pronto
1. Adicione seus primeiros leads
2. Organize seu funil
3. Crie suas primeiras tarefas
```

Botões:

- Adicionar lead
- Importar planilha
- Ver exemplo de funil

**Critério de aceite:**

- Workspace vazio orienta o usuário.
- Não mostra apenas números zerados sem contexto.

---

### 13. Criar estados com poucos dados

**Problema:**

- Cliente com 1–5 leads ainda não tem métricas suficientes.

**Melhoria:**

- Mostrar mensagens educativas:

```txt
Você ainda tem poucos leads para formar uma taxa de conversão confiável.
Continue cadastrando oportunidades para acompanhar seu desempenho.
```

**Critério de aceite:**

- Dashboard não parece negativo quando ainda não há volume.
- Métricas zeradas são explicadas.

---

## Fase 7 — Ajustar trial/billing sem pressionar cedo demais

### 14. Melhorar texto do banner de teste grátis

**Problema:**

- “Assinar Pro” pode soar agressivo no começo.

**Melhoria sugerida:**

```txt
Você está no teste grátis — faltam 7 dias
Continue usando todos os recursos Pro durante o teste.
[Ver planos]
```

**Critério de aceite:**

- Banner informa sem pressionar demais.
- CTA vira “Ver planos” ou “Conhecer Pro”.

---

## Fase 8 — Reduzir confusão com WhatsApp nesta etapa

### 15. Rever bloco “WhatsApp conectado” na sidebar

**Problema:**

- Se WhatsApp ainda não é prioridade ou está mockado, mostrar “conectado” cria expectativa errada.

**Melhoria:**

- Se não houver conexão real, mostrar:

```txt
WhatsApp
Não configurado
```

Ou esconder o bloco por enquanto.

**Critério de aceite:**

- Usuário não acha que WhatsApp já está funcionando se não estiver.
- Dashboard continua focado no CRM manual.

---

## Ordem recomendada de implementação

### Sprint UX Dashboard — Parte 1

1. Remover CTAs do topo:
   - Ativar agente IA
   - Adicionar lead
2. Trocar filtro de período por seletor único.
3. Ajustar copy dos KPIs e gráficos.
4. Melhorar texto do banner de trial.

### Sprint UX Dashboard — Parte 2

5. Implementar sidebar recolhível.
6. Salvar preferência do menu.
7. Agrupar itens do menu lateral.

### Sprint UX Dashboard — Parte 3

8. Criar seção “Atenção hoje”.
9. Tornar cards clicáveis com filtros aplicados.
10. Criar dashboard vazio/onboarding.
11. Criar mensagens para poucos dados.

### Sprint UX Dashboard — Parte 4

12. Revisar bloco de WhatsApp na sidebar.
13. Testar fluxo no desktop.
14. Testar fluxo no celular.
15. Validar com usuário real antes de avançar para WhatsApp.

---

## Fora do escopo desta etapa

Não implementar agora:

- WhatsApp real
- automações novas de IA
- novos planos Stripe
- push notifications
- campanhas em massa
- grandes mudanças no backend

Esta etapa é sobre clareza, confiança e usabilidade do CRM manual.

---

## Resultado esperado

Ao final desta etapa, o cliente deve conseguir abrir o dashboard e entender:

- quantos leads/oportunidades existem;
- o que exige atenção agora;
- onde clicar para agir;
- como navegar pelo app;
- que WhatsApp/IA são próximos passos, não pré-requisitos.
