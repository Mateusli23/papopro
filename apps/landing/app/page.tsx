import { FeaturesSection } from '@/components/features-section';
import { Header } from '@/components/header';
import { HeroSection } from '@/components/hero-section';
import { ProblemSection } from '@/components/problem-section';

/**
 * Landing pública — `pipeflow.com.br`.
 *
 * Composição declarativa por seção. Cada section é colocated em
 * `components/<section>-section.tsx` (Server Component por default). M6#1
 * entrega Header + Hero + Problema + Features. M6#2 adiciona Demo + ROI +
 * Planos + FAQ + CTA + WhatsApp FAB. M6#3 cuida de SEO, OG e analytics.
 */
export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <ProblemSection />
        <FeaturesSection />
        {/* M6#2 — Demo, ROI, Planos, FAQ, CTA, WhatsApp FAB e Footer. */}
      </main>
    </>
  );
}
