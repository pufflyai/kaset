import { useCallback, useEffect } from "react";
import { compile, type CompileResult } from "@pstdio/tiny-ui-bundler";
import { toTinyUIError } from "../setupTinyUI";
import type { TinyUIStatus } from "../types";

interface UseCompileOptions {
  autoCompile: boolean;
  serviceWorkerReady: boolean;
  skipCache: boolean;
  sourceId: string;
  wasmURL: string;
  ensureHost(): Promise<{ sendInit(result: CompileResult): Promise<void> }>;
  onResult?(result: CompileResult): void;
  onError?(error: Error): void;
  onStatusChange?(status: TinyUIStatus): void;
}

export function useCompile(options: UseCompileOptions) {
  const {
    autoCompile,
    serviceWorkerReady,
    skipCache,
    sourceId,
    wasmURL,
    ensureHost,
    onResult,
    onError,
    onStatusChange,
  } = options;

  const compileAndInit = useCallback(
    async (forceRecompile: boolean) => {
      const host = await ensureHost();

      let statusSet = false;
      const shouldSkipCache = forceRecompile || skipCache;

      if (shouldSkipCache) {
        onStatusChange?.("compiling");
        statusSet = true;
      }

      const result = await compile(sourceId, {
        wasmURL,
        skipCache: shouldSkipCache,
      });

      if (!result.fromCache && !statusSet) {
        onStatusChange?.("compiling");
        statusSet = true;
      }

      onResult?.(result);

      await host.sendInit(result);
    },
    [ensureHost, onResult, onStatusChange, skipCache, sourceId, wasmURL],
  );

  useEffect(() => {
    if (!autoCompile || !serviceWorkerReady) return;

    let cancelled = false;

    (async () => {
      try {
        await compileAndInit(false);
      } catch (error) {
        if (cancelled) return;
        onStatusChange?.("error");
        onError?.(toTinyUIError(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoCompile, compileAndInit, onError, serviceWorkerReady, onStatusChange]);

  return {
    compileAndInit,
  };
}
