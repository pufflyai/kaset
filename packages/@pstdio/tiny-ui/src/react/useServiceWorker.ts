import { useEffect, useState } from "react";
import { resetBasePath, setBasePath } from "@pstdio/tiny-ui-bundler";
import type { TinyUIStatus } from "./types";

interface UseServiceWorkerOptions {
  serviceWorkerUrl: string;
  onError?(error: Error): void;
  onStatusChange?(status: TinyUIStatus): void;
}

const initializationErrorMessage = "Tiny UI initialization failed";
const activationTimeoutMs = 10;

function toTinyUIError(error: unknown) {
  return error instanceof Error ? error : new Error(initializationErrorMessage);
}

function getScopePathFromUrl(url: URL) {
  const rawPath = url.pathname.replace(/[^/]+$/, "");
  if (!rawPath) return "/";
  return rawPath.endsWith("/") ? rawPath : `${rawPath}/`;
}

function waitForActivation(worker: ServiceWorker | null | undefined) {
  if (!worker) return Promise.resolve();
  if (worker.state === "activated") return Promise.resolve();

  return new Promise<void>((resolve) => {
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      worker.removeEventListener("statechange", handleStateChange);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const resolveSafely = () => {
      cleanup();
      resolve();
    };

    const handleStateChange = () => {
      if (worker.state === "activated" || worker.state === "redundant") {
        resolveSafely();
      }
    };

    const timeoutId =
      activationTimeoutMs > 0
        ? globalThis.setTimeout(() => {
            resolveSafely();
          }, activationTimeoutMs)
        : null;

    worker.addEventListener("statechange", handleStateChange);
  });
}

function waitForController(expectedScope: string) {
  if (!("serviceWorker" in navigator)) return Promise.resolve<string | null>(null);

  const getControllerScope = () => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) return null;
    try {
      const controllerUrl = new URL(controller.scriptURL);
      const scopePath = controllerUrl.pathname.replace(/[^/]+$/, "");
      if (!scopePath) return "/";
      return scopePath.endsWith("/") ? scopePath : `${scopePath}/`;
    } catch (error) {
      console.warn("[Tiny UI] Failed to read controller scope", error);
      return null;
    }
  };

  const immediateScope = getControllerScope();
  if (immediateScope) {
    if (expectedScope && immediateScope !== expectedScope) {
      console.warn("[Tiny UI] SW controller scope mismatch", { expectedScope, controllerScope: immediateScope });
    }
    return Promise.resolve(immediateScope);
  }

  return new Promise<string | null>((resolve) => {
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (timeoutId) globalThis.clearTimeout(timeoutId);
    };

    const resolveSafely = (value: string | null) => {
      cleanup();
      resolve(value);
    };

    const handleControllerChange = () => {
      const scope = getControllerScope();
      if (scope) {
        if (expectedScope && scope !== expectedScope) {
          console.warn("[Tiny UI] SW controller scope mismatch", { expectedScope, controllerScope: scope });
        }
        resolveSafely(scope);
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const timeoutId =
      activationTimeoutMs > 0
        ? globalThis.setTimeout(() => {
            resolveSafely(null);
          }, activationTimeoutMs)
        : null;
  });
}

export function useServiceWorker(options: UseServiceWorkerOptions) {
  const { serviceWorkerUrl, onError, onStatusChange } = options;
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setServiceWorkerReady(false);
    resetBasePath();

    let expectedScope = "/";
    let resolvedUrl: URL | null = null;

    try {
      resolvedUrl = new URL(serviceWorkerUrl, window.location.origin);
      expectedScope = getScopePathFromUrl(resolvedUrl);
      setBasePath(expectedScope);
      console.info("[Tiny UI] SW derived scope", { serviceWorkerUrl: resolvedUrl.href, expectedScope });
    } catch (error) {
      console.warn("[Tiny UI] Failed to derive base path from service worker URL", error);
    }

    const ensureServiceWorker = async () => {
      if (!("serviceWorker" in navigator)) return;
      if (!resolvedUrl) return;

      const registration = await navigator.serviceWorker.register(resolvedUrl.href, { scope: expectedScope });
      console.info("[Tiny UI] SW registration", {
        scope: registration.scope,
        active: registration.active?.state,
        installing: registration.installing?.state,
        waiting: registration.waiting?.state,
      });
      const worker = registration.active ?? registration.installing ?? registration.waiting ?? null;

      await waitForActivation(worker);
      if (cancelled) return;

      const controllerScope = await waitForController(expectedScope);
      if (cancelled) return;

      if (controllerScope) {
        setBasePath(controllerScope);
        console.info("[Tiny UI] SW controller scope", controllerScope);
      } else {
        const scopeUrl = new URL(registration.scope);
        setBasePath(getScopePathFromUrl(scopeUrl));
        console.info("[Tiny UI] SW fallback scope", registration.scope);
      }
    };

    (async () => {
      try {
        onStatusChange?.("initializing");
        await ensureServiceWorker();
        if (cancelled) return;
        setServiceWorkerReady(true);
      } catch (error) {
        if (cancelled) return;
        onStatusChange?.("error");
        onError?.(toTinyUIError(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onError, serviceWorkerUrl, onStatusChange]);

  return serviceWorkerReady;
}

interface UseCompileOptions {
  autoCompile: boolean;
  serviceWorkerReady: boolean;
  doCompileAndInit(): Promise<void>;
  onError?(error: Error): void;
  onStatusChange?(status: TinyUIStatus): void;
}

export function useCompile(options: UseCompileOptions) {
  const { autoCompile, serviceWorkerReady, doCompileAndInit, onError, onStatusChange } = options;

  useEffect(() => {
    if (!autoCompile || !serviceWorkerReady) return;

    let cancelled = false;

    (async () => {
      try {
        await doCompileAndInit();
      } catch (error) {
        if (cancelled) return;
        onStatusChange?.("error");
        onError?.(toTinyUIError(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoCompile, doCompileAndInit, onError, serviceWorkerReady, onStatusChange]);
}
