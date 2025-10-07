import type { CSSProperties, Ref } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { getBundleCacheName, getBundleCount } from "../core/cache.js";
import { getLockfile, recordCompile, setBundleCount, setIframeCount } from "../core/idb.js";
import { buildImportMap, type ImportMap } from "../core/import-map.js";
import { compile } from "../esbuild/compile.js";
import type { BuildWithEsbuildOptions, CompileResult } from "../esbuild/types.js";
import { registerSources, removeSource, type SourceConfig } from "../core/sources.js";

export interface TinyUIHandle {
  rebuild: () => Promise<CompileResult | undefined>;
}

export type TinyUIStatus = "idle" | "compiling" | "ready" | "error";

export interface TinyUIProps {
  src: string;
  wasmURL?: string;
  id?: string;
  entry?: string;
  tsconfigPath?: string;
  include?: RegExp[];
  exclude?: RegExp[];
  runtimeUrl?: string | ((id: string) => string);
  runtimeSourceUrl?: string;
  serviceWorkerUrl?: string;
  serviceWorkerScope?: string;
  entryExport?: string;
  mountSelector?: string;
  runtimeOptions?: unknown;
  iframeAttributes?: Partial<HTMLIFrameElement>;
  className?: string;
  style?: CSSProperties;
  autoCompile?: boolean;
  showStatus?: boolean;
  define?: BuildWithEsbuildOptions["define"];
  meta?: Record<string, unknown>;
  importMapOverride?: ImportMap;
  onReady?: (result: CompileResult) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: TinyUIStatus) => void;
  onRuntimeError?: (error: Error, info: { id?: string | null }) => void;
}

interface TinyInitMessage {
  type: "tiny:init";
  id: string;
  moduleUrl: string;
  entryExport?: string;
  mountSelector?: string;
  runtimeOptions?: unknown;
  importMap?: ImportMap;
  styles?: string[];
  meta?: Record<string, unknown>;
}

type PendingHandshake = {
  resolve: () => void;
  reject: (error: Error) => void;
};

type RuntimeErrorPayload = { message?: string | null; stack?: string | null } | null | undefined;

type RuntimeReply =
  | { type: "tiny:ready"; id?: string | null }
  | { type: "tiny:error"; id?: string | null; error?: RuntimeErrorPayload };

const DEFAULT_RUNTIME_URL = "/tiny-ui/iframe.html";
const DEFAULT_RUNTIME_SOURCE_URL = "/tiny-ui-runtime.html";
const DEFAULT_SERVICE_WORKER_URL = "/tiny-ui-sw.js";
const DEFAULT_ESBUILD_WASM_URL = "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm";
const DEFAULT_SERVICE_WORKER_SCOPE = "/";
const DEFAULT_ENTRY_EXPORT = "mount";
const DEFAULT_MOUNT_SELECTOR = "#root";

const DEFAULT_IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms";
const DEFAULT_IFRAME_REFERRER_POLICY: ReferrerPolicy = "no-referrer";
const DEFAULT_IFRAME_LOADING: HTMLIFrameElement["loading"] = "lazy";

const serviceWorkerPromises = new Map<string, Promise<ServiceWorkerRegistration | null>>();
const runtimeCachePromises = new Map<string, Promise<void>>();
let activeIframeCount = 0;

const now = () => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
};

const toError = (value: unknown, fallbackMessage: string) => {
  if (value instanceof Error) return value;
  return new Error(fallbackMessage);
};

const toRuntimeError = (payload: RuntimeErrorPayload, fallbackMessage: string) => {
  const error = new Error(payload?.message ?? fallbackMessage);
  if (payload?.stack) {
    error.stack = payload.stack ?? undefined;
  }
  return error;
};

const normalizePath = (value: string) => {
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
};

const resolveRuntimeUrl = (resolver: TinyUIProps["runtimeUrl"], id: string) => {
  if (!resolver) return DEFAULT_RUNTIME_URL;
  return typeof resolver === "function" ? resolver(id) : resolver;
};

const ensureServiceWorker = (url: string, scope: string) => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  const cacheKey = JSON.stringify([url, scope]);
  if (!serviceWorkerPromises.has(cacheKey)) {
    const registrationPromise = (async () => {
      const options = { scope };
      const registration = await navigator.serviceWorker.register(url, options);
      await navigator.serviceWorker.ready;
      return registration;
    })();

    serviceWorkerPromises.set(cacheKey, registrationPromise);
  }

  return serviceWorkerPromises.get(cacheKey)!;
};

const ensureRuntimeCached = async (runtimeUrl: string, runtimeSourceUrl?: string) => {
  if (typeof caches === "undefined") return;
  if (typeof fetch !== "function") return;

  const runtimeKey = normalizePath(runtimeUrl);
  if (!runtimeCachePromises.has(runtimeKey)) {
    const promise = (async () => {
      const cache = await caches.open(getBundleCacheName());
      const existing = await cache.match(runtimeKey);
      if (existing) return;

      if (!runtimeSourceUrl) {
        throw new Error(
          `Runtime HTML for ${runtimeKey} is missing from cache and no runtimeSourceUrl was provided to populate it`,
        );
      }

      const response = await fetch(runtimeSourceUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to fetch runtime HTML: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      await cache.put(
        runtimeKey,
        new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        }),
      );
    })();

    runtimeCachePromises.set(runtimeKey, promise);
  }

  await runtimeCachePromises.get(runtimeKey);
};

const waitForIframeReady = (iframe: HTMLIFrameElement) =>
  new Promise<void>((resolve) => {
    const tryResolve = () => {
      const target = iframe.contentWindow;
      if (!target) return false;

      try {
        const href = target.location?.href;
        const readyState = target.document?.readyState;
        if (!href || href === "about:blank") return false;
        if (readyState !== "complete") return false;
      } catch {
        return false;
      }

      return true;
    };

    if (tryResolve()) {
      resolve();
      return;
    }

    const handleLoad = () => {
      if (!tryResolve()) return;
      iframe.removeEventListener("load", handleLoad);
      resolve();
    };

    iframe.addEventListener("load", handleLoad);
  });

const applyIframeAttributes = (iframe: HTMLIFrameElement, attributes: Partial<HTMLIFrameElement> | undefined) => {
  if (!attributes) return;

  Object.entries(attributes).forEach(([key, value]) => {
    if (value === undefined) return;

    if (key === "sandbox" && typeof value === "string") {
      iframe.setAttribute("sandbox", value);
      return;
    }

    if (key === "referrerPolicy" && typeof value === "string") {
      iframe.referrerPolicy = value as ReferrerPolicy;
      return;
    }

    if (key === "loading" && typeof value === "string") {
      iframe.loading = value as HTMLIFrameElement["loading"];
      return;
    }

    if (key in iframe) {
      Reflect.set(iframe, key, value);
      return;
    }

    iframe.setAttribute(key, String(value));
  });
};

const buildCssUrls = (hash: string, assets: string[]) =>
  assets
    .filter((asset) => asset.endsWith(".css"))
    .map((asset) => {
      const normalized = asset.startsWith("/") ? asset.slice(1) : asset;
      return `/virtual/${hash}/${normalized}`;
    });

const useIsMounted = () => {
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return mountedRef;
};

export const TinyUI = forwardRef<TinyUIHandle, TinyUIProps>((props: TinyUIProps, ref: Ref<TinyUIHandle>) => {
  const {
    src,
    wasmURL = DEFAULT_ESBUILD_WASM_URL,
    id,
    entry,
    tsconfigPath,
    include,
    exclude,
    runtimeUrl,
    runtimeSourceUrl = DEFAULT_RUNTIME_SOURCE_URL,
    serviceWorkerUrl = DEFAULT_SERVICE_WORKER_URL,
    serviceWorkerScope = DEFAULT_SERVICE_WORKER_SCOPE,
    entryExport = DEFAULT_ENTRY_EXPORT,
    mountSelector,
    runtimeOptions,
    iframeAttributes,
    className,
    style,
    autoCompile = true,
    showStatus = false,
    define,
    meta,
    importMapOverride,
    onReady,
    onError,
    onStatusChange,
    onRuntimeError,
  } = props;

  const resolvedId = id ?? src;
  const resolvedRuntimeUrl = resolveRuntimeUrl(runtimeUrl, resolvedId);

  useEffect(() => {
    const config: SourceConfig = {
      id: resolvedId,
      root: src,
      entry,
      tsconfigPath,
      include,
      exclude,
    };

    registerSources([config]);

    return () => {
      removeSource(resolvedId);
    };
  }, [resolvedId, src, entry, tsconfigPath, include, exclude]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const compilePromiseRef = useRef<Promise<CompileResult | undefined> | null>(null);
  const isMountedRef = useIsMounted();
  const handshakesRef = useRef<Map<string, PendingHandshake>>(new Map());

  // Keep the latest runtime options accessible without recreating callbacks on each render.
  const runtimeOptionsRef = useRef(runtimeOptions);
  runtimeOptionsRef.current = runtimeOptions;

  const [status, setStatus] = useState<TinyUIStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<CompileResult | null>(null);

  const updateStatus = useCallback(
    (next: TinyUIStatus) => {
      if (!isMountedRef.current) return;
      setStatus(next);
      onStatusChange?.(next);
    },
    [isMountedRef, onStatusChange],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent<RuntimeReply>) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;

      const payload = event.data;
      if (!payload || typeof payload !== "object") return;

      if (payload.type !== "tiny:ready" && payload.type !== "tiny:error") return;

      const handshakeId = payload.id ?? null;
      const pending = handshakeId ? handshakesRef.current.get(handshakeId) : undefined;

      if (payload.type === "tiny:ready") {
        if (!handshakeId || !pending) return;
        handshakesRef.current.delete(handshakeId);
        pending.resolve();
        return;
      }

      const runtimeError = toRuntimeError(payload.error, "Runtime reported an error");

      if (handshakeId && pending) {
        handshakesRef.current.delete(handshakeId);
        onRuntimeError?.(runtimeError, { id: handshakeId });
        pending.reject(runtimeError);
        return;
      }

      if (handshakeId) {
        handshakesRef.current.delete(handshakeId);
      }

      onRuntimeError?.(runtimeError, { id: handshakeId ?? undefined });

      if (isMountedRef.current) {
        setError(runtimeError);
        updateStatus("error");
        onError?.(runtimeError);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [isMountedRef, onError, onRuntimeError, updateStatus]);

  useEffect(() => {
    return () => {
      handshakesRef.current.forEach(({ reject }, handshakeId) => {
        reject(new Error(`Tiny UI unmounted before runtime responded (${handshakeId})`));
      });
      handshakesRef.current.clear();

      const iframe = iframeRef.current;
      if (iframe) {
        iframeRef.current = null;
        if (iframe.parentElement) {
          iframe.parentElement.removeChild(iframe);
        }
        activeIframeCount = Math.max(0, activeIframeCount - 1);
        setIframeCount(activeIframeCount);
      }
    };
  }, []);

  const ensureIframe = useCallback(() => {
    const container = containerRef.current;
    if (!container) throw new Error("TinyUI requires a container element");

    if (iframeRef.current) return iframeRef.current;

    const iframe = document.createElement("iframe");
    iframe.dataset.tinyUiId = resolvedId;
    iframe.src = resolvedRuntimeUrl;
    iframe.referrerPolicy = DEFAULT_IFRAME_REFERRER_POLICY;
    iframe.loading = DEFAULT_IFRAME_LOADING;
    if (!iframe.getAttribute("sandbox")) {
      iframe.setAttribute("sandbox", DEFAULT_IFRAME_SANDBOX);
    }

    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.display = "block";
    iframe.style.border = "none";
    iframe.style.backgroundColor = "transparent";

    applyIframeAttributes(iframe, iframeAttributes);

    container.innerHTML = "";
    container.appendChild(iframe);

    iframeRef.current = iframe;
    activeIframeCount += 1;
    setIframeCount(activeIframeCount);

    return iframe;
  }, [iframeAttributes, resolvedId, resolvedRuntimeUrl]);

  const sendInitMessage = useCallback(
    async (compileResult: CompileResult) => {
      const iframe = ensureIframe();

      const handshakeId = `${resolvedId}-${compileResult.hash}-${Date.now()}`;
      const importMap =
        importMapOverride ??
        (() => {
          const lockfile = getLockfile();
          return lockfile ? buildImportMap(lockfile) : undefined;
        })();
      const styles = buildCssUrls(compileResult.hash, compileResult.assets);

      const message: TinyInitMessage = {
        type: "tiny:init",
        id: handshakeId,
        moduleUrl: compileResult.url,
        entryExport,
        mountSelector: mountSelector ?? DEFAULT_MOUNT_SELECTOR,
        runtimeOptions: runtimeOptionsRef.current,
        importMap,
        styles: styles.length > 0 ? styles : undefined,
        meta: {
          hash: compileResult.hash,
          bytes: compileResult.bytes,
          fromCache: compileResult.fromCache,
          ...(meta ?? {}),
        },
      };

      const handshake = new Promise<void>((resolve, reject) => {
        handshakesRef.current.set(handshakeId, { resolve, reject });
      });

      try {
        await waitForIframeReady(iframe);

        const target = iframe.contentWindow;
        if (!target) {
          throw new Error("TinyUI runtime iframe does not expose a contentWindow to post messages");
        }

        target.postMessage(message, "*");

        await handshake;
      } catch (error) {
        handshakesRef.current.delete(handshakeId);
        throw error;
      }
    },
    [ensureIframe, entryExport, importMapOverride, meta, mountSelector, resolvedId],
  );

  const runCompile = useCallback(
    async (force?: boolean) => {
      if (compilePromiseRef.current && !force) return compilePromiseRef.current;

      const execution = (async () => {
        if (typeof window === "undefined") {
          throw new Error("TinyUI requires a DOM environment");
        }

        updateStatus("compiling");
        if (isMountedRef.current) {
          setError(null);
        }

        try {
          await ensureServiceWorker(serviceWorkerUrl, serviceWorkerScope);
          await ensureRuntimeCached(resolvedRuntimeUrl, runtimeSourceUrl);

          const startedAt = now();
          const compileResult = await compile(resolvedId, { wasmURL, define });
          const duration = Math.max(0, now() - startedAt);

          recordCompile(duration, compileResult.fromCache);

          const bundleCount = await getBundleCount();
          setBundleCount(bundleCount);

          await sendInitMessage(compileResult);

          if (isMountedRef.current) {
            setResult(compileResult);
            updateStatus("ready");
            onReady?.(compileResult);
          }

          return compileResult;
        } catch (raised) {
          const normalized = toError(raised, "TinyUI failed to compile or initialize the runtime");

          if (isMountedRef.current) {
            setError(normalized);
            updateStatus("error");
            onError?.(normalized);
          }

          throw normalized;
        }
      })();

      compilePromiseRef.current = execution;

      try {
        return await execution;
      } finally {
        compilePromiseRef.current = null;
      }
    },
    [
      define,
      ensureRuntimeCached,
      ensureServiceWorker,
      onError,
      onReady,
      resolvedId,
      resolvedRuntimeUrl,
      runtimeSourceUrl,
      sendInitMessage,
      serviceWorkerScope,
      serviceWorkerUrl,
      updateStatus,
      wasmURL,
      isMountedRef,
    ],
  );

  useEffect(() => {
    if (!autoCompile) return;

    runCompile().catch(() => {
      // Errors are handled inside runCompile so we intentionally swallow here.
    });
  }, [autoCompile, runCompile]);

  useImperativeHandle(
    ref,
    () => ({
      rebuild: async () => runCompile(true),
    }),
    [runCompile],
  );

  return (
    <div className={className} style={style}>
      <div ref={containerRef} />
      {showStatus && status === "compiling" ? <p>Compiling…</p> : null}
      {showStatus && status === "error" ? <p role="alert">{error?.message ?? "Unknown error"}</p> : null}
      {showStatus && status === "ready" && result ? <p>Bundle ready: {result.url}</p> : null}
    </div>
  );
});
