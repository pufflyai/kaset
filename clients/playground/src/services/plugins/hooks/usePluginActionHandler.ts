import { useMemo } from "react";
import { desktopAPI } from "@/services/desktop/desktop-api";
import { host } from "@/services/plugins/host";
import { isHostApiMethod, type HostApi, type HostApiMethod } from "@pstdio/tiny-plugins";
import type { TinyUIActionHandler } from "@pstdio/tiny-ui";

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }

  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }

  if (isNodeBufferLike(value)) {
    return Uint8Array.from(value.data);
  }

  const iterator = (value as { [Symbol.iterator]?: unknown })[Symbol.iterator];
  if (typeof iterator === "function") {
    return Uint8Array.from(value as Iterable<number>);
  }

  if (typeof value === "string") {
    return new TextEncoder().encode(value);
  }

  throw new Error("Host fs.readFile returned an unsupported value");
}

function isNodeBufferLike(value: unknown): value is { type: "Buffer"; data: number[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as { type?: unknown; data?: unknown };
  return record.type === "Buffer" && Array.isArray(record.data);
}

function normalizeHostResult(method: HostApiMethod, result: unknown) {
  if (method === "fs.readFile") {
    return toUint8Array(result);
  }

  return result;
}

export const usePluginActionHandler = (pluginId: string): TinyUIActionHandler => {
  return useMemo(() => {
    let hostApiPromise: Promise<HostApi> | null = null;

    const resolveHostApi = async () => {
      if (!hostApiPromise) {
        hostApiPromise = host.createHostApi(pluginId).catch((error) => {
          hostApiPromise = null;
          throw error;
        });
      }
      return hostApiPromise;
    };

    const handler: TinyUIActionHandler = async (method, params) => {
      if (isHostApiMethod(method)) {
        const api = await resolveHostApi();
        const result = await api.call(method, params as any);
        return normalizeHostResult(method, result);
      }

      const desktopHandler = desktopAPI[method as keyof typeof desktopAPI];
      if (!desktopHandler) {
        throw new Error(`Unhandled Tiny UI action: ${method}`);
      }

      return desktopHandler(params as any);
    };

    return handler;
  }, [pluginId]);
};
