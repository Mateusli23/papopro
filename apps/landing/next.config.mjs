/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@papopro/ui', '@papopro/config'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
