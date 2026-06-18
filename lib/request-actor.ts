import { AsyncLocalStorage } from "node:async_hooks";

// Request-scoped "who is acting right now" context.
//
// The activity → notification bridge (lib/activity-notify.ts) is a Prisma
// middleware: it sees the write but NOT the HTTP session, so on its own it can't
// say *which user* performed an action. We close that gap with an
// AsyncLocalStorage store that getSession() populates once per request; the
// middleware then reads it to stamp every notification with the actor.
//
// IMPORTANT — call setRequestActor() from the SERVER ACTION BODY (right after
// `await requireTenant()`), NOT from inside requireAuth/getSession. getSession is
// wrapped in React `cache()`, which runs in a detached AsyncLocalStorage context;
// an `enterWith` performed beneath that cache boundary does not propagate back up
// to the action's later Prisma write (verified). Called from the action's own
// async context, the store DOES persist through every downstream await to the
// write, where the activity-notify middleware reads it. Each request gets its own
// async context, so this never leaks between requests.

export type RequestActor = { userId: string; userName: string | null };

const storage = new AsyncLocalStorage<RequestActor>();

/** Set the current request's actor (called from getSession). No-op without id. */
export function setRequestActor(actor: RequestActor | null) {
  if (!actor?.userId) return;
  storage.enterWith(actor);
}

/** The acting user for the current request, or null (system / unauthenticated). */
export function getRequestActor(): RequestActor | null {
  return storage.getStore() ?? null;
}