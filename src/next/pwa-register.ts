type RegisterSWOptions = {
  immediate?: boolean;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisterError?: (error: Error) => void;
};

const DEFAULT_SW_URL = "/sw.js";

export const registerSW = (options: RegisterSWOptions = {}) => {
  let registration: ServiceWorkerRegistration | null = null;
  let initialized = false;

  const setupRegistration = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || initialized) return;
    initialized = true;

    try {
      registration = await navigator.serviceWorker.register(DEFAULT_SW_URL, {
        scope: "/",
      });
      options.onRegisteredSW?.(DEFAULT_SW_URL, registration);

      if (registration.waiting) {
        options.onNeedRefresh?.();
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration?.installing;
        if (!installingWorker) return;
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              options.onNeedRefresh?.();
            } else {
              options.onOfflineReady?.();
            }
          }
        });
      });
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error("Service worker registration failed");
      options.onRegisterError?.(normalized);
    }
  };

  if (options.immediate) {
    void setupRegistration();
  } else if (typeof window !== "undefined") {
    window.addEventListener("load", () => void setupRegistration(), { once: true });
  }

  return async (reload?: boolean) => {
    if (!registration?.waiting) {
      if (reload && typeof window !== "undefined") {
        window.location.reload();
      }
      return;
    }

    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    if (reload && typeof window !== "undefined") {
      window.location.reload();
    }
  };
};
