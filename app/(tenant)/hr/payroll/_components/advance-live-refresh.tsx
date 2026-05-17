"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

// Opens a websocket to the custom server (server.cjs, path /_ws), subscribes
// by TENANT, and on any advance change for this tenant shows a popup and
// router.refresh()es so the salary sheet / advances page reflect it live
// (Total Advance ← outstanding, Advance Recovery ← installment, etc.).
// No salary data crosses the socket — the authenticated server component
// re-fetches on refresh. Renders nothing.
//
// Degrades silently: if served by `next start` instead of `node server.cjs`,
// /_ws won't accept upgrades and it just keeps retrying quietly.
const MSG: Record<string, { title: string; desc: string }> = {
  created: { title: "New advance recorded", desc: "Salary sheet updated for that employee." },
  updated: { title: "Advance updated", desc: "Installment applied to Advance Recovery." },
  cancelled: { title: "Advance cancelled", desc: "Recovery reversed on the salary sheet." },
  refreshed: { title: "Advances re-synced", desc: "Advance figures refreshed from the ledger." },
};

export function AdvanceLiveRefresh({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const tenantRef = useRef(tenantId);
  tenantRef.current = tenantId;

  useEffect(() => {
    if (typeof window === "undefined") return;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let attempts = 0;

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
        ws?.send(JSON.stringify({ tenantId: tenantRef.current }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (
            msg?.type === "advance-changed" &&
            msg.tenantId === tenantRef.current
          ) {
            const m = MSG[msg.kind as string] ?? {
              title: "Advance updated",
              desc: "Salary sheet refreshed.",
            };
            // Popup fires immediately; data re-fetches in the background.
            toast.info(m.title, { description: m.desc });
            router.refresh();
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
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
      // Backoff 1s -> 30s cap; never spins hot if /_ws is unavailable.
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts, 5));
      retry = setTimeout(connect, delay);
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [router]);

  return null;
}
