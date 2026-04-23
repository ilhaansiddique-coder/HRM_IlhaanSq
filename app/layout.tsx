import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "../src/index.css";
import "lenis/dist/lenis.css";
import { LenisProvider } from "./_components/lenis-provider";

export const metadata: Metadata = {
  applicationName: "RaheDeen Inventory",
  title: {
    default: "RaheDeen Inventory — Wholesale & Retail Management",
    template: "%s · RaheDeen",
  },
  description:
    "All-in-one inventory, sales, customers, packaging and reporting platform built for wholesale and retail businesses.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RaheDeen",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Smart bootstrap:
// - Public routes (/, /login, /request-demo, /invite/*, /reset-password) → daisy "light" or "dark"
// - Tenant/admin routes → user-selected daisy theme (forest, dracula, etc.)
// Runs before React paints to prevent flash.
const themeBootstrapScript = `
(function () {
  try {
    var path = window.location.pathname;
    var publicPrefixes = ['/', '/login', '/request-demo', '/invite', '/reset-password', '/onboarding'];
    var isPublic = path === '/' || publicPrefixes.some(function (p) {
      return p !== '/' && (path === p || path.indexOf(p + '/') === 0);
    });

    if (isPublic) {
      var saved = window.localStorage.getItem('public-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var theme = saved || (prefersDark ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    } else {
      var savedTheme = window.localStorage.getItem('daisy-theme') || 'forest';
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrapScript}
        </Script>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
