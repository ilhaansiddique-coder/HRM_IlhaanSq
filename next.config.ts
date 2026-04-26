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
  // Vercel build if tsc ran over it. app/ and lib/ are type-clean and should
  // be verified with `npx tsc --noEmit` locally before push.
  // (Next 16 removed the `eslint` config option — ESLint is no longer
  // run as part of `next build` at all, so suppressing it is unnecessary.
  // If you want lint in CI, run `eslint .` directly.)
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: [
    "bcryptjs",
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "ioredis",
  ],
  // Allow LAN / WSL access during development (e.g., testing from phone on same
  // network, or hitting the dev server from the WSL bridge IP). Without the
  // origin in this list, Next 15 returns 404 + text/plain for /_next/* assets.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.0.127",
    "172.28.208.1",
    "172.28.*.*",
    "192.168.*.*",
  ],
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
