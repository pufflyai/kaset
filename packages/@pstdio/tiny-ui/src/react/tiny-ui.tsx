import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { RUNTIME_HTML_PATH } from "../constant";
import { registerSources } from "../core/sources";
import { compile } from "../esbuild/compile";
import type { CompileResult } from "../esbuild/types";
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
}

export interface TinyUIHandle {
  rebuild(): Promise<void>;
}

const DEFAULT_ESBUILD_WASM_URL = "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm";

export const TinyUI = forwardRef<TinyUIHandle, TinyUIProps>(function TinyUI(props, ref) {
  const { id, root, serviceWorkerUrl, runtimeUrl, autoCompile = true, onStatusChange, onReady, onError, style } = props;

  const resultRef = useRef<CompileResult | null>(null);
  const { iframeRef, getHost } = useComms({ id, onReady, onError, resultRef, onStatusChange });

  const doCompileAndInit = useCallback(async () => {
    registerSources([{ id, root }]);

    onStatusChange?.("compiling");
    const result = await compile(id, { wasmURL: DEFAULT_ESBUILD_WASM_URL });
    resultRef.current = result;

    const host = await getHost();
    await host.sendInit(result);
  }, [getHost, id, root, onStatusChange]);

  const serviceWorkerReady = useServiceWorker({
    serviceWorkerUrl,
    onError,
    onStatusChange,
  });

  useCompile({
    autoCompile,
    serviceWorkerReady,
    doCompileAndInit,
    onError,
    onStatusChange,
  });

  useImperativeHandle(ref, () => ({ rebuild: doCompileAndInit }), [doCompileAndInit]);

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
