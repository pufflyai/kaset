import { guest } from "rimless";
import type {
  HostApi,
  HostApiMethod,
  HostApiParams,
  HostApiResult,
  Manifest,
  PluginContext,
  PluginModule,
} from "../core/types";

type HostApiCallPayload<M extends HostApiMethod = HostApiMethod> = {
  method: M;
  params: HostApiParams[M];
};

type HostBridgeRemote = {
  callHostApi<M extends HostApiMethod>(payload: HostApiCallPayload<M>): Promise<HostApiResult[M]>;
};

type InitPayload = {
  pluginId: string;
  manifest: Manifest;
  moduleUrl: string;
};

type RunCommandPayload = {
  commandId: string;
  params?: unknown;
};

type WorkerInitResult = {
  commandIds: string[];
};

type WorkerApi = {
  init(payload: InitPayload, remote: HostBridgeRemote): Promise<WorkerInitResult>;
  runCommand(payload: RunCommandPayload): Promise<unknown>;
  shutdown(): Promise<void>;
};

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

type WorkerState = {
  pluginId?: string;
  manifest?: Manifest;
  module?: PluginModule;
  plugin?: PluginModule["default"];
  ctx?: PluginContext;
  remote?: HostBridgeRemote;
};

type InitializedWorkerState = Required<
  Pick<WorkerState, "pluginId" | "manifest" | "module" | "plugin" | "ctx" | "remote">
>;

const state: Mutable<WorkerState> = {};

function getInitializedState(): InitializedWorkerState {
  if (!state.pluginId || !state.manifest || !state.module || !state.plugin || !state.ctx || !state.remote) {
    throw new Error("Plugin worker is not initialized");
  }
  return state as InitializedWorkerState;
}

function toError(error: unknown, fallback: string): Error {
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

async function activatePlugin(remote: HostBridgeRemote) {
  if (!state.pluginId || !state.manifest || !state.module || !state.plugin) {
    throw new Error("Plugin module not loaded");
  }

  const api: HostApi = {
    call: async <M extends HostApiMethod>(
      method: M,
      ...args: HostApiParams[M] extends undefined ? [params?: HostApiParams[M]] : [params: HostApiParams[M]]
    ) => {
      const params = (args.length > 0 ? args[0] : undefined) as HostApiParams[M];
      return remote.callHostApi({ method, params });
    },
  };

  const ctx: PluginContext = {
    id: state.pluginId,
    manifest: state.manifest,
    api,
  };

  await state.plugin.activate(ctx);
  state.ctx = ctx;
  state.remote = remote;
}

async function importPluginModule(moduleUrl: string): Promise<PluginModule> {
  const mod = (await import(/* @vite-ignore */ moduleUrl)) as PluginModule;
  if (!mod?.default || typeof mod.default.activate !== "function") {
    throw new Error(`Plugin default export must implement activate()`);
  }
  return mod;
}

function resetState() {
  state.pluginId = undefined;
  state.manifest = undefined;
  state.module = undefined;
  state.plugin = undefined;
  state.ctx = undefined;
  state.remote = undefined;
}

const workerApi: WorkerApi = {
  async init(payload, remote) {
    if (state.plugin) {
      throw new Error(`Plugin ${state.pluginId ?? "<unknown>"} is already initialized`);
    }

    state.pluginId = payload.pluginId;
    state.manifest = payload.manifest;

    let module: PluginModule;
    try {
      module = await importPluginModule(payload.moduleUrl);
    } catch (error) {
      resetState();
      throw toError(error, `Failed to import module for ${payload.pluginId}`);
    }

    state.module = module;
    state.plugin = module.default;

    try {
      await activatePlugin(remote);
    } catch (error) {
      try {
        await state.plugin?.deactivate?.();
      } catch {
        // ignore deactivate failure during init
      }
      resetState();
      throw toError(error, `Failed to activate plugin ${payload.pluginId}`);
    }

    const commandIds = Object.keys(module.commands ?? {});
    return { commandIds } satisfies WorkerInitResult;
  },

  async runCommand({ commandId, params }) {
    const current = getInitializedState();
    const { module, ctx, pluginId } = current;
    const commands = module.commands ?? {};
    const handler = commands[commandId];
    if (typeof handler !== "function") {
      throw new Error(`Command ${commandId} is not registered for plugin ${pluginId}`);
    }
    return handler(ctx, params);
  },

  async shutdown() {
    if (!state.plugin) {
      resetState();
      return;
    }

    try {
      await state.plugin.deactivate?.();
    } finally {
      resetState();
    }
  },
};

await guest.connect(workerApi);
