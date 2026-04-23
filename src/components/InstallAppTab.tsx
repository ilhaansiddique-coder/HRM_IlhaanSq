import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export const InstallAppTab = () => {
  const { canInstall, install, isIOS, isInstalled, isSecureInstallContext } = usePwaInstall();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Install App
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isInstalled ? (
          <p className="text-sm text-muted-foreground">
            The app is already installed on this device.
          </p>
        ) : isIOS ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Install is available on iOS via Safari.</p>
            <p>
              Tap Share, then choose "Add to Home Screen".
            </p>
          </div>
        ) : canInstall ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Install the app for faster access and offline support.
            </p>
            <Button onClick={() => void install()} className="gap-2">
              <Download className="h-4 w-4" />
              Install App
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isSecureInstallContext
              ? "Install is not available yet. Open the app in Chrome or Edge and wait a moment, then try again."
              : "Install requires HTTPS or localhost. Open the app on a secure URL, then try again."}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
