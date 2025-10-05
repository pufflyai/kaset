import { toaster } from "@/components/ui/toaster";
import { PLUGIN_ROOT } from "@/constant";
import {
  createBrowserPluginHost,
  type BrowserPluginHost,
  type JSONSchema,
  type PluginFilesListener,
  type PluginMetadata,
  type RegisteredCommand,
} from "@pstdio/kaset-plugin-host";
import { createToolsForCommands } from "@pstdio/kaset-plugin-host/browser/adapters/tiny-ai-tasks";
import type { Tool } from "@pstdio/tiny-ai-tasks";

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

export type PluginCommand = RegisteredCommand & { pluginName?: string };

type CommandsListener = (commands: PluginCommand[]) => void;
type SettingsListener = (pluginId: string, schema?: JSONSchema) => void;
type DesktopSurfaceListener = (surfaces: PluginDesktopSurface[]) => void;

let pluginsRoot = normalizePluginsRoot(PLUGIN_ROOT);
let hostGeneration = 0;

let host: BrowserPluginHost | null = null;
let startPromise: Promise<BrowserPluginHost> | null = null;
let hostReady = false;

let rawCommands: RegisteredCommand[] = [];
let pluginTools: Tool[] = [];

const commandSubscribers = new Set<CommandsListener>();
const settingsSubscribers = new Set<SettingsListener>();
const desktopSurfaceSubscribers = new Set<DesktopSurfaceListener>();

const pluginSchemas = new Map<string, JSONSchema>();
const pluginMetadata = new Map<string, PluginMetadata>();
const pluginDesktopSurfaces = new Map<string, PluginDesktopSurface[]>();

let hostUnsubscribers: Array<() => void> = [];

function buildPluginCommand(command: RegisteredCommand): PluginCommand {
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

function rebuildTools() {
  pluginTools = createToolsForCommands(rawCommands, async (pluginId, commandId) => {
    const instance = await ensureHost();
    await instance.runCommand(pluginId, commandId);
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

function normalizeWindowDescriptor(
  window?: DesktopSurfaceManifest["window"],
): PluginDesktopWindowDescriptor | undefined {
  if (!window) return undefined;
  const entry = window.entry?.trim();
  if (!entry) return undefined;
  const normalizedEntry = entry.replace(/^\/+/, "");
  if (!normalizedEntry) return undefined;
  const dependencies = window.dependencies ? { ...window.dependencies } : undefined;
  return { entry: normalizedEntry, dependencies };
}

function normalizeDesktopSurfaces(
  pluginId: string,
  manifest: ManifestJson,
  fallbackTitle: string,
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

function resetPluginsState() {
  rawCommands = [];
  pluginTools = [];
  notifyCommandSubscribers();

  const schemaIds = Array.from(pluginSchemas.keys());
  pluginSchemas.clear();
  schemaIds.forEach((pluginId) => notifySettingsSubscribers(pluginId, undefined));

  pluginMetadata.clear();
  pluginDesktopSurfaces.clear();
  notifyDesktopSurfaceSubscribers();
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

function coerceManifest(value: unknown): ManifestJson | null {
  if (!value || typeof value !== "object") return null;
  return value as ManifestJson;
}

function handleManifestUpdate(pluginId: string, manifest: unknown | null) {
  const manifestJson = coerceManifest(manifest);
  const fallbackTitle = manifestJson?.name || pluginMetadata.get(pluginId)?.name || pluginId;
  const nextSurfaces = manifestJson ? normalizeDesktopSurfaces(pluginId, manifestJson, fallbackTitle) : [];
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

function attachHostSubscriptions(instance: BrowserPluginHost, generation: number) {
  clearHostSubscriptions();

  const unsubscribeCommands = instance.subscribeCommands((commands) => {
    if (generation !== hostGeneration) return;
    rawCommands = commands;
    rebuildTools();
    notifyCommandSubscribers();
  });

  const unsubscribeSettings = instance.subscribeSettings((pluginId, schema) => {
    if (generation !== hostGeneration) return;
    if (schema) {
      pluginSchemas.set(pluginId, schema);
    } else {
      pluginSchemas.delete(pluginId);
    }
    notifySettingsSubscribers(pluginId, schema);
  });

  const unsubscribePlugins = instance.subscribePlugins((entries) => {
    if (generation !== hostGeneration) return;

    const seen = new Set<string>();
    let metadataChanged = false;

    entries.forEach((entry) => {
      seen.add(entry.id);
      const stored = pluginMetadata.get(entry.id);
      if (!stored || stored.id !== entry.id || stored.name !== entry.name || stored.version !== entry.version) {
        pluginMetadata.set(entry.id, { ...entry });
        metadataChanged = true;
      }
    });

    pluginMetadata.forEach((_, pluginId) => {
      if (seen.has(pluginId)) return;
      pluginMetadata.delete(pluginId);
      metadataChanged = true;
    });

    if (metadataChanged) {
      notifyCommandSubscribers();
    }
  });

  const unsubscribeManifests = instance.subscribeManifests(({ pluginId, manifest }) => {
    if (generation !== hostGeneration) return;
    handleManifestUpdate(pluginId, manifest);
  });

  hostUnsubscribers = [unsubscribeCommands, unsubscribeSettings, unsubscribePlugins, unsubscribeManifests];
}

function createHostInstance(): BrowserPluginHost {
  return createBrowserPluginHost({
    root: pluginsRoot,
    watch: true,
    notify(level, message) {
      const type = level === "error" ? "error" : level === "warn" ? "warning" : "info";
      toaster.create({ type, title: message, duration: 5000 });
    },
    host: {
      netFetch: (url, init) => fetch(url, init),
    },
  });
}

async function disposeHost(instance: BrowserPluginHost | null) {
  if (!instance) return;
  try {
    await instance.stop();
  } catch (error) {
    console.warn("[plugin-host] Failed to dispose browser plugin host", error);
  }
}

async function ensureHost(): Promise<BrowserPluginHost> {
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
      // ignore failures while resetting
    }
  }

  await disposeHost(previousHost);
}

export async function ensurePluginHost(): Promise<BrowserPluginHost> {
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

export function subscribeToPluginFiles(pluginId: string, listener: PluginFilesListener) {
  let unsubscribe: (() => void) | null = null;
  let active = true;

  const connect = async () => {
    try {
      const instance = await ensureHost();
      if (!active) return;
      unsubscribe = instance.subscribePluginFiles(pluginId, listener);
    } catch (error) {
      console.warn(`[plugin-host] Failed to subscribe to plugin files for ${pluginId}`, error);
    }
  };

  void connect();

  return () => {
    active = false;
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn(`[plugin-host] Failed to unsubscribe from plugin files for ${pluginId}`, error);
      }
      unsubscribe = null;
    }
  };
}

export async function runPluginCommand(pluginId: string, commandId: string) {
  const instance = await ensureHost();
  await instance.runCommand(pluginId, commandId);
}

export async function readPluginSettings<T = unknown>(pluginId: string): Promise<T> {
  const instance = await ensureHost();
  return instance.readSettings<T>(pluginId);
}

export async function writePluginSettings<T = unknown>(pluginId: string, value: T): Promise<void> {
  const instance = await ensureHost();
  await instance.writeSettings(pluginId, value);
}

export function getPluginDisplayName(pluginId: string) {
  return pluginMetadata.get(pluginId)?.name || pluginId;
}

export function getPluginsRoot() {
  return pluginsRoot;
}
