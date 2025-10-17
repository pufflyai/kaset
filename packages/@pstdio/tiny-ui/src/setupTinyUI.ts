import { getRuntimeHtmlPath, resetBasePath, setBasePath } from "@pstdio/tiny-ui-bundler";
import { TinyUIStatus } from "./types";

const initializationErrorMessage = "Tiny UI initialization failed";
const activationTimeoutMs = 10;

type StatusListener = (status: TinyUIStatus) => void;
type ErrorListener = (error: Error) => void;
type ReadyListener = () => void;

const statusListeners = new Set<StatusListener>();
const errorListeners = new Set<ErrorListener>();
const readyListeners = new Set<ReadyListener>();

const setupState = {
  promise: null as Promise<void> | null,
  ready: false,
  error: null as Error | null,
  serviceWorkerUrl: undefined as string | undefined,
  runtimeUrl: undefined as string | undefined,
};

export interface SetupServiceWorkerOptions {
  serviceWorkerUrl?: string;
}

export interface SetupTinyUIOptions extends SetupServiceWorkerOptions {
  runtimeUrl?: string;
}

export interface TinyUISetupSubscriptionOptions {
  onStatusChange?(status: TinyUIStatus): void;
  onError?(error: Error): void;
  onReady?(): void;
}

export function toTinyUIError(error: unknown) {
  return error instanceof Error ? error : new Error(initializationErrorMessage);
}

function notifyStatus(status: TinyUIStatus) {
  for (const listener of statusListeners) {
    listener(status);
  }
}

function notifyError(error: Error) {
  for (const listener of errorListeners) {
    listener(error);
  }
}

function notifyReady() {
  for (const listener of readyListeners) {
    listener();
  }
}

export function getTinyUISetupState() {
  return {
    ready: setupState.ready,
    error: setupState.error,
    pending: !!setupState.promise && !setupState.ready && !setupState.error,
    serviceWorkerUrl: setupState.serviceWorkerUrl,
    runtimeUrl: setupState.runtimeUrl,
  };
}

export function getTinyUIRuntimePath() {
  return setupState.runtimeUrl ?? getRuntimeHtmlPath();
}

export function subscribeToTinyUISetup(options: TinyUISetupSubscriptionOptions) {
  const { onStatusChange, onError, onReady } = options;

  if (onStatusChange) statusListeners.add(onStatusChange);
  if (onError) errorListeners.add(onError);
  if (onReady) readyListeners.add(onReady);

  return () => {
    if (onStatusChange) statusListeners.delete(onStatusChange);
    if (onError) errorListeners.delete(onError);
    if (onReady) readyListeners.delete(onReady);
  };
}

export async function setupServiceWorker(options: SetupServiceWorkerOptions) {
  const { serviceWorkerUrl } = options;

  resetBasePath();
  if (!serviceWorkerUrl) return;

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

  const controllerScope = await waitForController(expectedScope);

  if (controllerScope) {
    setBasePath(controllerScope);
    console.info("[Tiny UI] SW controller scope", controllerScope);
    return;
  }

  const scopeUrl = new URL(registration.scope);
  setBasePath(getScopePathFromUrl(scopeUrl));
  console.info("[Tiny UI] SW fallback scope", registration.scope);
}

export function setupTinyUI(options: SetupTinyUIOptions = {}) {
  if (setupState.promise && !setupState.ready && !setupState.error) {
    return setupState.promise;
  }

  setupState.serviceWorkerUrl = options.serviceWorkerUrl;
  setupState.runtimeUrl = options.runtimeUrl ?? setupState.runtimeUrl;
  setupState.error = null;
  setupState.ready = false;
  notifyStatus("initializing");

  const promise = (async () => {
    try {
      await setupServiceWorker(options);
      if (options.runtimeUrl) {
        setupState.runtimeUrl = options.runtimeUrl;
      }
      setupState.ready = true;
      notifyStatus("ready");
      notifyReady();
    } catch (error) {
      const err = toTinyUIError(error);
      setupState.error = err;
      notifyStatus("error");
      notifyError(err);
      throw err;
    }
  })();

  setupState.promise = promise;
  void promise.catch(() => {
    // Swallow to avoid unhandled rejection. Error already tracked.
  });

  return promise;
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
