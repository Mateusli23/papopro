import type { MetadataRoute } from 'next';

/**
 * `robots.txt` gerado via convenção do Next 14. Permite crawl total da
 * landing — a UI da app real fica em `app.pipeflow.com.br` (outro
 * subdomínio) e tem seu próprio `robots.txt` que bloqueia o que precisar.
 *
 * `/api/*` é bloqueado: a única rota que existe (`/api/trial-signup`) é
 * POST-only e não tem nada útil pra indexar. Bloquear evita que crawlers
 * fiquem batendo no endpoint procurando vulnerabilidade.
 */

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://pipeflow.com.br';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: '/api/',
      },
    ],
    sitemap: `${LANDING_URL}/sitemap.xml`,
    host: LANDING_URL,
  };
}
