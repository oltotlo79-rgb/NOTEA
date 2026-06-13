import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Supabase Storage（ローカル開発）
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/**',
      },
      {
        // Supabase Storage（クラウド）
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/**',
      },
    ],
  },
};

export default nextConfig;
