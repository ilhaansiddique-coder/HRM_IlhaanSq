"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

// Public/marketing routes that should keep the cinematic smooth-scroll.
// Anything else (dashboard, products, settings, etc.) gets native scroll
// for snappy interactivity. Lenis hijacks wheel events and runs a
// continuous requestAnimationFrame loop — fine for a landing page, bad
// for an admin app where every millisecond of input latency matters.
const SMOOTH_SCROLL_PREFIXES = [
  "/",
  "/login",
  "/request-demo",
  "/invite",
  "/reset-password",
  "/onboarding",
];

function isPublicRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return SMOOTH_SCROLL_PREFIXES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/"))
  );
}

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const enabled = isPublicRoute(pathname);

  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({
      duration: 1.0,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      // Don't smooth scroll inside elements with `data-lenis-prevent`
      // (the sidebar's overflow-y scroll, dialogs, etc.)
    });

    let raf: number;
    function loop(time: number) {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [enabled]);

  return <>{children}</>;
}
