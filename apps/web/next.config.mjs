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
};

export default nextConfig;
