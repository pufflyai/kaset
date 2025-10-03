import { toaster } from "@/components/ui/toaster";
import { ROOT } from "@/constant";
import {
  createPluginHost,
  type HostConfig,
  type JSONSchema,
  type PluginHost,
  type RegisteredCommand,
} from "@pstdio/kaset-plugin-host";
import { deleteFile, getDirectoryHandle, ls, readFile, watchDirectory, writeFile, type ChangeRecord } from "@pstdio/opfs-utils";
import type { Tool } from "@pstdio/tiny-ai-tasks";

const DEFAULT_PLUGINS_ROOT = `${ROOT}/plugins`;

type PluginMetadata = {
  id: string;
  name?: string;
  version?: string;
};

type Dimensions = {
  width: number;
  height: number;
};

type Coordinates = {
  x: number;
  y: number;
};

export type PluginDesktopWindowDescriptor = {
  entry: string;
  dependencies?: Record<string, string>;
};

type DesktopSurfaceManifest = {
  id?: string;
  title?: string;
  description?: string;
  icon?: string;
  singleton?: boolean;
  defaultSize?: Partial<Dimensions>;
  minSize?: Partial<Dimensions>;
  defaultPosition?: Partial<Coordinates>;
  window?: {
    entry?: string;
    kind?: string;
    dependencies?: Record<string, string>;
  };
};

type ManifestJson = Partial<PluginMetadata> & {
  description?: string;
  ui?: {
    desktop?: DesktopSurfaceManifest | DesktopSurfaceManifest[];
    commands?: unknown;
  };
};

export type PluginDesktopSurface = {
  pluginId: string;
  surfaceId: string;
  title: string;
  description?: string;
  icon?: string;
  singleton?: boolean;
  defaultSize?: Dimensions;
  minSize?: Dimensions;
  defaultPosition?: Coordinates;
  window?: PluginDesktopWindowDescriptor;
};

type PluginFilesEvent = {
  pluginId: string;
  changes: ChangeRecord[];
};

type PluginFilesListener = (event: PluginFilesEvent) => void;

type PluginFileWatcher = {
  listeners: Set<PluginFilesListener>;
  cleanup?: () => void | Promise<void>;
  pending?: Promise<void>;
};

export type PluginCommand = RegisteredCommand & { pluginName?: string };

type CommandsListener = (commands: PluginCommand[]) => void;
type SettingsListener = (pluginId: string, schema?: JSONSchema) => void;

type ToolResultPayload = {
  success: true;
  pluginId: string;
  commandId: string;
  title?: string;
};

let pluginsRoot = DEFAULT_PLUGINS_ROOT;
let hostGeneration = 0;

let host: PluginHost | null = null;
let initPromise: Promise<PluginHost> | null = null;
let hostReady = false;

let rawCommands: RegisteredCommand[] = [];
let decoratedCommands: PluginCommand[] = [];
let pluginTools: Tool[] = [];

const commandSubscribers = new Set<CommandsListener>();
const settingsSubscribers = new Set<SettingsListener>();
const pluginSchemas = new Map<string, JSONSchema>();
const pluginMetadata = new Map<string, PluginMetadata>();

type DesktopSurfaceListener = (surfaces: PluginDesktopSurface[]) => void;

const desktopSurfaceSubscribers = new Set<DesktopSurfaceListener>();
const pluginDesktopSurfaces = new Map<string, PluginDesktopSurface[]>();
const pluginFileWatchers = new Map<string, PluginFileWatcher>();

function notifyCommandSubscribers() {
  const snapshot = decoratedCommands.map((cmd) => ({ ...cmd }));
  commandSubscribers.forEach((listener) => listener(snapshot));
}

function notifySettingsSubscribers(pluginId: string, schema?: JSONSchema) {
  settingsSubscribers.forEach((listener) => listener(pluginId, schema));
}

function cloneDimensions(value?: Dimensions): Dimensions | undefined {
  if (!value) return undefined;
  return { width: value.width, height: value.height };
}

function cloneCoordinates(value?: Coordinates): Coordinates | undefined {
  if (!value) return undefined;
  return { x: value.x, y: value.y };
}

function cloneWindowDescriptor(window?: PluginDesktopWindowDescriptor): PluginDesktopWindowDescriptor | undefined {
  if (!window) return undefined;
  const dependencies = window.dependencies ? { ...window.dependencies } : undefined;
  return { ...window, dependencies };
}

function getDesktopSurfaceSnapshot() {
  const snapshot: PluginDesktopSurface[] = [];
  pluginDesktopSurfaces.forEach((surfaces) => {
    surfaces.forEach((surface) => {
      snapshot.push({
        ...surface,
        defaultSize: cloneDimensions(surface.defaultSize),
        minSize: cloneDimensions(surface.minSize),
        defaultPosition: cloneCoordinates(surface.defaultPosition),
        window: cloneWindowDescriptor(surface.window),
      });
    });
  });

  return snapshot.sort((a, b) => {
    if (a.pluginId === b.pluginId) {
      return a.surfaceId.localeCompare(b.surfaceId);
    }
    return a.pluginId.localeCompare(b.pluginId);
  });
}

function notifyDesktopSurfaceSubscribers() {
  if (desktopSurfaceSubscribers.size === 0) return;
  const snapshot = getDesktopSurfaceSnapshot();
  desktopSurfaceSubscribers.forEach((listener) => listener(snapshot));
}

function getPluginDirectory(pluginId: string) {
  const normalizedRoot = pluginsRoot.replace(/\/+$/, "");
  const normalizedId = pluginId.replace(/^\/+/, "");
  return `${normalizedRoot}/${normalizedId}`.replace(/^\/+/, "");
}

async function disposePluginFileWatcher(pluginId: string) {
  const record = pluginFileWatchers.get(pluginId);
  if (!record) return;

  const pending = record.pending;
  record.pending = undefined;
  if (pending) {
    try {
      await pending;
    } catch {
      // ignore setup failures on dispose
    }
  }

  const cleanup = record.cleanup;
  record.cleanup = undefined;
  if (!cleanup) return;

  try {
    await cleanup();
  } catch (error) {
    console.warn(`[plugin-host] Failed to dispose file watcher for ${pluginId}`, error);
  }
}

async function ensurePluginFileWatcher(pluginId: string) {
  const record = pluginFileWatchers.get(pluginId);
  if (!record || record.listeners.size === 0) return;
  if (typeof window === "undefined") return;
  if (record.cleanup) return;

  if (record.pending) {
    try {
      await record.pending;
    } catch {
      // ignore setup failure; we'll retry below if needed
    }
    return;
  }

  const directory = getPluginDirectory(pluginId);

  record.pending = watchDirectory(
    directory,
    (changes: ChangeRecord[]) => {
      if (!changes?.length) return;
      record.listeners.forEach((listener) => {
        try {
          listener({ pluginId, changes });
        } catch (error) {
          console.error(`[plugin-host] Plugin file listener failed for ${pluginId}`, error);
        }
      });
    },
    {
      recursive: true,
      emitInitial: false,
    },
  )
    .then((cleanup) => {
      record.cleanup = cleanup;
    })
    .catch((error) => {
      console.warn(`[plugin-host] Failed to watch plugin files for ${pluginId}`, error);
    })
    .finally(() => {
      record.pending = undefined;
    });

  try {
    await record.pending;
  } catch {
    // ignore; warning already logged above
  }
}

function sanitizeToolName(pluginId: string, commandId: string) {
  return `plugin_${pluginId}_${commandId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function rebuildDecoratedCommands() {
  decoratedCommands = rawCommands.map((cmd) => ({
    ...cmd,
    pluginName: pluginMetadata.get(cmd.pluginId)?.name,
  }));
}

function createToolForCommand(command: RegisteredCommand): Tool {
  return {
    definition: {
      name: sanitizeToolName(command.pluginId, command.id),
      description: command.title || `${command.pluginId}:${command.id}`,
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
    async run(_params, { toolCall }) {
      const instance = await ensurePluginHost();
      await instance.invokeCommand(command.pluginId, command.id);

      const payload: ToolResultPayload = {
        success: true,
        pluginId: command.pluginId,
        commandId: command.id,
        title: command.title,
      };

      return {
        data: payload,
        messages: [
          {
            role: "tool",
            tool_call_id: toolCall?.id ?? "",
            content: JSON.stringify(payload),
          },
        ],
      };
    },
  };
}

function rebuildTools() {
  pluginTools = rawCommands.map((cmd) => createToolForCommand(cmd));
}

function normalizeDimensions(value?: Partial<Dimensions>): Dimensions | undefined {
  if (!value) return undefined;
  const width = Number(value.width);
  const height = Number(value.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  return { width, height };
}

function normalizeCoordinates(value?: Partial<Coordinates>): Coordinates | undefined {
  if (!value) return undefined;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x, y };
}

function normalizeWindowDescriptor(
  window?: DesktopSurfaceManifest["window"],
): PluginDesktopWindowDescriptor | undefined {
  if (!window) return undefined;

  const entry = window.entry?.trim();
  if (!entry) return undefined;

  const normalizedEntry = entry.replace(/^\/+/, "");
  if (!normalizedEntry) return undefined;

  const dependencies = window.dependencies ? { ...window.dependencies } : undefined;

  return {
    entry: normalizedEntry,
    dependencies,
  };
}

function normalizeDesktopSurfaces(
  pluginId: string,
  manifest: ManifestJson,
  fallbackTitle?: string,
): PluginDesktopSurface[] {
  const desktop = manifest.ui?.desktop;
  if (!desktop) return [];

  const items = Array.isArray(desktop) ? desktop : [desktop];
  const normalized: PluginDesktopSurface[] = [];

  items.forEach((item, index) => {
    if (!item) return;

    const surfaceId = item.id?.trim() || `desktop-${index}`;
    const title = item.title?.trim() || fallbackTitle || manifest.name || pluginId;
    const description = item.description?.trim();
    const icon = item.icon?.trim();
    const singleton = typeof item.singleton === "boolean" ? item.singleton : undefined;
    const defaultSize = normalizeDimensions(item.defaultSize);
    const minSize = normalizeDimensions(item.minSize);
    const defaultPosition = normalizeCoordinates(item.defaultPosition);
    const window = normalizeWindowDescriptor(item.window);

    normalized.push({
      pluginId,
      surfaceId,
      title,
      description,
      icon,
      singleton,
      defaultSize,
      minSize,
      defaultPosition,
      window,
    });
  });

  return normalized.sort((a, b) => a.surfaceId.localeCompare(b.surfaceId));
}

function areSurfacesEqual(left: PluginDesktopSurface[], right: PluginDesktopSurface[]) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const currentLeft = left[index];
    const currentRight = right[index];
    if (!currentLeft || !currentRight) return false;
    if (JSON.stringify(currentLeft) !== JSON.stringify(currentRight)) return false;
  }
  return true;
}

async function ensureDirectory(path: string) {
  try {
    await getDirectoryHandle(path);
  } catch (error: any) {
    if (error?.name !== "NotFoundError" && error?.code !== 404) throw error;
    const keep = `${path.replace(/\/+$/, "")}/.keep`;
    await writeFile(keep, "");
    try {
      await deleteFile(keep);
    } catch {
      // ignore cleanup failures
    }
  }
}

function normalizePluginsRoot(root: string) {
  return root.replace(/^\/+/, "").replace(/\/+$/, "");
}

async function loadManifestMetadata(pluginId: string, options: { force?: boolean } = {}) {
  const force = options.force ?? false;
  const previousMetadata = pluginMetadata.get(pluginId);
  const previousSurfaces = pluginDesktopSurfaces.get(pluginId) ?? [];

  if (!force && previousMetadata) return;

  let metadataChanged = false;
  let surfacesChanged = false;

  try {
    const manifestRaw = await readFile(`${pluginsRoot}/${pluginId}/manifest.json`);
    const manifest = JSON.parse(manifestRaw) as ManifestJson;

    const nextMetadata: PluginMetadata = {
      id: manifest.id ?? pluginId,
      name: manifest.name,
      version: manifest.version,
    };

    metadataChanged =
      !previousMetadata ||
      previousMetadata.id !== nextMetadata.id ||
      previousMetadata.name !== nextMetadata.name ||
      previousMetadata.version !== nextMetadata.version;

    pluginMetadata.set(pluginId, nextMetadata);

    const fallbackTitle = manifest.name || nextMetadata.name || nextMetadata.id || pluginId;
    const nextSurfaces = normalizeDesktopSurfaces(pluginId, manifest, fallbackTitle);
    const hadSurfaces = pluginDesktopSurfaces.has(pluginId);

    if (nextSurfaces.length > 0) {
      surfacesChanged = !hadSurfaces || !areSurfacesEqual(previousSurfaces, nextSurfaces);
      pluginDesktopSurfaces.set(pluginId, nextSurfaces);
    } else if (hadSurfaces) {
      pluginDesktopSurfaces.delete(pluginId);
      surfacesChanged = true;
    }

    if (metadataChanged) {
      rebuildDecoratedCommands();
      notifyCommandSubscribers();
    }

    if (surfacesChanged) {
      notifyDesktopSurfaceSubscribers();
    }
  } catch (error) {
    const hadSurfaces = pluginDesktopSurfaces.delete(pluginId);
    pluginMetadata.set(pluginId, { id: pluginId });

    if (previousMetadata) {
      rebuildDecoratedCommands();
      notifyCommandSubscribers();
    }

    if (hadSurfaces || previousSurfaces.length > 0) {
      notifyDesktopSurfaceSubscribers();
    }

    console.warn(`[plugin-host] Failed to read manifest for ${pluginId}`, error);
  }
}

async function listPluginDirectories() {
  try {
    const entries = await ls(pluginsRoot, { maxDepth: 1, kinds: ["directory"] });
    return entries.map((entry) => entry.name).filter((name): name is string => Boolean(name));
  } catch (error: any) {
    if (error?.name === "NotFoundError" || error?.code === 404) {
      return [];
    }
    console.warn("[plugin-host] Failed to list plugin directories", error);
    return [];
  }
}

async function refreshPluginManifests(options: { force?: boolean } = {}) {
  const directories = await listPluginDirectories();
  const nextIds = new Set(directories);

  let metadataRemoved = false;
  let surfacesRemoved = false;

  pluginMetadata.forEach((_, pluginId) => {
    if (nextIds.has(pluginId)) return;
    pluginMetadata.delete(pluginId);
    metadataRemoved = true;
    if (pluginDesktopSurfaces.delete(pluginId)) {
      surfacesRemoved = true;
    }
    const watcher = pluginFileWatchers.get(pluginId);
    if (watcher) {
      void disposePluginFileWatcher(pluginId);
      pluginFileWatchers.delete(pluginId);
    }
  });

  if (metadataRemoved) {
    rebuildDecoratedCommands();
    notifyCommandSubscribers();
  }

  if (surfacesRemoved) {
    notifyDesktopSurfaceSubscribers();
  }

  for (const pluginId of nextIds) {
    await loadManifestMetadata(pluginId, { force: options.force });
  }

  pluginFileWatchers.forEach((watcher, pluginId) => {
    if (!nextIds.has(pluginId)) return;
    if (watcher.listeners.size === 0) return;
    if (watcher.cleanup) return;
    void ensurePluginFileWatcher(pluginId);
  });
}

function handleCommandsChanged(next: RegisteredCommand[]) {
  rawCommands = next;
  rebuildTools();
  rebuildDecoratedCommands();
  notifyCommandSubscribers();

  refreshPluginManifests({ force: true }).catch((error) => {
    console.warn("[plugin-host] Failed to refresh plugin manifests", error);
  });
}

function createHostConfig(): HostConfig {
  return {
    pluginsRoot,
    watchPlugins: true,
    netFetch: (url, init) => fetch(url, init),
    ui: {
      onCommandsChanged(commands) {
        handleCommandsChanged(commands);
      },
      notify(level, message) {
        const type = level === "error" ? "error" : level === "warn" ? "warning" : "info";
        toaster.create({ type, title: message, duration: 5000 });
      },
      onSettingsSchema(pluginId, schema) {
        if (schema) {
          pluginSchemas.set(pluginId, schema);
          loadManifestMetadata(pluginId);
        } else {
          pluginSchemas.delete(pluginId);
        }
        notifySettingsSubscribers(pluginId, schema);
      },
    },
  } satisfies HostConfig;
}

function resetPluginsState() {
  rawCommands = [];
  decoratedCommands = [];
  pluginTools = [];

  notifyCommandSubscribers();

  const schemaIds = [...pluginSchemas.keys()];
  pluginSchemas.clear();
  schemaIds.forEach((id) => notifySettingsSubscribers(id, undefined));

  const hadSurfaces = pluginDesktopSurfaces.size > 0;
  pluginDesktopSurfaces.clear();
  if (hadSurfaces) {
    notifyDesktopSurfaceSubscribers();
  }

  pluginFileWatchers.forEach((_watcher, pluginId) => {
    void disposePluginFileWatcher(pluginId);
  });

  pluginMetadata.clear();
}

async function disposeHost(instance: PluginHost | null | undefined) {
  if (!instance) return;
  try {
    await instance.unloadAll();
  } catch (error) {
    console.warn("[plugin-host] Failed to dispose plugin host", error);
  }
}

export async function ensurePluginHost(): Promise<PluginHost> {
  if (host) return host;

  if (!initPromise) {
    if (typeof window === "undefined") {
      throw new Error("kaset plugin host can only run in the browser.");
    }

    const generation = hostGeneration;
    initPromise = (async () => {
      await ensureDirectory(pluginsRoot);

      const instance = createPluginHost(createHostConfig());
      try {
        await instance.loadAll();
      } catch (error) {
        console.error("[plugin-host] Failed to load plugins", error);
      }

      if (generation !== hostGeneration) {
        await disposeHost(instance);
        throw new Error("Plugin root changed during initialization");
      }

      try {
        await refreshPluginManifests({ force: true });
      } catch (error) {
        console.warn("[plugin-host] Failed to refresh plugin manifests", error);
      }

      pluginFileWatchers.forEach((watcher, pluginId) => {
        if (watcher.listeners.size === 0) return;
        if (watcher.cleanup) return;
        void ensurePluginFileWatcher(pluginId);
      });

      host = instance;
      hostReady = true;
      return instance;
    })();
  }

  return initPromise;
}

export async function setPluginsRoot(nextRoot: string) {
  const normalized = normalizePluginsRoot(nextRoot) || normalizePluginsRoot(DEFAULT_PLUGINS_ROOT);
  if (!normalized) return;
  if (normalized === pluginsRoot) return;

  const previousInit = initPromise;

  hostGeneration += 1;
  pluginsRoot = normalized;
  host = null;
  hostReady = false;
  initPromise = null;

  resetPluginsState();

  if (previousInit) {
    try {
      const instance = await previousInit.catch(() => null);
      await disposeHost(instance);
    } catch (error) {
      console.warn("[plugin-host] Failed to teardown previous plugin host", error);
    }
  }
}

export function isPluginHostReady() {
  return hostReady;
}

export function getPluginTools(): Tool[] {
  return pluginTools;
}

export function getPluginCommands(): PluginCommand[] {
  return decoratedCommands.map((cmd) => ({ ...cmd }));
}

export function subscribeToPluginCommands(listener: CommandsListener) {
  commandSubscribers.add(listener);
  listener(getPluginCommands());
  return () => {
    commandSubscribers.delete(listener);
  };
}

export function subscribeToPluginSettings(listener: SettingsListener) {
  settingsSubscribers.add(listener);
  pluginSchemas.forEach((schema, pluginId) => listener(pluginId, schema));
  return () => {
    settingsSubscribers.delete(listener);
  };
}

export function getPluginSettingsEntries() {
  return Array.from(pluginSchemas.entries()).map(([pluginId, schema]) => ({ pluginId, schema }));
}

export function getPluginDesktopSurfaces() {
  return getDesktopSurfaceSnapshot();
}

export function subscribeToPluginDesktopSurfaces(listener: DesktopSurfaceListener) {
  desktopSurfaceSubscribers.add(listener);
  listener(getDesktopSurfaceSnapshot());
  return () => {
    desktopSurfaceSubscribers.delete(listener);
  };
}

export function subscribeToPluginFiles(pluginId: string, listener: PluginFilesListener) {
  let record = pluginFileWatchers.get(pluginId);
  if (!record) {
    record = { listeners: new Set() } satisfies PluginFileWatcher;
    pluginFileWatchers.set(pluginId, record);
  }

  record.listeners.add(listener);
  void ensurePluginFileWatcher(pluginId);

  return () => {
    const current = pluginFileWatchers.get(pluginId);
    if (!current) return;

    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      void disposePluginFileWatcher(pluginId);
      pluginFileWatchers.delete(pluginId);
    }
  };
}

export async function runPluginCommand(pluginId: string, commandId: string) {
  const instance = await ensurePluginHost();
  await instance.invokeCommand(pluginId, commandId);
}

export async function readPluginSettings<T = unknown>(pluginId: string): Promise<T> {
  const instance = await ensurePluginHost();
  return instance.readSettings<T>(pluginId);
}

export async function writePluginSettings<T = unknown>(pluginId: string, value: T): Promise<void> {
  const instance = await ensurePluginHost();
  await instance.writeSettings(pluginId, value);
}

export function getPluginDisplayName(pluginId: string) {
  return pluginMetadata.get(pluginId)?.name || pluginId;
}

export function getPluginsRoot() {
  return pluginsRoot;
}
