import type { Metadata } from 'next';

import { LegalPage, LegalSection, LEGAL_UPDATED_AT } from '@/components/legal-page';

/**
 * `/legal/privacy` — Política de Privacidade (M13#3).
 *
 * ⚠️ Conteúdo é um rascunho de MVP redigido por engenharia. **Precisa de
 * revisão jurídica** antes do trial público — bases legais, lista de
 * subprocessadores e cláusulas de transferência internacional devem ser
 * validadas por advogado e mantidas atualizadas.
 */

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Como o PapoPro coleta, usa, compartilha e protege dados pessoais, em conformidade com a LGPD.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt={LEGAL_UPDATED_AT}>
      <LegalSection title="1. Quem somos e nosso papel">
        <p>
          Esta Política descreve como o PapoPro (&quot;nós&quot;) trata dados pessoais, em
          conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>
        <p>Tratamos dados pessoais em dois papéis distintos:</p>
        <ul>
          <li>
            <strong>Como controlador</strong> — dados de cadastro dos usuários do produto (quem cria
            conta e usa o PapoPro).
          </li>
          <li>
            <strong>Como operador</strong> — dados de leads e contatos que o Cliente insere no
            Serviço. Nesse caso, o Cliente é o controlador e define as finalidades; nós apenas
            processamos esses dados conforme as instruções dele.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Dados que coletamos">
        <p>Como controlador, coletamos:</p>
        <ul>
          <li>
            <strong>Dados de conta:</strong> nome, e-mail, senha (armazenada de forma cifrada) e
            workspace.
          </li>
          <li>
            <strong>Dados de uso e técnicos:</strong> endereço IP, navegador, registros de auditoria
            de ações realizadas no produto e métricas de uso.
          </li>
          <li>
            <strong>Dados de cobrança:</strong> processados pela Stripe; não armazenamos números
            completos de cartão.
          </li>
        </ul>
        <p>
          Como operador, processamos os dados de leads que o Cliente cadastra — nome, telefone,
          e-mail, empresa, histórico de conversas e anexos. Esses dados são de responsabilidade do
          Cliente.
        </p>
      </LegalSection>

      <LegalSection title="3. Finalidades e bases legais">
        <p>Tratamos dados pessoais para:</p>
        <ul>
          <li>fornecer, manter e melhorar o Serviço — execução de contrato;</li>
          <li>
            autenticar usuários e garantir a segurança — legítimo interesse e cumprimento legal;
          </li>
          <li>processar pagamentos — execução de contrato;</li>
          <li>enviar comunicações transacionais e administrativas — execução de contrato;</li>
          <li>
            cumprir obrigações legais e registrar a auditoria de ações sensíveis — cumprimento de
            obrigação legal/regulatória.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Compartilhamento e subprocessadores">
        <p>
          Não vendemos dados pessoais. Compartilhamos dados apenas com prestadores que viabilizam o
          Serviço, sob obrigações contratuais de segurança e confidencialidade:
        </p>
        <ul>
          <li>Supabase — banco de dados, autenticação e armazenamento de arquivos;</li>
          <li>Vercel — hospedagem da aplicação;</li>
          <li>Stripe — processamento de pagamentos;</li>
          <li>Resend — envio de e-mails transacionais;</li>
          <li>uazapi — integração com o WhatsApp;</li>
          <li>Anthropic e OpenAI — processamento dos agentes de IA e busca semântica.</li>
        </ul>
        <p>Também podemos compartilhar dados para cumprir ordem judicial ou obrigação legal.</p>
      </LegalSection>

      <LegalSection title="5. Transferência internacional">
        <p>
          Alguns subprocessadores podem tratar dados fora do Brasil. Nesses casos, adotamos
          salvaguardas contratuais para garantir um nível de proteção compatível com a LGPD.
        </p>
      </LegalSection>

      <LegalSection title="6. Retenção de dados">
        <p>Mantemos os dados pelo tempo necessário às finalidades descritas. Em particular:</p>
        <ul>
          <li>registros de auditoria: 12 meses (24 meses em planos Enterprise);</li>
          <li>histórico de notificações in-app: 30 dias;</li>
          <li>
            dados de um workspace cancelado: 30 dias em modo somente-leitura, após os quais são
            excluídos;
          </li>
          <li>anexos removidos: excluídos do armazenamento em até 30 dias após a remoção.</li>
        </ul>
        <p>Dados podem ser retidos por prazo maior quando exigido por obrigação legal.</p>
      </LegalSection>

      <LegalSection title="7. Segurança">
        <p>
          Adotamos medidas técnicas e organizacionais para proteger os dados: isolamento por
          workspace, controle de acesso por papéis, criptografia em trânsito, registro de auditoria
          e princípio do menor privilégio. Nenhum sistema é totalmente imune a incidentes; em caso
          de violação relevante, comunicaremos os titulares e a ANPD conforme a lei.
        </p>
      </LegalSection>

      <LegalSection title="8. Direitos do titular">
        <p>
          A LGPD garante ao titular, entre outros, os direitos de confirmação, acesso, correção,
          anonimização, portabilidade, eliminação e informação sobre compartilhamento.
        </p>
        <p>
          Usuários do produto podem exercer esses direitos pelas ferramentas do PapoPro ou pelo
          contato abaixo. Quando os dados forem de leads inseridos por um Cliente, o titular deve
          contatar o Cliente (controlador); o PapoPro disponibiliza a ele recursos de exportação e
          exclusão completa dos dados do lead para atender essas solicitações.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookies">
        <p>
          Utilizamos cookies essenciais e, mediante consentimento, cookies de análise. Os detalhes
          estão na <a href="/legal/cookies">Política de Cookies</a>.
        </p>
      </LegalSection>

      <LegalSection title="10. Alterações desta Política">
        <p>
          Podemos atualizar esta Política periodicamente. Mudanças relevantes serão comunicadas por
          e-mail ou dentro do produto, e a data de última atualização será revisada no topo desta
          página.
        </p>
      </LegalSection>

      <LegalSection title="11. Encarregado e contato">
        <p>
          Para exercer seus direitos ou tirar dúvidas sobre privacidade, contate nosso encarregado
          pelo tratamento de dados (DPO) em{' '}
          <a href="mailto:privacidade@pipeflow.com.br">privacidade@pipeflow.com.br</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
