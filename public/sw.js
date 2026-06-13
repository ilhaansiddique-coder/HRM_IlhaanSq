const CACHE_VERSION = "rahestock-pwa-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
// Treat localhost AND private LAN / .local hosts as "dev origins". Next.js dev
// chunks under /_next/static/ are NOT content-hashed, so caching them serves
// stale code. On any dev origin the SW is a pure network pass-through; only a
// real (public, https) production origin gets PWA caching, where /_next/static
// filenames are content-hashed and therefore safe to cache aggressively.
const HOSTNAME = self.location.hostname;
const IS_DEV_ORIGIN =
  HOSTNAME === "localhost" ||
  HOSTNAME === "127.0.0.1" ||
  HOSTNAME === "::1" ||
  HOSTNAME === "0.0.0.0" ||
  HOSTNAME.endsWith(".local") ||
  HOSTNAME.endsWith(".localhost") ||
  /^10\./.test(HOSTNAME) ||
  /^192\.168\./.test(HOSTNAME) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(HOSTNAME);
const APP_SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
];

const isCacheableAsset = (url) => {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/_next/webpack-hmr")) return false;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".webmanifest")
  );
};

self.addEventListener("install", (event) => {
  if (IS_DEV_ORIGIN) {
    event.waitUntil(self.skipWaiting());
    return;
  }

  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("rahestock-pwa-") && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const networkFirst = async (request) => {
  if (IS_DEV_ORIGIN) {
    return fetch(request);
  }

  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    const shellResponse = await caches.match("/");
    if (shellResponse) {
      return shellResponse;
    }
    throw error;
  }
};

const staleWhileRevalidate = async (request) => {
  if (IS_DEV_ORIGIN) {
    return fetch(request);
  }

  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);
  const networkResponse = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  if (cachedResponse) {
    return cachedResponse;
  }

  const freshResponse = await networkResponse;
  if (freshResponse) {
    return freshResponse;
  }

  return fetch(request);
};

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
