import type { Metadata } from 'next';

import { LegalPage, LegalSection, LEGAL_UPDATED_AT } from '@/components/legal-page';

/**
 * `/legal/cookies` — Política de Cookies (M13#3).
 *
 * ⚠️ Conteúdo é um rascunho de MVP redigido por engenharia. **Precisa de
 * revisão jurídica** antes do trial público. A lista de cookies deve ser
 * mantida em sincronia com os trackers carregados em `analytics-scripts.tsx`.
 */

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description: 'Como o PapoPro usa cookies e como você pode gerenciar seu consentimento.',
};

export default function CookiesPage() {
  return (
    <LegalPage title="Política de Cookies" updatedAt={LEGAL_UPDATED_AT}>
      <LegalSection title="1. O que são cookies">
        <p>
          Cookies são pequenos arquivos guardados no seu navegador quando você visita um site. Eles
          permitem que o site funcione, lembre preferências e entenda como é utilizado. Tecnologias
          semelhantes, como o armazenamento local (localStorage), são tratadas aqui da mesma forma.
        </p>
      </LegalSection>

      <LegalSection title="2. Cookies que utilizamos">
        <p>
          <strong>Essenciais.</strong> Necessários para o funcionamento do site e da aplicação —
          sessão de login, preferência de tema e o registro da sua escolha de consentimento. Não
          dependem de autorização, pois sem eles o serviço não funciona.
        </p>
        <p>
          <strong>Análise (opcionais).</strong> Carregados apenas com o seu consentimento. Ajudam a
          entender o uso do site para melhorar a experiência. Quando autorizados, podemos usar:
        </p>
        <ul>
          <li>PostHog — análise de produto e funil de uso;</li>
          <li>Google Analytics — métricas de audiência;</li>
          <li>Meta Pixel — medição de campanhas.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Como gerenciar seu consentimento">
        <p>
          Na primeira visita, um banner permite <strong>aceitar todos</strong> os cookies ou usar{' '}
          <strong>apenas os essenciais</strong>. Enquanto você não autorizar, nenhum cookie de
          análise é carregado.
        </p>
        <p>
          Para rever sua escolha, limpe os dados do site no seu navegador — o banner aparecerá
          novamente na próxima visita. Você também pode bloquear ou apagar cookies diretamente nas
          configurações do navegador.
        </p>
      </LegalSection>

      <LegalSection title="4. Cookies de terceiros">
        <p>
          Os serviços de análise listados acima são operados por terceiros, que podem definir seus
          próprios cookies conforme as respectivas políticas de privacidade. O carregamento desses
          serviços só ocorre após o seu consentimento.
        </p>
      </LegalSection>

      <LegalSection title="5. Alterações e contato">
        <p>
          Esta Política pode ser atualizada para refletir mudanças nos serviços utilizados. Dúvidas
          podem ser enviadas para{' '}
          <a href="mailto:privacidade@pipeflow.com.br">privacidade@pipeflow.com.br</a>. Veja também
          a <a href="/legal/privacy">Política de Privacidade</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
