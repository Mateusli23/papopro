import type { MetadataRoute } from 'next';

/**
 * `sitemap.xml` gerado via convenção do Next 14 (App Router). O Next gera
 * automaticamente `/sitemap.xml` durante o build a partir desse export
 * default — não precisa wirar nada em `next.config.mjs`.
 *
 * Hoje só temos a home (`/`) — as rotas legais (`/privacidade`, `/termos`)
 * ainda não existem; quando entrarem, adicionar aqui (com `priority` e
 * `changeFrequency` apropriados).
 *
 * `LANDING_URL` cai pro domínio canônico se a env não estiver setada — em
 * dev (`http://localhost:3001`) ou prod (`https://pipeflow.com.br`).
 */

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://pipeflow.com.br';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: LANDING_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];
}
