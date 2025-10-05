import { deleteFile, ls, moveFile, readFile, watchDirectory, writeFile, type ChangeRecord } from "@pstdio/opfs-utils";
import * as picomatch from "picomatch/posix";
import { Manifest, type JSONSchema } from "../model/manifest";
import type { Plugin, PluginModule } from "../model/plugin";
import { type EventsApi, type Logger, type PluginContext, type RegisteredCommand, type UIAdapter } from "./context";
import type { HostConfig, PluginHost } from "./types";

const HOST_API_VERSION = "1.0.0";

interface LoadedPlugin {
  id: string;
  manifest: Manifest;
  module: PluginModule;
  plugin: Plugin;
  context: PluginContext;
  abort: AbortController;
  objectUrl: string;
  commands: RegisteredCommand[];
  cleanups: Array<() => void | Promise<void>>;
  settingsSchema?: JSONSchema;
  emit: (event: string, payload?: unknown) => void;
}

const DEFAULT_TIMEOUTS = {
  command: 10_000,
  activate: 10_000,
  deactivate: 5_000,
};

type Activation = NonNullable<Manifest["activation"]>[number];

class EventHub implements EventsApi {
  private readonly listeners = new Map<string, Set<(payload?: unknown) => void | Promise<void>>>();
  constructor(private readonly onListenerError: (error: unknown) => void) {}

  on(event: string, listener: (payload?: unknown) => void | Promise<void>) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return {
      dispose: () => this.off(event, listener),
    };
  }

  off(event: string, listener: (payload?: unknown) => void | Promise<void>) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event: string, payload?: unknown) {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    for (const listener of [...set]) {
      try {
        const result = listener(payload);
        if (result && typeof (result as Promise<unknown>).then === "function") {
          (result as Promise<unknown>).catch(this.onListenerError);
        }
      } catch (error) {
        this.onListenerError(error);
      }
    }
  }

  clear() {
    this.listeners.clear();
  }
}

function resolvePluginsRoot(root?: string) {
  if (!root) return "plugins";
  return root.replace(/^\/+/, "");
}

function decodeJson<T>(text: string, path: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${path}: ${(error as Error).message}`);
  }
}

function isApiCompatible(range: string, hostVersion: string) {
  const major = Number.parseInt(hostVersion.split(".")[0] ?? "0", 10);
  const match = range.trim().match(/^\^?(\d+)/);
  if (!match) return false;
  const wanted = Number.parseInt(match[1], 10);
  return Number.isFinite(wanted) && wanted === major;
}

function ensureAbsolute(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function joinPath(...parts: string[]) {
  return parts
    .filter(Boolean)
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function createLogger(pluginId: string): Logger {
  const prefix = `[kaset-plugin:${pluginId}]`;
  return {
    info: (...args) => console.info(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}

function createAbortError(message: string) {
  try {
    return new DOMException(message, "AbortError");
  } catch {
    const error = new Error(message);
    (error as Error & { name: string }).name = "AbortError";
    return error;
  }
}

async function runWithTimeout<T>(fn: () => Promise<T> | T, timeoutMs: number, abortSignal?: AbortSignal): Promise<T> {
  if (abortSignal?.aborted) {
    throw createAbortError("Operation aborted");
  }

  const runPromise = Promise.resolve().then(fn);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return runPromise;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;

  return await Promise.race([
    runPromise.finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
      if (abortSignal && abortListener) {
        abortSignal.removeEventListener("abort", abortListener);
      }
    }),
    new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Operation timed out"));
      }, timeoutMs);

      if (abortSignal) {
        abortListener = () => {
          reject(createAbortError("Operation aborted"));
        };
        abortSignal.addEventListener("abort", abortListener, { once: true });
      }
    }),
  ]);
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path);
    return decodeJson<T>(raw, path);
  } catch (error) {
    if ((error as Error).name === "NotFoundError") {
      return null;
    }
    throw error;
  }
}

async function writeJsonFile(path: string, value: unknown) {
  const serialized = JSON.stringify(value, null, 2);
  await writeFile(path, serialized);
}

export function createPluginHost(config: HostConfig = {}): PluginHost {
  const pluginsRoot = resolvePluginsRoot(config.pluginsRoot);
  const ui: UIAdapter = config.ui ?? {
    onCommandsChanged() {
      /* noop */
    },
  };
  const timeouts = { ...DEFAULT_TIMEOUTS, ...config.timeouts };
  const registry = new Map<string, LoadedPlugin>();
  const commandList: RegisteredCommand[] = [];
  let pluginsWatcherCleanup: (() => void | Promise<void>) | null = null;

  const notify = (level: "info" | "warn" | "error", message: string) => {
    ui.notify?.(level, message);
  };

  const listPluginDirs = async () => {
    try {
      const entries = await ls(pluginsRoot, { maxDepth: 1, kinds: ["directory"] });
      return entries.map((entry) => entry.name);
    } catch (error) {
      if ((error as Error).name === "NotFoundError") {
        return [];
      }
      throw error;
    }
  };

  const ensureWatcher = async () => {
    if (config.watchPlugins === false || pluginsWatcherCleanup) return;
    try {
      pluginsWatcherCleanup = await watchDirectory(
        pluginsRoot,
        async (changes: ChangeRecord[]) => {
          const touched = new Set<string>();
          for (const change of changes) {
            const [pluginId] = change.path;
            if (pluginId) touched.add(pluginId);
          }
          for (const pluginId of touched) {
            await reloadPlugin(pluginId).catch((error) => {
              console.error(`[kaset-plugin-host] Failed to reload plugin ${pluginId}`, error);
            });
          }
        },
        {
          recursive: true,
          emitInitial: false,
        },
      );
    } catch (error) {
      console.warn("[kaset-plugin-host] Failed to start plugin watcher", error);
    }
  };

  const addCommands = (commands: RegisteredCommand[]) => {
    if (!commands.length) return;
    commandList.push(...commands);
    ui.onCommandsChanged([...commandList]);
  };

  const removeCommands = (commands: RegisteredCommand[]) => {
    if (!commands.length) return;
    for (const cmd of commands) {
      const idx = commandList.indexOf(cmd);
      if (idx >= 0) {
        commandList.splice(idx, 1);
      }
    }
    ui.onCommandsChanged([...commandList]);
  };

  const disposeAll = async (items: Array<(() => void | Promise<void>) | { dispose(): void | Promise<void> }>) => {
    for (const item of items) {
      try {
        if (!item) continue;
        if (typeof item === "function") {
          await item();
        } else if (typeof item.dispose === "function") {
          await item.dispose();
        }
      } catch (error) {
        console.warn("[kaset-plugin-host] Failed to dispose resource", error);
      }
    }
  };

  const createContext = (
    manifest: Manifest,
    abort: AbortController,
  ): { context: PluginContext; eventHub: EventHub } => {
    const logger = createLogger(manifest.id);

    const fsApi = {
      ls,
      readFile,
      writeFile,
      deleteFile,
      moveFile,
    };

    const settingsApi = {
      async read<T = unknown>() {
        const value = await readJsonFile<T>(`state/public/plugins/${manifest.id}.json`);
        return (value ?? {}) as T;
      },
      async write<T = unknown>(value: T) {
        await writeJsonFile(`state/public/plugins/${manifest.id}.json`, value);
      },
    };

    const eventsHub = new EventHub((error) => {
      logger.error("Event listener error", error);
    });

    const context: PluginContext = {
      id: manifest.id,
      manifest,
      log: logger,
      fs: fsApi,
      settings: settingsApi,
      ui: {
        notify,
      },
      commands: {
        invoke: async (commandId: string, params?: unknown) => {
          await invokeCommand(manifest.id, commandId, params);
        },
      },
      events: eventsHub,
      cancelToken: abort.signal,
      disposables: [],
    };

    const netFetch = config.netFetch;
    if (netFetch) {
      context.net = {
        fetch: (url: string, init?: RequestInit) => netFetch(url, init),
      };
    }

    return { context, eventHub: eventsHub };
  };

  const activateFsChanges = async (plugin: LoadedPlugin, activation: Extract<Activation, { type: "onFSChange" }>) => {
    const glob = activation.glob;
    const matcher = picomatch(glob, { dot: true, windows: false, posixSlashes: true });
    const cleanup = await watchDirectory(
      "",
      (changes: ChangeRecord[]) => {
        for (const change of changes) {
          const asPath = ensureAbsolute(change.path.join("/"));
          if (matcher(asPath)) {
            plugin.emit("fs:change", { glob, change });
          }
        }
      },
      {
        recursive: true,
        emitInitial: false,
        signal: plugin.abort.signal,
      },
    );
    plugin.cleanups.push(cleanup);
  };

  const applyActivation = async (plugin: LoadedPlugin) => {
    const activation = (plugin.manifest.activation ?? []) as Activation[];
    for (const event of activation) {
      if (event.type === "onFSChange") {
        await activateFsChanges(plugin, event);
      } else if (event.type === "onCron") {
        console.warn(
          `[kaset-plugin-host] Plugin ${plugin.id} requested cron activation (${event.expr}) but cron is not implemented yet.`,
        );
      }
    }
  };

  const loadPlugin = async (pluginId: string): Promise<void> => {
    if (registry.has(pluginId)) {
      await reloadPlugin(pluginId);
      return;
    }

    const pluginDir = joinPath(pluginsRoot, pluginId);
    const manifestPath = joinPath(pluginDir, "manifest.json");
    const manifestRaw = await readFile(manifestPath);
    const manifest = decodeJson<Manifest>(manifestRaw, manifestPath);

    if (manifest.id && manifest.id !== pluginId) {
      console.warn(
        `[kaset-plugin-host] Plugin directory "${pluginId}" declares mismatched id "${manifest.id}" in manifest`,
      );
    }

    if (!isApiCompatible(manifest.api, HOST_API_VERSION)) {
      throw new Error(
        `Plugin ${manifest.id} targets API ${manifest.api}, which is incompatible with host ${HOST_API_VERSION}`,
      );
    }

    const entryPath = joinPath(pluginDir, manifest.entry);
    const entryCode = await readFile(entryPath);
    const blob = new Blob([entryCode], { type: "text/javascript" });
    const objectUrl = URL.createObjectURL(blob);

    let module: PluginModule | null = null;
    try {
      module = (await import(/* @vite-ignore */ objectUrl)) as PluginModule;
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }

    const plugin: Plugin = module?.default ?? (module as unknown as Plugin);
    if (!plugin || typeof plugin.activate !== "function") {
      URL.revokeObjectURL(objectUrl);
      throw new Error(`Plugin ${pluginId} is missing a default export with an activate function.`);
    }

    const abort = new AbortController();
    const { context, eventHub } = createContext(manifest, abort);

    const loaded: LoadedPlugin = {
      id: pluginId,
      manifest,
      module,
      plugin,
      context,
      abort,
      objectUrl,
      commands: [],
      cleanups: [],
      settingsSchema: manifest.settingsSchema,
      emit: (event: string, payload?: unknown) => eventHub.emit(event, payload),
    };

    try {
      await runWithTimeout(() => plugin.activate(context), timeouts.activate, abort.signal);
    } catch (error) {
      abort.abort();
      URL.revokeObjectURL(objectUrl);
      throw error;
    }

    const declaredCommands = manifest.commands ?? [];
    const commandHandlers = module?.commands ?? {};
    const registeredCommands: RegisteredCommand[] = [];

    for (const definition of declaredCommands) {
      const handler = commandHandlers?.[definition.id];

      if (typeof handler !== "function") {
        console.warn(
          `[kaset-plugin-host] Command ${definition.id} declared by plugin ${pluginId} has no implementation`,
        );
        continue;
      }

      const registered: RegisteredCommand = {
        pluginId,
        id: definition.id,
        title: definition.title,
        description: definition.description,
        category: definition.category,
        when: definition.when,
        parameters: definition.parameters,
        run: async (params?: unknown) => {
          await runWithTimeout(() => handler(context, params), timeouts.command, abort.signal);
        },
      };

      registeredCommands.push(registered);
    }

    loaded.commands = registeredCommands;
    addCommands(registeredCommands);

    if (loaded.settingsSchema) {
      ui.onSettingsSchema?.(pluginId, loaded.settingsSchema);
    }

    await applyActivation(loaded);
    registry.set(pluginId, loaded);
  };

  const unloadPlugin = async (pluginId: string) => {
    const loaded = registry.get(pluginId);
    if (!loaded) return;

    registry.delete(pluginId);
    loaded.abort.abort();
    removeCommands(loaded.commands);
    await disposeAll(loaded.cleanups);
    await disposeAll(loaded.context.disposables);

    try {
      if (loaded.plugin.deactivate) {
        await runWithTimeout(() => loaded.plugin.deactivate?.(), timeouts.deactivate);
      }
    } catch (error) {
      console.warn(`[kaset-plugin-host] Error while deactivating plugin ${pluginId}`, error);
    }

    URL.revokeObjectURL(loaded.objectUrl);
    loaded.context.events.emit("deactivated");
    if (loaded.settingsSchema) {
      ui.onSettingsSchema?.(pluginId, undefined);
    }
  };

  const reloadPlugin = async (pluginId: string) => {
    await unloadPlugin(pluginId);
    try {
      await loadPlugin(pluginId);
    } catch (error) {
      console.error(`[kaset-plugin-host] Failed to reload plugin ${pluginId}`, error);
    }
  };

  const loadAll = async () => {
    const dirs = await listPluginDirs();
    for (const dir of dirs) {
      try {
        await loadPlugin(dir);
      } catch (error) {
        console.error(`[kaset-plugin-host] Failed to load plugin ${dir}`, error);
      }
    }
    await ensureWatcher();
  };

  const unloadAll = async () => {
    if (pluginsWatcherCleanup) {
      await pluginsWatcherCleanup();
      pluginsWatcherCleanup = null;
    }
    const ids = [...registry.keys()];
    for (const id of ids) {
      await unloadPlugin(id);
    }
  };

  const invokeCommand = async (pluginId: string, commandId: string, params?: unknown) => {
    const command = commandList.find((cmd) => cmd.pluginId === pluginId && cmd.id === commandId);
    if (!command) {
      throw new Error(`Command not found: ${pluginId}:${commandId}`);
    }
    await command.run(params);
  };

  const emit = (name: string, payload?: unknown) => {
    for (const loaded of registry.values()) {
      loaded.emit(name, payload);
    }
  };

  const getSettingsSchema = (pluginId: string) => registry.get(pluginId)?.settingsSchema;

  const readSettings = async <T = unknown>(pluginId: string): Promise<T> => {
    const value = await readJsonFile<T>(`state/public/plugins/${pluginId}.json`);
    return (value ?? {}) as T;
  };

  const writeSettings = async <T = unknown>(pluginId: string, value: T) => {
    await writeJsonFile(`state/public/plugins/${pluginId}.json`, value);
  };

  return {
    loadAll,
    unloadAll,
    reloadPlugin,
    invokeCommand,
    listCommands: () => [...commandList],
    emit,
    getSettingsSchema,
    readSettings,
    writeSettings,
  };
}

export { HOST_API_VERSION };
