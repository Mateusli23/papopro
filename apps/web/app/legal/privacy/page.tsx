import Link from 'next/link';

import type { Metadata } from 'next';

import { Button, EmptyState } from '@papopro/ui';
import { ArrowLeft, ShieldCheck } from '@papopro/ui/icons';

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: 'Política de privacidade do PapoPro.',
};

/**
 * Stub de Política de Privacidade — placeholder até o texto definitivo
 * (revisado pelo jurídico, alinhado com LGPD CLAUDE.md §7.5) entrar no M13.
 * Mantém a rota viva.
 */
export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-foreground text-title-lg font-semibold">Política de privacidade</h1>
        <p className="text-muted-foreground text-body">
          Em construção · Última atualização: a definir
        </p>
      </header>

      <EmptyState
        icon={ShieldCheck}
        title="Documento em revisão"
        description="A política completa de privacidade — incluindo tratamento de dados conforme LGPD, retenção de logs e direitos do titular — está em redação. Esta página fica viva como placeholder e será publicada antes da abertura do trial público."
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
