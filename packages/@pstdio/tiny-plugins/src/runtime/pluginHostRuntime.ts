import { normalizeRoot, type ChangeRecord } from "@pstdio/opfs-utils";
import type { Tool } from "@pstdio/tiny-ai-tasks";
import { createToolsForCommands } from "../adapters/tiny-ai-tasks";
import { createHost } from "../core/host";
import type { CommandDefinition, HostOptions, Manifest, PluginChangePayload, PluginMetadata } from "../core/types";

type Host = ReturnType<typeof createHost>;
type HostCommand = CommandDefinition & { pluginId: string };

export type PluginSettingsSchema = Record<string, unknown> | boolean;

export type PluginCommand = HostCommand & { pluginName?: string };

export type PluginSurfaces = Record<string, unknown>;

export interface PluginSurfacesEntry {
  pluginId: string;
  surfaces: PluginSurfaces;
}

export type PluginSurfacesSnapshot = PluginSurfacesEntry[];

export interface PluginFilesEvent {
  pluginId: string;
  changes: ChangeRecord[];
}

export type PluginFilesListener = (event: PluginFilesEvent) => void;

export type PluginHostRuntimeOptions = HostOptions;

export interface PluginHostRuntime {
  ensureHost(): Promise<Host>;
  isReady(): boolean;
  getPluginsRoot(): string;
  setPluginsRoot(root: string): Promise<void>;
  getPluginCommands(): PluginCommand[];
  getPluginTools(): Tool[];
  subscribeToPluginCommands(listener: (commands: PluginCommand[]) => void): () => void;
  getPluginSettingsEntries(): Array<{ pluginId: string; schema: PluginSettingsSchema }>;
  subscribeToPluginSettings(listener: (pluginId: string, schema?: PluginSettingsSchema) => void): () => void;
  getPluginSurfaces(): PluginSurfacesSnapshot;
  subscribeToPluginSurfaces(listener: (snapshot: PluginSurfacesSnapshot) => void): () => void;
  getMergedPluginDependencies(): Record<string, string>;
  subscribeToPluginDependencies(listener: (dependencies: Record<string, string>) => void): () => void;
  runCommand(pluginId: string, commandId: string, params?: unknown): Promise<void>;
  readSettings<T = unknown>(pluginId: string): Promise<T>;
  writeSettings<T = unknown>(pluginId: string, value: T): Promise<void>;
  getPluginDisplayName(pluginId: string): string;
  getPluginManifest(pluginId: string): Manifest | null;
  subscribeToPluginFiles(pluginId: string, listener: PluginFilesListener): () => void;
}

export function createPluginHostRuntime(options: PluginHostRuntimeOptions = {}): PluginHostRuntime {
  const defaultRoot = normalizeRoot(options.root, { fallback: "plugins" });
  const defaultDataRoot = normalizeRoot(options.dataRoot, { fallback: "plugin_data" });

  let pluginsRoot = defaultRoot;
  const dataRoot = defaultDataRoot;
  const watch = options.watch ?? true;

  let host: Host | null = null;
  let startPromise: Promise<Host> | null = null;
  let hostReady = false;
  let hostGeneration = 0;

  let rawCommands: HostCommand[] = [];
  let pluginTools: Tool[] = [];
  const pluginSchemas = new Map<string, PluginSettingsSchema>();
  const pluginMetadata = new Map<string, PluginMetadata>();
  const pluginSurfaces = new Map<string, PluginSurfaces>();
  const pluginManifests = new Map<string, Manifest>();

  const commandSubscribers = new Set<(commands: PluginCommand[]) => void>();
  const settingsSubscribers = new Set<(pluginId: string, schema?: PluginSettingsSchema) => void>();
  const surfacesSubscribers = new Set<(snapshot: PluginSurfacesSnapshot) => void>();
  const dependencySubscribers = new Set<(dependencies: Record<string, string>) => void>();
  const pluginFileListeners = new Map<string, Set<PluginFilesListener>>();

  let mergedDependencies: Record<string, string> = {};
  let hostUnsubscribers: Array<() => void> = [];

  const baseHostOptions: HostOptions = {
    hostApiVersion: options.hostApiVersion,
    dataRoot,
    notify: options.notify,
    watch,
    defaultTimeoutMs: options.defaultTimeoutMs,
  };

  function ensureHostOptions(): HostOptions {
    return { ...baseHostOptions, root: pluginsRoot };
  }

  function notifyCommandSubscribers() {
    if (commandSubscribers.size === 0) return;
    const snapshot = collectPluginCommands();
    commandSubscribers.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn("[tiny-plugins] Failed to notify command listener", error);
      }
    });
  }

  function notifySettingsSubscribers(pluginId: string, schema?: PluginSettingsSchema) {
    settingsSubscribers.forEach((listener) => {
      try {
        listener(pluginId, schema);
      } catch (error) {
        console.warn("[tiny-plugins] Failed to notify settings listener", error);
      }
    });
  }

  function notifySurfacesSubscribers() {
    if (surfacesSubscribers.size === 0) return;
    const snapshot = getPluginSurfacesSnapshot();
    surfacesSubscribers.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn("[tiny-plugins] Failed to notify surfaces listener", error);
      }
    });
  }

  function notifyDependencySubscribers() {
    if (dependencySubscribers.size === 0) return;
    const snapshot = { ...mergedDependencies };
    dependencySubscribers.forEach((listener) => {
      try {
        listener({ ...snapshot });
      } catch (error) {
        console.warn("[tiny-plugins] Failed to notify dependency listener", error);
      }
    });
  }

  function notifyPluginFileListeners(pluginId: string, payload: PluginChangePayload) {
    const listeners = pluginFileListeners.get(pluginId);
    if (!listeners || listeners.size === 0) return;

    const changes =
      payload.changes?.map((change) => ({
        ...change,
        path: [...change.path],
      })) ??
      (payload.paths ?? []).map((path) => ({
        type: "unknown" as ChangeRecord["type"],
        path: path.split("/").filter(Boolean),
      }));

    listeners.forEach((listener) => {
      try {
        listener({ pluginId, changes });
      } catch (error) {
        console.warn("[tiny-plugins] Failed to notify file listener", error);
      }
    });
  }

  function collectPluginCommands(): PluginCommand[] {
    return rawCommands.map((command) => ({
      ...command,
      pluginName: pluginMetadata.get(command.pluginId)?.name,
    }));
  }

  function getPluginSurfacesSnapshot(): PluginSurfacesSnapshot {
    const entries: PluginSurfacesSnapshot = [];
    const pluginIds = [...pluginSurfaces.keys()].sort((a, b) => a.localeCompare(b));
    pluginIds.forEach((pluginId) => {
      const surfaces = pluginSurfaces.get(pluginId);
      if (!surfaces) return;
      entries.push({ pluginId, surfaces: cloneJsonish(surfaces) });
    });
    return entries;
  }

  function handleManifestUpdate(pluginId: string, manifest: Manifest | null) {
    if (manifest) {
      pluginManifests.set(pluginId, manifest);
    } else {
      pluginManifests.delete(pluginId);
    }

    const schema = manifest?.settingsSchema;
    const normalizedSchema = isPluginSettingsSchema(schema)
      ? (cloneJsonish(schema) as PluginSettingsSchema)
      : undefined;

    if (normalizedSchema !== undefined) {
      pluginSchemas.set(pluginId, normalizedSchema);
    } else {
      pluginSchemas.delete(pluginId);
    }

    notifySettingsSubscribers(pluginId, normalizedSchema);

    const nextSurfaces = manifest ? getPluginSurfaces(manifest) : undefined;
    const hasExisting = pluginSurfaces.has(pluginId);

    if (!nextSurfaces || Object.keys(nextSurfaces).length === 0) {
      if (hasExisting) {
        pluginSurfaces.delete(pluginId);
        notifySurfacesSubscribers();
      }
      return;
    }

    const current = pluginSurfaces.get(pluginId);
    if (current && surfacesEqual(current, nextSurfaces)) return;

    pluginSurfaces.set(pluginId, nextSurfaces);
    notifySurfacesSubscribers();
  }

  function refreshCommands(instance: Host) {
    rawCommands = instance.listCommands();
    pluginTools = createToolsForCommands(rawCommands, async (pluginId, commandId, params) => {
      const current = await runtime.ensureHost();
      await current.runCommand(pluginId, commandId, params);
    });
    notifyCommandSubscribers();
  }

  function syncPluginMetadata(entries: PluginMetadata[]) {
    const seen = new Set<string>();
    let changed = false;

    entries.forEach((entry) => {
      seen.add(entry.id);
      const stored = pluginMetadata.get(entry.id);
      if (!stored || stored.name !== entry.name || stored.version !== entry.version) {
        pluginMetadata.set(entry.id, { ...entry });
        changed = true;
      }
    });

    pluginMetadata.forEach((_, pluginId) => {
      if (seen.has(pluginId)) return;
      pluginMetadata.delete(pluginId);
      changed = true;
    });

    if (changed) notifyCommandSubscribers();
  }

  function surfacesEqual(left?: PluginSurfaces, right?: PluginSurfaces) {
    if (!left && !right) return true;
    if (!left || !right) return false;
    return JSON.stringify(left) === JSON.stringify(right);
  }

  async function readManifestSnapshot(instance: Host, pluginId: string): Promise<Manifest | null> {
    try {
      const api = instance.createHostApiFor(pluginId);
      const contents = await api.call("fs.readFile", { path: "manifest.json" });
      const text = new TextDecoder().decode(contents);
      const manifest = JSON.parse(text) as Manifest;
      if (manifest?.id !== pluginId) return null;
      return manifest;
    } catch (error) {
      console.warn(`[tiny-plugins] Failed to read manifest for ${pluginId}`, error);
      return null;
    }
  }

  async function initializeHostState(instance: Host, generation: number) {
    const metadata = instance.getMetadata();
    if (generation !== hostGeneration) return;

    syncPluginMetadata(metadata);

    for (const entry of metadata) {
      if (generation !== hostGeneration) return;
      const manifest = await readManifestSnapshot(instance, entry.id);
      if (generation !== hostGeneration) return;
      handleManifestUpdate(entry.id, manifest);
    }

    refreshCommands(instance);
    mergedDependencies = instance.getPluginDependencies();
    notifyDependencySubscribers();
  }

  function attachHostSubscriptions(instance: Host, generation: number) {
    clearHostSubscriptions();

    const unsubscribePluginChange = instance.onPluginChange((pluginId, payload) => {
      if (generation !== hostGeneration) return;
      handleManifestUpdate(pluginId, payload.manifest);
      syncPluginMetadata(instance.getMetadata());
      refreshCommands(instance);
      notifyPluginFileListeners(pluginId, payload);
    });

    const unsubscribeDependencies = instance.onDependencyChange((deps) => {
      if (generation !== hostGeneration) return;
      mergedDependencies = { ...deps };
      notifyDependencySubscribers();
    });

    hostUnsubscribers = [unsubscribePluginChange, unsubscribeDependencies];
  }

  function clearHostSubscriptions() {
    if (hostUnsubscribers.length === 0) return;
    hostUnsubscribers.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn("[tiny-plugins] Failed to remove host subscription", error);
      }
    });
    hostUnsubscribers = [];
  }

  async function disposeHost(instance: Host | null) {
    if (!instance) return;
    try {
      await instance.stop();
    } catch (error) {
      console.warn("[tiny-plugins] Failed to dispose plugin host", error);
    }
  }

  function resetRuntimeState() {
    const schemaKeys = Array.from(pluginSchemas.keys());
    pluginSchemas.clear();
    schemaKeys.forEach((pluginId) => notifySettingsSubscribers(pluginId, undefined));

    rawCommands = [];
    pluginTools = [];
    notifyCommandSubscribers();

    const hadSurfaces = pluginSurfaces.size > 0;
    pluginSurfaces.clear();
    if (hadSurfaces) notifySurfacesSubscribers();

    pluginMetadata.clear();
    mergedDependencies = {};
    notifyDependencySubscribers();

    pluginManifests.clear();
    pluginFileListeners.clear();
  }

  function createHostInstance() {
    return createHost(ensureHostOptions());
  }

  async function ensureHost(): Promise<Host> {
    if (host && hostReady) return host;

    if (!startPromise) {
      const generation = hostGeneration;
      const instance = createHostInstance();
      host = instance;
      hostReady = false;
      attachHostSubscriptions(instance, generation);

      startPromise = (async () => {
        try {
          await instance.start();
          if (generation !== hostGeneration) {
            await instance.stop().catch(() => undefined);
            if (host === instance) {
              clearHostSubscriptions();
              host = null;
            }
            throw new Error("Plugin root changed during initialization");
          }

          await initializeHostState(instance, generation);
          if (generation !== hostGeneration) {
            throw new Error("Plugin host replaced during initialization");
          }

          hostReady = true;
          return instance;
        } catch (error) {
          if (host === instance) {
            clearHostSubscriptions();
            host = null;
            hostReady = false;
          }
          throw error;
        } finally {
          startPromise = null;
        }
      })();
    }

    const instance = await startPromise;
    if (!instance) throw new Error("Plugin host failed to initialize.");
    return instance;
  }

  async function setPluginsRoot(nextRoot: string) {
    const normalized = normalizeRoot(nextRoot) || defaultRoot;
    if (!normalized || normalized === pluginsRoot) return;

    const previousHost = host;
    const previousPromise = startPromise;

    hostGeneration += 1;
    pluginsRoot = normalized;
    host = null;
    hostReady = false;
    startPromise = null;

    clearHostSubscriptions();
    resetRuntimeState();

    if (previousPromise) {
      try {
        await previousPromise.catch(() => previousHost ?? null);
      } catch {
        /* ignore */
      }
    }

    await disposeHost(previousHost);
  }

  const runtime: PluginHostRuntime = {
    ensureHost,
    isReady: () => hostReady,
    getPluginsRoot: () => pluginsRoot,
    setPluginsRoot,
    getPluginCommands: () => collectPluginCommands(),
    getPluginTools: () => [...pluginTools],
    subscribeToPluginCommands: (listener) => {
      commandSubscribers.add(listener);
      listener(collectPluginCommands());
      void ensureHost().catch((error) => {
        console.warn("[tiny-plugins] Failed to initialize plugin host for commands", error);
      });
      return () => {
        commandSubscribers.delete(listener);
      };
    },
    getPluginSettingsEntries: () =>
      Array.from(pluginSchemas.entries())
        .map(([pluginId, schema]) => ({ pluginId, schema }))
        .sort((a, b) => a.pluginId.localeCompare(b.pluginId)),
    subscribeToPluginSettings: (listener) => {
      settingsSubscribers.add(listener);
      pluginSchemas.forEach((schema, pluginId) => listener(pluginId, schema));
      void ensureHost().catch((error) => {
        console.warn("[tiny-plugins] Failed to initialize plugin host for settings", error);
      });
      return () => {
        settingsSubscribers.delete(listener);
      };
    },
    getPluginSurfaces: () => getPluginSurfacesSnapshot(),
    subscribeToPluginSurfaces: (listener) => {
      surfacesSubscribers.add(listener);
      listener(getPluginSurfacesSnapshot());
      void ensureHost().catch((error) => {
        console.warn("[tiny-plugins] Failed to initialize plugin host for surfaces", error);
      });
      return () => {
        surfacesSubscribers.delete(listener);
      };
    },
    getMergedPluginDependencies: () => ({ ...mergedDependencies }),
    subscribeToPluginDependencies: (listener) => {
      dependencySubscribers.add(listener);
      listener({ ...mergedDependencies });
      void ensureHost().catch((error) => {
        console.warn("[tiny-plugins] Failed to initialize plugin host for dependencies", error);
      });
      return () => {
        dependencySubscribers.delete(listener);
      };
    },
    runCommand: async (pluginId, commandId, params) => {
      const instance = await ensureHost();
      await instance.runCommand(pluginId, commandId, params);
    },
    readSettings: async (pluginId) => {
      const instance = await ensureHost();
      return instance.readSettings(pluginId);
    },
    writeSettings: async (pluginId, value) => {
      const instance = await ensureHost();
      await instance.updateSettings(pluginId, value);
    },
    getPluginDisplayName: (pluginId) => pluginMetadata.get(pluginId)?.name || pluginId,
    getPluginManifest: (pluginId) => pluginManifests.get(pluginId) ?? null,
    subscribeToPluginFiles: (pluginId, listener) => {
      let listeners = pluginFileListeners.get(pluginId);
      if (!listeners) {
        listeners = new Set();
        pluginFileListeners.set(pluginId, listeners);
      }
      listeners.add(listener);
      void ensureHost().catch((error) => {
        console.warn(`[tiny-plugins] Failed to initialize plugin host for file subscription ${pluginId}`, error);
      });
      return () => {
        const bucket = pluginFileListeners.get(pluginId);
        bucket?.delete(listener);
        if (bucket && bucket.size === 0) {
          pluginFileListeners.delete(pluginId);
        }
      };
    },
  };

  return runtime;
}

function cloneJsonish<T>(value: T): T {
  const cloneFn = (globalThis as typeof globalThis & { structuredClone?: <V>(input: V) => V }).structuredClone;
  if (typeof cloneFn === "function") return cloneFn(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPluginSettingsSchema(value: unknown): value is PluginSettingsSchema {
  if (typeof value === "boolean") return true;
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getPluginSurfaces(manifest: Manifest): PluginSurfaces | undefined {
  const rawSurfaces = manifest.surfaces;
  if (isRecord(rawSurfaces)) return cloneJsonish(rawSurfaces as Record<string, unknown>);

  return undefined;
}
