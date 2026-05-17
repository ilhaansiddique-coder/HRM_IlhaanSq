// Custom Next.js server.
//
// Next.js App Router has no native WebSocket support. To get realtime updates
// (advance changes -> live salary-sheet refresh) we run Next and a `ws` server
// on the SAME HTTP port. WebSocket upgrades on path `/_ws` are routed to `ws`;
// everything else goes to the Next request handler.
//
// Server Actions run inside this same process, so they publish on an
// EventEmitter pinned to globalThis (mirrors lib/realtime/bus.ts — same KEY).
// We attach a plain-JS listener here without importing the TS module.
//
// IMPORTANT: production must run `node server.cjs` (NOT `next start`).
const http = require("node:http");
const { parse } = require("node:url");
const { EventEmitter } = require("node:events");
const next = require("next");
const { WebSocketServer } = require("ws");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";

// Same key/shape as lib/realtime/bus.ts so Server Actions and this server
// share one emitter within the process.
const BUS_KEY = "__raheDeenRealtimeBus__";
function bus() {
  if (!globalThis[BUS_KEY]) {
    const e = new EventEmitter();
    e.setMaxListeners(0);
    globalThis[BUS_KEY] = e;
  }
  return globalThis[BUS_KEY];
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    let pathname = "/";
    try {
      pathname = parse(req.url || "/").pathname || "/";
    } catch {
      socket.destroy();
      return;
    }
    if (pathname === "/_ws") {
      wss.handleUpgrade(req, socket, head, (ws) =>
        wss.emit("connection", ws, req)
      );
    } else {
      // Let Next/HMR handle its own upgrades (e.g. dev websocket); destroy
      // anything else so we don't leak sockets.
      if (!dev) socket.destroy();
    }
  });

  // Each client subscribes by tenant (salary sheet AND advances page). The
  // server fans every advance change out to all of that tenant's open pages.
  wss.on("connection", (ws) => {
    ws.tenantId = null;
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg && typeof msg.tenantId === "string") ws.tenantId = msg.tenantId;
      } catch {
        /* ignore malformed frames */
      }
    });
    ws.on("error", () => {
      /* swallow — connection cleanup handled by close */
    });
  });

  // Drop dead connections so the broadcast set stays clean.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((c) => {
      if (c.isAlive === false) return c.terminate();
      c.isAlive = false;
      try {
        c.ping();
      } catch {
        /* ignore */
      }
    });
  }, 30000);
  wss.on("close", () => clearInterval(heartbeat));

  // Fan a published advance change out to every open page for that tenant
  // (salary sheets + the advances page).
  bus().on("advance-changed", (ev) => {
    if (!ev || !ev.tenantId) return;
    const data = JSON.stringify(ev);
    wss.clients.forEach((c) => {
      if (c.readyState === 1 /* OPEN */ && c.tenantId === ev.tenantId) {
        try {
          c.send(data);
        } catch {
          /* ignore */
        }
      }
    });
  });

  server.listen(port, hostname, () => {
    console.log(
      `> Ready on http://${hostname}:${port}  (websocket: /_ws, dev=${dev})`
    );
  });
});
