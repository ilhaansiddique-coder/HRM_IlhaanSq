import { registerSW } from "@/next/pwa-register";
import { toast } from "@/utils/toast";
import { appLogger } from "@/utils/logger";

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let registrationCheckInterval: number | null = null;
let controllerChangeBound = false;
let reloadingFromControllerChange = false;

const softReload = () => {
  window.location.reload();
};

const startRegistrationUpdateChecks = (registration: ServiceWorkerRegistration) => {
  if (registrationCheckInterval !== null) return;

  const checkForUpdates = () => {
    registration.update().catch(() => {
      // Ignore transient SW update check failures.
    });
  };

  checkForUpdates();
  registrationCheckInterval = window.setInterval(checkForUpdates, 60 * 1000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkForUpdates();
    }
  });
};

export const applyUpdate = async () => {
  try {
    if (updateSW) {
      await updateSW(true);
      return;
    }
  } catch (error) {
    appLogger.warn("PWA update failed", error);
  }

  softReload();
};

export const promptUpdate = (message = "Update available. Refresh to get the latest version.") => {
  toast.info(message, {
    duration: 10000,
    action: {
      label: "Update now",
      onClick: () => {
        void applyUpdate();
      },
    },
  });
};

export const initPwa = () => {
  if (typeof window === "undefined" || updateSW) return;
  if (process.env.NODE_ENV === "development") {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if (typeof caches !== "undefined") {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
        }
      }).catch(() => {
        // Ignore cleanup errors in dev
      });
    }
    return;
  }

  if ("serviceWorker" in navigator && !controllerChangeBound) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingFromControllerChange) return;
      reloadingFromControllerChange = true;
      softReload();
    });
    controllerChangeBound = true;
  }

  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        startRegistrationUpdateChecks(registration);
      }
    },
    onNeedRefresh() {
      toast.info("Updating to the latest version...", { duration: 2500 });
      void applyUpdate();
    },
    onOfflineReady() {
      toast.info("App ready for offline use.", { duration: 4000 });
    },
    onRegisterError(error) {
      appLogger.warn("Service worker registration failed", error);
    },
  });
};
