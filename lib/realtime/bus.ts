// In-process realtime bus.
//
// Server Actions and the custom WebSocket server (server.js) run in the SAME
// Node process, so a single EventEmitter pinned to globalThis lets a Server
// Action announce "this run's advances changed" and have the WS layer fan it
// out to subscribed browsers. NO salary data crosses the socket — only a
// {runId, employeeId?} hint; the client re-fetches through the authenticated
// server component. Single-instance only (in-memory): fine for the current
// single-container deploy; would need Redis pub/sub if scaled to >1 replica.
import { EventEmitter } from "node:events";

/** What triggered the change — drives the popup wording on the client. */
export type AdvanceChangeKind =
  | "created" // a new advance was recorded
  | "updated" // amount / installment edited
  | "cancelled" // an advance was cancelled
  | "refreshed"; // "Refresh advances" / re-sync ran

export type AdvanceChangeEvent = {
  type: "advance-changed";
  /** Tenant scope — clients subscribe by tenant and filter on this. */
  tenantId: string;
  kind: AdvanceChangeKind;
  /** Optional run hint (UI only; clients re-fetch their own server data). */
  runId?: string;
  /** Optional: the employee whose row moved (UI hint only). */
  employeeId?: string;
};

const KEY = "__hrmIlhaanSqRealtimeBus__";
type Glob = typeof globalThis & { [KEY]?: EventEmitter };

function bus(): EventEmitter {
  const g = globalThis as Glob;
  if (!g[KEY]) {
    const e = new EventEmitter();
    // Many salary sheets may subscribe to the same process; lift the cap.
    e.setMaxListeners(0);
    g[KEY] = e;
  }
  return g[KEY]!;
}

const CHANNEL = "advance-changed";

/** Called from Server Actions after advance data for a run actually changed. */
export function publishAdvanceChange(ev: Omit<AdvanceChangeEvent, "type">) {
  bus().emit(CHANNEL, { type: "advance-changed", ...ev } satisfies AdvanceChangeEvent);
}

/** Subscribed by server.js to push events to WebSocket clients. Returns an unsubscribe fn. */
export function onAdvanceChange(fn: (ev: AdvanceChangeEvent) => void): () => void {
  const b = bus();
  b.on(CHANNEL, fn);
  return () => b.off(CHANNEL, fn);
}

// ─── Generic realtime channel ───────────────────────────────
// App-wide realtime: ANY part of the app can push a tenant-scoped event
// (notification, data-changed, …). server.cjs fans these out to every open
// page for that tenant; the app-wide RealtimeProvider pops a toast and
// router.refresh()es. No sensitive data crosses the socket — only a hint;
// authenticated server components re-fetch on refresh.
export type RealtimeEvent = {
  type: "realtime";
  /** Tenant scope — clients subscribe by tenant and filter on this. */
  tenantId: string;
  /** "notification" | "data" | feature-specific kinds. */
  kind: string;
  title?: string;
  body?: string | null;
  severity?: string;
  category?: string;
};

const RT_CHANNEL = "realtime";

export function publishRealtime(ev: Omit<RealtimeEvent, "type">) {
  try {
    bus().emit(RT_CHANNEL, { type: "realtime", ...ev } satisfies RealtimeEvent);
  } catch {
    /* realtime is best-effort and must never break the caller */
  }
}

export function onRealtime(fn: (ev: RealtimeEvent) => void): () => void {
  const b = bus();
  b.on(RT_CHANNEL, fn);
  return () => b.off(RT_CHANNEL, fn);
}
