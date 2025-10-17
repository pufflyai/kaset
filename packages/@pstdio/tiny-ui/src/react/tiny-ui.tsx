import { type CompileResult } from "@pstdio/tiny-ui-bundler";
import React, { useCallback, useEffect, useRef } from "react";
import { getTinyUIRuntimePath } from "../setupTinyUI";
import { TinyUIStatus } from "../types";
import { useComms } from "./useComms";
import { useCompile } from "./useCompile";
import { useServiceWorkerStatus } from "./useServiceWorkerStatus";

const DEFAULT_ESBUILD_WASM_URL = "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm";

export type TinyUIActionHandler = (
  method: string,
  params?: Record<string, unknown> | undefined,
) => unknown | Promise<unknown>;

export interface TinyUIProps {
  title?: string;
  style?: React.CSSProperties;
  instanceId: string;
  sourceId?: string;
  skipCache?: boolean;
  autoCompile?: boolean;
  onStatusChange?(s: TinyUIStatus): void;
  onReady?(r: CompileResult): void;
  onError?(e: Error): void;
  onActionCall?: TinyUIActionHandler;
}

export function TinyUI(props: TinyUIProps) {
  const {
    instanceId,
    title = "tiny-ui",
    sourceId = instanceId,
    skipCache = false,
    autoCompile = true,
    onStatusChange,
    onReady,
    onError,
    style,
    onActionCall,
  } = props;

  const resultRef = useRef<CompileResult | null>(null);
  const { iframeRef, getHost } = useComms({ id: instanceId, onReady, onError, resultRef, onStatusChange });
  const hostSetupRef = useRef(false);
  const actionHandlerRef = useRef<TinyUIActionHandler | undefined>(onActionCall);
  const { serviceWorkerReady, status: providerStatus, error: providerError } = useServiceWorkerStatus();

  const onResult = useCallback((result: CompileResult) => {
    resultRef.current = result;
  }, []);

  useEffect(() => {
    actionHandlerRef.current = onActionCall ?? undefined;
  }, [onActionCall]);

  useEffect(() => {
    if (!onStatusChange) return;
    if (providerStatus === "idle") return;
    onStatusChange(providerStatus);
  }, [onStatusChange, providerStatus]);

  useEffect(() => {
    if (!providerError) return;
    onError?.(providerError);
  }, [onError, providerError]);

  const ensureHost = useCallback(async () => {
    const host = await getHost();

    if (!hostSetupRef.current) {
      host.onOps(async (request) => {
        const handler = actionHandlerRef.current;

        if (!handler) {
          throw new Error(`Tiny UI host cannot handle request for method '${request.method}'`);
        }

        return handler(request.method, request.params);
      });

      hostSetupRef.current = true;
    }

    return host;
  }, [getHost]);

  useCompile({
    autoCompile,
    serviceWorkerReady,
    skipCache,
    sourceId,
    wasmURL: DEFAULT_ESBUILD_WASM_URL,
    ensureHost,
    onResult,
    onError,
    onStatusChange,
  });

  const runtimePath = getTinyUIRuntimePath();

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
}
