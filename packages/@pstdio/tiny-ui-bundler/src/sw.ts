/// <reference lib="webworker" />

// KEEP IN SYNC with
const CACHE_NAME_PREFIX = "tiny-ui-";
const CACHE_NAME = "tiny-ui-bundles-v1";

const sw = self as unknown as ServiceWorkerGlobalScope;

const scopePath = new URL(sw.registration.scope).pathname;
const basePath = scopePath.endsWith("/") ? scopePath : `${scopePath}/`;

const RUNTIME_HTML_PATH = `${basePath}tiny-ui/runtime.html`;
const VIRTUAL_PREFIX = `${basePath}virtual/`;
// -----------------------------

const shouldHandleFetch = (request: Request) => {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return false;

  return url.pathname === RUNTIME_HTML_PATH || url.pathname.startsWith(VIRTUAL_PREFIX);
};

const matchCachedResponse = async (cache: Cache, request: Request) => {
  const directMatch = await cache.match(request);
  if (directMatch) return directMatch;

  const url = new URL(request.url);
  const normalizedMatch = await cache.match(url.pathname);
  if (normalizedMatch) return normalizedMatch;

  if (url.pathname === RUNTIME_HTML_PATH) {
    const runtimeMatch = await cache.match(RUNTIME_HTML_PATH);
    if (runtimeMatch) return runtimeMatch;
  }

  return null;
};

sw.addEventListener("install", (event) => {
  const installEvent = event as ExtendableEvent;
  installEvent.waitUntil(sw.skipWaiting());
});

sw.addEventListener("activate", (event) => {
  const activateEvent = event as ExtendableEvent;
  activateEvent.waitUntil(
    (async () => {
      await sw.clients.claim();
      const cacheKeys = await caches.keys();
      const deletions = cacheKeys
        .filter((key) => key !== CACHE_NAME && key.startsWith(CACHE_NAME_PREFIX))
        .map((key) => caches.delete(key));

      await Promise.all(deletions);
    })(),
  );
});

sw.addEventListener("fetch", (event) => {
  const fetchEvent = event as FetchEvent;
  const { request } = fetchEvent;

  if (!shouldHandleFetch(request)) return;

  fetchEvent.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await matchCachedResponse(cache, request);
      if (cached) return cached;

      const url = new URL(request.url);

      if (url.pathname === RUNTIME_HTML_PATH) {
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            await cache.put(RUNTIME_HTML_PATH, response.clone());
          }
          return response;
        } catch (error) {
          console.error("SW runtime fetch failed:", error);
          return new Response("Runtime unavailable", { status: 503 });
        }
      }

      return new Response("Not found", { status: 404 });
    })(),
  );
});

sw.addEventListener("error", (e) => {
  console.error("SW error:", e.message, e.filename, e.lineno, e.colno, e.error);
});

sw.addEventListener("unhandledrejection", (e) => {
  console.error("SW unhandledrejection:", e.reason);
});
