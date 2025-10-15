import { createScopedFs, ls, type ChangeRecord } from "@pstdio/opfs-utils";
import Ajv, { type ValidateFunction } from "ajv";
import type { Manifest, PluginMetadata, RegisteredCommand } from "../model/manifest";
import manifestSchema from "../schema/manifest.schema.json" assert { type: "json" };
import { CommandRegistry } from "./commands";
import type { PluginHostError } from "./errors";
import { loadPlugin, unloadPlugin, type LoadedPlugin, type Timeouts } from "./loader";
import type { SettingsAccessor } from "./settings";
import { createSettingsAccessor } from "./settings";
import type { HostOptions, PluginHost } from "./types";
import { watchPluginFiles, watchPluginsRoot, type Dispose } from "./watcher";

const HOST_API_VERSION = "1.0.0";

const DEFAULT_TIMEOUTS: Timeouts = {
  activate: 10_000,
  deactivate: 5_000,
  command: 10_000,
};

interface PluginState {
  id: string;
  manifest: Manifest | null;
  metadata: PluginMetadata;
  loaded: LoadedPlugin | null;
  fileWatcherCleanup: Dispose | null;
  loadPromise: Promise<void> | null;
  pendingReload: boolean;
  removed: boolean;
  settingsValidator?: ValidateFunction;
}

function resolveRoot(root?: string) {
  if (!root) return "plugins";
  const trimmed = root.trim().replace(/^[\\/]+|[\\/]+$/g, "");
  return trimmed || "plugins";
}

function clone<T>(value: T): T {
  if (value == null) return value;
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function isNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return (
    (error as { code?: string; name?: string }).code === "ENOENT" ||
    (error as { name?: string }).name === "NotFoundError"
  );
}

export function createPluginHost(options: HostOptions = {}): PluginHost {
  const root = resolveRoot(options.root);
  const dataRoot = options.dataRoot ? resolveRoot(options.dataRoot) : root;
  const watchEnabled = options.watch !== false;
  const timeouts: Timeouts = {
    activate: options.timeouts?.activate ?? DEFAULT_TIMEOUTS.activate,
    deactivate: options.timeouts?.deactivate ?? DEFAULT_TIMEOUTS.deactivate,
    command: options.timeouts?.command ?? DEFAULT_TIMEOUTS.command,
  };

  const ajv = new Ajv({ allErrors: true, useDefaults: true });

  const manifestValidator = ajv.compile(manifestSchema) as ValidateFunction;

  const registry = new CommandRegistry();

  const pluginStates = new Map<string, PluginState>();
  const pluginSubscribers = new Set<(plugins: PluginMetadata[]) => void>();
  const manifestSubscribers = new Map<string, Set<(manifest: Manifest | null) => void>>();
  const manifestBroadcastSubscribers = new Set<(update: { pluginId: string; manifest: Manifest | null }) => void>();
  const fileSubscribers = new Map<string, Set<(event: { pluginId: string; changes: ChangeRecord[] }) => void>>();

  let rootWatcherCleanup: Dispose | null = null;
  let ready = false;

  const notifyHost = (level: "info" | "warn" | "error", message: string): boolean => {
    if (typeof options.notify !== "function") return false;
    try {
      options.notify?.(level, message);
      return true;
    } catch (error) {
      console.error("[tiny-plugins] notify callback failed", error);
      return true;
    }
  };

  const emitNotification = (level: "info" | "warn" | "error", message: string) => {
    const delivered = notifyHost(level, message);
    if (delivered) return;

    const prefix = "[tiny-plugins]";
    if (level === "error") {
      console.error(prefix, message);
    } else if (level === "warn") {
      console.warn(prefix, message);
    } else {
      console.info(prefix, message);
    }
  };

  const logWarn = (message: string) => {
    console.warn("[tiny-plugins]", message);
    notifyHost("warn", message);
  };

  const logError = (message: string, error?: unknown) => {
    console.error("[tiny-plugins]", message, error);
    notifyHost("error", message);
  };

  function getOrCreateState(pluginId: string): PluginState {
    const existing = pluginStates.get(pluginId);
    if (existing) {
      existing.removed = false;
      return existing;
    }

    const state: PluginState = {
      id: pluginId,
      manifest: null,
      metadata: { id: pluginId },
      loaded: null,
      fileWatcherCleanup: null,
      loadPromise: null,
      pendingReload: false,
      removed: false,
      settingsValidator: undefined,
    };

    pluginStates.set(pluginId, state);
    notifyPluginsChanged();
    return state;
  }

  function notifyPluginsChanged() {
    const list = [...pluginStates.values()]
      .filter((state) => !state.removed)
      .map((state) => ({ ...state.metadata }))
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const cb of pluginSubscribers) {
      try {
        cb(list);
      } catch (error) {
        console.error("[tiny-plugins] plugin subscriber failed", error);
      }
    }
  }

  function emitManifest(pluginId: string, manifest: Manifest | null) {
    const specific = manifestSubscribers.get(pluginId);
    if (specific) {
      for (const cb of specific) {
        try {
          cb(manifest ? clone(manifest) : null);
        } catch (error) {
          console.error("[tiny-plugins] manifest subscriber failed", error);
        }
      }
    }

    for (const cb of manifestBroadcastSubscribers) {
      try {
        cb({ pluginId, manifest: manifest ? clone(manifest) : null });
      } catch (error) {
        console.error("[tiny-plugins] manifests subscriber failed", error);
      }
    }
  }

  async function ensurePluginWatcher(state: PluginState) {
    if (!watchEnabled || state.removed || state.fileWatcherCleanup) return;

    try {
      state.fileWatcherCleanup = await watchPluginFiles({
        root,
        pluginId: state.id,
        onChange(pluginId, changes) {
          emitFileChanges(pluginId, changes);
          scheduleLoad(state);
        },
      });
    } catch (error) {
      logWarn(`Failed to watch plugin ${state.id}: ${(error as Error).message}`);
    }
  }

  function emitFileChanges(pluginId: string, changes: ChangeRecord[]) {
    const listeners = fileSubscribers.get(pluginId);
    if (!listeners || listeners.size === 0) return;

    const payload = {
      pluginId,
      changes: changes.map((change) => ({ ...change, path: [...change.path] })),
    };

    for (const cb of listeners) {
      try {
        cb(payload);
      } catch (error) {
        console.error("[tiny-plugins] file subscriber failed", error);
      }
    }
  }

  async function performLoad(state: PluginState) {
    if (state.removed) return;

    if (state.loaded) {
      await unloadPlugin(state.loaded, registry, timeouts);
      state.loaded = null;
    }

    try {
      const loaded = await loadPlugin({
        pluginId: state.id,
        pluginsRoot: root,
        pluginsDataRoot: dataRoot,
        registry,
        manifestValidator,
        ajv,
        timeouts,
        hostApiVersion: HOST_API_VERSION,
        notify: emitNotification,
        warn: logWarn,
      });

      state.loaded = loaded;
      state.manifest = loaded.manifest;
      state.metadata = {
        id: loaded.manifest.id,
        name: loaded.manifest.name,
        version: loaded.manifest.version,
      };
      state.settingsValidator = loaded.settingsValidator;

      emitManifest(state.id, loaded.manifest);
      notifyPluginsChanged();
    } catch (error) {
      state.loaded = null;
      const hostError = error as PluginHostError;
      const message = hostError?.message ?? `Failed to load plugin ${state.id}`;
      logError(message, error);
      emitManifest(state.id, null);
    }
  }

  function scheduleLoad(state: PluginState) {
    if (state.removed) return;
    state.pendingReload = true;

    if (state.loadPromise) return state.loadPromise;

    const run = async () => {
      while (state.pendingReload && !state.removed) {
        state.pendingReload = false;
        await ensurePluginWatcher(state);
        await performLoad(state);
      }
    };

    const promise = run().finally(() => {
      if (state.loadPromise === promise) {
        state.loadPromise = null;
      }
    });

    state.loadPromise = promise;
    return promise;
  }

  async function disposeState(state: PluginState) {
    state.removed = true;
    state.pendingReload = false;

    if (state.loadPromise) {
      try {
        await state.loadPromise;
      } catch {
        /* ignore */
      }
    }

    if (state.loaded) {
      await unloadPlugin(state.loaded, registry, timeouts);
      state.loaded = null;
    }

    if (state.fileWatcherCleanup) {
      try {
        await state.fileWatcherCleanup();
      } catch {
        /* ignore */
      }
      state.fileWatcherCleanup = null;
    }

    pluginStates.delete(state.id);
    emitManifest(state.id, null);
    notifyPluginsChanged();
  }

  async function pluginDirectoryExists(pluginId: string): Promise<boolean> {
    const fs = createScopedFs([root, pluginId].filter(Boolean).join("/"));
    try {
      return fs.exists("");
    } catch (error) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  async function handleRootChange(pluginId: string) {
    const exists = await pluginDirectoryExists(pluginId);
    const state = pluginStates.get(pluginId);

    if (!exists) {
      if (state) {
        await disposeState(state);
      }
      return;
    }

    const nextState = state ?? getOrCreateState(pluginId);
    await ensurePluginWatcher(nextState);
    scheduleLoad(nextState);
  }

  async function ensureRootWatcher() {
    if (rootWatcherCleanup || !watchEnabled) return;

    try {
      rootWatcherCleanup = await watchPluginsRoot(root, (pluginId) => {
        void handleRootChange(pluginId);
      });
    } catch (error) {
      logWarn(`Failed to watch plugins root: ${(error as Error).message}`);
    }
  }

  async function enumeratePlugins(): Promise<string[]> {
    try {
      const entries = await ls(root, { maxDepth: 1, kinds: ["directory"] });
      return entries.map((entry) => entry.name);
    } catch (error) {
      if (isNotFoundError(error)) return [];
      throw error;
    }
  }

  async function start() {
    if (ready) return;

    const pluginIds = await enumeratePlugins();
    const pendingLoads: Promise<void>[] = [];

    for (const id of pluginIds) {
      const state = getOrCreateState(id);
      await ensurePluginWatcher(state);
      const promise = scheduleLoad(state);
      if (promise) pendingLoads.push(promise.then(() => undefined));
    }

    await Promise.allSettled(pendingLoads);
    await ensureRootWatcher();
    ready = true;
  }

  async function stop() {
    if (!ready) return;
    ready = false;

    if (rootWatcherCleanup) {
      try {
        await rootWatcherCleanup();
      } catch {
        /* ignore */
      }
      rootWatcherCleanup = null;
    }

    for (const state of [...pluginStates.values()]) {
      await disposeState(state);
    }
  }

  function isReady() {
    return ready;
  }

  function listPlugins(): PluginMetadata[] {
    return [...pluginStates.values()]
      .filter((state) => !state.removed)
      .map((state) => ({ ...state.metadata }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  function subscribePlugins(cb: (plugins: PluginMetadata[]) => void) {
    pluginSubscribers.add(cb);
    cb(listPlugins());
    return () => {
      pluginSubscribers.delete(cb);
    };
  }

  function doesPluginExist(pluginId: string) {
    const state = pluginStates.get(pluginId);
    return Boolean(state && !state.removed);
  }

  function listPluginCommands(pluginId: string): RegisteredCommand[] {
    return registry.list(pluginId);
  }

  function runPluginCommand<T = unknown>(pluginId: string, cmdId: string) {
    return (params?: unknown) => registry.run(pluginId, cmdId, params) as Promise<T | void>;
  }

  async function readPluginSettings<T = unknown>(pluginId: string): Promise<T> {
    const state = pluginStates.get(pluginId);
    const accessor = ensureSettingsAccessor(state, pluginId);
    return accessor.read<T>();
  }

  async function writePluginSettings<T = unknown>(pluginId: string, value: T): Promise<void> {
    const state = pluginStates.get(pluginId);
    const accessor = ensureSettingsAccessor(state, pluginId);
    await accessor.write(value);
  }

  function ensureSettingsAccessor(state: PluginState | undefined, pluginId: string): SettingsAccessor {
    if (state?.loaded?.contextSettings) return state.loaded.contextSettings;

    const fs = createScopedFs([dataRoot, pluginId].filter(Boolean).join("/"));
    let validator = state?.settingsValidator;

    if (!validator && state?.manifest?.settingsSchema) {
      try {
        validator = ajv.compile(state.manifest.settingsSchema);
        if (state) {
          state.settingsValidator = validator as ValidateFunction;
        }
      } catch (error) {
        logWarn(`Failed to compile settings schema for ${pluginId}: ${(error as Error).message}`);
      }
    }

    return createSettingsAccessor(fs, pluginId, validator);
  }

  function readPluginManifest(pluginId: string): Promise<Manifest | null> {
    const state = pluginStates.get(pluginId);
    if (!state || state.removed || !state.manifest) return Promise.resolve(null);
    return Promise.resolve(clone(state.manifest));
  }

  function listCommands(): Array<RegisteredCommand & { pluginId: string }> {
    return registry.listAll();
  }

  function subscribePluginManifest(pluginId: string, cb: (manifest: Manifest | null) => void) {
    const set = manifestSubscribers.get(pluginId) ?? new Set();
    set.add(cb);
    manifestSubscribers.set(pluginId, set);
    const manifest = pluginStates.get(pluginId)?.manifest ?? null;
    cb(manifest ? clone(manifest) : null);
    return () => {
      const current = manifestSubscribers.get(pluginId);
      current?.delete(cb);
      if (current && current.size === 0) {
        manifestSubscribers.delete(pluginId);
      }
    };
  }

  function subscribeManifests(cb: (update: { pluginId: string; manifest: Manifest | null }) => void) {
    manifestBroadcastSubscribers.add(cb);
    return () => {
      manifestBroadcastSubscribers.delete(cb);
    };
  }

  function subscribePluginFiles(pluginId: string, cb: (event: { pluginId: string; changes: ChangeRecord[] }) => void) {
    const set = fileSubscribers.get(pluginId) ?? new Set();
    set.add(cb);
    fileSubscribers.set(pluginId, set);
    return () => {
      const current = fileSubscribers.get(pluginId);
      current?.delete(cb);
      if (current && current.size === 0) {
        fileSubscribers.delete(pluginId);
      }
    };
  }

  return {
    start,
    stop,
    isReady,
    listPlugins,
    subscribePlugins,
    doesPluginExist,
    listPluginCommands,
    runPluginCommand,
    readPluginSettings,
    writePluginSettings,
    readPluginManifest,
    listCommands,
    subscribePluginManifest,
    subscribeManifests,
    subscribePluginFiles,
  } satisfies PluginHost;
}

export { HOST_API_VERSION };
