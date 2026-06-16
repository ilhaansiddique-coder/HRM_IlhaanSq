"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Global "App update available" prompt. Shown to every user when a newer build
 * has been deployed. Two independent detectors feed it:
 *
 *  1. Service worker — ServiceWorkerRegister dispatches `sw:update-ready` when a
 *     replacement worker is installed and waiting (the production PWA path).
 *  2. Version poll — compares the build id this page loaded with (passed from
 *     the server) against /api/version. Covers non-PWA browsers and dev, and
 *     catches deploys even if the SW path doesn't fire.
 *
 * Pressing Refresh asks the waiting worker to activate (→ controllerchange →
 * reload) and falls back to a direct reload when there is no service worker.
 */
export function UpdateBanner({ currentVersion }: { currentVersion: string }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;

    const onSwReady = () => setAvailable(true);
    window.addEventListener("sw:update-ready", onSwReady);

    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (active && data.version && data.version !== currentVersion) {
          setAvailable(true);
        }
      } catch {
        /* offline / transient — ignore */
      }
    };

    const interval = setInterval(check, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", check);
    const initial = setTimeout(check, 5_000);

    return () => {
      active = false;
      window.removeEventListener("sw:update-ready", onSwReady);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, [currentVersion]);

  if (!available) return null;

  const applyUpdate = () => {
    // Activate the waiting worker if there is one; it triggers controllerchange
    // → reload (handled in ServiceWorkerRegister). Fall back to a plain reload.
    window.dispatchEvent(new CustomEvent("sw:apply-update"));
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-card p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-border/70 text-primary">
          <RefreshCw className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          App update available
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          A new version has been deployed. Refresh now to continue using the app
          with the latest updates.
        </p>
        <button
          type="button"
          onClick={applyUpdate}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-primary px-8 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
