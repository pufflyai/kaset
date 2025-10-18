import { compile as bundleCompile, type CompileResult } from "@pstdio/tiny-ui-bundler";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { setupTinyUI, type SetupTinyUIOptions } from "../setupTinyUI";
import type { TinyUIStatus } from "../types";
import { useServiceWorkerStatus } from "./useServiceWorkerStatus";

const DEFAULT_ESBUILD_WASM_URL = "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm";

interface TinyUiProviderProps extends SetupTinyUIOptions {
  children: ReactNode;
  wasmURL?: string;
}

export interface TinyUiCompileOptions {
  wasmURL?: string;
  skipCache?: boolean;
}

export type TinyUiCompileFn = (sourceId: string, options?: TinyUiCompileOptions) => Promise<CompileResult>;

export interface TinyUiContextValue {
  serviceWorkerReady: boolean;
  status: TinyUIStatus;
  error: Error | null;
  compile: TinyUiCompileFn;
}

const TinyUiContext = createContext<TinyUiContextValue | null>(null);

export const TinyUiProvider = (props: TinyUiProviderProps) => {
  const { children, serviceWorkerUrl, runtimeUrl, wasmURL } = props;
  const serviceWorkerState = useServiceWorkerStatus();
  const resolvedWasmUrl = wasmURL ?? DEFAULT_ESBUILD_WASM_URL;

  useEffect(() => {
    if (typeof window === "undefined") return;

    setupTinyUI({ serviceWorkerUrl, runtimeUrl }).catch((error) => {
      console.error("[Tiny UI] Provider failed to initialize service worker", error);
    });
  }, [runtimeUrl, serviceWorkerUrl]);

  const compile = useCallback<TinyUiCompileFn>(
    async (sourceId, options) => {
      const result = await bundleCompile(sourceId, {
        wasmURL: options?.wasmURL ?? resolvedWasmUrl,
        skipCache: options?.skipCache ?? false,
      });

      return result;
    },
    [resolvedWasmUrl],
  );

  const value = useMemo<TinyUiContextValue>(
    () => ({
      serviceWorkerReady: serviceWorkerState.serviceWorkerReady,
      status: serviceWorkerState.status,
      error: serviceWorkerState.error,
      compile,
    }),
    [compile, serviceWorkerState.error, serviceWorkerState.serviceWorkerReady, serviceWorkerState.status],
  );

  return <TinyUiContext.Provider value={value}>{children}</TinyUiContext.Provider>;
};

export const useTinyUi = () => {
  const context = useContext(TinyUiContext);
  if (!context) {
    throw new Error("TinyUiProvider is required to use Tiny UI components");
  }
  return context;
};
