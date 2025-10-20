import { useCallback, useEffect, useRef, type RefObject } from "react";
import { type CompileResult } from "@pstdio/tiny-ui-bundler";
import { createTinyHost } from "../../runtime/host";
import { toTinyUIError } from "../../setupTinyUI";
import type { TinyUIStatus } from "../../types";
import { useTinyUi } from "../tiny-ui-provider";
import { useLatest } from "./useLatest";

// Re-declare locally to avoid circular deps.
export type TinyUIActionHandler = (
  method: string,
  params?: Record<string, unknown> | undefined,
) => unknown | Promise<unknown>;

type HostInstance = Awaited<ReturnType<typeof createTinyHost>>;

export interface UseTinyUiInstanceOptions {
  /** Unique iframe/host instance id */
  instanceId: string;
  /** Source to compile; defaults to instanceId in TinyUI component */
  sourceId: string;
  /** Auto-compile on mount when SW is ready (default: true) */
  autoCompile?: boolean;
  /** Bypass cache when compiling (default: false) */
  skipCache?: boolean;
  /** Lifecycle callbacks */
  onStatusChange?(s: TinyUIStatus): void;
  onReady?(r: CompileResult): void;
  onError?(e: Error): void;
  /** Invoked when runtime calls back into the host */
  onActionCall?: TinyUIActionHandler;
}

export interface UseTinyUiInstanceResult {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  /** Ensure the host connection exists (does not imply handshaked) */
  ensureHost(): Promise<HostInstance>;
  /** Compile + send init to host. Pass true to force recompile. */
  recompile(forceRecompile?: boolean): Promise<void>;
}

/**
 * One hook to rule them all: owns iframe↔host lifecycle, compiles sources, and handshakes.
 * - Stable callbacks via useLatest (no re-wiring of listeners).
 * - Provider status/error are forwarded once (deduped).
 * - `recompile()` exposes manual rebuilds; autocompile supported.
 */
export function useTinyUiInstance(options: UseTinyUiInstanceOptions): UseTinyUiInstanceResult {
  const {
    instanceId,
    sourceId,
    autoCompile = true,
    skipCache = false,
    onStatusChange,
    onReady,
    onError,
    onActionCall,
  } = options;

  const { compile, serviceWorkerReady, status: providerStatus, error: providerError } = useTinyUi();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hostRef = useRef<HostInstance | null>(null);
  const connectPromiseRef = useRef<Promise<HostInstance> | null>(null);
  const resultRef = useRef<CompileResult | null>(null);

  const onStatusRef = useLatest(onStatusChange);
  const onReadyRef = useLatest(onReady);
  const onErrorRef = useLatest(onError);
  const onActionRef = useLatest(onActionCall);

  const lastForwardedStatus = useRef<TinyUIStatus | null>(null);
  useEffect(() => {
    if (!onStatusRef.current) return;
    if (providerStatus === "idle") return;
    if (providerStatus !== lastForwardedStatus.current) {
      lastForwardedStatus.current = providerStatus;
      onStatusRef.current(providerStatus);
    }
  }, [providerStatus, onStatusRef]);

  const lastError = useRef<Error | null>(null);
  useEffect(() => {
    if (!providerError || providerError === lastError.current) return;
    lastError.current = providerError;
    onErrorRef.current?.(providerError);
  }, [providerError, onErrorRef]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let disposed = false;
    const promise = createTinyHost(iframe, instanceId);
    connectPromiseRef.current = promise;

    promise
      .then((host) => {
        if (disposed) {
          host.disconnect();
          return;
        }

        hostRef.current = host;

        host.onReady(() => {
          onStatusRef.current?.("ready");
          const result = resultRef.current;
          if (result) onReadyRef.current?.(result);
        });

        host.onError(({ message, stack }) => {
          const err = new Error(message);
          if (stack) err.stack = stack;
          onStatusRef.current?.("error");
          onErrorRef.current?.(err);
        });

        host.onOps(async (req) => {
          const handler = onActionRef.current;
          if (!handler) {
            throw new Error(`Tiny UI host cannot handle request for method '${req.method}'`);
          }
          return handler(req.method, req.params);
        });
      })
      .catch((e) => {
        if (disposed) return;
        onStatusRef.current?.("error");
        onErrorRef.current?.(e instanceof Error ? e : new Error("Tiny UI host failed to initialize"));
      });

    return () => {
      disposed = true;
      connectPromiseRef.current = null;
      const host = hostRef.current;
      hostRef.current = null;
      if (host) host.disconnect();
    };
  }, [instanceId, onActionRef, onErrorRef, onReadyRef, onStatusRef]);

  const ensureHost = useCallback(async () => {
    if (hostRef.current) return hostRef.current;
    if (connectPromiseRef.current) return connectPromiseRef.current;
    throw new Error("Tiny UI host not ready");
  }, []);

  const recompile = useCallback(
    async (forceRecompile = false) => {
      const host = await ensureHost();

      const shouldSkipCache = forceRecompile || skipCache;
      let statusSetEarly = false;

      if (shouldSkipCache) {
        onStatusRef.current?.("compiling");
        statusSetEarly = true;
      }

      const result = await compile(sourceId, { skipCache: shouldSkipCache });

      if (!result.fromCache && !statusSetEarly) {
        onStatusRef.current?.("compiling");
      }

      resultRef.current = result;

      onStatusRef.current?.("handshaking");
      await host.sendInit(result);
    },
    [compile, ensureHost, onStatusRef, skipCache, sourceId],
  );

  useEffect(() => {
    if (!autoCompile || !serviceWorkerReady) return;

    let cancelled = false;
    (async () => {
      try {
        await recompile(false);
      } catch (error) {
        if (cancelled) return;
        onStatusRef.current?.("error");
        onErrorRef.current?.(toTinyUIError(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoCompile, recompile, serviceWorkerReady, onErrorRef, onStatusRef]);

  return { iframeRef, ensureHost, recompile };
}
