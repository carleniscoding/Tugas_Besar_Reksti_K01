import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), "../.env") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

const nextConfig: NextConfig = {
  turbopack: {
    root: '.', // Set project root explicitly
  },
  async rewrites() {
    const backendUrl = process.env.VOTELY_BACKEND_URL || "http://localhost:4000";
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'foxpgqpclfptrkyfoivo.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
