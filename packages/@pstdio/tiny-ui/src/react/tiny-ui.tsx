import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { RUNTIME_HTML_PATH } from "../constant";
import { getCachedBundle } from "../core/cache-manifest";
import { registerSources } from "../core/sources";
import { compile } from "../esbuild/compile";
import type { CompileResult } from "../esbuild/types";
import { createIframeOps, type CreateIframeOpsOptions } from "../runtime/createIframeOps";
import { TinyUIStatus } from "./types";
import { useComms } from "./useComms";
import { useCompile, useServiceWorker } from "./useServiceWorker";

export interface TinyUIProps {
  id: string;
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

const DEFAULT_ESBUILD_WASM_URL = "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm";

export const TinyUI = forwardRef<TinyUIHandle, TinyUIProps>(function TinyUI(props, ref) {
  const {
    id,
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
  const { iframeRef, getHost } = useComms({ id, onReady, onError, resultRef, onStatusChange });

  const compileAndInit = useCallback(
    async (forceRecompile: boolean) => {
      registerSources([{ id, root }]);

      let cached: CompileResult | null = null;
      if (!forceRecompile) {
        cached = await getCachedBundle(id);
      }

      const host = await getHost();
      if (bridge) {
        host.onOps(createIframeOps(bridge));
      }

      if (cached) {
        resultRef.current = cached;
        await host.sendInit(cached);
        return;
      }

      onStatusChange?.("compiling");
      const result = await compile(id, { wasmURL: DEFAULT_ESBUILD_WASM_URL, skipCache: forceRecompile });
      resultRef.current = result;
      await host.sendInit(result);
    },
    [bridge, getHost, id, onStatusChange, root],
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

  const runtimePath = runtimeUrl ?? RUNTIME_HTML_PATH;

  return (
    <div style={style}>
      <iframe
        ref={iframeRef}
        title={`${id}-runtime`}
        src={runtimePath}
        style={{ flex: 1, width: "100%", height: "100%", border: 0, borderRadius: 8 }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
});
