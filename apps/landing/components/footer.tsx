import { LogoFull } from '@papopro/ui';

/**
 * Footer simples — `LogoFull` + 2 colunas de links (Produto / Empresa) +
 * copyright em pt-BR. Sem newsletter signup (CTA já é o foco, não
 * concorremos com ele aqui), sem redes sociais com badges (até existirem
 * de verdade, fica visualmente ruidoso).
 *
 * Links de produto usam caminho absoluto com âncora (`/#secao`) pra
 * funcionarem tanto da home quanto das páginas `/legal/*`. Os links legais
 * apontam pras páginas reais criadas em M13#3.
 *
 * Server Component — só HTML estático.
 */

const PRODUCT_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/#funcionalidades', label: 'Funcionalidades' },
  { href: '/#roi', label: 'Calculadora de ROI' },
  { href: '/#planos', label: 'Planos' },
  { href: '/#faq', label: 'Perguntas frequentes' },
];

const COMPANY_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/legal/privacy', label: 'Política de privacidade' },
  { href: '/legal/terms', label: 'Termos de uso' },
  { href: '/legal/cookies', label: 'Política de cookies' },
  { href: 'https://app.pipeflow.com.br/login', label: 'Entrar' },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-muted/30 border-border border-t">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-3 md:gap-12">
          <div className="flex flex-col gap-3">
            <LogoFull size={24} />
            <p className="text-muted-foreground text-body max-w-xs">
              O CRM brasileiro pra times de vendas consultivas que vivem no WhatsApp.
            </p>
          </div>

          <FooterColumn title="Produto" links={PRODUCT_LINKS} />
          <FooterColumn title="Empresa" links={COMPANY_LINKS} />
        </div>

        <div className="border-border mt-12 flex flex-col items-start gap-2 border-t pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-muted-foreground text-caption">
            © {year} PapoPro · CNPJ 00.000.000/0001-00 · Feito no Brasil.
          </p>
          <p className="text-muted-foreground text-caption">
            Dados hospedados no Brasil · LGPD compliant
          </p>
        </div>
      </div>
    </footer>
  );
}

interface FooterColumnProps {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-foreground text-body font-semibold">{title}</h3>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-body transition-colors"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
