/// <reference lib="webworker" />

import { CACHE_NAME } from "../../constant.js";

const sw = self as unknown as ServiceWorkerGlobalScope;

const RUNTIME_HTML_PATH = "/tiny-ui/iframe.html";
const VIRTUAL_PREFIX = "/virtual/";

const CACHE_NAME_PREFIX = "tiny-ui-";

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

      return new Response("Not found", { status: 404 });
    })(),
  );
});
