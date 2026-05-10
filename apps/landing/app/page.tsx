import { CtaSection } from '@/components/cta-section';
import { DemoSection } from '@/components/demo-section';
import { FaqSection } from '@/components/faq-section';
import { FeaturesSection } from '@/components/features-section';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { HeroSection } from '@/components/hero-section';
import { JsonLd } from '@/components/json-ld';
import { PageViewTracker } from '@/components/page-view-tracker';
import { PricingSection } from '@/components/pricing-section';
import { ProblemSection } from '@/components/problem-section';
import { RoiCalculator } from '@/components/roi-calculator';
import { WhatsAppFab } from '@/components/whatsapp-fab';

/**
 * Landing pública — `pipeflow.com.br`. Bloco A do PapoPro: navegável de
 * ponta a ponta, sem persistência.
 *
 * Ordem das seções (do PRD):
 *   Hero → Problema → Funcionalidades → Demo → ROI → Planos → FAQ → CTA
 *
 * `WhatsAppFab` é renderizado fora do `<main>` porque é um elemento global
 * (fixed). `Footer` fecha o documento. `JsonLd` injeta structured data
 * (SoftwareApplication + FAQPage) no HTML inicial — Server Component
 * garante que o crawler veja o JSON antes de qualquer hidratação.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd />
      <PageViewTracker />
      <Header />
      <main>
        <HeroSection />
        <ProblemSection />
        <FeaturesSection />
        <DemoSection />
        <RoiCalculator />
        <PricingSection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  );
}
