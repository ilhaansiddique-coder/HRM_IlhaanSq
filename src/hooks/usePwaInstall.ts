import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const isLocalhostHost = (hostname: string) => LOCALHOST_HOSTS.has(hostname);

export const usePwaInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSecureInstallContext, setIsSecureInstallContext] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const userAgent = navigator.userAgent.toLowerCase();
    const media = window.matchMedia("(display-mode: standalone)");

    const syncInstallState = () => {
      const standalone = media.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
    };

    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsSecureInstallContext(window.isSecureContext || isLocalhostHost(window.location.hostname));
    syncInstallState();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (media.addEventListener) {
      media.addEventListener("change", syncInstallState);
    } else {
      media.addListener(syncInstallState);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (media.addEventListener) {
        media.removeEventListener("change", syncInstallState);
      } else {
        media.removeListener(syncInstallState);
      }
    };
  }, []);

  const canInstall = useMemo(
    () => !!deferredPrompt && !isInstalled,
    [deferredPrompt, isInstalled]
  );

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    const accepted = choice.outcome === "accepted";
    if (accepted) {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    return accepted;
  };

  return {
    canInstall,
    install,
    isIOS,
    isInstalled,
    isSecureInstallContext,
  };
};
