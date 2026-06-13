"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { realtimeStatus } from "./realtime-status";

// App-wide notification popup. Mounted once in TenantShell, so it runs on
// every tenant page. Polls the recent-notifications API; when something new
// shows up (any activity, anywhere in the app) it pops a toast and refreshes
// the server tree so the TopBar bell + /admin counts update without a manual
// reload. Polling (not WebSocket) keeps this independent of the custom ws
// server, which has prod deploy caveats.

const POLL_MS = 25_000;

type Item = {
  id: string;
  title: string;
  body: string | null;
  category: string;
  severity: string;
  createdAt: string;
};

export function NotificationPoller() {
  const router = useRouter();
  // Baseline server time. Seeded on the first successful poll so we never
  // backfill toasts for notifications that already existed before this load.
  const sinceRef = useRef<number | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        if (typeof document !== "undefined" && document.hidden) return;
        // Fallback only: when the websocket is connected it already pushes
        // toasts + refreshes instantly, so the poll stands down.
        if (realtimeStatus.connected) return;

        const res = await fetch("/api/notifications/recent", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: { now: string; items: Item[] } = await res.json();
        const nowMs = new Date(data.now).getTime();

        if (sinceRef.current === null) {
          // First poll: establish the baseline, don't toast history.
          sinceRef.current = nowMs;
          data.items.forEach((i) => seenRef.current.add(i.id));
          return;
        }

        const fresh = data.items.filter(
          (i) =>
            !seenRef.current.has(i.id) &&
            new Date(i.createdAt).getTime() > (sinceRef.current ?? 0)
        );
        if (fresh.length === 0) return;

        fresh.forEach((i) => seenRef.current.add(i.id));
        sinceRef.current = nowMs;

        if (fresh.length === 1) {
          const n = fresh[0];
          const msg = n.body ? `${n.title} — ${n.body}` : n.title;
          const fn =
            n.severity === "warning"
              ? toast.warning
              : n.severity === "critical"
                ? toast.error
                : n.severity === "success"
                  ? toast.success
                  : toast.info;
          fn(msg);
        } else {
          toast.info(`${fresh.length} new activities`);
        }

        // Refresh server components so the bell + admin counts update live.
        router.refresh();
      } catch {
        // Polling must stay silent on failure.
      }
    }

    function loop() {
      if (stopped) return;
      void tick().finally(() => {
        if (!stopped) timer = setTimeout(loop, POLL_MS);
      });
    }

    // Small initial delay so it doesn't contend with first paint.
    timer = setTimeout(loop, 4_000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [router]);

  return null;
}
