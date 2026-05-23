import type { Metadata } from 'next';

import { LegalPage, LegalSection, LEGAL_UPDATED_AT } from '@/components/legal-page';

/**
 * `/legal/terms` — Termos de Uso (M13#3).
 *
 * ⚠️ Conteúdo é um rascunho de MVP redigido por engenharia. **Precisa de
 * revisão jurídica** antes do trial público — limitação de responsabilidade,
 * foro e cláusulas de SLA devem ser validados por advogado.
 */

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos de Uso do PapoPro — condições de contratação e uso do serviço.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updatedAt={LEGAL_UPDATED_AT}>
      <LegalSection title="1. Aceitação dos termos">
        <p>
          Estes Termos de Uso regem o acesso e a utilização do PapoPro (&quot;Serviço&quot;), um CRM
          com WhatsApp, cadência automática e agentes de IA, operado pelo PapoPro (&quot;nós&quot;).
          Ao criar uma conta ou usar o Serviço, você (&quot;Cliente&quot;) declara ter lido e
          concordado com estes Termos e com a <a href="/legal/privacy">Política de Privacidade</a>.
        </p>
        <p>
          Se você aceita estes Termos em nome de uma empresa, declara ter poderes para vinculá-la.
        </p>
      </LegalSection>

      <LegalSection title="2. Descrição do Serviço">
        <p>
          O PapoPro é um software como serviço (SaaS) para times de vendas consultivas, oferecendo
          gestão de leads, funil de vendas, caixa de WhatsApp unificada, motor de cadência, alertas
          de lead frio e agentes de IA. O Serviço é fornecido na modalidade nuvem
          (&quot;cloud&quot;); não há versão on-premise.
        </p>
        <p>
          Podemos evoluir, alterar ou descontinuar funcionalidades. Mudanças relevantes serão
          comunicadas com antecedência razoável.
        </p>
      </LegalSection>

      <LegalSection title="3. Cadastro e conta">
        <p>
          Para usar o Serviço é necessário criar uma conta com e-mail válido, que deve ser
          confirmado antes do primeiro acesso. Você é responsável por manter a confidencialidade das
          credenciais e por toda atividade realizada na sua conta.
        </p>
        <p>
          Cada workspace é um ambiente isolado. O Cliente é responsável por gerenciar os papéis de
          acesso (Owner, Admin, Manager, Vendedor, Viewer) dos seus membros.
        </p>
      </LegalSection>

      <LegalSection title="4. Teste grátis, planos e pagamento">
        <p>
          O Serviço oferece um período de teste de 7 dias, sem necessidade de cartão de crédito. Ao
          fim do teste, o acesso aos recursos pagos depende da contratação de um plano.
        </p>
        <p>
          Os pagamentos são processados pela Stripe. Os valores, ciclos de cobrança e recursos de
          cada plano são informados na página de planos. Em caso de cancelamento, o workspace entra
          em modo somente-leitura por 30 dias antes da exclusão definitiva dos dados.
        </p>
      </LegalSection>

      <LegalSection title="5. Uso aceitável">
        <p>O Cliente concorda em não utilizar o Serviço para:</p>
        <ul>
          <li>
            enviar mensagens não solicitadas (spam) ou conteúdo ilícito, fraudulento ou abusivo;
          </li>
          <li>violar a legislação aplicável, incluindo a LGPD e as políticas do WhatsApp;</li>
          <li>contatar pessoas que tenham solicitado o descadastramento (opt-out);</li>
          <li>
            tentar burlar limites de plano, mecanismos de segurança ou a camada anti-bloqueio;
          </li>
          <li>realizar engenharia reversa ou revender o Serviço sem autorização.</li>
        </ul>
        <p>
          O uso do WhatsApp está sujeito às regras da plataforma. O Cliente é o único responsável
          pelo conteúdo enviado e pela obtenção de consentimento dos seus contatos. A camada
          anti-bloqueio reduz riscos, mas não garante a ausência de bloqueio do número.
        </p>
      </LegalSection>

      <LegalSection title="6. Dados e conteúdo do Cliente">
        <p>
          Todo o conteúdo inserido no Serviço — leads, conversas, negócios, arquivos — pertence ao
          Cliente. Em relação aos dados pessoais de leads, o Cliente atua como{' '}
          <strong>controlador</strong> e o PapoPro como <strong>operador</strong>, nos termos da
          LGPD. O tratamento desses dados está descrito na{' '}
          <a href="/legal/privacy">Política de Privacidade</a>.
        </p>
        <p>
          O Cliente pode exportar e solicitar a exclusão dos seus dados a qualquer momento, pelas
          ferramentas do produto ou por solicitação ao nosso encarregado.
        </p>
      </LegalSection>

      <LegalSection title="7. Disponibilidade e suporte">
        <p>
          Empregamos esforços razoáveis para manter o Serviço disponível, mas ele é fornecido
          &quot;no estado em que se encontra&quot;. Manutenções programadas e indisponibilidades de
          terceiros (provedores de nuvem, WhatsApp, gateways de pagamento) podem afetar o acesso.
        </p>
      </LegalSection>

      <LegalSection title="8. Suspensão e encerramento">
        <p>
          Podemos suspender ou encerrar o acesso em caso de violação destes Termos, inadimplência ou
          uso que coloque em risco a segurança ou a reputação do Serviço. O Cliente pode encerrar a
          conta a qualquer momento; após o encerramento, os dados seguem a política de retenção
          descrita na Política de Privacidade.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida pela lei, o PapoPro não se responsabiliza por danos
          indiretos, lucros cessantes ou perda de dados decorrentes do uso ou da impossibilidade de
          uso do Serviço, incluindo bloqueio de número de WhatsApp. A responsabilidade total, em
          qualquer hipótese, limita-se ao valor pago pelo Cliente nos 12 meses anteriores ao evento.
        </p>
      </LegalSection>

      <LegalSection title="10. Alterações destes Termos">
        <p>
          Podemos atualizar estes Termos periodicamente. Mudanças relevantes serão comunicadas por
          e-mail ou dentro do produto. O uso continuado após a vigência das alterações representa
          concordância.
        </p>
      </LegalSection>

      <LegalSection title="11. Lei aplicável e foro">
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro
          do domicílio do Cliente para dirimir eventuais controvérsias.
        </p>
      </LegalSection>

      <LegalSection title="12. Contato">
        <p>
          Dúvidas sobre estes Termos podem ser enviadas para{' '}
          <a href="mailto:contato@pipeflow.com.br">contato@pipeflow.com.br</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
