import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";

import "./globals.css";
import { ToasterProvider } from "./_components/toaster-provider";

export const dynamic = "force-dynamic";

// All typography — body and headings — uses Bricolage Grotesque, which
// is self-hosted via @font-face declarations in src/index.css pointing at
// public/fonts/BricolageGrotesque-Variable-*.woff2. No Google Fonts CDN.

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
    { media: "(prefers-color-scheme: light)", color: "#f9f9f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Smart bootstrap:
// - Public routes respect OS color-scheme preference or saved 'public-theme'
// - Tenant/admin routes → user-selected theme (light or night); defaults to light
// Only 'light' and 'night' are valid; legacy stored values fall back to 'light'.
// Runs before React paints to prevent flash.
const themeBootstrapScript = `
(function () {
  try {
    var path = window.location.pathname;
    var publicPrefixes = ['/', '/login', '/request-demo', '/invite', '/reset-password', '/onboarding'];
    var isPublic = path === '/' || publicPrefixes.some(function (p) {
      return p !== '/' && (path === p || path.indexOf(p + '/') === 0);
    });
    var validThemes = ['light', 'night'];

    if (isPublic) {
      var saved = window.localStorage.getItem('public-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var candidate = saved === 'dark' ? 'night' : saved;
      var theme = validThemes.indexOf(candidate) >= 0
        ? candidate
        : (prefersDark ? 'night' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'night');
    } else {
      var savedTheme = window.localStorage.getItem('daisy-theme');
      var theme = validThemes.indexOf(savedTheme) >= 0 ? savedTheme : 'light';
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrapScript}
        </Script>
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
