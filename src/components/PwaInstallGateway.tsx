"use client";

import { useEffect, useState } from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePwaInstall } from "@/hooks/usePwaInstall";

const DISMISS_STORAGE_KEY = "pwa-install-gateway:dismissed";

export const PwaInstallGateway = () => {
  const { canInstall, install, isIOS, isInstalled, isSecureInstallContext } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!isInstalled || typeof window === "undefined") return;
    window.localStorage.removeItem(DISMISS_STORAGE_KEY);
    setDismissed(false);
  }, [isInstalled]);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    }
    setDismissed(true);
  };

  const shouldShow =
    !dismissed &&
    !isInstalled &&
    (canInstall || isIOS || !isSecureInstallContext);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] w-[calc(100vw-2rem)] max-w-sm">
      <Card className="pointer-events-auto border-border/70 bg-card/95 shadow-xl backdrop-blur">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-4 w-4 text-primary" />
                Install App
              </CardTitle>
              <CardDescription>
                Save this app on desktop or mobile for faster access.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {canInstall ? (
            <>
              <p className="text-sm text-muted-foreground">
                Your browser is ready to install this app now.
              </p>
              <Button onClick={() => void install()} className="w-full gap-2">
                <Download className="h-4 w-4" />
                Install App
              </Button>
            </>
          ) : isIOS ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Share2 className="h-4 w-4 text-primary" />
                iPhone / iPad install
              </p>
              <p>Open this site in Safari, tap Share, then choose Add to Home Screen.</p>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Install needs a secure URL.</p>
              <p>Use HTTPS or localhost. Browsers usually do not show install on plain local-network HTTP.</p>
            </div>
          )}
          <p className={cn("text-xs text-muted-foreground", canInstall && "pt-1")}>
            Desktop Chrome/Edge and Android Chrome can show install automatically in the address bar when supported.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
