"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Coffee, TimerOff, Loader2, Play } from "lucide-react";
import { startBreakAction, endBreakAction } from "../../actions";
import { useRouter } from "next/navigation";

type ActiveBreak = {
  id: string;
  breakStart: string;
  breakCategory: string;
  notes: string | null;
};

function fmt(totalSec: number) {
  const s = Math.abs(Math.trunc(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Live timer while on break. Counts UP from 00:00 (elapsed break time) and
 * keeps running until the user presses "End Break Time". Once it passes the
 * allowed break threshold it turns red and shows how far over.
 */
function BreakCountdown({
  breakStart,
  thresholdMin,
}: {
  breakStart: string;
  thresholdMin: number;
}) {
  const startMs = new Date(breakStart).getTime();
  const thresholdSec = Math.max(0, thresholdMin) * 60;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = Math.max(0, Math.floor((now - startMs) / 1000));
  const over = thresholdSec > 0 && elapsedSec >= thresholdSec;
  const lowWarn = !over && thresholdSec > 0 && thresholdSec - elapsedSec <= 60;
  const overBySec = over ? elapsedSec - thresholdSec : 0;

  return (
    <div
      className={`rounded-lg border px-3 py-3 text-center ${
        over
          ? "border-destructive/40 bg-destructive/10"
          : lowWarn
            ? "border-warning/40 bg-warning/10"
            : "border-border/60 bg-background/40"
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {over ? "Over allowed break" : "Break time"}
      </p>
      <p
        className={`mt-0.5 font-mono text-3xl font-semibold tabular-nums ${
          over
            ? "text-destructive"
            : lowWarn
              ? "text-warning"
              : "text-foreground"
        }`}
      >
        {fmt(elapsedSec)}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {over
          ? `Over by ${fmt(overBySec)} · Allowed ${thresholdMin} min`
          : `Allowed ${thresholdMin} min`}
      </p>
    </div>
  );
}

export function BreakStartEndPanel({
  employeeId,
  thresholdMin,
  activeBreak,
}: {
  employeeId: string;
  thresholdMin: number;
  activeBreak: ActiveBreak | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const router = useRouter();

  function handleStart() {
    setError(null);
    if (!note.trim()) {
      setError("Please enter a reason for the break before starting.");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("employeeId", employeeId);
        fd.set("note", note.trim());
        await startBreakAction(fd);
        setNote("");
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
        <>
          <div className="rounded-lg border border-warning/35 bg-warning/10 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
              <Coffee className="h-3.5 w-3.5" />
              On Break
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Started at{" "}
              {new Date(activeBreak.breakStart).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <BreakCountdown
            breakStart={activeBreak.breakStart}
            thresholdMin={thresholdMin}
          />

          {activeBreak.notes && (
            <p className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Reason: </span>
              {activeBreak.notes}
            </p>
          )}

          <Button
            onClick={handleEnd}
            disabled={pending}
            className="w-full"
            variant="destructive"
            size="lg"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TimerOff className="h-4 w-4" />
            )}
            End Break Time
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="break-note">
              Reason for taking break <span className="text-destructive">*</span>
            </label>
            <textarea
              id="break-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Lunch, prayer, deliver parcel to courier office"
              className={`flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                error && !note.trim() ? "border-destructive" : "border-input"
              }`}
            />
            <p className="text-[11px] text-muted-foreground">
              Mention <span className="font-medium">courier</span> if it&apos;s a
              work errand — that time counts as working/duty time.
            </p>
          </div>

          <Button
            onClick={handleStart}
            disabled={pending}
            className="w-full"
            size="lg"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Start Break Time
          </Button>
        </div>
      )}
    </div>
  );
}
