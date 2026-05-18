"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Coffee, TimerOff, Loader2, Play } from "lucide-react";
import { startBreakAction, endBreakAction } from "../../actions";
import { useRouter } from "next/navigation";

export function BreakStartEndPanel({
  employeeId,
  activeBreak,
}: {
  employeeId: string;
  activeBreak: { id: string; breakStart: string } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleStart() {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("employeeId", employeeId);
        await startBreakAction(fd);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start break");
      }
    });
  }

  function handleEnd() {
    if (!activeBreak) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("employeeId", employeeId);
        fd.set("breakSessionId", activeBreak.id);
        await endBreakAction(fd);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to end break");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      {activeBreak ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-warning/35 bg-warning/10 px-3 py-2">
            <p className="text-xs font-medium text-warning flex items-center gap-1.5">
              <Coffee className="h-3.5 w-3.5" />
              On Break
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Started at {new Date(activeBreak.breakStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <Button onClick={handleEnd} disabled={pending} className="w-full" variant="destructive">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TimerOff className="h-4 w-4" />}
            End Break
          </Button>
        </div>
      ) : (
        <Button onClick={handleStart} disabled={pending} className="w-full">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Start Break
        </Button>
      )}
      <p className="text-xs text-muted-foreground text-center">
        Records use the current time.
      </p>
    </div>
  );
}
