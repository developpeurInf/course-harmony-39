import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // console.log / console.debug retirés en production (avertissements et erreurs gardés)
  compiler: { removeConsole: { exclude: ["error", "warn"] } },
  typescript: { ignoreBuildErrors: false },
  images: { unoptimized: true },
  async headers() {
    return [
      { source: "/assets/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default nextConfig;
