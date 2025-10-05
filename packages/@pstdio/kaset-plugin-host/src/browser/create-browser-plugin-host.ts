import { createPluginHost } from "../host/plugin-host";
import type { RegisteredCommand, NotificationLevel } from "../host/context";
import type { HostConfig, PluginHost } from "../host/types";
import type { JSONSchema } from "../model/manifest";
import {
  deleteFile,
  getDirectoryHandle,
  ls,
  readFile,
  watchDirectory,
  writeFile,
  type ChangeRecord,
} from "@pstdio/opfs-utils";

export type PluginMetadata = { id: string; name?: string; version?: string };
export type PluginFilesEvent = { pluginId: string; changes: ChangeRecord[] };
export type PluginFilesListener = (event: PluginFilesEvent) => void;

export interface BrowserHostOptions {
  root: string;
  notify?: (level: NotificationLevel, message: string) => void;
  host?: Omit<HostConfig, "pluginsRoot" | "ui" | "netFetch" | "watchPlugins"> & {
    netFetch?: (url: string, init?: RequestInit) => Promise<Response>;
  };
  watch?: boolean;
  onPluginEvent?: (pluginId: string, event: string, payload: unknown) => void;
}

/** Public surface exposed to browser consumers for managing OPFS-backed plugins. */
export interface BrowserPluginHost {
  /** Load plugins from OPFS so browser clients can use commands and settings. */
  start(): Promise<void>;
  /** Stop watchers and reset state when the browser no longer needs plugin access. */
  stop(): Promise<void>;
  /** Let callers gate interactions until the host finishes loading plugins. */
  isReady(): boolean;
  /** Provide the command list so UIs can render menus or action palettes. */
  listCommands(): RegisteredCommand[];
  /** Keep command UIs in sync by subscribing to changes in the command registry. */
  subscribeCommands(listener: (commands: RegisteredCommand[]) => void): () => void;
  /** Invoke a plugin command in response to user actions. */
  runCommand(pluginId: string, commandId: string): Promise<void>;
  /** Watch for settings schema updates so forms can adapt dynamically. */
  subscribeSettings(listener: (pluginId: string, schema?: JSONSchema) => void): () => void;
  /** Retrieve persisted settings to hydrate configuration views. */
  readSettings<T = unknown>(pluginId: string): Promise<T>;
  /** Persist updated settings coming from browser-driven edits. */
  writeSettings<T = unknown>(pluginId: string, value: T): Promise<void>;
  /** Surface plugin metadata so selectors and dashboards know what is available. */
  listPlugins(): PluginMetadata[];
  /** Stay current with plugin availability by subscribing to metadata changes. */
  subscribePlugins(listener: (plugins: PluginMetadata[]) => void): () => void;
  /** Resolve plugin ids to human-friendly labels for presentation. */
  getPluginDisplayName(pluginId: string): string;
  /** Load a plugin manifest so consumers can inspect capabilities and metadata. */
  readManifest(pluginId: string): Promise<unknown | null>;
  /** React to manifest edits for a specific plugin, e.g., when showing details. */
  subscribeManifest(pluginId: string, listener: (manifest: unknown | null) => void): () => void;
  /** Observe manifest updates across all plugins for global dashboards. */
  subscribeManifests(listener: (update: { pluginId: string; manifest: unknown | null }) => void): () => void;
  /** Listen for file changes to power live editors or hot-reload experiences. */
  subscribePluginFiles(pluginId: string, listener: PluginFilesListener): () => void;
  /** Reveal the active plugins root for debugging and status displays. */
  getRoot(): string;
}

/** Normalize the configured root so we always point at a single OPFS directory. */
function normalizeRoot(root: string) {
  const trimmed = root.replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed || "plugins";
}

/** Ensure the target directory exists by briefly creating a sentinel file. */
async function ensureDirectory(path: string) {
  try {
    await getDirectoryHandle(path);
  } catch (error: unknown) {
    const notFound = (error as { name?: string; code?: number })?.name === "NotFoundError";
    const missing = (error as { code?: number })?.code === 404;

    if (!notFound && !missing) throw error;

    const keep = `${path.replace(/\/+$/, "")}/.keep`;
    await writeFile(keep, "");
    try {
      await deleteFile(keep);
    } catch {
      // Ignore delete failures; directory exists at this point.
    }
  }
}

/** Create a browser-aware plugin host that manages OPFS-backed plugins and subscriptions. */
export function createBrowserPluginHost(options: BrowserHostOptions): BrowserPluginHost {
  const watchPlugins = options.watch ?? true;

  let pluginsRoot = normalizeRoot(options.root);
  let host: PluginHost | null = null;
  let ready = false;

  let commands: RegisteredCommand[] = [];
  const schemas = new Map<string, JSONSchema>();
  const metadata = new Map<string, PluginMetadata>();
  const manifests = new Map<string, unknown | null>();

  const commandSubscribers = new Set<(next: RegisteredCommand[]) => void>();
  const settingsSubscribers = new Set<(pluginId: string, schema?: JSONSchema) => void>();
  const pluginSubscribers = new Set<(next: PluginMetadata[]) => void>();
  const manifestSubscribers = new Set<(update: { pluginId: string; manifest: unknown | null }) => void>();
  const manifestSubscribersPerPlugin = new Map<string, Set<(manifest: unknown | null) => void>>();

  let rootWatcherCleanup: (() => void | Promise<void>) | null = null;
  let rootWatchDebounce: number | undefined;

  type PluginFileWatcher = {
    listeners: Set<PluginFilesListener>;
    cleanup?: () => void | Promise<void>;
    pending?: Promise<void>;
  };

  const pluginFileWatchers = new Map<string, PluginFileWatcher>();

  function notify(level: NotificationLevel, message: string) {
    options.notify?.(level, message);
  }

  function getPluginDir(pluginId: string) {
    const trimmedRoot = pluginsRoot.replace(/\/+$/, "");
    const trimmedId = pluginId.replace(/^\/+/, "");
    return `${trimmedRoot}/${trimmedId}`.replace(/^\/+/, "");
  }

  function pushCommands() {
    const snapshot = commands.map((command) => ({ ...command }));
    commandSubscribers.forEach((listener) => listener(snapshot));
  }

  function pushPlugins() {
    const list = Array.from(metadata.values())
      .map((entry) => ({ ...entry }))
      .sort((a, b) => a.id.localeCompare(b.id));
    pluginSubscribers.forEach((listener) => listener(list));
  }

  function publishManifest(pluginId: string, manifest: unknown | null) {
    manifestSubscribers.forEach((listener) => listener({ pluginId, manifest }));
    const set = manifestSubscribersPerPlugin.get(pluginId);
    set?.forEach((listener) => listener(manifest));
  }

  /** List immediate child directories so we know which plugins are currently present. */
  async function listPluginDirectories() {
    try {
      const entries = await ls(pluginsRoot, { maxDepth: 1, kinds: ["directory"] });
      return entries.map((entry) => entry.name).filter(Boolean) as string[];
    } catch (error: unknown) {
      const name = (error as { name?: string })?.name;
      const code = (error as { code?: number })?.code;
      if (name === "NotFoundError" || code === 404) return [];
      console.warn("[browser-host] Failed to list plugin directories", error);
      return [];
    }
  }

  /** Load and parse a plugin's manifest file, tolerating missing entries. */
  async function readManifestRaw(pluginId: string) {
    try {
      const raw = await readFile(`${pluginsRoot}/${pluginId}/manifest.json`);
      return JSON.parse(raw) as unknown;
    } catch (error: unknown) {
      const name = (error as { name?: string })?.name;
      const code = (error as { code?: number })?.code;
      if (name === "NotFoundError" || code === 404) return null;
      console.warn(`[browser-host] Failed to read manifest for ${pluginId}`, error);
      return null;
    }
  }

  /** Compute the metadata snapshot we surface to the UI from the manifest payload. */
  function deriveMetadata(pluginId: string, manifest: unknown) {
    const value = manifest as { id?: string; name?: string; version?: string } | null | undefined;
    return {
      id: value?.id ?? pluginId,
      name: value?.name,
      version: value?.version,
    } satisfies PluginMetadata;
  }

  /** Sync in-memory state with the live plugins directory, emitting events on change. */
  async function refreshInventory(options: { force?: boolean } = {}) {
    const dirs = await listPluginDirectories();
    const live = new Set(dirs);

    const removed: string[] = [];
    for (const id of metadata.keys()) {
      if (live.has(id)) continue;
      metadata.delete(id);
      manifests.delete(id);
      removed.push(id);
    }
    if (removed.length > 0) {
      pushPlugins();
      removed.forEach((pluginId) => publishManifest(pluginId, null));
    }

    for (const id of live) {
      const manifest = await readManifestRaw(id);
      const previous = manifests.get(id);

      const changed =
        options.force === true ||
        (manifest && JSON.stringify(manifest) !== JSON.stringify(previous ?? undefined)) ||
        (!manifest && previous !== undefined);

      if (changed) {
        manifests.set(id, manifest);
        const meta = deriveMetadata(id, manifest);
        const stored = metadata.get(id);
        const metaChanged =
          !stored || stored.name !== meta.name || stored.version !== meta.version || stored.id !== meta.id;
        metadata.set(id, meta);
        if (metaChanged) pushPlugins();
        publishManifest(id, manifest);
      } else if (!metadata.has(id)) {
        metadata.set(id, deriveMetadata(id, manifest));
        pushPlugins();
      }
    }

    pluginFileWatchers.forEach((watcher, pluginId) => {
      if (!live.has(pluginId)) return;
      if (watcher.listeners.size === 0) return;
      if (watcher.cleanup) return;
      const maybeStart = ensurePluginFileWatcher(pluginId);
      if (maybeStart) {
        maybeStart.catch(() => {
          // Errors are logged inside ensurePluginFileWatcher.
        });
      }
    });
  }

  /** Watch the plugin root for changes so inventory stays up to date in the browser. */
  async function ensureRootWatcher() {
    if (!watchPlugins) return;
    if (rootWatcherCleanup) return;
    if (typeof window === "undefined") return;

    try {
      rootWatcherCleanup = await watchDirectory(
        pluginsRoot,
        () => {
          if (rootWatchDebounce !== undefined) clearTimeout(rootWatchDebounce);
          rootWatchDebounce = window.setTimeout(() => {
            refreshInventory({ force: true }).catch((error: unknown) => {
              console.warn("[browser-host] Inventory refresh failed", error);
            });
          }, 150);
        },
        { recursive: true, emitInitial: false },
      );
    } catch (error: unknown) {
      console.warn("[browser-host] Failed to start root watcher", error);
    }
  }

  /** Tear down the root watcher when the host stops or changes roots. */
  async function disposeRootWatcher() {
    if (!rootWatcherCleanup) return;

    try {
      await rootWatcherCleanup();
    } catch (error: unknown) {
      console.warn("[browser-host] Failed to dispose root watcher", error);
    } finally {
      rootWatcherCleanup = null;
      if (rootWatchDebounce !== undefined) clearTimeout(rootWatchDebounce);
      rootWatchDebounce = undefined;
    }
  }

  /** Start a per-plugin watcher so consumers can react to file-level changes. */
  function ensurePluginFileWatcher(pluginId: string) {
    const record = pluginFileWatchers.get(pluginId);
    if (!record) return undefined;
    if (record.listeners.size === 0) return undefined;
    if (typeof window === "undefined") return undefined;
    if (record.cleanup || record.pending) return record.pending;

    const directory = getPluginDir(pluginId);

    const pending = watchDirectory(
      directory,
      (changes: ChangeRecord[]) => {
        if (!changes.length) return;

        record.listeners.forEach((listener) => {
          try {
            listener({ pluginId, changes });
          } catch (error) {
            console.error(`[browser-host] Plugin file listener failed for ${pluginId}`, error);
          }
        });

        const manifestTouched = changes.some((item) => item.path.join("/").endsWith("manifest.json"));
        if (!manifestTouched) return;

        const manifestRefresh = (async () => {
          const manifest = await readManifestRaw(pluginId);
          const previous = manifests.get(pluginId);
          const changed =
            (manifest && JSON.stringify(manifest) !== JSON.stringify(previous ?? undefined)) ||
            (!manifest && previous !== undefined);

          if (!changed) return;

          manifests.set(pluginId, manifest);
          const meta = deriveMetadata(pluginId, manifest);
          const stored = metadata.get(pluginId);
          const metaChanged =
            !stored || stored.name !== meta.name || stored.version !== meta.version || stored.id !== meta.id;
          metadata.set(pluginId, meta);
          if (metaChanged) pushPlugins();
          publishManifest(pluginId, manifest);
        })();

        manifestRefresh.catch((error: unknown) => {
          console.warn(`[browser-host] Failed to refresh manifest for ${pluginId}`, error);
        });
      },
      { recursive: true, emitInitial: false },
    )
      .then((cleanup) => {
        record.cleanup = cleanup;
      })
      .catch((error: unknown) => {
        console.warn(`[browser-host] Failed to watch files for ${pluginId}`, error);
      })
      .finally(() => {
        record.pending = undefined;
      });

    record.pending = pending;
    return pending;
  }

  /** Stop a plugin's file watcher and release associated resources. */
  async function disposePluginFileWatcher(pluginId: string) {
    const record = pluginFileWatchers.get(pluginId);
    if (!record) return;

    const pending = record.pending;
    record.pending = undefined;
    if (pending) {
      try {
        await pending;
      } catch {
        // Pending promise already handled.
      }
    }

    const cleanup = record.cleanup;
    record.cleanup = undefined;
    if (!cleanup) return;

    try {
      await cleanup();
    } catch (error) {
      console.warn(`[browser-host] Failed to dispose file watcher for ${pluginId}`, error);
    }
  }

  /** Instantiate the underlying host that knows how to load and manage plugin runtimes. */
  function createCoreHost(): PluginHost {
    const hostConfig: HostConfig = {
      pluginsRoot,
      watchPlugins,
      netFetch: options.host?.netFetch ?? ((url, init) => fetch(url, init)),
      ui: {
        onCommandsChanged(next) {
          commands = next;
          pushCommands();
          refreshInventory({ force: true }).catch((error: unknown) => {
            console.warn("[browser-host] Failed to refresh inventory after commands change", error);
          });
        },
        notify(level, message) {
          notify(level, message);
        },
        onSettingsSchema(pluginId, schema) {
          if (schema) {
            schemas.set(pluginId, schema);
          } else {
            schemas.delete(pluginId);
          }

          settingsSubscribers.forEach((listener) => listener(pluginId, schema));
        },
        onPluginEvent: options.onPluginEvent,
      },
      timeouts: options.host?.timeouts,
    };

    return createPluginHost(hostConfig);
  }

  /** Bring the plugin host online, loading manifests and wiring watchers. */
  async function start() {
    if (host) return;
    if (typeof window === "undefined") throw new Error("Browser plugin host can only run in the browser.");

    await ensureDirectory(pluginsRoot);

    host = createCoreHost();

    try {
      await host.loadAll();
    } catch (error) {
      console.error("[browser-host] Failed to load plugins", error);
    }

    await refreshInventory({ force: true });
    await ensureRootWatcher();

    pluginFileWatchers.forEach((watcher, id) => {
      if (watcher.listeners.size === 0) return;
      if (watcher.cleanup) return;
      const maybeStart = ensurePluginFileWatcher(id);
      if (maybeStart) {
        maybeStart.catch(() => {
          // Errors already logged inside ensurePluginFileWatcher.
        });
      }
    });

    ready = true;
  }

  /** Unload plugins and clean up watchers so the host can shut down cleanly. */
  async function stop() {
    if (!host) return;

    ready = false;

    try {
      await host.unloadAll();
    } catch (error) {
      console.warn("[browser-host] Failed to unload core host", error);
    }

    await disposeRootWatcher();
    for (const id of pluginFileWatchers.keys()) {
      await disposePluginFileWatcher(id);
    }

    host = null;

    const schemasToClear = Array.from(schemas.keys());
    const manifestIds = Array.from(manifests.keys());

    commands = [];
    schemas.clear();
    metadata.clear();
    manifests.clear();

    pushCommands();
    pluginSubscribers.forEach((listener) => listener([]));
    schemasToClear.forEach((pluginId) => settingsSubscribers.forEach((listener) => listener(pluginId, undefined)));
    manifestIds.forEach((pluginId) => publishManifest(pluginId, null));
  }

  return {
    start,
    stop,
    isReady: () => ready,
    listCommands: () => commands.map((command) => ({ ...command })),
    subscribeCommands(listener) {
      commandSubscribers.add(listener);
      listener(commands.map((command) => ({ ...command })));
      return () => {
        commandSubscribers.delete(listener);
      };
    },
    async runCommand(pluginId, commandId) {
      if (!host) await start();
      if (!host) throw new Error("Plugin host failed to start.");
      await host.invokeCommand(pluginId, commandId);
    },
    subscribeSettings(listener) {
      settingsSubscribers.add(listener);
      schemas.forEach((schema, pluginId) => listener(pluginId, schema));
      return () => {
        settingsSubscribers.delete(listener);
      };
    },
    async readSettings(pluginId) {
      if (!host) await start();
      if (!host) throw new Error("Plugin host failed to start.");
      return host.readSettings(pluginId);
    },
    async writeSettings(pluginId, value) {
      if (!host) await start();
      if (!host) throw new Error("Plugin host failed to start.");
      await host.writeSettings(pluginId, value);
    },
    listPlugins: () =>
      Array.from(metadata.values())
        .map((entry) => ({ ...entry }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    subscribePlugins(listener) {
      pluginSubscribers.add(listener);
      listener(
        Array.from(metadata.values())
          .map((entry) => ({ ...entry }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      );
      return () => {
        pluginSubscribers.delete(listener);
      };
    },
    getPluginDisplayName(pluginId) {
      return metadata.get(pluginId)?.name ?? pluginId;
    },
    async readManifest(pluginId) {
      if (manifests.has(pluginId)) return manifests.get(pluginId) ?? null;

      const manifest = await readManifestRaw(pluginId);
      manifests.set(pluginId, manifest);

      const meta = deriveMetadata(pluginId, manifest);
      const stored = metadata.get(pluginId);
      const metaChanged =
        !stored || stored.name !== meta.name || stored.version !== meta.version || stored.id !== meta.id;
      if (metaChanged) {
        metadata.set(pluginId, meta);
        pushPlugins();
      }

      return manifest;
    },
    subscribeManifest(pluginId, listener) {
      let set = manifestSubscribersPerPlugin.get(pluginId);
      if (!set) {
        set = new Set();
        manifestSubscribersPerPlugin.set(pluginId, set);
      }
      set.add(listener);
      listener(manifests.get(pluginId) ?? null);
      return () => {
        const current = manifestSubscribersPerPlugin.get(pluginId);
        if (!current) return;
        current.delete(listener);
        if (current.size === 0) manifestSubscribersPerPlugin.delete(pluginId);
      };
    },
    subscribeManifests(listener) {
      manifestSubscribers.add(listener);
      manifests.forEach((manifest, pluginId) => listener({ pluginId, manifest }));
      return () => {
        manifestSubscribers.delete(listener);
      };
    },
    subscribePluginFiles(pluginId, listener) {
      let record = pluginFileWatchers.get(pluginId);

      if (!record) {
        record = { listeners: new Set() };
        pluginFileWatchers.set(pluginId, record);
      }

      record.listeners.add(listener);
      ensurePluginFileWatcher(pluginId);

      return () => {
        const current = pluginFileWatchers.get(pluginId);

        if (!current) return;

        current.listeners.delete(listener);

        if (current.listeners.size === 0) {
          (async () => {
            try {
              await disposePluginFileWatcher(pluginId);
            } finally {
              pluginFileWatchers.delete(pluginId);
            }
          })();
        }
      };
    },
    getRoot: () => pluginsRoot,
  } satisfies BrowserPluginHost;
}
