import { ls, normalizeRoot, type ChangeRecord } from "@pstdio/opfs-utils";
import { CommandRegistry } from "../commands";
import { Emitter } from "../events";
import type { HostOptions, PluginChangePayload, StatusUpdate } from "../types";
import { watchPluginsRoot } from "../watchers";
import { collectMetadata, getPluginDependencies } from "./utils";
import type { Events, HostRuntime, LifecycleHooks } from "./internalTypes";
import { handlePluginAddition, handlePluginRemoval, loadPlugin, startPluginWatcher, unloadPlugin } from "./plugins";
import { buildHostApi } from "./hostApi";

const DEFAULT_HOST_API_VERSION = "v1";

export function createHost(options: HostOptions) {
  const root = normalizeRoot(options.root, { fallback: "plugins" });
  const dataRoot = normalizeRoot(options.dataRoot, { fallback: "plugin_data" });
  const watch = options.watch ?? true;
  const notify = options.notify;
  const hostApiVersion = options.hostApiVersion ?? DEFAULT_HOST_API_VERSION;
  const workerEnabled = typeof Worker !== "undefined";

  const workerScriptUrl = workerEnabled
    ? new URL(/* @vite-ignore */ "../../runtime/pluginWorker.ts", import.meta.url)
    : null;

  const emitter = new Emitter<Events>();
  const commands = new CommandRegistry(options.defaultTimeoutMs);
  const states: HostRuntime["states"] = new Map();
  let rootWatcherCleanup: (() => void | Promise<void>) | undefined;

  const runtime: HostRuntime = {
    root,
    dataRoot,
    watch,
    notify,
    hostApiVersion,
    workerEnabled,
    workerScriptUrl,
    emitter,
    commands,
    states,
  };

  function emitStatus(status: string, pluginId?: string, detail?: unknown) {
    notify?.("info", status);
    emitter.emit("status", { status, pluginId, detail });
  }

  function emitError(err: Error) {
    notify?.("error", err.message);
    emitter.emit("error", err);
  }

  function emitPluginsChange() {
    emitter.emit("pluginsChange", { plugins: collectMetadata(states) });
  }

  function emitDependenciesChanged() {
    emitter.emit("dependencyChange", { deps: getPluginDependencies(states) });
  }

  const hooks: LifecycleHooks = {
    emitStatus,
    emitError,
    emitPluginsChange,
    emitDependenciesChanged,
  };

  async function startRootWatcher() {
    if (!watch || rootWatcherCleanup) return;

    rootWatcherCleanup = await watchPluginsRoot(root, async (changes: ChangeRecord[]) => {
      const grouped = new Map<string, ChangeRecord[]>();
      changes.forEach((change) => {
        const pluginId = change.path[0];
        if (!pluginId) return;
        const existing = grouped.get(pluginId);
        if (existing) existing.push(change);
        else grouped.set(pluginId, [change]);
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
        await handlePluginRemoval(pluginId, pluginChanges, runtime, hooks);
      }
      for (const pluginId of additions) {
        await handlePluginAddition(pluginId, runtime, hooks);
      }
    });
  }

  async function start() {
    let pluginIds: string[] = [];
    try {
      const entries = await ls(root, { maxDepth: 1, kinds: ["directory"] });
      pluginIds = entries.map((entry) => entry.name);
    } catch {
      pluginIds = [];
    }

    for (const id of pluginIds) {
      try {
        await loadPlugin(id, runtime, hooks, { emitChange: false });
        await startPluginWatcher(id, runtime, hooks);
      } catch (error) {
        emitError(error as Error);
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

    for (const [id, state] of states) {
      try {
        await state.watcherCleanup?.();
      } catch {
        /* ignore */
      }
      await unloadPlugin(id, runtime);
    }
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

  function getMetadata() {
    return collectMetadata(states);
  }

  function listCommands() {
    return commands.listAll();
  }

  function getPluginDependenciesPublic() {
    return getPluginDependencies(states);
  }

  async function updateSettings<T = unknown>(pluginId: string, value: T) {
    const api = buildHostApi({ root, dataRoot, pluginId, notify, emitter });
    await api.call("settings.write", { value });
  }

  async function readSettings<T = unknown>(pluginId: string) {
    const api = buildHostApi({ root, dataRoot, pluginId, notify, emitter });
    return api.call("settings.read") as Promise<T>;
  }

  async function runCommand<T = unknown>(pluginId: string, commandId: string, params?: unknown): Promise<T | void> {
    const state = states.get(pluginId);
    if (!state?.ctx) throw new Error(`Plugin ${pluginId} is not loaded`);
    return (await commands.run(pluginId, commandId, state.ctx, params)) as T | void;
  }

  function createHostApiFor(pluginId: string) {
    return buildHostApi({ root, dataRoot, pluginId, notify, emitter });
  }

  return {
    start,
    stop,
    onPluginChange,
    onDependencyChange,
    onSettingsChange,
    onStatus: (cb: (s: StatusUpdate) => void) => emitter.on("status", cb),
    onError: (cb: (e: Error) => void) => emitter.on("error", cb),
    getPluginDependencies: getPluginDependenciesPublic,
    getMetadata,
    listCommands,
    updateSettings,
    readSettings,
    runCommand,
    createHostApiFor,
  };
}
