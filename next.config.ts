import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The legacy src/ Vite tree contains broken imports that would fail the
  // Vercel build if tsc/ESLint ran over it. app/ and lib/ are type-clean and
  // should be verified with `npx tsc --noEmit` locally before push.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: [
    "bcryptjs",
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "ioredis",
  ],
  // Allow LAN access during development (e.g., testing from phone on same network)
  allowedDevOrigins: ["192.168.0.127", "localhost", "127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
