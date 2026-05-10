import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@papopro/ui';
import { HelpCircle } from '@papopro/ui/icons';

/**
 * FAQ usando o `Accordion` entregue em M6#1. As 6 perguntas cobrem as
 * dúvidas mais comuns que aparecem na decisão de compra de SaaS B2B no
 * Brasil:
 *
 *  1. Trial — quando começa a cobrar
 *  2. LGPD — onde os dados ficam
 *  3. Troca de plano — sem perder nada
 *  4. Cancelamento — controle do cliente
 *  5. Segurança — criptografia e backup
 *  6. Suporte — quem fala com a gente
 *
 * As perguntas/respostas vivem numa constante (`FAQS`) — em M6#3 a mesma
 * constante alimenta o JSON-LD `FAQPage` schema.org pra SEO. Por isso o
 * texto é prosa direta, sem markdown ou HTML embutido (mais simples de
 * serializar e mais limpo pro Google).
 *
 * Server Component — Accordion controla seu próprio estado internamente.
 */

export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQS: ReadonlyArray<FAQItem> = [
  {
    question: 'Como funciona o trial de 7 dias?',
    answer:
      'Você cria a conta com email + senha (sem cartão de crédito) e tem 7 dias pra explorar o plano Pro IA com todas as funcionalidades. Quando o trial acabar, o produto entra em modo somente-leitura por 30 dias até você escolher um plano ou pedir exclusão dos dados — nunca cobramos sem confirmação explícita.',
  },
  {
    question: 'Vocês são compatíveis com a LGPD?',
    answer:
      'Sim. Os dados são hospedados no Brasil (Supabase região São Paulo), você pode exportar tudo a qualquer momento, opt-out de WhatsApp (PARE/SAIR/CANCELAR) é respeitado automaticamente em todos os envios, e log de auditoria registra quem exportou o que e quando. Retenção padrão é 12 meses (24 no Enterprise).',
  },
  {
    question: 'Posso trocar de plano depois?',
    answer:
      'A qualquer momento, sem perder nada. Subir de Pro pra Pro IA é instantâneo — os agentes IA aparecem na hora. Descer de plano também funciona, mas se o novo plano não cobrir tudo que você usa (ex: mais que 10 vendedores no Pro IA), a gente avisa antes de aplicar pra você ajustar com calma.',
  },
  {
    question: 'Como funciona o cancelamento?',
    answer:
      'Sem ligação, sem "vou transferir pro time de retenção". Você cancela em 1 clique pelo Customer Portal da Stripe e a conta continua ativa até o fim do ciclo já pago. Após o cancelamento, ficamos 30 dias em modo somente-leitura pra você baixar os dados, e depois excluímos tudo definitivamente (ou mantemos, se você optar por reativar nesse período).',
  },
  {
    question: 'Meus dados ficam seguros?',
    answer:
      'Criptografia em trânsito (TLS 1.3) e em repouso (AES-256). Cada empresa cliente tem isolamento via Row-Level Security do Postgres, então mesmo um bug nosso não exporia dados de uma empresa pra outra. Backup automático diário com retenção de 7 dias. Senhas nunca são armazenadas em texto puro.',
  },
  {
    question: 'Como funciona o suporte?',
    answer:
      'Suporte por WhatsApp em horário comercial (9h–18h, dias úteis) pro Pro, e prioritário com SLA de 4h úteis pro Pro IA. No Enterprise, onboarding guiado por um Customer Success dedicado e canal direto com a engenharia. Base de conhecimento e tutoriais em vídeo estão disponíveis 24/7 dentro do produto.',
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col items-center text-center">
            <div className="bg-primary/10 text-primary inline-flex size-12 items-center justify-center rounded-full">
              <HelpCircle className="size-6" />
            </div>
            <h2 className="text-foreground mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              Dúvidas que <span className="text-primary">a gente já ouviu</span>.
            </h2>
            <p className="text-muted-foreground text-body-lg mt-4">
              Se a sua pergunta não estiver aqui, mande no WhatsApp — a gente responde em horas, não
              em semanas.
            </p>
          </div>

          <Accordion type="single" collapsible className="mt-12">
            {FAQS.map((faq, idx) => (
              <AccordionItem key={faq.question} value={`item-${idx + 1}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
