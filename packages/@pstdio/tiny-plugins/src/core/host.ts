import { host as rimlessHost } from "rimless";
import { ls, normalizeRoot, type ChangeRecord } from "@pstdio/opfs-utils";
import { CommandRegistry } from "./commands";
import { mergeDependencies } from "./dependencies";
import { Emitter } from "./events";
import { createPluginDataFs, createPluginFs } from "./fs";
import { readManifestStrict } from "./manifest";
import { createSettings } from "./settings";
import type {
  HostApi,
  HostApiHandlerMap,
  HostApiMethod,
  HostApiParams,
  HostApiResult,
  HostOptions,
  Manifest,
  PluginChangePayload,
  PluginContext,
  PluginMetadata,
  PluginModule,
  StatusUpdate,
} from "./types";
import { listFiles, watchPluginDir, watchPluginsRoot } from "./watchers";
import type { Connection } from "rimless";

type Events = {
  pluginChange: { pluginId: string; payload: PluginChangePayload };
  dependencyChange: { deps: Record<string, string> };
  settingsChange: { pluginId: string; settings: unknown };
  status: StatusUpdate;
  error: Error;
  pluginsChange: { plugins: PluginMetadata[] };
};

const DEFAULT_HOST_API_VERSION = "v1";

type HostApiCallPayload<M extends HostApiMethod = HostApiMethod> = {
  method: M;
  params: HostApiParams[M];
};

type WorkerRemoteSchema = {
  init(payload: { pluginId: string; manifest: Manifest; moduleUrl: string }): Promise<{ commandIds: string[] }>;
  runCommand(payload: { commandId: string; params?: unknown }): Promise<unknown>;
  shutdown(): Promise<void>;
};

type WorkerConnection = Connection & { remote: WorkerRemoteSchema };

interface WorkerBridge {
  init(manifest: Manifest, moduleUrl: string): Promise<{ commandIds: string[] }>;
  runCommand(commandId: string, params?: unknown): Promise<unknown>;
  shutdown(): Promise<void>;
  close(): void;
}

export function createHost(options: HostOptions) {
  const root = normalizeRoot(options.root, { fallback: "plugins" });
  const dataRoot = normalizeRoot(options.dataRoot, { fallback: "plugin_data" });
  const watch = options.watch ?? true;
  const notify = options.notify;
  const hostApiVersion = options.hostApiVersion ?? DEFAULT_HOST_API_VERSION;
  const workerEnabled = Boolean(options.useWorkers && typeof Worker !== "undefined");
  const workerScriptUrl = workerEnabled
    ? new URL(/* @vite-ignore */ "./runtime/pluginWorker.ts", import.meta.url)
    : null;

  const emitter = new Emitter<Events>();
  const commands = new CommandRegistry(options.defaultTimeoutMs);

  const states = new Map<
    string,
    {
      manifest: Manifest | null;
      moduleUrl?: string;
      module?: PluginModule;
      plugin?: PluginModule["default"];
      watcherCleanup?: () => void | Promise<void>;
      ctx?: PluginContext;
      worker?: WorkerBridge;
    }
  >();
  let rootWatcherCleanup: (() => void | Promise<void>) | undefined;

  function emitStatus(status: string, pluginId?: string, detail?: unknown) {
    notify?.("info", status);
    emitter.emit("status", { status, pluginId, detail });
  }

  function emitError(err: Error) {
    notify?.("error", err.message);
    emitter.emit("error", err);
  }

  function pluginRootPath(pluginId: string) {
    return [root, pluginId].join("/");
  }

  function collectMetadata(): PluginMetadata[] {
    return [...states.entries()]
      .map(([id, s]) => ({ id, name: s.manifest?.name, version: s.manifest?.version }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  function emitPluginsChange() {
    emitter.emit("pluginsChange", { plugins: collectMetadata() });
  }

  function shouldEmitPluginsChange(
    prev?: { manifest: Manifest | null },
    next?: { manifest: Manifest | null },
  ): boolean {
    if (!prev && next) return true;
    if (prev && !next) return true;
    const prevManifest = prev?.manifest ?? null;
    const nextManifest = next?.manifest ?? null;
    if (!prevManifest && !nextManifest) return false;
    if (!prevManifest || !nextManifest) return true;
    return prevManifest.name !== nextManifest.name || prevManifest.version !== nextManifest.version;
  }

  function emitDependenciesChanged() {
    emitter.emit("dependencyChange", { deps: getPluginDependencies() });
  }

  function buildHostApi(pluginId: string): HostApi {
    const pfs = createPluginFs(root, pluginId);

    const settings = createSettings(createPluginDataFs(dataRoot, pluginId), (value) => {
      emitter.emit("settingsChange", { pluginId, settings: value });
    });

    const logPrefix = `[tiny-plugins:${pluginId}]`;

    const forwardLog = (level: "info" | "warn" | "error", message: string, detail?: unknown) => {
      notify?.(level, message);

      emitter.emit("status", { status: message, detail, pluginId });

      const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.info;

      if (detail !== undefined) {
        consoleFn(`${logPrefix} ${message}`, detail);
      } else {
        consoleFn(`${logPrefix} ${message}`);
      }
    };

    const handlers: HostApiHandlerMap = {
      "fs.readFile": async ({ path }) => pfs.readFile(path),
      "fs.writeFile": async ({ path, contents }) => pfs.writeFile(path, contents),
      "fs.deleteFile": async ({ path }) => pfs.deleteFile(path),
      "fs.moveFile": async ({ from, to }) => pfs.moveFile(from, to),
      "fs.exists": async ({ path }) => pfs.exists(path),
      "fs.mkdirp": async ({ path }) => pfs.mkdirp(path),
      "log.statusUpdate": async ({ status, detail }) => {
        emitter.emit("status", { status, detail, pluginId });
      },
      "log.info": async ({ message, detail }) => {
        forwardLog("info", message, detail);
      },
      "log.warn": async ({ message, detail }) => {
        forwardLog("warn", message, detail);
      },
      "log.error": async ({ message, detail }) => {
        forwardLog("error", message, detail);
      },
      "settings.read": async (_params: HostApiParams["settings.read"]) => settings.read(),
      "settings.write": async ({ value }) => settings.write(value),
    };

    const call = async <M extends HostApiMethod>(
      method: M,
      ...args: HostApiParams[M] extends undefined ? [params?: HostApiParams[M]] : [params: HostApiParams[M]]
    ): Promise<HostApiResult[M]> => {
      const handler = handlers[method];
      const params = (args.length > 0 ? args[0] : undefined) as HostApiParams[M];
      return handler(params);
    };

    return { call } satisfies HostApi;
  }

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

  async function createWorkerBridge(pluginId: string, scriptUrl: URL, api: HostApi): Promise<WorkerBridge> {
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

    return {
      init,
      runCommand,
      shutdown,
      close,
    } satisfies WorkerBridge;
  }

  async function disposeWorkerBridge(pluginId: string, bridge: WorkerBridge | undefined, moduleUrl?: string) {
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

  function runCommandWithWorker(pluginId: string, commandId: string, params?: unknown) {
    const state = states.get(pluginId);
    if (!state?.worker) throw new Error(`Worker for ${pluginId} is not available`);
    return state.worker.runCommand(commandId, params);
  }

  async function loadPlugin(pluginId: string, options?: { emitChange?: boolean }) {
    const shouldEmitChange = options?.emitChange !== false;
    const prevState = states.get(pluginId);
    const fs = createPluginFs(root, pluginId);

    const mres = await readManifestStrict(
      async (p) => new TextDecoder().decode(await fs.readFile(p)),
      pluginId,
      hostApiVersion,
    );

    if (!mres.ok) {
      const nextState = { manifest: null, watcherCleanup: prevState?.watcherCleanup };
      states.set(pluginId, nextState);

      if (shouldEmitPluginsChange(prevState, nextState)) emitPluginsChange();

      emitStatus(`manifest invalid for ${pluginId}: ${mres.error}`, pluginId, mres.details ?? mres);

      if (shouldEmitChange) {
        emitter.emit("pluginChange", {
          pluginId,
          payload: {
            paths: [],
            manifest: null,
            files: await listFiles(pluginRootPath(pluginId)),
            changes: undefined,
          },
        });
      }

      return;
    }

    const manifest = mres.manifest;
    const entry = manifest.entry;

    const code = new TextDecoder().decode(await fs.readFile(entry));
    const blob = new Blob([code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);

    const ctx: PluginContext = {
      id: pluginId,
      manifest,
      api: buildHostApi(pluginId),
    };

    let nextState:
      | {
          manifest: Manifest;
          moduleUrl: string;
          module?: PluginModule;
          plugin?: PluginModule["default"];
          ctx: PluginContext;
          watcherCleanup?: () => void | Promise<void>;
          worker?: WorkerBridge;
        }
      | undefined;

    if (workerEnabled && workerScriptUrl) {
      let bridge: WorkerBridge | undefined;
      try {
        bridge = await createWorkerBridge(pluginId, workerScriptUrl, ctx.api);
        const readyResult = await bridge.init(manifest, url);

        const handlers: Record<string, (ctx: PluginContext, params?: unknown) => Promise<unknown | void> | unknown> =
          {};
        readyResult.commandIds.forEach((commandId) => {
          handlers[commandId] = (_ctx, params) => runCommandWithWorker(pluginId, commandId, params);
        });

        commands.register(pluginId, manifest.commands, handlers);

        nextState = {
          manifest,
          moduleUrl: url,
          ctx,
          watcherCleanup: prevState?.watcherCleanup,
          worker: bridge,
        };
      } catch (error) {
        await disposeWorkerBridge(pluginId, bridge, url);
        throw toWorkerError(error, `Failed to initialize worker for ${pluginId}:${entry}`);
      }
    } else {
      let mod: PluginModule;
      try {
        mod = (await import(/* @vite-ignore */ url)) as PluginModule;
      } catch (e) {
        URL.revokeObjectURL(url);
        throw new Error(`Failed to import ${pluginId}:${entry} - ${(e as Error).message}`);
      }

      const plugin = mod?.default;
      if (!plugin || typeof plugin.activate !== "function") {
        URL.revokeObjectURL(url);
        throw new Error(`Plugin ${pluginId} default export must implement activate()`);
      }

      await plugin.activate(ctx);
      commands.register(pluginId, manifest.commands, mod.commands);

      nextState = {
        manifest,
        moduleUrl: url,
        module: mod,
        plugin,
        ctx,
        watcherCleanup: prevState?.watcherCleanup,
      };
    }

    if (!nextState) {
      URL.revokeObjectURL(url);
      throw new Error(`Failed to initialize state for ${pluginId}`);
    }

    states.set(pluginId, nextState);

    if (prevState?.worker) {
      await disposeWorkerBridge(pluginId, prevState.worker, prevState.moduleUrl);
    } else if (prevState?.moduleUrl) {
      URL.revokeObjectURL(prevState.moduleUrl);
    }

    if (shouldEmitPluginsChange(prevState, nextState)) emitPluginsChange();

    if (shouldEmitChange) {
      emitter.emit("pluginChange", {
        pluginId,
        payload: {
          paths: [],
          manifest,
          files: await listFiles(pluginRootPath(pluginId)),
          changes: undefined,
        },
      });
    }
  }

  async function unloadPlugin(pluginId: string) {
    const s = states.get(pluginId);
    commands.unregister(pluginId);
    try {
      await s?.plugin?.deactivate?.();
    } catch (e) {
      console.warn(`[tiny-plugins] deactivate error for ${pluginId}`, e);
    }
    if (s?.worker) {
      await disposeWorkerBridge(pluginId, s.worker, s.moduleUrl);
    } else if (s?.moduleUrl) {
      URL.revokeObjectURL(s.moduleUrl);
    }
    states.delete(pluginId);
  }

  async function startWatching(pluginId: string) {
    if (!watch) return;
    const rootPath = pluginRootPath(pluginId);

    const cleanup = await watchPluginDir(rootPath, async (changes: ChangeRecord[]) => {
      const paths = [...new Set(changes.map((c) => c.path.join("/")))];
      try {
        await loadPlugin(pluginId); // hot reload
        emitter.emit("pluginChange", {
          pluginId,
          payload: {
            paths,
            manifest: states.get(pluginId)?.manifest ?? null,
            files: await listFiles(rootPath),
            changes,
          },
        });
        emitDependenciesChanged();
      } catch (e) {
        emitError(e as Error);
      }
    });

    const s = states.get(pluginId);
    if (s) s.watcherCleanup = cleanup;
  }

  async function handlePluginRemoval(pluginId: string, changes: ChangeRecord[]) {
    const state = states.get(pluginId);
    if (!state) return;

    try {
      await state.watcherCleanup?.();
    } catch {
      /* ignore */
    }

    const emitChange = shouldEmitPluginsChange(state, undefined);
    await unloadPlugin(pluginId);
    if (emitChange) emitPluginsChange();

    const paths = [...new Set(changes.map((change) => change.path.join("/")))];
    emitter.emit("pluginChange", {
      pluginId,
      payload: {
        paths,
        manifest: null,
        files: await listFiles(pluginRootPath(pluginId)),
        changes,
      },
    });
    emitDependenciesChanged();
  }

  async function handlePluginAddition(pluginId: string) {
    if (states.has(pluginId)) return;
    try {
      await loadPlugin(pluginId);
      await startWatching(pluginId);
      emitDependenciesChanged();
    } catch (e) {
      emitError(e as Error);
    }
  }

  async function startRootWatcher() {
    if (!watch || rootWatcherCleanup) return;
    rootWatcherCleanup = await watchPluginsRoot(root, async (changes: ChangeRecord[]) => {
      const grouped = new Map<string, ChangeRecord[]>();
      changes.forEach((change) => {
        const pluginId = change.path[0];
        if (!pluginId) return;
        const existing = grouped.get(pluginId);
        if (existing) {
          existing.push(change);
        } else {
          grouped.set(pluginId, [change]);
        }
      });

      const removals: Array<[string, ChangeRecord[]]> = [];
      const additions = new Set<string>();

      grouped.forEach((pluginChanges, pluginId) => {
        if (pluginChanges.some((change) => change.type === "disappeared")) {
          removals.push([pluginId, pluginChanges]);
        }
        if (pluginChanges.some((change) => change.type === "appeared")) {
          additions.add(pluginId);
        }
      });

      for (const [pluginId, pluginChanges] of removals) {
        await handlePluginRemoval(pluginId, pluginChanges);
      }

      for (const pluginId of additions) {
        await handlePluginAddition(pluginId);
      }
    });
  }

  async function start() {
    let pluginIds: string[] = [];
    try {
      const entries = await ls(root, { maxDepth: 1, kinds: ["directory"] });
      pluginIds = entries.map((e) => e.name);
    } catch {
      pluginIds = [];
    }

    for (const id of pluginIds) {
      try {
        await loadPlugin(id, { emitChange: false });
        await startWatching(id);
      } catch (e) {
        emitError(e as Error);
      }
    }

    await startRootWatcher();
    emitDependenciesChanged();
  }

  async function stop() {
    try {
      await rootWatcherCleanup?.();
    } catch {
      /* ignore */
    }

    rootWatcherCleanup = undefined;

    for (const [id, s] of states) {
      try {
        await s.watcherCleanup?.();
      } catch {
        /* ignore */
      }
      await unloadPlugin(id);
    }
  }

  function getPluginDependencies() {
    return mergeDependencies(
      [...states.values()].map((s) => ({
        id: s.manifest?.id,
        dependencies: s.manifest?.dependencies,
      })),
    );
  }

  function onPluginChange(cb: (pluginId: string, payload: PluginChangePayload) => void) {
    return emitter.on("pluginChange", ({ pluginId, payload }) => cb(pluginId, payload));
  }

  function onDependencyChange(cb: (deps: Record<string, string>) => void) {
    return emitter.on("dependencyChange", ({ deps }) => cb(deps));
  }

  function onSettingsChange(cb: (pluginId: string, settings: unknown) => void) {
    return emitter.on("settingsChange", ({ pluginId, settings }) => cb(pluginId, settings));
  }

  function getMetadata(): PluginMetadata[] {
    return collectMetadata();
  }

  async function updateSettings<T = unknown>(pluginId: string, value: T) {
    const api = buildHostApi(pluginId);
    await api.call("settings.write", { value });
  }

  async function readSettings<T = unknown>(pluginId: string) {
    const api = buildHostApi(pluginId);
    return api.call("settings.read") as Promise<T>;
  }

  async function runCommand<T = unknown>(pluginId: string, commandId: string, params?: unknown): Promise<T | void> {
    const s = states.get(pluginId);
    if (!s?.ctx) throw new Error(`Plugin ${pluginId} is not loaded`);
    return (await commands.run(pluginId, commandId, s.ctx, params)) as T | void;
  }

  function listCommands() {
    return commands.listAll();
  }

  // API the UI layer can call by (method, params)
  function createHostApiFor(pluginId: string) {
    return buildHostApi(pluginId);
  }

  return {
    // lifecycle
    start,
    stop,

    // subscriptions
    onPluginChange,
    onDependencyChange,
    onSettingsChange,
    onStatus: (cb: (s: StatusUpdate) => void) => emitter.on("status", cb),
    onError: (cb: (e: Error) => void) => emitter.on("error", cb),

    // queries
    getPluginDependencies,
    getMetadata,
    listCommands,

    // actions
    updateSettings,
    readSettings,
    runCommand,

    // ui bridge
    createHostApiFor,
  };
}
