import { host } from "rimless";
import { getLockfile } from "../core/idb";
import { buildImportMap } from "../core/import-map";
import type { CompileResult } from "../esbuild/types";

export interface HostAPI {
  ready(data: { id: string; meta?: unknown }): Promise<void>;
  runtimeError(data: { id: string; message: string; stack?: string }): Promise<void>;
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
  };

  const conn = await host.connect(iframe, hostApi);

  const internal: {
    onReady?: (data: { id: string; meta?: unknown }) => void;
    onError?: (data: { id: string; message: string; stack?: string }) => void;
  } = {};

  async function sendInit(result: CompileResult) {
    const lockfile = getLockfile() ?? null;
    const importMap = lockfile ? buildImportMap(lockfile) : undefined;
    const styles = (result.assets || []).map((p) => `/virtual/${result.hash}/${p}`);

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
    sendInit,
    disconnect() {
      conn.remote.disconnect?.();
    },
  };
}
