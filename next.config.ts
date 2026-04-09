import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep server output for Vercel; do not set output: "export".
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb"
    }
  }
};

export default nextConfig;
