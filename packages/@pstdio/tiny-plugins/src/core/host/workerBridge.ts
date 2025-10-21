import { host as rimlessHost } from "rimless";
import type { HostApi, HostApiMethod, HostApiParams, Manifest } from "../types";
import type { WorkerBridge, WorkerConnection } from "./internalTypes";

type HostApiCallPayload<M extends HostApiMethod = HostApiMethod> = {
  method: M;
  params: HostApiParams[M];
};

function toWorkerError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message =
      typeof (error as { message: unknown }).message === "string" ? (error as { message: string }).message : fallback;
    const err = new Error(message);
    if ("name" in error && typeof (error as { name: unknown }).name === "string") {
      err.name = (error as { name: string }).name;
    }
    if ("stack" in error && typeof (error as { stack: unknown }).stack === "string") {
      err.stack = (error as { stack: string }).stack;
    }
    return err;
  }
  return new Error(typeof error === "string" ? error : fallback);
}

export async function createWorkerBridge(pluginId: string, scriptUrl: URL, api: HostApi): Promise<WorkerBridge> {
  const worker = new Worker(scriptUrl, { type: "module" });

  const hostHandlers = {
    async callHostApi<M extends HostApiMethod>({ method, params }: HostApiCallPayload<M>) {
      return api.call(method, params);
    },
  };

  let connection: WorkerConnection;
  try {
    connection = (await rimlessHost.connect(worker, hostHandlers)) as WorkerConnection;
  } catch (error) {
    worker.terminate();
    throw toWorkerError(error, `Failed to establish worker connection for ${pluginId}`);
  }

  let closed = false;
  let shutdownPromise: Promise<void> | null = null;

  const close = () => {
    if (closed) return;
    closed = true;
    connection.close();
  };

  const init = async (manifest: Manifest, moduleUrl: string) => {
    try {
      return await connection.remote.init({ pluginId, manifest, moduleUrl });
    } catch (error) {
      throw toWorkerError(error, `Failed to initialize worker for ${pluginId}`);
    }
  };

  const runCommand = async (commandId: string, params?: unknown) => {
    try {
      return await connection.remote.runCommand({ commandId, params });
    } catch (error) {
      throw toWorkerError(error, `Failed to run command ${commandId} for ${pluginId}`);
    }
  };

  const shutdown = async () => {
    if (!shutdownPromise) {
      shutdownPromise = connection.remote
        .shutdown()
        .catch((error) => {
          throw toWorkerError(error, `Worker shutdown failed for ${pluginId}`);
        })
        .finally(() => {
          close();
        });
    }
    return shutdownPromise;
  };

  return { init, runCommand, shutdown, close };
}

export async function disposeWorkerBridge(pluginId: string, bridge: WorkerBridge | undefined, moduleUrl?: string) {
  if (!bridge) {
    if (moduleUrl) URL.revokeObjectURL(moduleUrl);
    return;
  }

  try {
    await bridge.shutdown();
  } catch (error) {
    console.warn(`[tiny-plugins] Worker shutdown error for ${pluginId}`, error);
  } finally {
    bridge.close();
  }

  if (moduleUrl) URL.revokeObjectURL(moduleUrl);
}
