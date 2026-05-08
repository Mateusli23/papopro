/**
 * Landing — placeholder de M1.
 * M6 entrega as 8 seções (hero, problema, features, demo, ROI, planos, FAQ, CTA).
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6 py-16">
      <span className="bg-primary/10 text-caption text-primary rounded-full px-3 py-1">
        M1 — Setup do monorepo
      </span>
      <h1 className="text-title-lg">PapoPro · landing</h1>
      <p className="text-body-lg text-muted-foreground">
        Esqueleto pronto. A landing completa com hero, calculadora de ROI, planos e FAQ chega em M6.
      </p>
    </main>
  );
}
