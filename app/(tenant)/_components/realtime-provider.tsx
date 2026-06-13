"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { realtimeStatus } from "./realtime-status";

// App-wide realtime. Mounted once in TenantShell, so EVERY tenant page gets
// instant push: it opens a single websocket to the custom server
// (server.cjs, path /_ws), subscribes by tenant, and on any realtime event
// for this tenant pops a toast + router.refresh() so the bell, /admin and
// the current page reflect it live — no 25s wait.
//
// Degrades silently: if the app is served WITHOUT the custom ws server
// (plain `next dev` / `next start` / nginx), /_ws never connects and the
// NotificationPoller fallback keeps things working.

export function RealtimeProvider({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const tenantRef = useRef(tenantId);
  tenantRef.current = tenantId;

  useEffect(() => {
    if (typeof window === "undefined" || !tenantId) return;

    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let attempts = 0;
    let pending = 0; // coalesced events since last refresh

    // Debounce refresh + summarise toasts so a burst of writes doesn't storm.
    const flush = () => {
      refreshTimer = null;
      if (pending > 1) toast.info(`${pending} new updates`);
      pending = 0;
      router.refresh();
    };

    const onEvent = (title?: string, body?: string | null, sev?: string) => {
      pending += 1;
      if (pending === 1) {
        const msg = body ? `${title} — ${body}` : title || "New activity";
        const fn =
          sev === "warning"
            ? toast.warning
            : sev === "critical"
              ? toast.error
              : sev === "success"
                ? toast.success
                : toast.info;
        fn(msg);
      }
      if (!refreshTimer) refreshTimer = setTimeout(flush, 1500);
    };

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      try {
        ws = new WebSocket(`${proto}://${window.location.host}/_ws`);
      } catch {
        scheduleRetry();
        return;
      }

      ws.onopen = () => {
        attempts = 0;
        realtimeStatus.connected = true;
        ws?.send(JSON.stringify({ tenantId: tenantRef.current }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg?.tenantId !== tenantRef.current) return;
          if (msg?.type === "realtime") {
            onEvent(msg.title, msg.body, msg.severity);
          }
          // advance-changed is handled by the dedicated AdvanceLiveRefresh
          // on the salary-sheet/advances pages — ignore it here.
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        realtimeStatus.connected = false;
        if (!closed) scheduleRetry();
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      };
    };

    const scheduleRetry = () => {
      if (closed) return;
      attempts += 1;
      // 1s → 30s cap; never spins hot when /_ws is unavailable.
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts, 5));
      retry = setTimeout(connect, delay);
    };

    connect();

    return () => {
      closed = true;
      realtimeStatus.connected = false;
      if (retry) clearTimeout(retry);
      if (refreshTimer) clearTimeout(refreshTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [router, tenantId]);

  return null;
}
