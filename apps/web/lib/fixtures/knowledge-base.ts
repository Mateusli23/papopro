/**
 * Cérebro da Empresa mockado (PRD §3.9 — base de conhecimento compartilhada).
 *
 * 5 seções estruturadas + 3 arquivos exemplo. Conteúdo realista pt-BR de uma
 * imobiliária fictícia ("Lar Brasil"), pra a demo de M5 mostrar como o Cérebro
 * alimenta os 3 agentes da fixture (Sofia/Léo/Bia).
 *
 * Em M11 substituído por:
 *  - `SELECT * FROM knowledge_base_fields WHERE workspace_id = ?`
 *  - `SELECT * FROM knowledge_documents WHERE workspace_id = ?`
 *
 * **Não lemos conteúdo de arquivo no mock** — guardamos só metadata
 * (`name`/`size`/`kind`) que vai pro `KnowledgeFile`. Em M11 entra extração
 * de texto + chunking + embeddings via pgvector.
 */
import { subDays } from 'date-fns';

import type { KnowledgeBase, KnowledgeFile } from '@/features/agents/types';

const NOW = new Date('2026-05-09T14:00:00-03:00');
const WORKSPACE = 'ws_demo';

let FILE_ID = 0;
function nextFileId(): string {
  FILE_ID += 1;
  return `kbf_${FILE_ID.toString().padStart(5, '0')}`;
}

const FILES: KnowledgeFile[] = [
  {
    id: nextFileId(),
    name: 'institucional-lar-brasil.pdf',
    sizeBytes: 1_847_293,
    kind: 'pdf',
    status: 'processed',
    uploadedAt: subDays(NOW, 28).toISOString(),
  },
  {
    id: nextFileId(),
    name: 'scripts-objeções-2026.docx',
    sizeBytes: 312_540,
    kind: 'doc',
    status: 'processed',
    uploadedAt: subDays(NOW, 14).toISOString(),
  },
  {
    id: nextFileId(),
    name: 'politica-comercial-q2.pdf',
    sizeBytes: 524_188,
    kind: 'pdf',
    status: 'processed',
    uploadedAt: subDays(NOW, 6).toISOString(),
  },
];

export const FAKE_KNOWLEDGE_BASE: KnowledgeBase = {
  workspaceId: WORKSPACE,
  about: `Somos a Lar Brasil, imobiliária boutique fundada em 2014 em São Paulo. Atendemos clientes que buscam imóveis residenciais e comerciais nas zonas Sul e Oeste de SP, com ticket médio de R$ 850 mil.

O diferencial: corretor sênior dedicado por cliente (sem rodízio), processo de visita em até 48h e contrato assinado digitalmente em D+0. Nossa NPS é 9.2 nos últimos 12 meses.

Time atual: 8 corretores efetivos + 3 SDRs. Operamos com pipeline próprio (uazapi + Pipedrive) e usamos os agentes IA pra primeira triagem e reaquecimento.`,

  products: `**Imóveis residenciais (foco principal — 78% do volume)**
- Apartamentos 2-3 quartos · 65-110m² · Vila Olímpia, Pinheiros, Itaim, Vila Mariana
- Casas em condomínio · Granja Viana, Alphaville · ticket R$ 1,5-3M
- Studios · Pinheiros, Vila Madalena · ticket R$ 380-650k

**Imóveis comerciais (22% do volume)**
- Salas comerciais · Faria Lima, Berrini · 30-120m²
- Lojas de rua · Vila Madalena, Pinheiros (em análise comercial)

**Financiamento**: parcerias ativas com Itaú, Bradesco e Santander. Aprovação prévia em 5 dias úteis. Não trabalhamos com Caixa (decisão estratégica).`,

  faq: `**Como funciona a primeira visita?**
A primeira visita é sempre gratuita e dura ~45min. O corretor sênior responsável pelo perfil te leva no imóvel de interesse + 2 alternativas similares. Você pode visitar até 5 imóveis em 1 dia.

**Vocês cobram comissão do comprador?**
Não. A comissão é paga 100% pelo proprietário. Você não paga nada pra usar nossos serviços.

**Quanto tempo leva da visita até a assinatura?**
Em média 21 dias se for à vista; 38 dias se for financiado (depende do banco). Já tivemos casos de assinatura em D+5 (cliente pré-aprovado).

**Aceitam permuta?**
Em alguns casos sim — depende do imóvel ofertado. Nosso comercial avalia em até 48h após você enviar a documentação.

**Atendem fora de SP?**
Não. Operamos exclusivamente em SP capital + Granja Viana. Encaminhamos pra parceiros de confiança em outras cidades quando o lead chega.`,

  scripts: `**Cliente diz "está caro"**
Reconheça: "Entendo, é um valor alto mesmo." Reformule em parcela mensal: "Se for financiado em 360 meses, fica R$ X com base na nossa parceira atual." Pergunte: "O que faria sentido financeiro pra você nesse perfil?"

**Cliente diz "vou pensar"**
Não pressione. Pergunte: "Faz sentido — o que ainda está te deixando em dúvida? Posso ajudar a clarear?" Se não responder específico, ofereça: "Te mando 2 alternativas similares + comparação de financiamento. Lê com calma e me avisa."

**Cliente diz "vi mais barato em outro lugar"**
"Que ótimo que está pesquisando. Posso te enviar uma comparação técnica? Às vezes o que parece mais barato tem custos escondidos (IPTU, condomínio, reforma). Levo 5 minutos."

**Cliente some depois da visita**
NÃO mande "oi, sumiu?". Mande: "Oi {nome}, passei aqui pra ver se ainda faz sentido o {imóvel} ou se já viu outras opções. Sem cobrança — só quero saber se posso ajudar com algo específico."`,

  policy: `**Política de exclusividade**: assumimos contratos exclusivos por 90 dias. Cliente pode cancelar sem multa em até 7 dias após assinar.

**Política de reembolso**: visitas e avaliações são gratuitas e não geram custo nenhum pro cliente — sem reembolso necessário.

**Política de comunicação**: comercial atende WhatsApp das 8h às 22h (todos os dias). Email é respondido em até 4h úteis. Ligações por agendamento via WhatsApp.

**LGPD**: dados de leads ficam armazenados por 24 meses após último contato (compliance + obrigação fiscal). Cliente pode solicitar exclusão a qualquer momento via lgpd@larbrasil.com.br.

**Casos especiais**: imóveis em inventário, separação ou penhora seguem fluxo separado — corretor sênior aciona advogada parceira (Fernanda Vidotti) antes de qualquer compromisso.`,

  files: FILES,
  updatedAt: subDays(NOW, 1).toISOString(),
};
