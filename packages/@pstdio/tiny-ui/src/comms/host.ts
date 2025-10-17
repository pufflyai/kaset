import { host } from "rimless";
import { buildImportMap, getLockfile, type CompileResult } from "@pstdio/tiny-ui-bundler";
import { getVirtualPrefix } from "../constant";
import type { TinyUiOpsHandler, TinyUiOpsRequest } from "../runtime/types";

export interface HostAPI {
  ready(data: { id: string; meta?: unknown }): Promise<void>;
  runtimeError(data: { id: string; message: string; stack?: string }): Promise<void>;
  ops(request: TinyUiOpsRequest): Promise<unknown>;
}

export type TinyHost = ReturnType<typeof createTinyHost>;

export async function createTinyHost(iframe: HTMLIFrameElement, id: string) {
  const hostApi: HostAPI = {
    async ready(data) {
      internal.onReady?.(data);
    },
    async runtimeError(data) {
      internal.onError?.(data);
    },
    async ops(request) {
      if (!internal.opsHandler) {
        throw new Error("Tiny UI host ops handler not registered");
      }
      return internal.opsHandler(request);
    },
  };

  const conn = await host.connect(iframe, hostApi);

  const internal: {
    onReady?: (data: { id: string; meta?: unknown }) => void;
    onError?: (data: { id: string; message: string; stack?: string }) => void;
    opsHandler?: TinyUiOpsHandler;
  } = {};

  async function sendInit(result: CompileResult) {
    const lockfile = getLockfile() ?? null;
    const importMap = lockfile ? buildImportMap(lockfile) : undefined;
    const virtualPrefix = getVirtualPrefix();
    const styles = (result.assets || []).map((p) => `${virtualPrefix}${result.hash}/${p}`);

    console.info("[Tiny UI host] init result", {
      url: result.url,
      virtualPrefix,
      hash: result.hash,
      assets: result.assets,
    });

    await conn.remote.init({
      id,
      moduleUrl: result.url,
      importMap,
      styles,
      entryExport: "mount",
      mountSelector: "#root",
      runtimeOptions: {},
      meta: { bytes: result.bytes, fromCache: result.fromCache },
    });
  }

  return {
    onReady(fn: (data: { id: string; meta?: unknown }) => void) {
      internal.onReady = fn;
    },
    onError(fn: (data: { id: string; message: string; stack?: string }) => void) {
      internal.onError = fn;
    },
    onOps(fn: TinyUiOpsHandler) {
      internal.opsHandler = fn;
    },
    sendInit,
    disconnect() {
      conn.remote.disconnect?.();
      internal.opsHandler = undefined;
    },
  };
}
