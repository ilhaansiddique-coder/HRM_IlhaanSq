"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker and guarantees clients never get stuck on a
 * stale worker:
 *  - registers /sw.js after load
 *  - calls registration.update() on mount, when the tab becomes visible,
 *    when the network comes back, and on a slow interval
 *  - when an updated worker finishes installing, tells it to skipWaiting()
 *    (sw.js handles the SKIP_WAITING message) so it activates immediately
 *  - reloads the page exactly once when the new worker takes control, so the
 *    fresh assets are actually used (guarded against reload loops, and skipped
 *    on the very first install when there was no previous controller)
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;
    let interval: ReturnType<typeof setInterval> | undefined;
    // Was a worker already controlling this page when we loaded? If so, a
    // later controllerchange means a *replacement* (update) — reload to pick
    // up the new assets. On a first-ever install there's no controller, so we
    // don't force an extra reload.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;

    const promoteWaiting = (worker: ServiceWorker | null) => {
      if (worker) worker.postMessage({ type: "SKIP_WAITING" });
    };

    const onControllerChange = () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    const triggerUpdate = () => {
      if (reg) void reg.update().catch(() => {});
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") triggerUpdate();
    };

    const register = async () => {
      try {
        reg = await navigator.serviceWorker.register("/sw.js");

        // A new worker may already be waiting from a previous visit.
        if (reg.waiting && navigator.serviceWorker.controller) {
          promoteWaiting(reg.waiting);
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg?.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // An update (not the first install) finished installing —
              // activate it now instead of waiting for all tabs to close.
              promoteWaiting(installing);
            }
          });
        });

        triggerUpdate();
        interval = setInterval(triggerUpdate, 60_000);
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("online", triggerUpdate);
      } catch {
        // Registration failures are non-fatal; the app still works online.
      }
    };

    // Defer until the page has settled so registration doesn't compete with
    // hydration / first paint.
    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", () => void register(), { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", triggerUpdate);
      if (interval) clearInterval(interval);
    };
  }, []);

  return null;
}
