import { clearCachedCompileResult, resetStats, setLockfile } from "../src";
import { CACHE_NAME, buildVirtualUrl, getManifestUrl } from "../src/constants";
import type { CompileResult } from "../src/types";

import { SOURCE_ID, STORY_ROOT } from "./compileScenarioShared";

declare global {
  interface Window {
    __tinyUiBundlerSwReady?: Promise<ServiceWorkerRegistration | null>;
  }
}

export type AccessibilityCheck =
  | {
      status: "ok";
    }
  | {
      status: "skipped";
      details?: string;
    }
  | {
      status: "error";
      details?: string;
    };

export type HostedBundle = {
  id: string;
  hash: string;
  url: string;
  bytes: number;
  lockfileHash: string;
  updatedAt: number;
  entryCached: boolean;
  assets: {
    path: string;
    cached: boolean;
  }[];
};

type ManifestEntry = {
  hash: string;
  url: string;
  assets: string[];
  bytes: number;
  lockfileHash: string;
  updatedAt: number;
};

const toAssetUrl = (hash: string, assetPath: string) => buildVirtualUrl(hash, assetPath);

export const listHostedBundles = async (): Promise<HostedBundle[]> => {
  if (typeof window === "undefined") return [];
  if (!("caches" in globalThis)) return [];

  let cache: Cache | null = null;

  try {
    cache = await caches.open(CACHE_NAME);
  } catch (error) {
    console.warn("[Tiny UI Bundler] Failed to open cache while listing bundles", error);
    return [];
  }

  if (!cache) return [];

  let manifestResponse: Response | undefined;

  try {
    manifestResponse = await cache.match(getManifestUrl());
  } catch (error) {
    console.warn("[Tiny UI Bundler] Failed to query manifest while listing bundles", error);
    return [];
  }

  if (!manifestResponse) return [];

  let rawManifest: unknown;

  try {
    rawManifest = await manifestResponse.json();
  } catch (error) {
    console.warn("[Tiny UI Bundler] Failed to parse manifest while listing bundles", error);
    return [];
  }

  if (!rawManifest || typeof rawManifest !== "object") return [];

  const manifest = rawManifest as Record<string, ManifestEntry>;
  const bundles: HostedBundle[] = [];

  for (const [id, entry] of Object.entries(manifest)) {
    if (!entry || typeof entry !== "object") continue;

    try {
      const hash = typeof entry.hash === "string" ? entry.hash : "";
      const entryUrl = typeof entry.url === "string" ? entry.url : "";
      const entryMatch = entryUrl ? await cache.match(entryUrl) : undefined;
      const assets = await Promise.all(
        Array.isArray(entry.assets)
          ? entry.assets.map(async (assetPath) => {
              const assetMatch = await cache.match(toAssetUrl(hash, assetPath));
              return {
                path: assetPath,
                cached: Boolean(assetMatch),
              };
            })
          : [],
      );

      bundles.push({
        id,
        hash,
        url: entryUrl,
        bytes: typeof entry.bytes === "number" ? entry.bytes : 0,
        lockfileHash: typeof entry.lockfileHash === "string" ? entry.lockfileHash : "",
        updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0,
        entryCached: Boolean(entryMatch),
        assets,
      });
    } catch (error) {
      console.warn(`[Tiny UI Bundler] Failed to inspect cache entry for ${id}`, error);
    }
  }

  return bundles.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const ensureServiceWorkerRegistered = async () => {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  if (window.__tinyUiBundlerSwReady) {
    return window.__tinyUiBundlerSwReady;
  }

  const { serviceWorker } = navigator;
  if (!serviceWorker) return null;

  const readinessPromise = (async () => {
    try {
      const existing =
        typeof serviceWorker.getRegistration === "function"
          ? await serviceWorker.getRegistration("/tiny-ui-sw.js")
          : null;
      const registration =
        existing ??
        (typeof serviceWorker.register === "function" ? await serviceWorker.register("/tiny-ui-sw.js") : null);

      if (!registration) return null;

      try {
        return await serviceWorker.ready;
      } catch (readyError) {
        console.warn("[tiny-ui-bundler] Service worker ready wait failed after registration", readyError);
        return registration;
      }
    } catch (error) {
      console.warn("[tiny-ui-bundler] Failed to ensure service worker registration", error);
      return null;
    }
  })();

  window.__tinyUiBundlerSwReady = readinessPromise;
  return readinessPromise;
};

const waitForServiceWorker = async () => {
  if (typeof window === "undefined") return;
  if (!window.__tinyUiBundlerSwReady) {
    await ensureServiceWorkerRegistered();
  }

  const readiness = window.__tinyUiBundlerSwReady;
  if (!readiness) return;

  try {
    await readiness;
  } catch (error) {
    console.warn("[tiny-ui-bundler] Service worker readiness wait failed", error);
  }
};

export const resetServiceWorker = async () => {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const { serviceWorker } = navigator;
  if (!serviceWorker) return;

  try {
    await waitForServiceWorker();
  } catch (error) {
    console.warn("[tiny-ui-bundler] Service worker readiness wait failed during reset", error);
  }

  try {
    const registrations =
      typeof serviceWorker.getRegistrations === "function" ? await serviceWorker.getRegistrations() : [];

    const scopedRegistrations = registrations.filter((registration) => registration.scope.includes(STORY_ROOT));

    if (scopedRegistrations.length > 0) {
      await Promise.all(scopedRegistrations.map((registration) => registration.unregister()));
    } else if (typeof serviceWorker.getRegistration === "function") {
      const registration = await serviceWorker.getRegistration(STORY_ROOT);
      if (registration) {
        await registration.unregister();
      }
    }
  } catch (error) {
    console.warn("[tiny-ui-bundler] Reset service worker failed", error);
  }

  window.__tinyUiBundlerSwReady = undefined;
};

const deleteBundleCaches = async () => {
  if (!("caches" in globalThis)) return;
  if (typeof caches.keys !== "function") return;

  const keys = await caches.keys();
  const bundleKeys = keys.filter((key) => key.startsWith("tiny-ui-"));
  await Promise.all(bundleKeys.map((key) => caches.delete(key)));
};

export const resetCompileArtifacts = async () => {
  try {
    await clearCachedCompileResult(SOURCE_ID);
  } catch (error) {
    console.warn("[Tiny UI Bundler] Failed to clear manifest entry", error);
  }

  try {
    await deleteBundleCaches();
  } catch (error) {
    console.warn("[Tiny UI Bundler] Failed to delete caches", error);
  }

  resetStats();
  setLockfile(null);
};

export const verifyBundleAccessibility = async (bundle: CompileResult): Promise<AccessibilityCheck> => {
  if (typeof window === "undefined") {
    return { status: "skipped", details: "Storybook not running in a browser context" };
  }

  if (!("serviceWorker" in navigator)) {
    return { status: "skipped", details: "Service workers are unsupported in this browser" };
  }

  try {
    await waitForServiceWorker();
    const response = await fetch(bundle.url, { cache: "reload" });
    if (!response.ok) {
      return { status: "error", details: `Fetch failed (${response.status})` };
    }
    await response.text();
    return { status: "ok" };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    return { status: "error", details };
  }
};

export const compileStoryHelpers = {
  ensureServiceWorkerRegistered,
  resetCompileArtifacts,
  resetServiceWorker,
};
