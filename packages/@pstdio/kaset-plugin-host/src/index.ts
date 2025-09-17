import { ls, readFile, watchDirectory, type ChangeRecord, type DirectoryWatcherCleanup } from "@pstdio/opfs-utils";
import micromatch from "micromatch";
import { satisfies } from "semver";
import { HOST_API_VERSION } from "./constants";
import type { ActivationEvent, Manifest, JSONSchema } from "./model/manifest";
import type { Plugin, PluginCommand, PluginModule } from "./model/plugin";
import { createPluginRuntime, type PluginRuntime, type UIBridge } from "./host/context";
import { CommandRegistry } from "./host/command-registry";
import { createPermissionChecker, type PermissionChecker } from "./host/permissions";
import { SettingsManager } from "./host/settings";
import type { RegisteredCommand, UIAdapter } from "./host/ui-adapter";
import { createConsoleUIAdapter } from "./host/ui-adapter";
import type { AppEvents, Disposable } from "./host/types";
import { withBudget } from "./utils/async";
import { disposeAll } from "./utils/dispose";
import { joinPath, trimLeadingSlash } from "./utils/path";

const DEFAULT_TIMEOUTS = {
  activate: 10_000,
  deactivate: 5_000,
  command: 10_000,
};

interface TimeoutConfig {
  activate: number;
  deactivate: number;
  command: number;
}

export interface HostConfig {
  pluginsRoot?: string;
  watchPlugins?: boolean;
  ui?: UIAdapter;
  netFetch?: (url: string, init?: RequestInit) => Promise<Response>;
  appEvents?: AppEvents;
  fsWatcher?: boolean;
  timeouts?: Partial<TimeoutConfig>;
}

export interface PluginHost {
  loadAll(): Promise<void>;
  unloadAll(): Promise<void>;
  reloadPlugin(id: string): Promise<void>;
  invokeCommand(pluginId: string, commandId: string): Promise<void>;
  listCommands(): RegisteredCommand[];
  emit(name: string, payload?: unknown): void;
  getSettingsSchema(pluginId: string): JSONSchema | undefined;
  readSettings<T = unknown>(pluginId: string): Promise<T>;
  writeSettings<T = unknown>(pluginId: string, value: T): Promise<void>;
}

interface ResolvedHostConfig {
  pluginsRoot: string;
  pluginsRootRelative: string;
  watchPlugins: boolean;
  ui: UIAdapter;
  netFetch?: (url: string, init?: RequestInit) => Promise<Response>;
  appEvents?: AppEvents;
  fsWatcher: boolean;
  timeouts: TimeoutConfig;
}

interface LoadedPlugin {
  id: string;
  directory: string;
  manifest: Manifest;
  module: PluginModule;
  plugin: Plugin;
  runtime: PluginRuntime;
  abortController: AbortController;
  blobUrl: string;
  commandIds: Set<string>;
  activationDisposables: Disposable[];
  eventNames: Set<string>;
  permissionChecker: PermissionChecker;
}

const toRelativePath = (path: string) => trimLeadingSlash(path || "");

const createDisposable = (fn: () => void): Disposable => ({
  dispose: () => fn(),
});

class KasetPluginHost implements PluginHost {
  private readonly config: ResolvedHostConfig;
  private readonly settings = new SettingsManager();
  private readonly ui: UIAdapter;
  private readonly commandRegistry: CommandRegistry;
  private readonly plugins = new Map<string, LoadedPlugin>();
  private readonly directoryIndex = new Map<string, string>();
  private pluginWatcherCleanup?: DirectoryWatcherCleanup;
  private readonly reloadQueues = new Map<string, Promise<void>>();
  private readonly appEventSubscriptions = new Map<string, { count: number; unsubscribe?: () => void }>();
  private readonly eventListeners = new Map<string, Set<string>>();

  constructor(cfg: HostConfig = {}) {
    const pluginsRoot = cfg.pluginsRoot ?? "/plugins";
    const pluginsRootRelative = toRelativePath(pluginsRoot);
    const timeouts: TimeoutConfig = {
      activate: cfg.timeouts?.activate ?? DEFAULT_TIMEOUTS.activate,
      deactivate: cfg.timeouts?.deactivate ?? DEFAULT_TIMEOUTS.deactivate,
      command: cfg.timeouts?.command ?? DEFAULT_TIMEOUTS.command,
    };
    this.config = {
      pluginsRoot,
      pluginsRootRelative,
      watchPlugins: cfg.watchPlugins ?? true,
      ui: cfg.ui ?? createConsoleUIAdapter(),
      netFetch: cfg.netFetch,
      appEvents: cfg.appEvents,
      fsWatcher: cfg.fsWatcher ?? true,
      timeouts,
    };
    this.ui = this.config.ui;
    this.commandRegistry = new CommandRegistry(this.ui);
  }

  async loadAll(): Promise<void> {
    await this.loadFromDisk();
    if (this.config.watchPlugins) {
      await this.startPluginWatcher();
    }
  }

  async unloadAll(): Promise<void> {
    const plugins = [...this.plugins.keys()];
    for (const id of plugins) {
      await this.unloadPlugin(id);
    }
    if (this.pluginWatcherCleanup) {
      this.pluginWatcherCleanup();
      this.pluginWatcherCleanup = undefined;
    }
  }

  async reloadPlugin(id: string): Promise<void> {
    await this.enqueueReload(id, async () => {
      const existing = this.plugins.get(id);
      const directory = existing?.directory ?? joinPath(this.config.pluginsRootRelative, id);
      if (existing) {
        await this.unloadPlugin(id);
      }
      await this.loadPluginFromDirectory(directory).catch((error) => {
        console.error("[kaset-plugin-host] Failed to reload plugin", id, error);
      });
    });
  }

  async invokeCommand(pluginId: string, commandId: string): Promise<void> {
    const command = this.commandRegistry.find(pluginId, commandId);
    if (!command) {
      throw new Error(`Command not found: ${pluginId}:${commandId}`);
    }
    await command.run();
  }

  listCommands(): RegisteredCommand[] {
    return this.commandRegistry.list();
  }

  emit(name: string, payload?: unknown): void {
    const targets = this.eventListeners.get(name);
    if (!targets?.size) return;
    for (const pluginId of targets) {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) continue;
      try {
        plugin.runtime.emit(name, payload);
      } catch (error) {
        plugin.runtime.logger.error("Failed to emit event", { name, error });
      }
    }
  }

  getSettingsSchema(pluginId: string): JSONSchema | undefined {
    return this.settings.getSchema(pluginId);
  }

  async readSettings<T = unknown>(pluginId: string): Promise<T> {
    return this.settings.read<T>(pluginId);
  }

  async writeSettings<T = unknown>(pluginId: string, value: T): Promise<void> {
    await this.settings.write(pluginId, value);
  }

  private async loadFromDisk(): Promise<void> {
    let entries: Awaited<ReturnType<typeof ls>> = [];
    try {
      entries = await ls(this.config.pluginsRootRelative, { maxDepth: 1, kinds: ["directory"] });
    } catch (error) {
      console.warn("[kaset-plugin-host] Unable to list plugins", error);
      return;
    }
    for (const entry of entries) {
      const dir = joinPath(this.config.pluginsRootRelative, entry.path);
      await this.loadPluginFromDirectory(dir).catch((error) => {
        console.error("[kaset-plugin-host] Failed to load plugin", entry.path, error);
      });
    }
  }

  private async startPluginWatcher(): Promise<void> {
    if (this.pluginWatcherCleanup) return;
    try {
      this.pluginWatcherCleanup = await watchDirectory(
        this.config.pluginsRootRelative,
        (changes) => this.handlePluginDirectoryChanges(changes),
        { recursive: true, emitInitial: false },
      );
    } catch (error) {
      console.warn("[kaset-plugin-host] Failed to watch plugins directory", error);
    }
  }

  private async handlePluginDirectoryChanges(changes: ChangeRecord[]): Promise<void> {
    const touched = new Set<string>();
    for (const change of changes) {
      if (!change.path?.length) continue;
      const [dir] = change.path;
      if (dir) touched.add(dir);
    }
    for (const dir of touched) {
      const relative = joinPath(this.config.pluginsRootRelative, dir);
      await this.enqueueReload(relative, async () => {
        const existingId = this.directoryIndex.get(relative);
        if (existingId) {
          await this.unloadPlugin(existingId);
        }
        await this.loadPluginFromDirectory(relative).catch((error) => {
          console.error("[kaset-plugin-host] Failed to reload directory", relative, error);
        });
      });
    }
  }

  private async enqueueReload(key: string, task: () => Promise<void>): Promise<void> {
    const previous = this.reloadQueues.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(task)
      .catch((error) => {
        console.error("[kaset-plugin-host] Reload task failed", error);
      })
      .finally(() => {
        if (this.reloadQueues.get(key) === next) {
          this.reloadQueues.delete(key);
        }
      });
    this.reloadQueues.set(key, next);
    await next;
  }

  private async loadPluginFromDirectory(directory: string): Promise<void> {
    const manifestPath = joinPath(directory, "manifest.json");
    let manifestRaw: string;
    try {
      manifestRaw = await readFile(toRelativePath(manifestPath));
    } catch (error) {
      throw new Error(`Failed to read manifest at ${manifestPath}: ${error instanceof Error ? error.message : error}`);
    }
    let manifest: Manifest;
    try {
      manifest = JSON.parse(manifestRaw) as Manifest;
    } catch (error) {
      throw new Error(`Invalid manifest JSON at ${manifestPath}: ${error instanceof Error ? error.message : error}`);
    }
    if (!manifest.id) {
      throw new Error(`Manifest at ${manifestPath} is missing an id`);
    }
    if (!manifest.entry) {
      throw new Error(`Manifest for ${manifest.id} is missing an entry field`);
    }
    if (!satisfies(HOST_API_VERSION, manifest.api)) {
      throw new Error(`Plugin ${manifest.id} requires host api ${manifest.api}`);
    }

    const entryPath = joinPath(directory, manifest.entry);
    let code: string;
    try {
      code = await readFile(toRelativePath(entryPath));
    } catch (error) {
      throw new Error(
        `Failed to read entry module for ${manifest.id}: ${error instanceof Error ? error.message : error}`,
      );
    }

    const blob = new Blob([code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    let mod: PluginModule;
    try {
      mod = (await import(/* @vite-ignore */ url)) as PluginModule;
    } catch (error) {
      URL.revokeObjectURL(url);
      throw new Error(`Failed to import plugin ${manifest.id}: ${error instanceof Error ? error.message : error}`);
    }

    const pluginExport = (mod.default ?? mod) as Plugin;
    if (!pluginExport || typeof pluginExport.activate !== "function") {
      URL.revokeObjectURL(url);
      throw new Error(`Plugin ${manifest.id} must export an activate function`);
    }

    const abortController = new AbortController();
    const permissionChecker = createPermissionChecker(manifest);

    this.settings.registerSchema(manifest.id, manifest.settingsSchema);
    this.ui.onSettingsSchema?.(manifest.id, manifest.settingsSchema);

    const commandIds = new Set<string>();
    const activationDisposables: Disposable[] = [];
    const eventNames = new Set<string>();
    const runtimeRef: { current?: PluginRuntime } = {};

    const uiBridge: UIBridge = {
      notify: (level, message) => {
        this.ui.notify?.(level, message);
      },
      invoke: (pluginId, commandId) => this.invokeCommand(pluginId, commandId),
      registerCommand: (pluginId, definition, handler) => {
        const runtime = runtimeRef.current;
        if (!runtime) throw new Error("Plugin runtime is not ready");
        const wrapped = async () => {
          try {
            await withBudget(
              () => Promise.resolve(handler()),
              this.config.timeouts.command,
              runtime.context.cancelToken,
            );
          } catch (error) {
            runtime.logger.error("Command handler failed", { command: definition.id, error });
            throw error;
          }
        };
        const command = this.commandRegistry.register(pluginId, definition, wrapped);
        commandIds.add(command.id);
        return {
          dispose: () => {
            if (commandIds.has(command.id)) {
              commandIds.delete(command.id);
              this.commandRegistry.unregister(pluginId, command.id);
            }
          },
        };
      },
      unregisterCommand: (pluginId, commandId) => {
        if (commandIds.has(commandId)) {
          commandIds.delete(commandId);
          this.commandRegistry.unregister(pluginId, commandId);
        }
      },
    };

    const runtime = createPluginRuntime(
      manifest,
      permissionChecker,
      this.settings,
      uiBridge,
      abortController.signal,
      this.config.netFetch,
    );
    runtimeRef.current = runtime;

    try {
      await withBudget(
        () => pluginExport.activate(runtime.context),
        this.config.timeouts.activate,
        abortController.signal,
      );
    } catch (error) {
      abortController.abort();
      runtime.scheduler.dispose();
      runtime.disposeEvents();
      this.settings.registerSchema(manifest.id, undefined);
      this.ui.onSettingsSchema?.(manifest.id, undefined);
      URL.revokeObjectURL(url);
      throw error;
    }

    const commands = manifest.ui?.commands ?? [];
    const commandImpls = (mod.commands ?? {}) as Record<string, PluginCommand>;
    for (const definition of commands) {
      const handler = commandImpls[definition.id];
      if (typeof handler !== "function") {
        runtime.logger.warn("Command declared but not implemented", { command: definition.id });
        continue;
      }
      const wrapped = async () => {
        try {
          await withBudget(() => handler(runtime.context), this.config.timeouts.command, runtime.context.cancelToken);
        } catch (error) {
          runtime.logger.error("Command failed", { command: definition.id, error });
          throw error;
        }
      };
      this.commandRegistry.register(manifest.id, definition, wrapped);
      commandIds.add(definition.id);
    }

    const loaded: LoadedPlugin = {
      id: manifest.id,
      directory,
      manifest,
      module: mod,
      plugin: pluginExport,
      runtime,
      abortController,
      blobUrl: url,
      commandIds,
      activationDisposables,
      eventNames,
      permissionChecker,
    };

    await this.setupActivationHandlers(loaded);

    this.plugins.set(manifest.id, loaded);
    this.directoryIndex.set(directory, manifest.id);
  }

  private async setupActivationHandlers(plugin: LoadedPlugin): Promise<void> {
    const activations = plugin.manifest.activation ?? [];
    const fsChanges = activations.filter((activation) => activation.type === "onFSChange") as Array<
      Extract<ActivationEvent, { type: "onFSChange" }>
    >;
    if (fsChanges.length) {
      if (!this.config.fsWatcher) {
        plugin.runtime.logger.warn("FS change activations requested but fsWatcher is disabled");
      } else {
        const cleanup = await watchDirectory(
          "",
          (changes) => {
            for (const change of changes) {
              const path = `/${change.path.join("/")}`;
              if (!plugin.permissionChecker.canRead(path)) continue;
              for (const activation of fsChanges) {
                if (micromatch.isMatch(path, activation.glob, { dot: true })) {
                  plugin.runtime.emit("fs:change", { glob: activation.glob, change, path });
                }
              }
            }
          },
          { recursive: true, emitInitial: false },
        );
        plugin.activationDisposables.push(createDisposable(cleanup));
      }
    }

    const cronActivations = activations.filter((activation) => activation.type === "onCron") as Array<
      Extract<ActivationEvent, { type: "onCron" }>
    >;
    for (const activation of cronActivations) {
      const disposable = plugin.runtime.scheduler.registerCron(activation.expr, () => {
        plugin.runtime.emit("cron", { expr: activation.expr });
      });
      plugin.activationDisposables.push(disposable);
    }

    const eventActivations = activations.filter((activation) => activation.type === "onEvent") as Array<
      Extract<ActivationEvent, { type: "onEvent" }>
    >;
    for (const activation of eventActivations) {
      plugin.eventNames.add(activation.name);
      if (!this.eventListeners.has(activation.name)) {
        this.eventListeners.set(activation.name, new Set());
      }
      this.eventListeners.get(activation.name)!.add(plugin.id);
      this.subscribeAppEvent(activation.name);
    }
  }

  private subscribeAppEvent(name: string): void {
    const entry = this.appEventSubscriptions.get(name);
    if (entry) {
      entry.count += 1;
      return;
    }
    let unsubscribe: (() => void) | undefined;
    if (this.config.appEvents) {
      const result = this.config.appEvents.on(name, (payload) => this.emit(name, payload));
      if (typeof result === "function") {
        unsubscribe = result;
      }
    }
    this.appEventSubscriptions.set(name, { count: 1, unsubscribe });
  }

  private unsubscribeAppEvent(name: string): void {
    const entry = this.appEventSubscriptions.get(name);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count <= 0) {
      entry.unsubscribe?.();
      this.appEventSubscriptions.delete(name);
    }
  }

  private async unloadPlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) return;

    this.plugins.delete(id);
    this.directoryIndex.delete(plugin.directory);
    this.commandRegistry.removeAll(id);
    for (const eventName of plugin.eventNames) {
      const listeners = this.eventListeners.get(eventName);
      listeners?.delete(id);
      if (!listeners?.size) {
        this.eventListeners.delete(eventName);
      }
      this.unsubscribeAppEvent(eventName);
    }

    this.settings.registerSchema(id, undefined);
    this.ui.onSettingsSchema?.(id, undefined);

    plugin.abortController.abort();

    try {
      if (typeof plugin.plugin.deactivate === "function") {
        await withBudget(() => plugin.plugin.deactivate?.(), this.config.timeouts.deactivate);
      }
    } catch (error) {
      plugin.runtime.logger.error("Plugin deactivate failed", error);
    }

    await disposeAll(plugin.activationDisposables);
    plugin.activationDisposables.length = 0;

    const contextDisposables = [...plugin.runtime.context.disposables];
    plugin.runtime.context.disposables.length = 0;
    await disposeAll(contextDisposables);

    plugin.runtime.scheduler.dispose();
    plugin.runtime.disposeEvents();

    URL.revokeObjectURL(plugin.blobUrl);
  }
}

export const createPluginHost = (config?: HostConfig): PluginHost => new KasetPluginHost(config);

export type { RegisteredCommand } from "./host/ui-adapter";
export type { ActivationEvent, CommandDefinition, Manifest, Permissions, JSONSchema } from "./model/manifest";
export type { Disposable, Events, FSApi, Logger, PluginContext, Scheduler, SettingsApi, UIHostApi } from "./host/types";
export { SettingsValidationError } from "./host/types";
export { HOST_API_VERSION } from "./constants";
