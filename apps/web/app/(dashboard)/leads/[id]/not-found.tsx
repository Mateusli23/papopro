import Link from 'next/link';

import { Button, EmptyState } from '@papopro/ui';
import { ArrowLeft, Users } from '@papopro/ui/icons';

export default function LeadNotFound() {
  return (
    <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <EmptyState
        icon={Users}
        title="Lead não encontrado"
        description="Esse lead pode ter sido removido ou o link está incorreto. Volte pra lista pra continuar."
        action={
          <Button asChild>
            <Link href="/leads">
              <ArrowLeft /> Voltar para leads
            </Link>
          </Button>
        }
      />
    </div>
  );
}
