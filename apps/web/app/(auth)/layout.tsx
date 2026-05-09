import Link from 'next/link';

import { BrandArcs, LogoFull, ThemeToggle } from '@papopro/ui';
import { Flame, MessageCircle, Repeat } from '@papopro/ui/icons';

/**
 * Layout das telas de autenticação e recuperação de senha.
 *
 * Duas colunas em ≥lg:
 *  - Esquerda: painel de marca com `BrandArcs` (uso permitido em superfícies
 *    de auth, CLAUDE.md §8) + os 3 diferenciais que justificam o produto
 *    (CLAUDE.md §1).
 *  - Direita: o formulário (slot via `children`), centralizado, com toggle
 *    de tema discreto no canto.
 *
 * Em ≤md (mobile/tablet) o painel da marca colapsa — o formulário ocupa a
 * tela inteira e exibe só o `LogoFull` no topo.
 */

const DIFFERENTIALS = [
  {
    Icon: Repeat,
    title: 'Cadência automática',
    description: 'Todo lead recebe a sequência configurada — sem depender da memória do vendedor.',
  },
  {
    Icon: Flame,
    title: 'Alertas de lead frio',
    description: 'O sistema avisa por etapa do funil antes do negócio esfriar.',
  },
  {
    Icon: MessageCircle,
    title: 'WhatsApp centralizado',
    description: 'Caixa unificada do time, vinculada a leads, com camada anti-bloqueio.',
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background relative grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca — só em lg+ */}
      <aside
        aria-hidden
        className="from-primary/10 via-background to-background relative hidden overflow-hidden bg-gradient-to-br lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <BrandArcs variant="login" className="opacity-90" />

        <div className="relative z-10">
          <Link href="/" aria-label="PapoPro — voltar para o início">
            <LogoFull />
          </Link>
        </div>

        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex max-w-md flex-col gap-3">
            <h2 className="text-foreground text-title-lg font-semibold leading-tight">
              Pipeline proativo, não reativo.
            </h2>
            <p className="text-muted-foreground text-body-lg">
              O sistema lembra. O vendedor executa. Lead não esfria, oportunidade não escapa.
            </p>
          </div>

          <ul className="flex max-w-md flex-col gap-4">
            {DIFFERENTIALS.map(({ Icon, title, description }) => (
              <li key={title} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md"
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-foreground text-body font-semibold">{title}</span>
                  <span className="text-muted-foreground text-caption">{description}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-muted-foreground text-caption relative z-10">
          © {new Date().getFullYear()} PapoPro · CRM com WhatsApp para times de vendas consultivas.
        </p>
      </aside>

      {/* Coluna do formulário */}
      <section className="relative flex flex-col">
        <header className="flex items-center justify-between p-4 lg:justify-end lg:p-6">
          <Link href="/" aria-label="PapoPro" className="lg:hidden">
            <LogoFull />
          </Link>
          <ThemeToggle />
        </header>

        <div className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-6">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </section>
    </div>
  );
}
