# PRD — PapoPro

## CRM SaaS para times de vendas consultivas com WhatsApp e IA

**Versão:** 1.0
**Data:** Maio 2026
**Autor:** Mateus

---

## 1. CONTEXTO E PROBLEMA

Times de vendas consultivas em pequenas e médias empresas (1 a 15 vendedores) — com destaque para mercados de ciclo médio/longo como imobiliário, serviços B2B e produtos de alto ticket — perdem oportunidades em pipeline por falhas de follow-up e ausência de gestão centralizada do funil.

Os dados de mercado expõem a dimensão do problema:

- **48% dos vendedores nunca fazem um único follow-up** após o contato inicial, e **44% desistem após apenas uma tentativa** (Invesp).
- **80% das vendas exigem 5 ou mais follow-ups**, mas **92% dos vendedores param antes da 5ª tentativa** (Close.com).
- Apenas **2% das vendas fecham no primeiro contato** — **80% acontecem entre o 5º e o 12º contato** (HubSpot).
- **79% dos leads de marketing nunca se convertem em vendas**, e a causa principal é ausência de nutrição estruturada (Salesforce).
- No Brasil, fluxos de cadência com maiores conversões têm **entre 7 e 8 tentativas estruturadas** (Reev) — patamar que a operação manual em planilha/WhatsApp raramente sustenta.

Na prática, isso significa que a maioria dos leads qualificados esfriam antes de receber uma segunda interação estruturada — não por falta de interesse do cliente, mas por falha operacional do time de vendas.

Hoje a operação é fragmentada entre três frentes que não se conversam:

- **Planilhas e cadernos:** sem alertas, sem priorização automática, sem visão de funil. Escalam mal e dependem da disciplina individual de cada vendedor.
- **WhatsApp:** é onde o lead realmente conversa, mas o histórico fica disperso entre celulares pessoais, sem rastreabilidade, sem padronização e sem registro vinculado ao cliente no sistema.
- **CRMs genéricos (Pipedrive, HubSpot, RD Station):** caros para o porte SMB, exigem implantação demorada, e foram desenhados para vendas inbound digitais — não para vendas consultivas com forte componente de relacionamento via WhatsApp.

Quando a equipe cresce, gestores não conseguem responder perguntas básicas: _quais leads esfriaram? quem está com qual cliente? em qual etapa cada negócio travou? qual vendedor está abaixo da meta de atividade?_ O custo prático desse gap é direto — receita perdida por leads não retomados, propostas que não voltam, e decisões de gestão tomadas sem visibilidade real do pipeline.

**Público-alvo prioritário (beachhead):** times comerciais de 2 a 10 vendedores em vendas consultivas de ciclo médio/longo, com WhatsApp como canal principal de relacionamento.

---

## 2. SOLUÇÃO PROPOSTA

Construiremos uma plataforma SaaS web e mobile (PWA) de CRM e gestão comercial multi-empresa, com pipeline visual em Kanban, motor de follow-up automatizado, integração nativa com WhatsApp e agentes de IA configuráveis para qualificação e atendimento de leads. A plataforma é desenhada especificamente para times de vendas consultivas de pequeno e médio porte (1 a 15 vendedores) que operam com WhatsApp como canal principal de relacionamento, oferecendo a profundidade de um CRM corporativo com a simplicidade e o custo acessível para SMBs.

### Como a Solução Resolve o Problema

A dor central identificada — leads qualificados esfriando antes de uma segunda interação estruturada por falha de follow-up — é atacada por três frentes integradas no produto:

1. **Motor de cadência automática:** garante que todo lead receba a sequência de follow-ups configurada pela equipe, eliminando a dependência da memória individual do vendedor.
2. **Sistema de alertas de lead frio por etapa do funil:** identifica proativamente leads sem interação dentro dos prazos definidos e notifica vendedor e gestor antes que o negócio esfrie de forma irrecuperável.
3. **Centralização do WhatsApp dentro do CRM:** resolve o problema dos históricos dispersos em celulares pessoais, dando ao gestor visibilidade total sobre conversas, atividade da equipe e gargalos do funil.

A combinação dessas três frentes transforma um pipeline reativo (vendedor lembra → vendedor age) em um pipeline proativo (sistema lembra → vendedor executa), atacando diretamente a estatística de mercado em que 48% dos vendedores nunca fazem follow-up e 92% desistem antes da quinta tentativa, justamente quando 80% das vendas acontecem.

### Componentes da Plataforma

**2.1. Núcleo do CRM**

- Cadastro completo de leads e contatos: nome, email, telefone, empresa, cargo, origem, tags personalizadas, valor estimado do negócio, data de previsão de fechamento, vendedor responsável e campos customizáveis por workspace.
- Pipeline visual em Kanban com drag-and-drop: etapas padrão (Novo Lead → Em Contato → Proposta Enviada → Negociação → Fechamento Ganho/Perdido) totalmente customizáveis por workspace, com indicador visual de temperatura do lead (quente/morno/frio) em cada card.
- Página de detalhe do lead: histórico completo e cronológico de todas as interações (mensagens WhatsApp, ligações, emails, reuniões, notas internas, tarefas, mudanças de etapa, documentos anexados), ficha consolidada do lead, próximas ações programadas e atalhos para envio de mensagem direta.
- Tarefas e lembretes: criação manual ou automática (via cadência) de tarefas vinculadas a leads, com integração bidirecional ao Google Calendar — toda tarefa criada vira evento no calendário do vendedor, e movimentações no calendário refletem no CRM.

**2.2. Motor de Follow-up Automatizado (peça central da diferenciação)**

- Cadências configuráveis por etapa do funil: sequências de mensagens com gatilhos por dia (D+0, D+1, D+3, D+7, D+14, D+30) e canal (WhatsApp, email), com templates personalizados por placeholder ({nome}, {empresa}, {produto}).
- Templates de cadência prontos: cadências pré-configuradas para os perfis mais comuns (imobiliário, B2B, alto ticket) que o cliente pode usar como ponto de partida e customizar.
- Alertas de lead frio por etapa: sistema monitora tempo sem interação e dispara notificação para vendedor e gestor quando o lead ultrapassa o limite configurado da etapa em que está. Defaults: 7 dias em "Novo Lead", 14 dias em "Em Contato", 7 dias em "Proposta Enviada", 5 dias em "Negociação", 30 dias como limite global.
- Pausa inteligente: cadências em fila são automaticamente pausadas se o cliente responder, evitando o erro de continuar enviando mensagens automáticas quando há conversa ativa.

**2.3. Captura Multi-canal de Leads**

- Cadastro manual: formulário rápido acessível de qualquer tela.
- Importação por CSV: template downloadável com mapeamento visual de colunas e preview antes da confirmação. Crítico para onboarding de clientes que migram de planilha.
- Webhooks de entrada: URL única por workspace que recebe leads de Meta Ads (Lead Ads), Google Ads, RD Station, Hotmart, formulários de site (Lovable, WordPress, Webflow) e qualquer ferramenta com webhook de saída.
- Captura automática via WhatsApp: quando um cliente envia mensagem para o número conectado no workspace, o sistema cria automaticamente um lead com a primeira mensagem registrada, atribui ao vendedor disponível (round-robin ou regra customizada) e dispara a cadência de boas-vindas configurada.

**2.4. WhatsApp Integrado com Anti-Bloqueio**

- Conexão por workspace via QR Code: cada cliente conecta seu próprio número, com tela dedicada de "Conexões" exibindo status em tempo real, health score, histórico de desconexões e botão de reconexão self-service.
- Heartbeat e reconexão automática: sistema monitora a conexão a cada 60 segundos, notifica imediatamente o admin via push e email em caso de queda, pausa cadências em fila e processa a fila acumulada quando a conexão é restabelecida.
- Camada anti-bloqueio (anti-ban):
  - Limites diários de envio configuráveis com defaults seguros (20-50 msgs/dia para chip novo, escalonamento gradual de até 20%/dia)
  - Intervalo aleatório entre disparos (30 a 90 segundos por padrão)
  - Janela horária respeitosa configurável por workspace (default 9h-21h)
  - Pausa automática a cada 50 envios consecutivos
  - Health Score visível do número (verde/amarelo/vermelho) com pausa automática se cair para vermelho
  - Opt-out automático via palavras-chave ("PARE", "SAIR", "CANCELAR") com adição à blacklist do workspace
  - Variação automática de templates para evitar repetição de strings idênticas em massa
- Caixa de entrada unificada: todas as conversas WhatsApp do time em uma única tela, vinculadas aos cards do CRM, com filtros por vendedor, status, etapa do funil e leads sem resposta.
- Disparador de mensagens em massa: envio de campanhas para listas segmentadas (por tag, etapa do funil, origem, período de cadastro) com agendamento, respeitando os limites anti-ban.

**2.5. Agentes de IA Configuráveis (Multi-agente)**

- Múltiplos agentes IA por workspace com identidades, prompts e regras de roteamento independentes (até 3 agentes ativos no plano Pro IA).
- Casos de uso: agente de qualificação (SDR), agente de atendimento, agente de recuperação de lead frio, agente especialista por produto/linha de negócio.
- Configuração de cada agente por prompt em linguagem natural: nome, persona, tom de voz, regras de negócio, gatilhos de handoff.
- Roteamento entre agentes por etapa do funil, tag do lead, número WhatsApp conectado e palavra-chave configurável.
- Base de conhecimento compartilhada por workspace ("Cérebro da Empresa"): campos estruturados (sobre a empresa, produtos com preços, FAQ, scripts de objeção, política) + upload de arquivos (PDF, DOC, TXT) processados em embeddings via pgvector. Versionamento e rollback de mudanças.
- Memória em três camadas: sessão (últimas mensagens da conversa atual, isolada por agente), lead (ficha consolidada compartilhada entre agentes do workspace), empresa (base de conhecimento permanente, compartilhada).
- Handoff entre agentes IA: agente A passa conversa para agente B mediante gatilho de palavra-chave, mudança de etapa do funil ou comando explícito. Resumo automático do contexto entregue ao agente seguinte. Pausa do agente anterior para evitar duplicidade.
- Handoff humano com múltiplos gatilhos: manual via botão "Assumir conversa", por palavra-chave configurável, por intenção comercial detectada, por etapa do funil e por horário comercial. Pausa automática do agente após handoff humano. Resumo entregue ao vendedor (perfil do lead, demandas, etapa, próxima ação sugerida, qual agente vinha atendendo).
- Detalhamento completo da interface de gestão de agentes na Seção 3.9.

**2.6. Multi-empresa, Permissões e Auditoria**

- Workspaces isolados: cada empresa opera em um ambiente totalmente separado, com dados, leads, configurações e integrações independentes. Um mesmo usuário pode pertencer a múltiplos workspaces com papéis distintos.
- Convite de colaboradores por email com aceite via magic link.
- **RBAC com cinco papéis pré-definidos:**
  - **Owner:** acesso total, gestão de billing, transferência de propriedade
  - **Admin:** acesso total exceto billing
  - **Manager:** acesso a todos os leads do time, edição de pipeline e cadências, sem convidar usuários
  - **Vendedor:** acesso apenas aos próprios leads (com flag opcional de transparência total ativada pelo Admin)
  - **Viewer:** somente leitura
- Log de auditoria: registro de eventos críticos com filtro por usuário e período. Retenção de 12 meses no padrão e 24 meses no Enterprise.
- Conformidade LGPD: consentimento explícito no cadastro de leads, opt-out automático, exportação de dados sob demanda e exclusão por solicitação.

**2.7. Dashboard e Inteligência Comercial**

- **Métricas operacionais (MVP):** total de leads (com filtros), negócios abertos por etapa, valor total do pipeline, taxa de conversão geral e por etapa, tempo médio em cada etapa, leads esfriando no momento, performance individual por vendedor (atividade × resultado).
- **Visualização de funil:** gráfico de funil com volume e valor por etapa, identificando gargalos.
- **Métricas avançadas (V2):** forecast por probabilidade × etapa, análise de origem do lead, comparativo com período anterior, cohort de leads por mês de entrada.

**2.8. Mobile e Notificações**

- PWA responsivo no MVP: mesma base de código web, instalável no celular, sem dependência de App Store ou Google Play.
- Web Push: notificações em tempo real para novo lead atribuído, mensagem recebida, alerta de lead frio, queda de conexão WhatsApp e tarefas programadas.
- App nativo iOS/Android: previsto para V2/V3, após validação comercial.

### Diferenciais Competitivos

A solução se posiciona contra três alternativas atuais e supera cada uma por pontos específicos:

- **Versus planilhas e cadernos:** entrega automação de cadência, alertas proativos de lead frio, visão de funil em tempo real e rastreabilidade — sem depender da disciplina individual.
- **Versus WhatsApp puro:** centraliza histórico, vincula conversas a leads, dá visibilidade ao gestor e elimina o problema de "vendedor sai e leva tudo no celular pessoal".
- **Versus CRMs genéricos (Pipedrive, HubSpot, RD):** nasce com WhatsApp como canal central (não como integração de terceiros), tem agente IA configurável incluso, oferece preço acessível ao porte SMB e implantação imediata sem necessidade de consultoria.

### Estratégia de Plataforma WhatsApp

A plataforma adota uma arquitetura de **WhatsApp Adapter** que abstrai o provedor de envio, permitindo dois modos de operação com a mesma interface de usuário:

- **Modo Standard (uazapi):** disponível nos planos Pro e Pro IA, baseado em API não-oficial de baixo custo, indicado para SMBs com volume moderado e tolerância ao risco operacional. Inclui toda a camada anti-bloqueio descrita.
- **Modo Enterprise (WhatsApp Cloud API oficial Meta):** disponível no plano Enterprise, com selo verde verificado, templates pré-aprovados, limites altos (até 100 mil conversas/dia), SLA de uptime 99,9%, compliance completo (opt-in registrado, janela de 24h, consentimento documentado) e onboarding assistido.

O cliente pode iniciar no modo Standard e migrar para Enterprise sem perda de dados ou retrabalho.

### Modelo de Monetização

- **Plano Pro** (sem agente IA): R$ 197/mês — até 5 usuários, 5.000 leads ativos, 5.000 disparos/mês, 1 número WhatsApp.
- **Plano Pro IA** (com agentes IA): R$ 497/mês — até 10 usuários, 20.000 leads ativos, 20.000 disparos/mês, 3 números WhatsApp, até 3 agentes IA.
- **Plano Enterprise:** sob consulta — Cloud API oficial, limites elevados, SLA, onboarding assistido, suporte prioritário.
- **Trial gratuito de 7 dias** sem necessidade de cartão de crédito, com aviso por email e push em D-2 e D-1.
- **Gateway de pagamento:** Stripe Checkout + Customer Portal + Webhooks (3,99% + R$ 0,39 por transação).

---

## 3. REQUISITOS FUNCIONAIS

### 3.1. Login e Autenticação

- Autenticação via **email + senha** com hash bcrypt (gerenciado pelo Supabase Auth).
- **Recuperação de senha** por email com link temporário (validade 60 minutos).
- **Verificação de email obrigatória** no cadastro: usuário só consegue acessar o produto após confirmar via link enviado por email.
- Sessão JWT com refresh token automático.
- Logout em todos os dispositivos como opção do usuário.
- Tela de login com validação inline (Zod) e mensagens de erro claras em português.
- Redirect inteligente após login: se usuário tem 0 workspaces, vai para "Criar workspace"; se tem 1, vai direto para o dashboard; se tem N, vai para tela de seleção.
- **OAuth Google e 2FA ficam para V2.**

### 3.2. Notificações

**Canais ativos no MVP:**

- **In-app:** sino com badge no canto superior direito + central de notificações (Drawer lateral) com histórico dos últimos 30 dias.
- **Push notifications (PWA):** Web Push API + VAPID keys + Service Worker, com suporte iOS Safari 16.4+ e Android Chrome.
- **Email transacional (Resend):** apenas para eventos críticos.

**Matriz de notificação por evento e canal:**

| Evento                                    | In-app | Push | Email |
| ----------------------------------------- | :----: | :--: | :---: |
| Novo lead atribuído ao vendedor           |   ✅   |  ✅  |   —   |
| Cliente respondeu mensagem WhatsApp       |   ✅   |  ✅  |   —   |
| Lead esfriando (atingiu prazo da etapa)   |   ✅   |  ✅  |   —   |
| Tarefa programada chegou na hora          |   ✅   |  ✅  |   —   |
| Conexão WhatsApp caiu                     |   ✅   |  ✅  |  ✅   |
| Convite para workspace recebido           |   —    |  —   |  ✅   |
| Trial expirando em 2 dias                 |   ✅   |  ✅  |  ✅   |
| Pagamento falhou ou próximo do vencimento |   ✅   |  —   |  ✅   |
| Agente IA fez handoff para humano         |   ✅   |  ✅  |   —   |
| Disparo em massa terminou                 |   ✅   |  —   |   —   |

**Configuração de preferências:** o usuário pode ajustar canal por evento na tela de "Configurações > Notificações". Eventos administrativos (convite, pagamento) não podem ser desligados — são obrigatórios.

### 3.3. Onboarding do Usuário

**Welcome modal** ao primeiro login após cadastro:

- Mensagem de boas-vindas personalizada com nome do usuário.
- Resumo de 3 benefícios principais do produto.
- Botão "Começar agora" (inicia wizard) e botão "Pular por enquanto".

**Wizard de configuração inicial** (4 passos bloqueantes em sequência, com botão "Pular este passo" em cada um):

1. **Criar workspace:** nome da empresa + segmento (imobiliário / B2B / serviços / outro) + logotipo opcional.
2. **Conectar WhatsApp:** exibição de QR Code da uazapi com instruções visuais ("abra o WhatsApp no celular > Aparelhos conectados > Conectar"). Confirmação automática quando conexão é estabelecida.
3. **Criar primeiro agente IA:** seleção de template pré-configurado (qualificação SDR / atendimento genérico / recuperação de lead frio / personalizado em branco). Edição rápida do prompt antes de ativar.
4. **Importar leads:** upload de CSV com mapeamento visual de colunas (template downloadável) ou opção "Pular para depois".

Cada passo "pulado" fica marcado como pendente e aparece em destaque no dashboard até ser concluído.

### 3.4. Relatórios e Exportação

**Itens exportáveis no MVP** (formatos: CSV e Excel .xlsx):

- Lista de leads (com filtros aplicados)
- Negociações do pipeline (deals)
- Histórico de conversas WhatsApp por lead (apenas Owner e Admin, com log de quem exportou e quando, e cabeçalho de confidencialidade)
- Atividades e timeline por lead
- Relatório de performance por vendedor
- Relatório de funil (volume e valor por etapa)
- Relatório de origem dos leads (qual canal converte mais)
- Log de auditoria (LGPD)
- Dados completos do lead (LGPD - exportação sob demanda do titular)

**Regras gerais:**

- Exportações pesadas (>1.000 linhas) são processadas em background via Supabase Edge Function e enviadas por email com link de download (válido por 7 dias).
- Limite de 5 exportações simultâneas por workspace para evitar abuso.
- Toda exportação registrada no log de auditoria com usuário, timestamp e tipo.

### 3.5. Upload de Arquivos

**Contextos de upload no MVP:**

- **Avatar do usuário:** JPG, PNG, WEBP — até 2 MB.
- **Logo do workspace:** JPG, PNG, WEBP, SVG — até 2 MB.
- **Anexos no detalhe do lead:** contratos, propostas, fotos — até 10 MB por arquivo.
- **Base de conhecimento do agente IA:** PDF, DOC, DOCX, TXT, MD — até 10 MB por arquivo.
- **Importação CSV de leads:** até 10.000 linhas por importação.
- **Mídias enviadas/recebidas via WhatsApp:** JPG, PNG, MP4, MP3, OGG, PDF — limites do WhatsApp (16 MB para áudio/vídeo, 100 MB para documento).
- **Templates de proposta/contrato (versão MVP simplificada):** biblioteca de arquivos PDF/DOC estáticos por workspace, anexáveis ao WhatsApp/email com 1 clique. Sem editor de variáveis no MVP (vai para V2).

**Storage:** Supabase Storage com cleanup automático de mídias órfãs após 30 dias (lead deletado, conversa arquivada permanentemente).

**Limites totais por plano:**

- Plano Pro: 5 GB de storage por workspace.
- Plano Pro IA: 20 GB de storage por workspace.
- Plano Enterprise: limites elevados (sob consulta).

### 3.6. Busca e Filtros

**Buscas disponíveis no MVP:**

- **Busca por leads:** nome, telefone, email, empresa.
- **Busca dentro de conversas WhatsApp:** texto da mensagem (full-text search PostgreSQL).
- **Busca por negócios/deals:** título e valor.
- **Busca por tarefas:** descrição.
- **Busca na base de conhecimento do agente IA:** semântica via pgvector (também usada pelo agente para responder).

**Busca global (Cmd+K) fica para V2.**

**Filtros padrão por listagem:**

- **Lista de Leads:** status, etapa do funil, vendedor responsável, origem, tag, temperatura (quente/morno/frio), período de cadastro.
- **Kanban:** vendedor, origem, valor mínimo/máximo, tag.
- **Caixa WhatsApp:** vendedor, status (aguardando resposta / respondido / arquivado), etapa do funil, leads sem resposta há X dias.
- **Auditoria (Owner/Admin):** usuário, tipo de evento, período.

Filtros combináveis exibidos como **chips** acima da listagem (inspiração HubSpot).

### 3.7. Calendário e Tarefas

**Funcionalidades no MVP:**

- **Criação manual de tarefa** pelo vendedor.
- **Criação automática via cadência:** motor de cadência cria tarefa de follow-up automaticamente.
- **Visualização do calendário dentro do produto:** mês / semana / dia.
- **Integração bidirecional com Google Calendar:** OAuth, sincronização em até 2 minutos. Toda tarefa do CRM vira evento no calendário do vendedor; movimentações no calendário refletem no CRM.
- **Lembretes em horários específicos:** 15 minutos, 1 hora, 1 dia antes (configuráveis por tarefa).
- **Tarefas recorrentes:** regras configuráveis (toda segunda às 9h, todo dia 5, a cada 2 semanas) com edição "só esta" vs "todas as futuras".
- **Atribuição de tarefa para outro membro do time:** apenas Owner, Admin e Manager podem atribuir para outros. Notificação push + email para a pessoa atribuída. Tela "Tarefas Atribuídas a Mim" separada de "Minhas Tarefas".
- **Marcação de conclusão com notas:** vendedor termina ligação e registra ("ele pediu para retornar amanhã"). A nota vira atividade na timeline do lead.

**Tipos de tarefa:** Ligar, Enviar mensagem, Reunião, Enviar proposta, Follow-up, Outro.

**Status da tarefa:** Pendente, Em andamento, Concluída, Cancelada.

**Vinculação obrigatória:** toda tarefa deve estar vinculada a um lead ou negócio (tarefa solta não existe).

### 3.8. Chat / Mensagens (Caixa de WhatsApp)

**Funcionalidades de envio:**

- Envio de **texto + emoji**.
- Envio de **imagem/foto**.
- Envio de **áudio gravado no próprio CRM** (microfone via Web Audio API).
- Envio de **documento** (PDF, DOC).

**Funcionalidades de recebimento:**

- Recebimento de mídia (foto/áudio/doc) com preview inline.
- **Indicador de digitando** ("Fulano está digitando...") quando o cliente está digitando do lado dele.
- **Confirmação de leitura** (check duplo azul) quando o cliente lê a mensagem.

**Gestão da caixa:**

- **Respostas rápidas / templates:** botões com mensagens pré-prontas configuráveis por workspace ("Bom dia, em que posso ajudar?", "Vou verificar e te retorno", etc).
- **Marcar mensagem como não lida** para retornar depois.
- **Marcar conversa como resolvida/arquivada.**
- **Notas internas na conversa:** visíveis apenas para o time (não enviadas ao cliente). Aparecem com fundo amarelo na thread, marcadas com ícone de cadeado.

**Layout em 3 painéis:**

- Painel esquerdo: lista de conversas com filtros e busca.
- Painel central: thread da conversa atual.
- Painel direito: ficha do lead vinculado (etapa do funil, valor, dados de contato, timeline resumida, próxima tarefa).

**Atalhos de teclado:**

- Enter envia mensagem
- Shift+Enter quebra linha
- Setas ↑↓ navegam entre conversas
- Esc fecha thread atual

**Sincronização em tempo real** via Supabase Realtime. **Histórico paginado** carregando 50 mensagens por vez.

**Transferência de conversa entre vendedores e tradução automática ficam para V2/V3.**

### 3.9. Agentes de IA Configuráveis (Multi-agente)

- Múltiplos agentes IA por workspace com identidades, prompts e regras de roteamento independentes.
- Limite no MVP: até 3 agentes ativos por workspace no plano Pro IA.
- Casos de uso suportados: agente de qualificação (SDR), agente de atendimento, agente de recuperação de lead frio, agente especialista por produto/linha de negócio.
- Configuração de cada agente por prompt em linguagem natural: nome, persona, tom de voz, regras de negócio, gatilhos de handoff.

**Roteamento entre agentes** (qual agente atende qual lead/conversa):

- Por **etapa do funil**: cada etapa pode ter um agente designado.
- Por **tag do lead**: admin define regras manuais.
- Por **número WhatsApp conectado**: cada número pode ter um agente padrão.
- Por **palavra-chave configurável**.

**Base de conhecimento compartilhada por workspace ("Cérebro da Empresa"):**

- Campos estruturados: sobre a empresa, produtos com preços, FAQ, scripts de objeção, política.
- Upload de arquivos (PDF, DOC, TXT) processados em embeddings via pgvector para busca semântica.
- Versionamento e rollback de mudanças.
- Cada agente acessa toda a base, mas o prompt define qual parte é prioritária.

**Identidade e prompt isolados por agente** (cada agente tem sua persona).

**Memória em três camadas:**

- **Sessão:** últimas mensagens da conversa atual no contexto direto, isolada por agente.
- **Lead:** ficha consolidada do lead atualizada via resumo automático após cada interação, compartilhada entre todos os agentes do workspace.
- **Empresa:** base de conhecimento permanente recuperada por relevância semântica, compartilhada.

**Handoff entre agentes IA** (não apenas IA → humano):

- Agente A pode passar conversa para agente B mediante gatilho de palavra-chave, mudança de etapa do funil ou comando explícito no prompt.
- Resumo automático do contexto entregue ao agente seguinte (perfil, demandas, etapa).
- Pausa do agente anterior para evitar duplicidade de resposta.

**Handoff humano com múltiplos gatilhos** (mantém-se em todos os agentes):

- Manual via botão "Assumir conversa" no painel do vendedor.
- Por palavra-chave configurável (atendente, humano, vendedor).
- Por intenção comercial detectada (quero contratar, quanto fica, como pago).
- Por etapa do funil (handoff automático ao avançar para Negociação).
- Por horário comercial (bot atende fora do expediente, humano dentro).

**Pausa automática de qualquer agente após handoff humano** para evitar duplicidade.

**Resumo automático entregue ao vendedor:** perfil do lead, demandas, etapa do funil, próxima ação sugerida, qual agente vinha atendendo.

**Interface de gestão de agentes:**

- Aba dedicada "Agentes IA" no painel do workspace.
- Lista de agentes com status (ativo / inativo / em teste), número de conversas atendidas, taxa de handoff.
- Botão "Criar novo agente" com templates pré-configurados (qualificação, atendimento, recuperação).
- Editor de prompt com preview e teste em chat de simulação antes de ativar.
- Versionamento e rollback do prompt de cada agente.
- Métricas por agente: total de conversas, taxa de resolução sem handoff, tempo médio de resposta, satisfação inferida.

### 3.10. Landing Page

**Estrutura completa (8 seções):**

1. **Hero** — proposta de valor + CTA principal de trial.
2. **Seção de Problema** — estatísticas que assustam (48% nunca fazem follow-up, 80% das vendas exigem 5+ tentativas).
3. **Seção de Funcionalidades** — o que o produto faz para resolver o problema.
4. **Demo em vídeo** — vídeo de 60-90s mostrando Kanban + WhatsApp + agente IA em ação.
5. **Calculadora de ROI** — calculadora honesta baseada em dados públicos (Reev, Invesp, Close.com): cliente informa volume de leads/mês e ticket médio, calculadora mostra estimativa de receita recuperada com cadência estruturada.
6. **Tabela de planos e preços** — Pro / Pro IA / Enterprise.
7. **FAQ** — destrava últimas objeções (LGPD, troca de plano, cancelamento, segurança, suporte).
8. **CTA final + formulário de trial** — cadastro com email, senha, nome da empresa.

**Botão WhatsApp flutuante** para falar com vendas (coerência: vendemos CRM com WhatsApp, atendemos pelo WhatsApp).

**Especificações técnicas:**

- Performance: Lighthouse 90+ (Vercel entrega).
- SEO: meta tags por seção, schema.org, sitemap.xml automático (Next.js).
- Pixel de tracking: Meta Pixel + Google Analytics 4.
- Hosting: Vercel.
- Domínio: raiz (ex: `pipeflow.com.br`) → landing; `app.pipeflow.com.br` → produto.

### 3.11. Gestão de Workspace e Colaboração

- Criar workspace com nome, segmento, logotipo opcional.
- Convidar colaboradores por email via Resend, com aceite por magic link.
- Alternar entre workspaces via dropdown na sidebar.
- Sair de um workspace.
- Transferir propriedade do workspace (apenas Owner).
- Suspender/excluir workspace (apenas Owner, com confirmação dupla).
- Isolamento absoluto de dados via Row Level Security (RLS) Supabase.

### 3.12. Gestão de Plano e Billing (Stripe)

- Tela "Plano e Faturamento" acessível apenas pelo Owner.
- Visualização do plano atual, próxima cobrança, método de pagamento.
- Upgrade/downgrade de plano com Stripe Checkout.
- Acesso ao Customer Portal do Stripe para atualizar cartão, baixar faturas, cancelar assinatura.
- Webhook do Stripe → Supabase Edge Function que ativa/desativa plano automaticamente.
- Bloqueio progressivo após cancelamento: acesso de leitura por 30 dias antes da exclusão de dados.

---

## 4. PERSONA E TIPOS DE USUÁRIOS

### Visão Geral

O produto atende quatro personas principais. É importante distinguir **persona** (perfil humano real do usuário) de **papel no sistema** (permissão técnica de RBAC). Um Gestor de Vendas e um Dono de SMB podem ter o mesmo papel "Admin" no RBAC, mas têm comportamentos, dores e motivações distintas.

### Persona 1 — Dono de SMB / Empreendedor

- **Quem é:** dono de pequena ou média empresa que opera com vendas consultivas, ciclo médio ou longo e WhatsApp como canal principal de relacionamento.
- **Contexto típico:** dono de imobiliária pequena, dono de consultoria B2B, dono de loja de produtos de alto ticket, corretor que abriu seu próprio negócio. Equipe de 1 a 10 pessoas. Faturamento entre R$ 50 mil e R$ 1 milhão/mês. Geralmente opera vendendo também (player-coach), e não tem tempo nem dinheiro para implantar HubSpot ou Salesforce.
- **Papel no sistema:** Owner.
- **Principais dores:**
  - Vê negócios sumindo no pipeline sem entender por quê
  - Não sabe em qual etapa do funil os leads estão travando
  - Time desorganizado, cada vendedor com seu próprio "sistema" (planilha, caderno, WhatsApp pessoal)
  - Quando vendedor sai da empresa, leva os leads no celular pessoal
  - Tentou Pipedrive ou HubSpot e desistiu por complexidade ou preço
- **Motivações:**
  - Aumentar a taxa de conversão sem aumentar o volume de leads
  - Profissionalizar a operação para parecer maior do que é
  - Ganhar visibilidade total do funil sem precisar perguntar para cada vendedor
  - Escalar a operação sem precisar contratar mais gente imediatamente
- **Como usa o produto:** cria o workspace, convida o time, configura cadências e agentes IA, acompanha o dashboard semanalmente, atende como vendedor quando necessário, gerencia o plano e a assinatura.
- **Frequência e dispositivo:** uso diário, alterna entre desktop (configuração e análise) e celular via PWA (operação no campo).

### Persona 2 — Gestor de Vendas / Coordenador Comercial

- **Quem é:** profissional contratado para liderar a equipe comercial em times de 5 a 15 vendedores. Não é dono, é responsável pela meta do time.
- **Contexto típico:** gerente comercial em imobiliária média, head de vendas em SaaS de pequeno porte, coordenador de SDRs. Reporta para o dono ou para a diretoria. Tem experiência em vendas e sabe ler dashboards.
- **Papel no sistema:** Admin (ou Manager se quiser ver todos os leads do time mas sem mexer em configurações sensíveis).
- **Principais dores:**
  - Não consegue ver quem está fazendo o quê em tempo real
  - Vendedores reclamam que processo manual atrapalha as vendas
  - Bate meta às custas de pressão, não de processo
  - Identifica gargalos do funil tarde demais (depois do mês fechado)
  - Não tem como treinar vendedor com base em dados reais de conversa
- **Motivações:**
  - Bater a meta do time e individual de cada vendedor
  - Identificar gargalos do funil em tempo de corrigir
  - Padronizar o processo e o discurso da equipe
  - Mostrar resultado e visibilidade para a diretoria
- **Como usa o produto:** acompanha pipeline e dashboard diariamente, configura cadências e templates de mensagem, monitora atividade individual de cada vendedor, ajusta o agente IA com base no que vê na caixa de entrada unificada, reatribui leads, faz coaching baseado no histórico de conversas.
- **Frequência e dispositivo:** uso intenso e diário, principalmente desktop (visão analítica), com PWA para alertas e respostas pontuais.

### Persona 3 — Vendedor / Corretor / Consultor

- **Quem é:** profissional de vendas que opera no campo, com forte relacionamento via WhatsApp.
- **Contexto típico:** corretor de imóveis em incorporadora ou imobiliária, consultor B2B, vendedor de alto ticket. Trabalha com 30 a 100 leads ativos simultaneamente. Está em obra, em apartamento, em reunião externa, em trânsito. Celular é o principal dispositivo de trabalho.
- **Papel no sistema:** Vendedor.
- **Principais dores:**
  - Tem dezenas de conversas no WhatsApp e perde follow-up
  - Esquece de retornar no momento certo e perde o negócio
  - Sente que ferramentas de CRM "engessam" e atrapalham a venda
  - Odeia digitar relatório no fim do dia
  - Tem medo de "perder" o lead se ele entrar em sistema que outro vendedor pode acessar
- **Motivações:**
  - Bater a meta pessoal e ganhar comissão
  - Fechar mais negócios com o mesmo volume de leads
  - Liberar tempo para vender (e menos para administrar)
  - Ter alertas que evitam esquecimento sem virar vigilância
- **Como usa o produto:** recebe leads atribuídos automaticamente, movimenta cards no Kanban durante o dia, responde WhatsApp pela caixa de entrada do CRM, recebe lembretes de tarefa no celular, vê quais dos seus leads estão esfriando e precisa retomar.
- **Frequência e dispositivo:** uso intenso e diário, predominantemente celular via PWA, com push notifications ativas.

### Persona 4 — Freelancer / Consultor Solo

- **Quem é:** profissional independente que atende múltiplos clientes ou projetos simultaneamente.
- **Contexto típico:** consultor de vendas, consultor de marketing, agência boutique de 1 a 3 pessoas, social media manager que gerencia leads de clientes, especialista que opera vendas para terceiros como serviço.
- **Papel no sistema:** Owner em múltiplos workspaces.
- **Principais dores:**
  - Precisa separar dados de cada cliente sem misturar
  - Cada cliente quer ver o próprio pipeline sem ver o dos outros
  - Compliance LGPD é responsabilidade dele, mesmo operando dados do cliente
  - Ferramentas atuais cobram por workspace e ficam caras
- **Motivações:**
  - Profissionalizar a entrega para clientes
  - Escalar atendimento sem contratar
  - Demonstrar valor com dashboards próprios para cada cliente
  - Manter conformidade legal e contratual
- **Como usa o produto:** cria um workspace por cliente, opera todos os workspaces sozinho ou convida o cliente como Admin do próprio workspace, alterna rapidamente entre workspaces via dropdown na sidebar, usa o mesmo login para acessar todos.
- **Frequência e dispositivo:** uso diário, predominantemente desktop, com PWA para mobilidade.

### Resumo dos Papéis no Sistema (RBAC)

| Persona                                       | Papel RBAC                    | Pode ver                                                                                 |
| --------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| Dono de SMB                                   | Owner                         | Tudo + billing + transferência de propriedade                                            |
| Gestor de Vendas (com billing)                | Admin                         | Tudo, exceto billing                                                                     |
| Gestor de Vendas (sem mexer em config)        | Manager                       | Todos os leads do time, edita pipeline e cadências, não convida usuários                 |
| Vendedor / Corretor                           | Vendedor                      | Apenas seus próprios leads (com flag opcional de transparência total ativada pelo Admin) |
| Stakeholder passivo (sócio, mentor, contador) | Viewer                        | Somente leitura                                                                          |
| Freelancer / Consultor Solo                   | Owner em múltiplos workspaces | Tudo do workspace, dados isolados entre workspaces via RLS                               |

### Anti-personas (quem o produto NÃO atende no MVP)

Definir quem o produto não atende é tão importante quanto definir quem atende. As seguintes audiências ficam fora do escopo do MVP e do plano comercial:

- **Empresas com mais de 50 vendedores:** demandam recursos enterprise (SSO corporativo, integrações ERP, customizações avançadas) que não cabem no MVP.
- **E-commerce de baixo ticket e alto volume (B2C):** ciclo de venda é curto, WhatsApp não é canal central de relacionamento, melhor atendido por ferramentas de automação de marketing.
- **Operações puramente inbound digitais (sem WhatsApp):** o diferencial do produto é a integração com WhatsApp; sem isso, o cliente é melhor atendido por HubSpot ou RD Station.
- **Times de pré-vendas (SDR) puros sem operação de fechamento:** o produto é desenhado para o ciclo completo (do lead ao fechamento), não apenas para qualificação.
- **Empresas que exigem instalação on-premise ou self-hosted:** o produto é cloud-only no MVP.

---

## 5. STACK TECNOLÓGICA

- **Linguagem:** TypeScript 5 — Gratuito.
- **Frontend:** Next.js 14 (App Router) + React 18 + Tailwind CSS + shadcn/ui — Gratuito.
- **Backend/API:** Next.js API Routes (Server Components) + Supabase Edge Functions — Gratuito.
- **ORM:** Prisma — Gratuito (open source).
- **Banco de Dados + Auth + Storage + Realtime:** Supabase (PostgreSQL + Auth + Storage + Realtime + pgvector + pg_cron) — Free tier gratuito / Pro US$ 25/mês.
- **WhatsApp API:** uazapi (não-oficial, baseado em Whatsmeow) — ~R$ 30/número/mês.
- **WhatsApp Oficial (V2 Enterprise):** WhatsApp Cloud API Meta — pay-per-use (~R$ 0,10 a R$ 0,30 por conversa).
- **IA / Agentes:** Anthropic Claude API (Sonnet) — pay-per-use (~US$ 3/M tokens input, US$ 15/M tokens output).
- **Embeddings:** OpenAI text-embedding-3-small — pay-per-use (US$ 0,02/M tokens).
- **Pagamentos:** Stripe Checkout + Customer Portal + Webhooks — sem mensalidade (taxa 3,99% + R$ 0,39 por transação).
- **Email transacional:** Resend — Free tier 100 e-mails/dia / Pro US$ 20/mês (50.000 e-mails).
- **Drag-and-drop:** @dnd-kit — Gratuito (open source).
- **Gráficos:** Recharts — Gratuito (open source).
- **Formulários e validação:** React Hook Form + Zod — Gratuito (open source).
- **Cache e sync de dados:** TanStack Query — Gratuito (open source).
- **Datas:** date-fns — Gratuito (open source).
- **Notificações in-app:** react-hot-toast — Gratuito (open source).
- **Ícones:** Lucide React — Gratuito (open source).
- **Push Notifications (PWA):** Web Push API + VAPID keys + Service Worker — Gratuito.
- **Monitoramento de erros:** Sentry — Free tier 5.000 erros/mês / Team US$ 26/mês.
- **Analytics de produto:** PostHog — Free tier 1M eventos/mês.
- **Performance:** Vercel Analytics — incluso no Vercel Pro.
- **Versionamento:** Git + GitHub — Gratuito (repositório privado ilimitado).
- **CI/CD:** GitHub Actions — Gratuito (2.000 minutos/mês).
- **Deploy Frontend:** Vercel — Free tier para dev / Pro US$ 20/mês.
- **Deploy Backend/DB:** Supabase Cloud (região São Paulo) — coberto pelo plano Supabase Pro.
- **Domínio:** Registro.br (.com.br) — ~R$ 50/ano.
- **SSL/TLS:** automático via Vercel — Gratuito.
- **IDE:** Cursor com Claude Code no Terminal — Anthropic Pro US$ 20/mês.
- **Cliente PostgreSQL:** TablePlus ou DBeaver — Gratuito.
- **Testes de API:** Postman ou Insomnia — Gratuito.

### Custo Total Estimado da Operação

**Custos fixos mensais (independente do número de clientes):**

| Item                                 | Custo mensal      |
| ------------------------------------ | ----------------- |
| Supabase Pro                         | US$ 25 (~R$ 137)  |
| Vercel Pro                           | US$ 20 (~R$ 110)  |
| Anthropic Pro (Cursor + Claude Code) | US$ 20 (~R$ 110)  |
| Sentry Team                          | US$ 26 (~R$ 143)  |
| Resend Pro                           | US$ 20 (~R$ 110)  |
| Domínio .com.br                      | ~R$ 5 (R$ 50/ano) |
| **Total fixo**                       | **~R$ 615/mês**   |

**Custos variáveis por workspace ativo:**

| Item                                         | Custo unitário                                  |
| -------------------------------------------- | ----------------------------------------------- |
| uazapi (1 número WhatsApp)                   | ~R$ 30/mês                                      |
| Anthropic Claude API                         | US$ 5 a US$ 30/mês conforme volume de conversas |
| OpenAI Embeddings                            | <US$ 1/mês (uso típico)                         |
| Supabase compute extra (após ~50 workspaces) | US$ 10 a US$ 50/mês                             |
| Stripe (taxa por transação)                  | 3,99% + R$ 0,39 sobre faturamento               |

**Cenário de breakeven estimado:**

- 10 clientes pagantes (5 Pro + 5 Pro IA): receita bruta ~R$ 3.470/mês
- Custo operacional total estimado: ~R$ 1.200/mês
- Margem operacional: ~65% antes de impostos e taxas Stripe

---

## 6. REFERÊNCIAS DE DESIGN

### Visão Geral

A identidade visual do produto se inspira em três referências principais e três complementares, combinando a robustez de CRMs estabelecidos com a leveza de ferramentas modernas. O objetivo é entregar um produto que tenha a densidade de informação esperada de uma ferramenta de vendas séria, sem o peso visual e a curva de aprendizado de softwares corporativos legados. A linguagem visual é direta, brasileira e orientada a ação — refletindo o perfil do time comercial SMB que opera com WhatsApp como canal central.

### Referências Principais

#### HubSpot CRM

**Referência de:** sistema de design e arquitetura de informação.

HubSpot é o benchmark global em consistência de UI para CRM. Tem mais de 189 componentes em seu UI Kit, com tokens de tipografia, cores e layout que escalam bem entre web e mobile.

**O que pegar:**

- Layout de página de detalhe do lead com timeline cronológica unificada e cards laterais para metadados
- Densidade de informação equilibrada (mostra muito sem parecer poluído)
- Padrão de navegação por sidebar fixa com ícones e labels claros
- Componentes acessíveis e responsivos para web e mobile
- Filtros combináveis com chips visíveis acima das listagens

**O que NÃO pegar:**

- Excesso de configurações expostas para o usuário final (overwhelm)
- Curva de aprendizado longa por excesso de funcionalidades visíveis simultaneamente
- Visual corporativo "americano" com muito espaço vazio que reduz densidade útil

#### Pipedrive

**Referência de:** Kanban visual e fluxo de ação.

Pipedrive é referência mundial em pipeline visual drag-and-drop e em "activity-based selling" — o produto inteiro gira em torno do board Kanban e de atividades vinculadas a cada deal.

**O que pegar:**

- Visual do Kanban com colunas claras, cards densos e drag-and-drop fluido
- Indicadores de "deal rotting" (negócio esfriando) com cores e ícones diretos no card
- Top bar com múltiplas visualizações alternáveis (Kanban, lista, forecast, timeline)
- Sorting por próxima atividade (vermelho atrasado, amarelo próximo, verde do dia, cinza sem atividade) — aplicar diretamente nos cards do nosso Kanban
- Ação rápida nos cards sem precisar abrir página de detalhe

**O que NÃO pegar:**

- Navegação com múltiplos tabs e subtabs que confunde usuários novos
- Algumas telas com excesso de modais sobrepostos
- Tema padrão claro sem alternativa real de dark mode robusto

#### DataCrazy

**Referência de:** linguagem, tom de voz e posicionamento brasileiro.

DataCrazy é um CRM brasileiro de Balneário Camboriú que se posiciona como "máquina de vendas com IA". É a referência mais próxima do nosso mercado-alvo, com excelente tradução cultural para o vendedor brasileiro.

**O que pegar:**

- Comunicação descontraída e próxima do dia a dia do vendedor brasileiro
- Posicionamento claro como ferramenta de performance comercial, não apenas registro de dados
- Foco no WhatsApp como canal central, não como integração secundária
- Estrutura de planos simples e acessível para SMBs (Starter, Essential, Pro)
- Linguagem de venda focada em resultado mensurável (LTV, CAC, taxa de conversão por origem, vendedor e produto)

**O que NÃO pegar:**

- Excesso de recursos prometidos ao mesmo tempo (BI + automação + chatbot + multiatendimento + tarefas) que confunde proposta de valor
- Site ainda em construção em várias seções, comunicando imaturidade do produto
- Visual de marketing exagerado em algumas telas que pode parecer agressivo demais para perfis mais formais

### Referências Complementares (Modernidade Visual)

#### Attio

**Referência de:** estética 2026 e densidade elegante.

Attio é o CRM mais bonito do mercado atual, com visual minimalista, tipografia moderna e tabelas inspiradas em planilhas modernas tipo Notion. É a referência principal para o design visual do nosso produto sair do padrão "CRM corporativo americano" e adotar uma linguagem mais 2026.

**O que pegar:**

- Paleta neutra e sofisticada com acentos de cor controlados
- Tipografia Inter ou similar, com hierarquia clara e espaçamento generoso
- Cards e tabelas com bordas suaves e sombras sutis (não brutalistas)
- Microinterações refinadas (hover states, transições de 200ms a 300ms)
- Uso inteligente de espaço vazio para reduzir cansaço visual

#### Linear

**Referência de:** velocidade percebida e atalhos de teclado.

Linear redefiniu o padrão de SaaS B2B em velocidade de interação. É a referência para como nossos vendedores devem se sentir usando o produto: rápido, fluido, com atalhos.

**O que pegar:**

- Comando rápido (Cmd+K) para abrir lead, criar tarefa, mudar etapa do funil sem usar o mouse
- Animações sutis que comunicam progresso sem distrair
- Estados de loading otimistas (interface responde antes do servidor confirmar)
- Dark mode tratado como padrão, não como feature secundária
- Densidade de informação alta sem visual sobrecarregado

#### Notion

**Referência de:** flexibilidade e simplicidade na configuração.

Notion ensinou o mercado SaaS como criar interfaces flexíveis sem virar "configuração de servidor". Para a tela de configuração do agente IA e da base de conhecimento ("Cérebro do Agente"), Notion é a referência direta.

**O que pegar:**

- Editor inline para campos de texto longo (descrição da empresa, scripts, FAQ)
- Blocos arrastáveis para organização do conhecimento
- Slash commands para ações rápidas dentro de campos de texto
- Templates pré-configurados que aceleram primeiro uso
- Sensação de "documento vivo" para a base de conhecimento, não formulário burocrático

### Diretrizes Visuais Consolidadas

**Paleta de cores principal:**

- Cor primária (CTAs, navegação ativa, links): azul indigo profundo (#4F46E5 ou similar)
- Cor de apoio (destaque secundário): roxo/índigo (#6C5CE7)
- Neutros: cinza escuro (#0F172A), cinza médio (#475569), cinza claro (#F1F5F9), branco
- Estados:
  - Verde (#10B981) para sucesso, lead quente, conexão ativa
  - Amarelo (#F59E0B) para atenção, lead morno, conexão instável
  - Vermelho (#EF4444) para alerta, lead frio, desconectado
  - Azul (#3B82F6) para informação neutra
- Dark mode tratado como tema de primeira classe, não opção secundária

**Tipografia:**

- Inter ou Geist Sans para interface (open source, gratuita, alta legibilidade em telas)
- Hierarquia clara: títulos em 18-24px, body em 14-16px, captions em 12px
- Peso 600 para títulos, 500 para destaques, 400 para body

**Espaçamento e layout:**

- Sistema de spacing baseado em múltiplos de 4px (4, 8, 12, 16, 24, 32, 48, 64)
- Cards com border-radius de 8 a 12px
- Sombras sutis (elevation discreta, sem efeito brutalista)
- Sidebar fixa em 240px com ícones e labels
- Breakpoints: mobile 320-768, tablet 768-1024, desktop 1024+

**Componentes-chave:**

- shadcn/ui como base do design system, customizado com tokens próprios
- Lucide Icons para iconografia consistente
- Recharts para gráficos do dashboard
- Tabelas densas estilo planilha moderna (inspiração Attio) para listagens
- Cards de Kanban com indicador visual de temperatura no canto superior

**Tom de voz e microcopy:**

- Linguagem direta e brasileira, sem traduções literais de inglês
- Microcopy próxima ao vendedor (inspiração DataCrazy), sem ser informal demais
- Mensagens de erro úteis e propositivas, não genéricas
- CTAs em verbo de ação no infinitivo ("Adicionar lead", "Conectar WhatsApp", "Criar agente")
- Confirmações curtas e claras ("Lead criado", "Cadência ativada", "Agente em teste")

**Princípios de UX:**

- Mostrar status visualmente sempre que possível (cores e ícones, não só texto)
- Reduzir cliques para ações frequentes (drag-and-drop, atalhos de teclado, ações rápidas no card)
- Estado vazio (empty state) tratado com carinho — sempre orientar o próximo passo
- Onboarding contextual e progressivo, não tutorial bloqueante
- Mobile-first nas telas que vendedor usa em campo (Kanban, detalhe do lead, caixa WhatsApp)
- Performance percebida acima da performance real — interface responde antes do servidor

**Inspiração de comunicação visual:**

- Densidade alta (HubSpot) com elegância visual (Attio)
- Velocidade fluida (Linear) com flexibilidade de configuração (Notion)
- Tom brasileiro e direto (DataCrazy) com Kanban best-in-class (Pipedrive)

---

## 7. PROCESSO DE DESENVOLVIMENTO

- Cronograma alvo: **120 dias** até MVP em produção.
- Quebrar a construção em milestones lógicos com entregas incrementais.
- Priorizar funcionalidade core primeiro (auth, multi-empresa, kanban, WhatsApp), depois iterar (cadências, IA, billing, polimento).
- Testar cada milestone antes de seguir para o próximo.
- Sprints quinzenais com escopo bloqueado.
- Marco de validação intermediário: lançar fechado para 5-10 usuários antes de abrir trial público.
