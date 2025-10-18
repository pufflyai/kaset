import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bundlerMock = {
  getRuntimeHtmlPath: vi.fn(() => "/mock/runtime.html"),
  resetBasePath: vi.fn(),
  setBasePath: vi.fn(),
};

vi.mock("@pstdio/tiny-ui-bundler", () => bundlerMock);

const loadSetupModule = async () => {
  const setupModule = await import("./setupTinyUI");
  const bundler = await import("@pstdio/tiny-ui-bundler");

  return { setupModule, bundler };
};

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const originalServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

const createRegistration = () =>
  ({
    scope: "https://kaset.virtual/",
    active: {
      state: "activated",
      scriptURL: "https://kaset.virtual/sw.js",
      postMessage: vi.fn(),
      onstatechange: null,
      onerror: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    },
    installing: null,
    waiting: null,
    unregister: vi.fn(),
    update: vi.fn(),
  }) as unknown as ServiceWorkerRegistration;

const setServiceWorkerMock = (
  options: {
    register?: () => Promise<ServiceWorkerRegistration>;
    controller?: ServiceWorker | null;
  } = {},
) => {
  let controllerRef: ServiceWorker | null | undefined =
    options.controller ??
    ({
      scriptURL: "https://kaset.virtual/sw.js",
    } as ServiceWorker);

  const register =
    options.register ??
    vi.fn(async () => {
      return createRegistration();
    });

  const serviceWorker = {
    register,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as ServiceWorkerContainer;

  Object.defineProperty(serviceWorker, "controller", {
    configurable: true,
    get: () => controllerRef ?? null,
    set: (value) => {
      controllerRef = value;
    },
  });

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker,
  });

  return { register };
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

afterEach(() => {
  if (originalServiceWorkerDescriptor) {
    Object.defineProperty(navigator, "serviceWorker", originalServiceWorkerDescriptor);
  } else {
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  }
});

describe("setupTinyUI helpers", () => {
  it("wraps unknown errors with the Tiny UI initialization message", async () => {
    const { setupModule } = await loadSetupModule();

    const error = setupModule.toTinyUIError("boom");

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Tiny UI initialization failed");
  });

  it("returns the runtime path from the bundler when none provided", async () => {
    const { setupModule, bundler } = await loadSetupModule();

    const path = setupModule.getTinyUIRuntimePath();

    expect(path).toBe("/mock/runtime.html");
    expect(bundler.getRuntimeHtmlPath).toHaveBeenCalledTimes(1);
  });

  it("exposes the initial setup state", async () => {
    const { setupModule } = await loadSetupModule();

    const state = setupModule.getTinyUISetupState();

    expect(state).toEqual({
      ready: false,
      error: null,
      pending: false,
      serviceWorkerUrl: undefined,
      runtimeUrl: undefined,
    });
  });
});

describe("subscribeToTinyUISetup", () => {
  it("removes listeners when unsubscribe is called", async () => {
    const { setupModule } = await loadSetupModule();
    const status = vi.fn();

    const unsubscribe = setupModule.subscribeToTinyUISetup({ onStatusChange: status });
    unsubscribe();

    await setupModule.setupTinyUI({});

    expect(status).not.toHaveBeenCalled();
  });
});

describe("setupServiceWorker", () => {
  it("resets the base path even when no service worker url is provided", async () => {
    const { setupModule, bundler } = await loadSetupModule();

    await setupModule.setupServiceWorker({});

    expect(bundler.resetBasePath).toHaveBeenCalledTimes(1);
    expect(bundler.setBasePath).not.toHaveBeenCalled();
  });
});

describe("setupTinyUI", () => {
  it("marks the setup as ready and notifies listeners on success", async () => {
    const { setupModule } = await loadSetupModule();
    setServiceWorkerMock();

    const status = vi.fn();
    const ready = vi.fn();

    setupModule.subscribeToTinyUISetup({
      onStatusChange: status,
      onReady: ready,
    });

    await setupModule.setupTinyUI({ runtimeUrl: "/tiny/runtime.html" });

    expect(status.mock.calls).toEqual([["initializing"], ["service-worker-ready"]]);
    expect(ready).toHaveBeenCalledTimes(1);

    const state = setupModule.getTinyUISetupState();
    expect(state.ready).toBe(true);
    expect(state.error).toBeNull();
    expect(state.pending).toBe(false);
    expect(state.runtimeUrl).toBe("/tiny/runtime.html");
    expect(state.serviceWorkerUrl).toBeUndefined();

    const runtimePath = setupModule.getTinyUIRuntimePath();
    expect(runtimePath).toBe("/tiny/runtime.html");
  });

  it("propagates errors from the service worker setup", async () => {
    const { setupModule } = await loadSetupModule();
    const failure = new Error("service worker failed");

    setServiceWorkerMock({
      register: vi.fn(async () => {
        throw failure;
      }),
    });

    const status = vi.fn();
    const errorListener = vi.fn();

    setupModule.subscribeToTinyUISetup({
      onStatusChange: status,
      onError: errorListener,
    });

    await expect(setupModule.setupTinyUI({ serviceWorkerUrl: "/sw.js" })).rejects.toThrow(failure);

    expect(status.mock.calls).toEqual([["initializing"], ["error"]]);
    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(errorListener).toHaveBeenCalledWith(failure);

    const state = setupModule.getTinyUISetupState();
    expect(state.ready).toBe(false);
    expect(state.error).toBe(failure);
    expect(state.pending).toBe(false);
    expect(state.serviceWorkerUrl).toBe("/sw.js");
  });

  it("returns the existing promise when initialization is already pending", async () => {
    const { setupModule } = await loadSetupModule();
    const deferred = createDeferred<void>();
    const registration = createRegistration();

    const { register } = setServiceWorkerMock({
      register: vi.fn(() => deferred.promise.then(() => registration)),
    });

    const first = setupModule.setupTinyUI({ serviceWorkerUrl: "/sw.js" });
    const second = setupModule.setupTinyUI({ serviceWorkerUrl: "/sw.js" });

    expect(register).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    deferred.resolve();
    await expect(first).resolves.toBeUndefined();

    const state = setupModule.getTinyUISetupState();
    expect(state.ready).toBe(true);
    expect(state.pending).toBe(false);
    expect(state.error).toBeNull();
    expect(state.serviceWorkerUrl).toBe("/sw.js");
  });
});
