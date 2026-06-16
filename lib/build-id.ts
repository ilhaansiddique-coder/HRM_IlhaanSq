// Server-only build identifier. Used by /api/version and the root layout to
// detect when a new version has been deployed so connected clients can be
// prompted to refresh.
//
// Resolution order:
//  1. NEXT_PUBLIC_BUILD_ID / BUILD_ID — set these in CI to a commit SHA for a
//     stable, deploy-correct id.
//  2. Fallback: a timestamp captured once per server process.
//
// IMPORTANT: in dev (and in some bundling setups) this module is evaluated in
// MORE THAN ONE module instance — e.g. once for the RSC/layout graph and once
// for the /api/version route handler. If each instance computed its own
// Date.now(), the layout's id would never equal the route's id and the update
// banner would show forever. We cache the resolved id on globalThis so every
// instance in the same Node process agrees on one value; it only changes when
// the process actually restarts (i.e. a real redeploy).
const KEY = "__APP_BUILD_ID__";
const g = globalThis as typeof globalThis & { [KEY]?: string };

export const BUILD_ID: string =
  g[KEY] ??
  (g[KEY] =
    process.env.NEXT_PUBLIC_BUILD_ID ||
    process.env.BUILD_ID ||
    String(Date.now()));
