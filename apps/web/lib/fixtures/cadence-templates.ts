/**
 * Templates pré-configurados de cadência (PRD §2.2).
 *
 * Três cadências prontas pra ativar em 1 clique no onboarding e no dialog
 * de criação. **Texto em pt-BR realista** — vende a feature na demo de M5
 * e fica pronto pra ser seedado no banco em M10 sem retrabalho.
 *
 * Convenções do copy:
 *  - Voz brasileira direta (CLAUDE.md §5 / §8 — "DataCrazy").
 *  - Tom propositivo, sem cobrança ("sem pressa, sem pressão").
 *  - Placeholders `{nome}`, `{empresa}`, `{produto}` resolvidos em runtime
 *    pela Edge Function de M10 (PRD §2.2).
 *  - Mensagens curtas no início (alta fricção), maiores quando o lead
 *    "ganha" o follow-up (D+7+).
 *  - WhatsApp domina o início; email entra pra material e despedida.
 */
import type { CadenceTemplate } from '@/features/cadences/types';

/**
 * Imobiliário — corretores e imobiliárias. 6 passos em ~30 dias.
 * Etapa default: Novo (lead acabou de demonstrar interesse num imóvel).
 */
const IMOBILIARIO: CadenceTemplate = {
  key: 'imobiliario',
  label: 'Imobiliário',
  iconKey: 'home',
  description: 'Acompanha o lead do interesse à visita sem deixar esfriar.',
  recommendedFor: 'Corretores autônomos e imobiliárias',
  defaultStageId: 'novo',
  steps: [
    {
      dayOffset: 0,
      channel: 'whatsapp',
      templateBody:
        'Olá {nome}, aqui é da {empresa}. Vi que você se interessou pelo {produto} e queria entender melhor o que está procurando — fala comigo o que faz mais sentido pra sua família?',
      order: 0,
    },
    {
      dayOffset: 1,
      channel: 'whatsapp',
      templateBody:
        'Bom dia, {nome}! Conseguiu pensar sobre o que conversamos? Se quiser, posso enviar mais fotos e a planta do {produto} pra você dar uma olhada com calma.',
      order: 0,
    },
    {
      dayOffset: 3,
      channel: 'email',
      templateBody:
        '{nome}, separei algumas opções parecidas com o {produto} pra você comparar lado a lado. Anexei o material aqui no email — qualquer dúvida me chama no WhatsApp que eu respondo rápido.',
      order: 0,
    },
    {
      dayOffset: 7,
      channel: 'whatsapp',
      templateBody:
        'Oi {nome}, faz uma semana que falamos sobre o {produto}. Posso agendar uma visita pra você ver pessoalmente? Tenho horários abertos essa semana e na próxima.',
      order: 0,
    },
    {
      dayOffset: 14,
      channel: 'whatsapp',
      templateBody:
        '{nome}, passando aqui pra ver se posso ajudar em alguma coisa. Se mudou de ideia sobre o {produto} ou prefere outro tipo de imóvel, é só me avisar — tenho várias opções no portfólio.',
      order: 0,
    },
    {
      dayOffset: 30,
      channel: 'email',
      templateBody:
        '{nome}, voltei a falar porque chegaram novos imóveis no perfil que você procurava. Vale dar uma olhada quando puder — alguns saem rápido. Te respondo no WhatsApp também se preferir.',
      order: 0,
    },
  ],
};

/**
 * B2B Consultivo — vendas de serviços/SaaS, ciclo de 14–30 dias.
 * Etapa default: Em contato (já houve primeira interação, agora precisa qualificar).
 */
const B2B: CadenceTemplate = {
  key: 'b2b',
  label: 'B2B Consultivo',
  iconKey: 'briefcase',
  description: 'Qualifica e nutre decisores B2B com tom consultivo.',
  recommendedFor: 'Vendas de serviços, software ou consultoria',
  defaultStageId: 'em_contato',
  steps: [
    {
      dayOffset: 0,
      channel: 'email',
      templateBody:
        'Oi {nome}, vi que vocês da {empresa} entraram em contato. Sou consultivo, prefiro entender o cenário antes de mandar proposta — quando rola uma conversa de 15 min essa semana?',
      order: 0,
    },
    {
      dayOffset: 1,
      channel: 'whatsapp',
      templateBody:
        'Bom dia {nome}! Mandei email ontem mas o WhatsApp costuma ser mais ágil. Tem 15 min essa semana pra eu entender como vocês trabalham hoje na {empresa}?',
      order: 0,
    },
    {
      dayOffset: 3,
      channel: 'whatsapp',
      templateBody:
        '{nome}, separei um case rápido de uma empresa parecida com a {empresa} que pode te dar contexto sobre o {produto}. Te envio? São 2 páginas, leitura de café.',
      order: 0,
    },
    {
      dayOffset: 7,
      channel: 'email',
      templateBody:
        'Oi {nome}, sei que a agenda aperta. Deixei aqui um material sobre como abordamos {produto} — leva 5 min de leitura. Quando voltar das corridas, fala comigo que a gente conversa.',
      order: 0,
    },
    {
      dayOffset: 14,
      channel: 'whatsapp',
      templateBody:
        '{nome}, vou parar de insistir aqui, mas se mudar a prioridade na {empresa} é só me chamar — fico à disposição. Boa quinta!',
      order: 0,
    },
  ],
};

/**
 * Alto Ticket — vendas premium de ciclo longo (60+ dias).
 * Etapa default: Proposta (alto ticket geralmente passa rápido por
 * "novo"/"em_contato" e o follow-up crítico é depois da proposta).
 */
const ALTO_TICKET: CadenceTemplate = {
  key: 'alto-ticket',
  label: 'Alto Ticket',
  iconKey: 'gem',
  description: 'Cadência calma para decisões de alto valor e ciclo longo.',
  recommendedFor: 'Vendas premium, ticket acima de R$ 50 mil',
  defaultStageId: 'proposta',
  steps: [
    {
      dayOffset: 0,
      channel: 'whatsapp',
      templateBody:
        'Boa tarde, {nome}. Sei que decisões desse porte sobre o {produto} merecem tempo. Estou aqui pra esclarecer o que precisar — sem pressa, sem pressão.',
      order: 0,
    },
    {
      dayOffset: 1,
      channel: 'whatsapp',
      templateBody:
        '{nome}, dormiu bem com a ideia? Posso adiantar alguma dúvida específica antes de você bater o martelo? Conta comigo pra qualquer detalhe.',
      order: 0,
    },
    {
      dayOffset: 3,
      channel: 'whatsapp',
      templateBody:
        'Oi {nome}, separei dois casos de clientes que passaram por essa mesma decisão sobre {produto}. Se quiser, te conecto com um deles pra conversar diretamente — costuma ajudar bastante.',
      order: 0,
    },
    {
      dayOffset: 7,
      channel: 'whatsapp',
      templateBody:
        '{nome}, faz uma semana. Imagino que esteja avaliando alternativas — totalmente normal. Se quiser que eu prepare uma comparação lado a lado com o {produto}, me avisa.',
      order: 0,
    },
    {
      dayOffset: 14,
      channel: 'whatsapp',
      templateBody:
        'Oi {nome}, sem cobrança. Só queria saber se está fazendo sentido continuarmos a conversa sobre o {produto} ou se prefere que eu volte a falar mais pra frente.',
      order: 0,
    },
    {
      dayOffset: 30,
      channel: 'whatsapp',
      templateBody:
        '{nome}, voltei aqui um mês depois pra reabrir o canal. Se a janela voltar a fazer sentido na {empresa}, é só me chamar — vamos do seu jeito, no seu tempo.',
      order: 0,
    },
  ],
};

/** Em branco — usuário monta do zero. Default sugere "Novo". */
const BLANK: CadenceTemplate = {
  key: 'blank',
  label: 'Em branco',
  iconKey: 'square-pen',
  description: 'Comece do zero e desenhe sua própria sequência.',
  recommendedFor: 'Quando você já tem cadência mental e quer só ferramenta',
  defaultStageId: 'novo',
  steps: [],
};

export const CADENCE_TEMPLATES: CadenceTemplate[] = [IMOBILIARIO, B2B, ALTO_TICKET, BLANK];

/** Helper de lookup para o store popular steps no createCadence. */
export function getTemplate(key: string): CadenceTemplate | undefined {
  return CADENCE_TEMPLATES.find((t) => t.key === key);
}
