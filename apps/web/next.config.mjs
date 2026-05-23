/**
 * Security headers aplicados em todas as rotas. CSP fica fora por ora — Next
 * 14 usa estilos/scripts inline (RSC, Turbopack runtime) que exigem nonce; um
 * CSP permissivo daria falsa sensação de proteção. Adicionar via middleware
 * com nonce dedicado em milestone de observabilidade (M13#4).
 *
 *  - `Strict-Transport-Security`: força HTTPS por 2 anos (preload-ready).
 *  - `X-Frame-Options: DENY`: impede iframe/clickjacking. App não usa
 *     embedação cross-origin.
 *  - `X-Content-Type-Options: nosniff`: previne MIME sniffing em respostas.
 *  - `Referrer-Policy: strict-origin-when-cross-origin`: padrão moderno;
 *     não vaza path cross-origin.
 *  - `Permissions-Policy`: nega APIs sensíveis que o app não usa
 *     (camera/microphone/geolocation/payment/usb/serial/midi/etc).
 *  - `Cross-Origin-Opener-Policy: same-origin`: isolation pro window.opener.
 */
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Permite que packages do monorepo sejam consumidos como TS direto.
  transpilePackages: ['@papopro/ui', '@papopro/db', '@papopro/config'],
  experimental: {
    typedRoutes: false,
  },
  eslint: {
    // Lint roda via `pnpm lint` (Turborepo) — não duplicar no build.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
