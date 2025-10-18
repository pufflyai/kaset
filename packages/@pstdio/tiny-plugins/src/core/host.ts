import { ls, type ChangeRecord, type LsEntry } from "@pstdio/opfs-utils";
import { createPluginFs, createPluginDataFs } from "./fs";
import { Emitter } from "./events";
import { readManifestStrict } from "./manifest";
import { listFiles, watchPluginDir } from "./watchers";
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
};

const DEFAULT_HOST_API_VERSION = "1.0.0";

export function createHost(options: HostOptions) {
  const {
    root,
    dataRoot,
    watch = true,
    notify,
    hostApiVersion = DEFAULT_HOST_API_VERSION,
  } = options;

  const emitter = new Emitter<Events>();
  const commands = new CommandRegistry();

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

  // --- Host API mapping (scoped to a pluginId) ---
  function buildHostApi(pluginId: string): HostApi {
    const pfs = createPluginFs(root, pluginId);
    const settings = createSettings(createPluginDataFs(dataRoot, pluginId), (value) => {
      emitter.emit("settingsChange", { pluginId, settings: value });
    });

    return {
      // FS
      "fs.readFile": (path) => pfs.readFile(path),
      "fs.writeFile": (path, contents) => pfs.writeFile(path, contents),
      "fs.deleteFile": (path) => pfs.deleteFile(path),
      "fs.moveFile": (from, to) => pfs.moveFile(from, to),
      "fs.exists": (path) => pfs.exists(path),
      "fs.mkdirp": (path) => pfs.mkdirp(path),

      // Logs/notifications
      "logs.statusUpdate": async (status) => {
        emitter.emit("status", { status: status.status, detail: status.detail, pluginId });
      },
      "logs.logError": async (error) => {
        notify?.("error", error?.message ?? "unknown");
      },

      // Settings
      "settings.read": () => settings.read(),
      "settings.write": (value) => settings.write(value),
    };
  }

  async function loadPlugin(pluginId: string) {
    const fs = createPluginFs(root, pluginId);

    const mres = await readManifestStrict(
      async (p) => new TextDecoder().decode(await fs.readFile(p)),
      pluginId,
      hostApiVersion,
    );

    if (!mres.ok) {
      states.set(pluginId, { manifest: null });
      emitStatus(`manifest invalid for ${pluginId}: ${mres.error}`, pluginId, mres.details ?? mres);
      emitter.emit("pluginChange", {
        pluginId,
        payload: {
          paths: [],
          manifest: null,
          files: await listFiles(pluginRootPath(pluginId)),
        },
      });
      return;
    }

    const manifest = mres.manifest;
    const entry = manifest.entry;

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

    await plugin.activate(ctx);
    commands.register(pluginId, manifest.commands, mod.commands);

    const prev = states.get(pluginId);
    if (prev?.moduleUrl) URL.revokeObjectURL(prev.moduleUrl);
    states.set(pluginId, { manifest, moduleUrl: url, module: mod, plugin, ctx });

    emitter.emit("pluginChange", {
      pluginId,
      payload: {
        paths: [],
        manifest,
        files: await listFiles(pluginRootPath(pluginId)),
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
          },
        });
        emitter.emit("dependencyChange", { deps: getPluginDependencies() });
      } catch (e) {
        emitError(e as Error);
      }
    });

    const s = states.get(pluginId);
    if (s) s.watcherCleanup = cleanup;
  }

  async function start() {
    let pluginIds: string[] = [];
    try {
      const entries = await ls(root, { maxDepth: 1, kinds: ["directory"] });
      pluginIds = entries.map((entry: LsEntry) => entry.name);
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

    emitter.emit("dependencyChange", { deps: getPluginDependencies() });
  }

  async function stop() {
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
    return mergeDependencies([...states.values()].map((s) => ({
      id: s.manifest?.id,
      dependencies: s.manifest?.dependencies,
    })));
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
    return [...states.entries()]
      .map(([id, s]) => ({ id, name: s.manifest?.name, version: s.manifest?.version }))
      .sort((a, b) => a.id.localeCompare(b.id));
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
