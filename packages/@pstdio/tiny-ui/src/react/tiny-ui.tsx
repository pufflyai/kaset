import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { getRuntimeHtmlPath } from "../constant";
import { registerSources } from "../core/sources";
import { compile } from "../esbuild/compile";
import type { CompileResult } from "../esbuild/types";
import { createIframeOps, type CreateIframeOpsOptions } from "../runtime/createIframeOps";
import { createTinyUITimer } from "./createTinyUITimer";
import { TinyUIStatus } from "./types";
import { useComms } from "./useComms";
import { useCompile, useServiceWorker } from "./useServiceWorker";

const DEFAULT_ESBUILD_WASM_URL = "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm";

export interface TinyUIProps {
  title?: string;
  instanceId: string;
  sourceId?: string;
  skipCache?: boolean;
  root: string;
  serviceWorkerUrl: string;
  autoCompile?: boolean;
  runtimeUrl?: string;
  onStatusChange?(s: TinyUIStatus): void;
  onReady?(r: CompileResult): void;
  onError?(e: Error): void;
  style?: React.CSSProperties;
  bridge?: CreateIframeOpsOptions;
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
    root,
    serviceWorkerUrl,
    runtimeUrl,
    autoCompile = true,
    onStatusChange,
    onReady,
    onError,
    style,
    bridge,
  } = props;

  const resultRef = useRef<CompileResult | null>(null);
  const { iframeRef, getHost } = useComms({ id: instanceId, onReady, onError, resultRef, onStatusChange });

  const compileAndInit = useCallback(
    async (forceRecompile: boolean) => {
      const timing = createTinyUITimer(`${sourceId}:${forceRecompile ? "rebuild" : "init"}`);

      try {
        await timing.withTiming("registerSources", () => {
          registerSources([{ id: sourceId, root }]);
        });

        const host = await timing.withTiming("getHost", () => getHost());

        if (bridge) {
          await timing.withTiming("registerBridgeOps", () => {
            host.onOps(createIframeOps(bridge));
          });
        }

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
    [bridge, sourceId, getHost, onStatusChange, root, skipCache],
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
        style={{ flex: 1, width: "100%", height: "100%", border: 0 }}
      />
    </div>
  );
});
