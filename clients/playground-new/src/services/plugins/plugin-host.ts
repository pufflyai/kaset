import { toaster } from "@/components/ui/toaster";
import { PLUGIN_DATA_ROOT, PLUGIN_ROOT } from "@/constant";
import type { ChangeRecord } from "@pstdio/opfs-utils";
import type { Tool } from "@pstdio/tiny-ai-tasks";
import {
  createHost,
  createToolsForCommands,
  mergeManifestDependencies,
  type CommandDefinition,
  type Manifest,
  type PluginChangePayload,
  type PluginMetadata,
} from "@pstdio/tiny-plugins";

export type JSONSchema = Record<string, unknown> | boolean;

type HostCommand = CommandDefinition & { pluginId: string };

type TinyPluginHost = ReturnType<typeof createHost>;

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
  defaultPosition?: Partial<Coordinates>;
  entry?: string;
  dependencies?: Record<string, string>;
  window?: {
    entry?: string;
    dependencies?: Record<string, string>;
  };
};

function isJsonSchema(value: unknown): value is JSONSchema {
  if (typeof value === "boolean") return true;
  return typeof value === "object" && value !== null;
}

export type PluginFilesEvent = { pluginId: string; changes: ChangeRecord[] };
export type PluginFilesListener = (event: PluginFilesEvent) => void;

type ManifestWithUi = Manifest & {
  ui?: Manifest["ui"] & { desktop?: DesktopSurfaceManifest | DesktopSurfaceManifest[] };
};

export type PluginDesktopSurface = {
  pluginId: string;
  surfaceId: string;
  title: string;
  description?: string;
  icon?: string;
  singleton?: boolean;
  defaultSize?: Dimensions;
  defaultPosition?: Coordinates;
  window?: PluginDesktopWindowDescriptor;
};

export type PluginCommand = HostCommand & { pluginName?: string };

type CommandsListener = (commands: PluginCommand[]) => void;
type SettingsListener = (pluginId: string, schema?: JSONSchema) => void;
type DesktopSurfaceListener = (surfaces: PluginDesktopSurface[]) => void;

let pluginsRoot = normalizePluginsRoot(PLUGIN_ROOT);
const pluginDataRoot = normalizePluginsRoot(PLUGIN_DATA_ROOT);
let hostGeneration = 0;

let host: TinyPluginHost | null = null;
let startPromise: Promise<TinyPluginHost> | null = null;
let hostReady = false;

let rawCommands: HostCommand[] = [];
let pluginTools: Tool[] = [];

const commandSubscribers = new Set<CommandsListener>();
const settingsSubscribers = new Set<SettingsListener>();
const desktopSurfaceSubscribers = new Set<DesktopSurfaceListener>();
const pluginFileListeners = new Map<string, Set<PluginFilesListener>>();

const pluginSchemas = new Map<string, JSONSchema>();
const pluginMetadata = new Map<string, PluginMetadata>();
const pluginDesktopSurfaces = new Map<string, PluginDesktopSurface[]>();
const pluginDependencies = new Map<string, Record<string, string>>();
const dependencySubscribers = new Set<(dependencies: Record<string, string>) => void>();

let mergedDependencies: Record<string, string> = {};

function updateMergedDependencies() {
  mergedDependencies = mergeManifestDependencies(
    Array.from(pluginDependencies.entries()).map(([pluginId, dependencies]) => ({
      id: pluginId,
      dependencies,
    })),
  );
}

let hostUnsubscribers: Array<() => void> = [];

function buildPluginCommand(command: HostCommand): PluginCommand {
  return {
    ...command,
    pluginName: pluginMetadata.get(command.pluginId)?.name,
  };
}

function collectPluginCommands() {
  return rawCommands.map(buildPluginCommand);
}

function notifyCommandSubscribers() {
  if (commandSubscribers.size === 0) return;
  commandSubscribers.forEach((listener) => listener(collectPluginCommands()));
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

function getMergedDependenciesSnapshot(): Record<string, string> {
  return { ...mergedDependencies };
}

function notifyDesktopSurfaceSubscribers() {
  if (desktopSurfaceSubscribers.size === 0) return;
  const snapshot = getDesktopSurfaceSnapshot();
  desktopSurfaceSubscribers.forEach((listener) => listener(snapshot));
}

function notifyDependencySubscribers() {
  if (dependencySubscribers.size === 0) return;
  const snapshot = getMergedDependenciesSnapshot();
  dependencySubscribers.forEach((listener) => listener({ ...snapshot }));
}

function notifyPluginFileListeners(pluginId: string, payload: PluginChangePayload) {
  const listeners = pluginFileListeners.get(pluginId);
  if (!listeners || listeners.size === 0) return;

  const changes: ChangeRecord[] = (payload.paths ?? []).map((path) => ({
    type: "unknown",
    path: path.split("/").filter(Boolean),
  }));

  listeners.forEach((listener) => {
    try {
      listener({ pluginId, changes });
    } catch (error) {
      console.warn(`[plugin-host] Failed to notify file listener for ${pluginId}`, error);
    }
  });
}

function rebuildTools() {
  pluginTools = createToolsForCommands(rawCommands, async (pluginId, commandId, params) => {
    const instance = await ensureHost();
    await instance.runCommand(pluginId, commandId, params);
  });
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

function sanitizeEntryPath(entry?: string) {
  const trimmed = entry?.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/^\/+/, "");
  if (!normalized) return null;
  return normalized;
}

function normalizeWindowSection(
  window?: DesktopSurfaceManifest["window"],
  fallbackDependencies?: Record<string, string>,
): PluginDesktopWindowDescriptor | undefined {
  if (!window) return undefined;
  const entry = sanitizeEntryPath(window.entry);
  if (!entry) return undefined;
  const source = window.dependencies ?? fallbackDependencies;
  const dependencies = source ? { ...source } : undefined;
  return { entry, dependencies };
}

function normalizeWindowFromEntry(
  entry?: string,
  dependencies?: Record<string, string>,
  fallbackDependencies?: Record<string, string>,
): PluginDesktopWindowDescriptor | undefined {
  const normalizedEntry = sanitizeEntryPath(entry);
  if (!normalizedEntry) return undefined;
  const source = dependencies ?? fallbackDependencies;
  const normalizedDependencies = source ? { ...source } : undefined;
  return { entry: normalizedEntry, dependencies: normalizedDependencies };
}

function resolveWindowDescriptor(
  item: DesktopSurfaceManifest,
  manifestDependencies?: Record<string, string>,
): PluginDesktopWindowDescriptor | undefined {
  return (
    normalizeWindowSection(item.window, manifestDependencies) ??
    normalizeWindowFromEntry(item.entry, item.dependencies, manifestDependencies)
  );
}

function normalizeDesktopSurfaces(
  pluginId: string,
  manifest: ManifestWithUi,
  fallbackTitle: string,
): PluginDesktopSurface[] {
  const desktopConfig = manifest.ui?.desktop;
  if (!desktopConfig) return [];

  const manifestDependencies = manifest.dependencies;
  const items = Array.isArray(desktopConfig) ? desktopConfig : [desktopConfig];
  const normalized: PluginDesktopSurface[] = [];

  items.forEach((item, index) => {
    if (!item) return;

    const surfaceId = item.id?.trim() || `desktop-${index}`;
    const title = item.title?.trim() || fallbackTitle || manifest.name || pluginId;
    const description = item.description?.trim();
    const icon = item.icon?.trim();
    const singleton = typeof item.singleton === "boolean" ? item.singleton : undefined;
    const defaultSize = normalizeDimensions(item.defaultSize);
    const defaultPosition = normalizeCoordinates(item.defaultPosition);
    const window = resolveWindowDescriptor(item, manifestDependencies);

    if (!window) return;

    normalized.push({
      pluginId,
      surfaceId,
      title,
      description,
      icon,
      singleton,
      defaultSize,
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

function resetPluginsState() {
  rawCommands = [];
  pluginTools = [];
  notifyCommandSubscribers();

  const schemaIds = Array.from(pluginSchemas.keys());
  pluginSchemas.clear();
  schemaIds.forEach((pluginId) => notifySettingsSubscribers(pluginId, undefined));

  pluginMetadata.clear();

  const hadSurfaces = pluginDesktopSurfaces.size > 0;
  pluginDesktopSurfaces.clear();
  if (hadSurfaces) {
    notifyDesktopSurfaceSubscribers();
  }

  const hadDependencies = pluginDependencies.size > 0;
  pluginDependencies.clear();
  if (hadDependencies || Object.keys(mergedDependencies).length > 0) {
    mergedDependencies = {};
    notifyDependencySubscribers();
  }

  if (pluginFileListeners.size > 0) {
    pluginFileListeners.clear();
  }
}

function clearHostSubscriptions() {
  if (hostUnsubscribers.length === 0) return;
  hostUnsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      console.warn("[plugin-host] Failed to remove host subscription", error);
    }
  });
  hostUnsubscribers = [];
}

function syncPluginMetadata(entries: PluginMetadata[]) {
  const seen = new Set<string>();
  let changed = false;

  entries.forEach((entry) => {
    seen.add(entry.id);
    const stored = pluginMetadata.get(entry.id);
    if (!stored || stored.id !== entry.id || stored.name !== entry.name || stored.version !== entry.version) {
      pluginMetadata.set(entry.id, { ...entry });
      changed = true;
    }
  });

  pluginMetadata.forEach((_, pluginId) => {
    if (seen.has(pluginId)) return;
    pluginMetadata.delete(pluginId);
    changed = true;
  });

  if (changed) {
    notifyCommandSubscribers();
  }
}

function handleManifestUpdate(pluginId: string, manifest: Manifest | null) {
  const schema = manifest?.settingsSchema;
  const normalizedSchema = isJsonSchema(schema) ? schema : undefined;

  if (normalizedSchema !== undefined) {
    pluginSchemas.set(pluginId, normalizedSchema);
  } else {
    pluginSchemas.delete(pluginId);
  }

  notifySettingsSubscribers(pluginId, normalizedSchema);

  const existingDependencies = pluginDependencies.get(pluginId);
  const nextDependencies = manifest?.dependencies ? { ...manifest.dependencies } : undefined;
  let dependenciesChanged = false;

  if (nextDependencies) {
    const currentSignature = JSON.stringify(existingDependencies ?? {});
    const nextSignature = JSON.stringify(nextDependencies);
    if (!existingDependencies || currentSignature !== nextSignature) {
      pluginDependencies.set(pluginId, nextDependencies);
      dependenciesChanged = true;
    }
  } else if (existingDependencies) {
    pluginDependencies.delete(pluginId);
    dependenciesChanged = true;
  }

  if (dependenciesChanged) {
    updateMergedDependencies();
  }

  const manifestWithUi = (manifest ?? undefined) as ManifestWithUi | undefined;
  const fallbackTitle = manifest?.name || pluginMetadata.get(pluginId)?.name || pluginId;
  const nextSurfaces = manifestWithUi ? normalizeDesktopSurfaces(pluginId, manifestWithUi, fallbackTitle) : [];
  const previous = pluginDesktopSurfaces.get(pluginId) ?? [];

  if (nextSurfaces.length === 0) {
    if (pluginDesktopSurfaces.delete(pluginId) && previous.length > 0) {
      notifyDesktopSurfaceSubscribers();
    }
    return;
  }

  if (!areSurfacesEqual(previous, nextSurfaces)) {
    pluginDesktopSurfaces.set(pluginId, nextSurfaces);
    notifyDesktopSurfaceSubscribers();
  }
}

function refreshCommands(instance: TinyPluginHost) {
  const commands = instance.listCommands() as HostCommand[];
  rawCommands = commands.map((command) => ({ ...command }));
  rebuildTools();
  notifyCommandSubscribers();
}

function attachHostSubscriptions(instance: TinyPluginHost, generation: number) {
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

function createHostInstance(): TinyPluginHost {
  return createHost({
    root: pluginsRoot,
    dataRoot: pluginDataRoot,
    watch: true,
    notify(level, message) {
      const type = level === "error" ? "error" : level === "warn" ? "warning" : "info";
      toaster.create({ type, title: message, duration: 5000 });
    },
  });
}

async function disposeHost(instance: TinyPluginHost | null) {
  if (!instance) return;
  try {
    await instance.stop();
  } catch (error) {
    console.warn("[plugin-host] Failed to dispose plugin host", error);
  }
}

async function initializeHostState(instance: TinyPluginHost, generation: number) {
  const metadataList = instance.getMetadata();
  if (generation !== hostGeneration) return;

  syncPluginMetadata(metadataList);
  refreshCommands(instance);
  mergedDependencies = instance.getPluginDependencies();
  notifyDependencySubscribers();
}

async function ensureHost(): Promise<TinyPluginHost> {
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

function normalizePluginsRoot(root: string) {
  return root.replace(/^\/+/, "").replace(/\/+$/, "");
}

export async function setPluginsRoot(nextRoot: string) {
  const normalized = normalizePluginsRoot(nextRoot) || normalizePluginsRoot(PLUGIN_ROOT);
  if (!normalized || normalized === pluginsRoot) return;

  const previousHost = host;
  const previousPromise = startPromise;

  hostGeneration += 1;
  pluginsRoot = normalized;
  host = null;
  hostReady = false;
  startPromise = null;

  clearHostSubscriptions();
  resetPluginsState();

  if (previousPromise) {
    try {
      await previousPromise.catch(() => previousHost ?? null);
    } catch {
      /* ignore failures while resetting */
    }
  }

  await disposeHost(previousHost);
}

export async function ensurePluginHost(): Promise<TinyPluginHost> {
  return ensureHost();
}

export function isPluginHostReady() {
  return hostReady;
}

export function getPluginTools(): Tool[] {
  return pluginTools;
}

export function getPluginCommands(): PluginCommand[] {
  return collectPluginCommands();
}

export function subscribeToPluginCommands(listener: CommandsListener) {
  commandSubscribers.add(listener);
  listener(getPluginCommands());
  void ensureHost().catch((error) => {
    console.warn("[plugin-host] Failed to initialize plugin host for commands", error);
  });
  return () => {
    commandSubscribers.delete(listener);
  };
}

export function subscribeToPluginSettings(listener: SettingsListener) {
  settingsSubscribers.add(listener);
  pluginSchemas.forEach((schema, pluginId) => listener(pluginId, schema));
  void ensureHost().catch((error) => {
    console.warn("[plugin-host] Failed to initialize plugin host for settings", error);
  });
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
  void ensureHost().catch((error) => {
    console.warn("[plugin-host] Failed to initialize plugin host for desktop surfaces", error);
  });
  return () => {
    desktopSurfaceSubscribers.delete(listener);
  };
}

export function getMergedPluginDependencies() {
  return getMergedDependenciesSnapshot();
}

export function subscribeToPluginDependencies(listener: (dependencies: Record<string, string>) => void) {
  dependencySubscribers.add(listener);
  listener(getMergedDependenciesSnapshot());
  void ensureHost().catch((error) => {
    console.warn("[plugin-host] Failed to initialize plugin host for dependencies", error);
  });
  return () => {
    dependencySubscribers.delete(listener);
  };
}

export function subscribeToPluginFiles(pluginId: string, listener: PluginFilesListener) {
  let listeners = pluginFileListeners.get(pluginId);
  if (!listeners) {
    listeners = new Set();
    pluginFileListeners.set(pluginId, listeners);
  }

  listeners.add(listener);
  void ensureHost().catch((error) => {
    console.warn(`[plugin-host] Failed to initialize plugin host for file subscription ${pluginId}`, error);
  });

  return () => {
    const current = pluginFileListeners.get(pluginId);
    current?.delete(listener);
    if (current && current.size === 0) {
      pluginFileListeners.delete(pluginId);
    }
  };
}

export async function runPluginCommand(pluginId: string, commandId: string, params?: unknown) {
  const instance = await ensureHost();
  await instance.runCommand(pluginId, commandId, params);
}

export async function readPluginSettings<T = unknown>(pluginId: string): Promise<T> {
  const instance = await ensureHost();
  return instance.readSettings<T>(pluginId);
}

export async function writePluginSettings<T = unknown>(pluginId: string, value: T): Promise<void> {
  const instance = await ensureHost();
  await instance.updateSettings(pluginId, value);
}

export function getPluginDisplayName(pluginId: string) {
  return pluginMetadata.get(pluginId)?.name || pluginId;
}

export function getPluginsRoot() {
  return pluginsRoot;
}
