import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { compile, type CompileResult } from "@pstdio/tiny-ui-bundler";
import { getRuntimeHtmlPath } from "../constant";
import { createTinyUITimer } from "./createTinyUITimer";
import { TinyUIStatus } from "./types";
import { useComms } from "./useComms";
import { useCompile, useServiceWorker } from "./useServiceWorker";

const DEFAULT_ESBUILD_WASM_URL = "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm";

export type TinyUIActionHandler = (
  method: string,
  params?: Record<string, unknown> | undefined,
) => unknown | Promise<unknown>;

export interface TinyUIProps {
  title?: string;
  instanceId: string;
  sourceId?: string;
  skipCache?: boolean;
  serviceWorkerUrl?: string;
  autoCompile?: boolean;
  runtimeUrl?: string;
  onStatusChange?(s: TinyUIStatus): void;
  onReady?(r: CompileResult): void;
  onError?(e: Error): void;
  style?: React.CSSProperties;
  onActionCall?: TinyUIActionHandler;
}

export interface TinyUIHandle {
  rebuild(): Promise<void>;
}

export const TinyUI = forwardRef<TinyUIHandle, TinyUIProps>(function TinyUI(props, ref) {
  const {
    instanceId,
    title = "TinyUI",
    sourceId = instanceId,
    skipCache = false,
    serviceWorkerUrl,
    runtimeUrl,
    autoCompile = true,
    onStatusChange,
    onReady,
    onError,
    style,
    onActionCall,
  } = props;

  const resultRef = useRef<CompileResult | null>(null);
  const { iframeRef, getHost } = useComms({ id: instanceId, onReady, onError, resultRef, onStatusChange });
  const actionHandlerRef = useRef<TinyUIActionHandler | undefined>(onActionCall);

  useEffect(() => {
    actionHandlerRef.current = onActionCall ?? undefined;
  }, [onActionCall]);

  const ensureHost = useCallback(async () => {
    const host = await getHost();

    host.onOps(async (request) => {
      const handler = actionHandlerRef.current;

      if (!handler) {
        throw new Error(`Tiny UI host cannot handle request for method '${request.method}'`);
      }

      return handler(request.method, request.params);
    });

    return host;
  }, [getHost]);

  const compileAndInit = useCallback(
    async (forceRecompile: boolean) => {
      const timing = createTinyUITimer(`${sourceId}:${forceRecompile ? "rebuild" : "init"}`);

      try {
        const host = await timing.withTiming("getHost", () => ensureHost());

        let statusSet = false;
        const shouldSkipCache = forceRecompile || skipCache;

        if (shouldSkipCache) {
          onStatusChange?.("compiling");
          statusSet = true;
        }

        const result = await timing.withTiming("compile", () =>
          compile(sourceId, { wasmURL: DEFAULT_ESBUILD_WASM_URL, skipCache: shouldSkipCache }),
        );

        if (!result.fromCache && !statusSet) {
          onStatusChange?.("compiling");
          statusSet = true;
        }

        resultRef.current = result;

        await timing.withTiming("sendInit", () => host.sendInit(result));
      } finally {
        timing.mark?.("total");
      }
    },
    [ensureHost, sourceId, onStatusChange, skipCache],
  );

  const runInitialCompile = useCallback(() => compileAndInit(false), [compileAndInit]);

  const serviceWorkerReady = useServiceWorker({
    serviceWorkerUrl,
    onError,
    onStatusChange,
  });

  useCompile({
    autoCompile,
    serviceWorkerReady,
    doCompileAndInit: runInitialCompile,
    onError,
    onStatusChange,
  });

  useImperativeHandle(
    ref,
    () => ({
      rebuild: () => compileAndInit(true),
    }),
    [compileAndInit],
  );

  const runtimePath = runtimeUrl ?? getRuntimeHtmlPath();

  return (
    <div style={style}>
      <iframe
        ref={iframeRef}
        title={title}
        src={runtimePath}
        allowTransparency
        style={{ flex: 1, width: "100%", height: "100%", border: 0, background: "transparent" }}
      />
    </div>
  );
});
