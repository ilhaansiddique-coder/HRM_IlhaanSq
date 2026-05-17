"use client";

import { useEffect, type ReactNode } from "react";
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

export function LenisProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
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

  // Guard against Radix Dialog/Sheet leaks. When Radix opens a modal
  // it sets `pointer-events: none` on body and `overflow: hidden` on
  // <html>. If a modal unmounts mid-transition (route change while
  // open, error during close, etc.) the cleanup can be skipped and
  // the page becomes scroll-dead and tap-dead while dialogs (rendered
  // in their own portal) keep working — a textbook reproduction of
  // "mobile scroll broken but dialogs scroll fine". Forcing a reset
  // on every pathname change costs nothing and rescues the user.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.pointerEvents = "";
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }, [pathname]);

  return <>{children}</>;
}
