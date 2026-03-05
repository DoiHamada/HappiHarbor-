import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Keep CI/deploy unblocked when eslint toolchain versions differ from local.
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
