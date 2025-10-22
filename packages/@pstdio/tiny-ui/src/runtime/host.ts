import { host } from "rimless";
import { buildImportMap, getLockfile, prepareRuntimeAssets, type CompileResult } from "@pstdio/tiny-ui-bundler";
import type { TinyUiOpsHandler, TinyUiOpsRequest } from "../types";

export interface HostAPI {
  ready(data: { id: string; meta?: unknown }): Promise<void>;
  runtimeError(data: { id: string; message: string; stack?: string }): Promise<void>;
  ops(request: TinyUiOpsRequest): Promise<unknown>;
}

export type TinyHost = ReturnType<typeof createTinyHost>;

export interface CreateTinyHostCallbacks {
  onReady?(data: { id: string; meta?: unknown }): void;
  onError?(data: { id: string; message: string; stack?: string }): void;
  onOps?: TinyUiOpsHandler;
}

export async function createTinyHost(iframe: HTMLIFrameElement, id: string, callbacks: CreateTinyHostCallbacks = {}) {
  const current = { ...callbacks };

  const hostApi: HostAPI = {
    async ready(data) {
      current.onReady?.(data);
    },
    async runtimeError(data) {
      current.onError?.(data);
    },
    async ops(request) {
      if (!current.onOps) {
        throw new Error("Tiny UI host ops handler not registered");
      }
      return current.onOps(request);
    },
  };

  const conn = await host.connect(iframe, hostApi);

  let assetCleanup: (() => void) | null = null;

  async function sendInit(result: CompileResult) {
    if (assetCleanup) {
      assetCleanup();
      assetCleanup = null;
    }

    const lockfile = getLockfile() ?? null;
    const importMap = lockfile ? buildImportMap(lockfile) : undefined;
    const prepared = await prepareRuntimeAssets(result);
    assetCleanup = prepared.cleanup;

    await conn.remote.init({
      id,
      moduleUrl: prepared.moduleUrl,
      importMap,
      styles: prepared.styles,
      inlineStyles: prepared.inlineStyles.length > 0 ? prepared.inlineStyles : undefined,
      entryExport: "mount",
      mountSelector: "#root",
      runtimeOptions: {},
      meta: { bytes: result.bytes, fromCache: result.fromCache },
    });
  }

  return {
    sendInit,
    disconnect() {
      conn.remote.disconnect?.();
      if (assetCleanup) {
        assetCleanup();
        assetCleanup = null;
      }
    },
  };
}
