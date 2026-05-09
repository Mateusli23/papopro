import Link from 'next/link';

import type { Metadata } from 'next';

import { Button, EmptyState } from '@papopro/ui';
import { ArrowLeft, FileText } from '@papopro/ui/icons';

export const metadata: Metadata = {
  title: 'Termos de uso',
  description: 'Termos de uso do PapoPro.',
};

/**
 * Stub de Termos de Uso — placeholder até o texto definitivo (revisado pelo
 * jurídico) entrar no M13. Mantém a rota viva pra que os links de cadastro,
 * checkout e rodapé não dêem 404.
 */
export default function TermsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-foreground text-title-lg font-semibold">Termos de uso</h1>
        <p className="text-muted-foreground text-body">
          Em construção · Última atualização: a definir
        </p>
      </header>

      <EmptyState
        icon={FileText}
        title="Documento em revisão"
        description="O texto final dos termos está sendo redigido com revisão jurídica. Esta página fica viva como placeholder e será publicada antes da abertura do trial público."
        action={
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft />
              Voltar para o início
            </Link>
          </Button>
        }
      />
    </div>
  );
}
