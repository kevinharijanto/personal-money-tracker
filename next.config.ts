import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure NextAuth uses the correct URL for callbacks
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
      },
    ];
  },
  // Add environment variables for NextAuth
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
};

export default nextConfig;
