"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Loader2, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { checkInAction, checkOutAction } from "../hr/actions";

type Today = {
  status: string | null;
  checkIn: string | null;
  checkOut: string | null;
} | null;

function fmtDuration(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(
    2,
    "0"
  )}:${String(sec).padStart(2, "0")}`;
}

// Polished one-tap check-in / check-out for the logged-in employee. Shows a
// live clock + today's state; no employee picker (it's always "me").
export function SelfCheckInOut({
  employeeId,
  today,
}: {
  employeeId: string;
  today: Today;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clock, setClock] = useState("");
  // `now` and the date string are time/locale dependent, so they must start
  // null and only fill in after mount — otherwise the server-rendered second
  // won't match the client's and React throws a hydration mismatch.
  const [now, setNow] = useState<number | null>(null);
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d.getTime());
      setClock(
        d.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    tick();
    setTodayLabel(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    );
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const checkedIn = !!today?.checkIn;
  const checkedOut = !!today?.checkOut;
  const isLate = today?.status === "late";

  const checkInMs = today?.checkIn ? new Date(today.checkIn).getTime() : null;
  const workedSec =
    checkInMs != null
      ? ((checkedOut && today?.checkOut
          ? new Date(today.checkOut).getTime()
          : // Before the first client tick `now` is null — fall back to the
            // check-in time so the live counter renders 00:00:00 identically on
            // server and client, then animates once mounted.
            (now ?? checkInMs)) -
          checkInMs) /
        1000
      : 0;

  function run(fn: (fd: FormData) => Promise<unknown>, label: string) {
    const fd = new FormData();
    fd.set("employeeId", employeeId);
    startTransition(async () => {
      try {
        await fn(fd);
        toast.success(label);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-background/50 p-5 text-center">
        <div className="flex items-center justify-center gap-2 text-3xl font-semibold tabular-nums">
          <Clock className="h-6 w-6 text-primary" />
          {clock || "--:--:--"}
        </div>
        <p className="mt-1 text-xs text-muted-foreground" suppressHydrationWarning>
          {todayLabel || " "}
        </p>

        <div className="mt-4">
          {!checkedIn && (
            <span className="text-sm text-muted-foreground">
              Not checked in yet
            </span>
          )}
          {checkedIn && !checkedOut && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                isLate
                  ? "bg-warning/20 text-warning"
                  : "bg-success/15 text-success"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isLate ? "Checked in — LATE" : "Checked in"} ·{" "}
              {new Date(today!.checkIn!).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {checkedOut && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Done for today ·{" "}
              {new Date(today!.checkIn!).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              →{" "}
              {new Date(today!.checkOut!).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}

          {checkedIn && !checkedOut && (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Working time
              </p>
              <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums text-success">
                {fmtDuration(workedSec)}
              </p>
            </div>
          )}
          {checkedOut && (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Total worked today
              </p>
              <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums text-muted-foreground">
                {fmtDuration(workedSec)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          className="h-12 gap-2"
          disabled={pending || checkedIn}
          onClick={() => run(checkInAction, "Checked in")}
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <LogIn className="h-5 w-5" />
          )}
          Check In
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 gap-2"
          disabled={pending || !checkedIn || checkedOut}
          onClick={() => run(checkOutAction, "Checked out")}
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <LogOut className="h-5 w-5" />
          )}
          Check Out
        </Button>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        Office starts 09:00 — checking in after that is marked late. Fridays
        are the weekly holiday (working a Friday counts as extra duty).
      </p>
    </div>
  );
}
