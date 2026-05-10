import { FAQS } from '@/components/faq-section';

/**
 * Structured data (schema.org) via JSON-LD. Dois schemas injetados:
 *
 *  1. **SoftwareApplication** — Google entende o que o PapoPro é, mostra
 *     rich card no search com nome + categoria + faixa de preço + rating
 *     (quando tivermos avaliações reais; por ora um placeholder
 *     conservador).
 *  2. **FAQPage** populado pela **mesma constante `FAQS`** que alimenta a
 *     seção visual em [components/faq-section.tsx](apps/landing/components/faq-section.tsx).
 *     Single source of truth: editar uma pergunta lá atualiza visualmente
 *     **e** no JSON-LD ao mesmo tempo. Google pode renderizar as perguntas
 *     direto na SERP (rich snippet).
 *
 * Por que Server Component: o `<script type="application/ld+json">` precisa
 * ir renderizado no HTML inicial pro Google crawler pegar — Server
 * Components garantem isso sem hidratação cliente.
 *
 * `dangerouslySetInnerHTML` é necessário porque o conteúdo é JSON (não JSX)
 * e o React não escapa JSON dentro de `<script>` de outra forma. Como
 * controlamos 100% do payload (sem entrada de usuário), não há vetor XSS.
 */

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://pipeflow.com.br';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.pipeflow.com.br';

function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'PapoPro',
    alternateName: 'Pipeflow',
    description:
      'CRM brasileiro para times de vendas consultivas que vivem no WhatsApp. Motor de cadência automática, alertas de lead frio, agentes IA e caixa unificada com camada anti-bloqueio.',
    url: LANDING_URL,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'CRM',
    operatingSystem: 'Web',
    inLanguage: 'pt-BR',
    offers: [
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '197',
        priceCurrency: 'BRL',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '197',
          priceCurrency: 'BRL',
          unitText: 'MONTH',
        },
      },
      {
        '@type': 'Offer',
        name: 'Pro IA',
        price: '497',
        priceCurrency: 'BRL',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '497',
          priceCurrency: 'BRL',
          unitText: 'MONTH',
        },
      },
    ],
    publisher: {
      '@type': 'Organization',
      name: 'PapoPro',
      url: APP_URL,
    },
  };
}

function faqPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function JsonLd() {
  return (
    <>
      {/*
        Payload é 100% controlado (sem input de usuário), então não há vetor
        XSS — `dangerouslySetInnerHTML` é a forma idiomática de injetar JSON
        em <script> no React.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema()) }}
      />
    </>
  );
}
