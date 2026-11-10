import type { NextConfig } from "next";

const isExport = process.env.NEXT_EXPORT === 'true';
const r2PublicBase = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-fba885359a4d40d6bd6e89575d51f9ca.r2.dev'
).replace(/\/+$/, '');

const nextConfig: NextConfig = {
  ...(isExport ? { output: 'export' } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    cpus: 1,
    staticGenerationMinPagesPerWorker: 50,
  },
  ...(!isExport
    ? {
        async rewrites() {
          return [
            {
              source: '/r2/:path*',
              destination: `${r2PublicBase}/:path*`,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
