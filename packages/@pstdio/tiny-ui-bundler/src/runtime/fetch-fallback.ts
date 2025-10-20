/**
 * Tiny UI bundles are normally served by the service worker under `/virtual/*`.
 * During a hard reload browsers bypass the SW, so those URLs 404 even though the
 * compiled assets are already cached. This module installs a light-weight fetch
 * shim that spots those virtual requests when no controller is present and
 * fulfils them straight from the Cache API. The shim is idempotent and safe to
 * call multiple times.
 *
 * Usage:
 *   import { ensureVirtualFetchFallback } from "@pstdio/tiny-ui-bundler";
 *   ensureVirtualFetchFallback();
 *
 * That call is cheap when the SW is active; it only steps in while the page is
 * bypassing the controller so you still get real network behaviour elsewhere.
 */

import { CACHE_NAME, getManifestUrl, getVirtualPrefix } from "../constants";

const PATCH_FLAG = "__tinyUiVirtualFetchPatched";

const supportsPatching = () =>
  typeof window !== "undefined" &&
  typeof globalThis.fetch === "function" &&
  typeof caches !== "undefined" &&
  typeof Request !== "undefined";

export const isServiceWorkerControlled = () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  return Boolean(navigator.serviceWorker.controller);
};

const shouldHandleRequest = (request: Request) => {
  if (request.method !== "GET") return false;

  try {
    const prefix = getVirtualPrefix();
    const manifestUrl = getManifestUrl();
    const url = new URL(request.url, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    if (url.pathname === manifestUrl) return true;
    return url.pathname.startsWith(prefix);
  } catch {
    return false;
  }
};

const openVirtualCache = async () => {
  if (typeof caches === "undefined") return null;
  return caches.open(CACHE_NAME);
};

const matchCachedResponse = async (request: Request) => {
  const cache = await openVirtualCache();
  if (!cache) return null;

  const direct = await cache.match(request);
  if (direct) return direct;

  try {
    const url = new URL(request.url, window.location.origin);
    const byPath = await cache.match(url.pathname);
    if (byPath) return byPath;
  } catch {
    // ignore parsing issues
  }

  return null;
};

export const ensureVirtualFetchFallback = () => {
  if (!supportsPatching()) return;
  const globalAny = globalThis as unknown as Record<string, unknown>;
  if (globalAny[PATCH_FLAG]) return;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request =
      input instanceof Request
        ? input
        : new Request(typeof input === "string" || input instanceof URL ? input : String(input), init);

    if (isServiceWorkerControlled() || !shouldHandleRequest(request)) {
      return originalFetch(input as RequestInfo, init);
    }

    const cached = await matchCachedResponse(request);
    if (cached) return cached.clone();

    return originalFetch(input as RequestInfo, init);
  }) as typeof fetch;

  globalAny[PATCH_FLAG] = true;
};
