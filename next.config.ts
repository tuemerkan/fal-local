import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'v3.fal.media',
      },
      {
        protocol: 'https',
        hostname: 'fal.media',
      },
    ],
  },
};

export default nextConfig;
