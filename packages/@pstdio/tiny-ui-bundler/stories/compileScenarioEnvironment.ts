import { clearCachedCompileResult, resetStats, setLockfile } from "../src";
import type { CompileResult } from "../src/esbuild/types";

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
