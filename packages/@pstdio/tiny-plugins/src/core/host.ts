import { ls, type ChangeRecord } from "@pstdio/opfs-utils";
import { createPluginFs, createPluginDataFs } from "./fs";
import { Emitter } from "./events";
import { readManifestStrict } from "./manifest";
import { listFiles, watchPluginDir, watchPluginsRoot } from "./watchers";
import { CommandRegistry } from "./commands";
import { mergeDependencies } from "./dependencies";
import { createSettings } from "./settings";
import type {
  HostOptions,
  Manifest,
  PluginMetadata,
  PluginModule,
  PluginContext,
  PluginChangePayload,
  StatusUpdate,
  HostApi,
} from "./types";

type Events = {
  pluginChange: { pluginId: string; payload: PluginChangePayload };
  dependencyChange: { deps: Record<string, string> };
  settingsChange: { pluginId: string; settings: unknown };
  status: StatusUpdate;
  error: Error;
  pluginsChange: { plugins: PluginMetadata[] };
};

const DEFAULT_HOST_API_VERSION = "1.0.0";

function normalizeRoot(value?: string) {
  if (!value) return "plugins";
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed || "plugins";
}

export function createHost(options: HostOptions) {
  const root = normalizeRoot(options.root);
  const dataRoot = normalizeRoot(options.dataRoot ?? "plugin_data");
  const watch = options.watch ?? true;
  const notify = options.notify;
  const hostApiVersion = options.hostApiVersion ?? DEFAULT_HOST_API_VERSION;

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

    return {
      // FS
      "fs.readFile": (path) => pfs.readFile(path),
      "fs.writeFile": (path, contents) => pfs.writeFile(path, contents),
      "fs.deleteFile": (path) => pfs.deleteFile(path),
      "fs.moveFile": (from, to) => pfs.moveFile(from, to),
      "fs.exists": (path) => pfs.exists(path),
      "fs.mkdirp": (path) => pfs.mkdirp(path),

      // Notifications
      "log.statusUpdate": async (status: { status: string; detail?: unknown }) => {
        emitter.emit("status", { status: status.status, detail: status.detail, pluginId });
      },
      "log.info": async (message: string, detail?: unknown) => {
        forwardLog("info", message, detail);
      },
      "log.warn": async (message: string, detail?: unknown) => {
        forwardLog("warn", message, detail);
      },
      "log.error": async (message: string, detail?: unknown) => {
        forwardLog("error", message, detail);
      },

      // Settings
      "settings.read": () => settings.read(),
      "settings.write": (value) => settings.write(value),
    };
  }

  async function loadPlugin(pluginId: string) {
    const prevState = states.get(pluginId);

    const cleanupPrevious = async () => {
      commands.unregister(pluginId);
      if (!prevState) return;
      try {
        await prevState.plugin?.deactivate?.();
      } catch (e) {
        console.warn(`[tiny-plugins] deactivate error for ${pluginId}`, e);
      }
      if (prevState.moduleUrl) URL.revokeObjectURL(prevState.moduleUrl);
    };

    const fs = createPluginFs(root, pluginId);

    const mres = await readManifestStrict(
      async (p) => new TextDecoder().decode(await fs.readFile(p)),
      pluginId,
      hostApiVersion,
    );

    if (!mres.ok) {
      await cleanupPrevious();
      const nextState = { manifest: null, watcherCleanup: prevState?.watcherCleanup };
      states.set(pluginId, nextState);
      if (shouldEmitPluginsChange(prevState, nextState)) emitPluginsChange();
      emitStatus(`manifest invalid for ${pluginId}: ${mres.error}`, pluginId, mres.details ?? mres);
      emitter.emit("pluginChange", {
        pluginId,
        payload: {
          paths: [],
          manifest: null,
          files: await listFiles(pluginRootPath(pluginId)),
          changes: undefined,
        },
      });
      return;
    }

    const manifest = mres.manifest;
    const entry = manifest.entry;

    await cleanupPrevious();

    const code = new TextDecoder().decode(await fs.readFile(entry));
    const blob = new Blob([code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);

    let mod: PluginModule;
    try {
      mod = (await import(/* @vite-ignore */ url)) as PluginModule;
    } catch (e) {
      URL.revokeObjectURL(url);
      throw new Error(`Failed to import ${pluginId}:${entry} – ${(e as Error).message}`);
    }

    const plugin = mod?.default;
    if (!plugin || typeof plugin.activate !== "function") {
      URL.revokeObjectURL(url);
      throw new Error(`Plugin ${pluginId} default export must implement activate()`);
    }

    const ctx: PluginContext = {
      id: pluginId,
      manifest,
      api: buildHostApi(pluginId),
    };

    try {
      await plugin.activate(ctx);
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
    commands.register(pluginId, manifest.commands, mod.commands);

    const nextState = {
      manifest,
      moduleUrl: url,
      module: mod,
      plugin,
      ctx,
      watcherCleanup: prevState?.watcherCleanup,
    };
    states.set(pluginId, nextState);
    if (shouldEmitPluginsChange(prevState, nextState)) emitPluginsChange();

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

  async function unloadPlugin(pluginId: string) {
    const s = states.get(pluginId);
    commands.unregister(pluginId);
    try {
      await s?.plugin?.deactivate?.();
    } catch (e) {
      console.warn(`[tiny-plugins] deactivate error for ${pluginId}`, e);
    }
    if (s?.moduleUrl) URL.revokeObjectURL(s.moduleUrl);
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
        await loadPlugin(id);
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

  function onPluginsChange(cb: (plugins: PluginMetadata[]) => void) {
    return emitter.on("pluginsChange", ({ plugins }) => cb(plugins));
  }

  function onSettingsChange(cb: (pluginId: string, settings: unknown) => void) {
    return emitter.on("settingsChange", ({ pluginId, settings }) => cb(pluginId, settings));
  }

  function getMetadata(): PluginMetadata[] {
    return collectMetadata();
  }

  async function updateSettings<T = unknown>(pluginId: string, value: T) {
    const api = buildHostApi(pluginId);
    await api["settings.write"](value);
  }

  async function readSettings<T = unknown>(pluginId: string) {
    const api = buildHostApi(pluginId);
    return api["settings.read"]<T>();
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
    onPluginsChange,
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
