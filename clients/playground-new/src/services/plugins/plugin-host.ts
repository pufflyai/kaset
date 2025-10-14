import { toaster } from "@/components/ui/toaster";
import { PLUGIN_ROOT } from "@/constant";
import type { ChangeRecord } from "@pstdio/opfs-utils";
import {
  createPluginHost,
  createToolsForCommands,
  mergeManifestDependencies,
  type JSONSchema,
  type Manifest,
  type PluginHost,
  type PluginMetadata,
  type RegisteredCommand,
} from "@pstdio/tiny-plugins";
import type { Tool } from "@pstdio/tiny-ai-tasks";

import {
  getPluginStatusSnapshot,
  markPluginReload,
  markPluginRemoved,
  recordPluginNotification,
  resetPluginStatusStore,
  waitForPluginReload as waitForPluginReloadInternal,
  type PluginReloadWaitOptions,
  type PluginStatusSnapshot,
} from "./plugin-status-store";
import { createPluginTools } from "./tools/createPluginTools";

export type { PluginStatusSnapshot, PluginReloadWaitOptions } from "./plugin-status-store";

type HostCommand = RegisteredCommand & { pluginId: string };

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

export interface PluginVerificationOptions {
  waitForReload?: boolean;
  reloadTimeoutMs?: number;
  afterReloadAt?: number;
  selftestCommandId?: string;
}

type PluginVerificationFailurePhase = "reload" | "exists" | "manifest" | "commands" | "selftest";
type PluginVerificationSuccessPhase = "loaded" | "selftest";

export type PluginVerificationResult =
  | {
      pluginId: string;
      ok: true;
      phase: PluginVerificationSuccessPhase;
      reloadAt?: number;
      commands: string[];
      result?: unknown;
    }
  | {
      pluginId: string;
      ok: false;
      phase: PluginVerificationFailurePhase;
      reloadAt?: number;
      commands: string[];
      error: string;
    };

let pluginsRoot = normalizePluginsRoot(PLUGIN_ROOT);
let hostGeneration = 0;

let host: PluginHost | null = null;
let startPromise: Promise<PluginHost> | null = null;
let hostReady = false;

let rawCommands: HostCommand[] = [];
let pluginTools: Tool[] = [];
let builtinPluginTools: Tool[] | null = null;

pluginTools = [...ensureBuiltinPluginTools()];

const commandSubscribers = new Set<CommandsListener>();
const settingsSubscribers = new Set<SettingsListener>();
const desktopSurfaceSubscribers = new Set<DesktopSurfaceListener>();

const pluginSchemas = new Map<string, JSONSchema>();
const pluginMetadata = new Map<string, PluginMetadata>();
const pluginDesktopSurfaces = new Map<string, PluginDesktopSurface[]>();
const pluginDependencies = new Map<string, Record<string, string>>();
const dependencySubscribers = new Set<(dependencies: Record<string, string>) => void>();

let cachedMergedDependencies: Record<string, string> = {};
let dependenciesDirty = true;

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

function listPluginCommandIds(pluginId: string) {
  return rawCommands.filter((command) => command.pluginId === pluginId).map((command) => command.command.id);
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
  if (dependenciesDirty) {
    cachedMergedDependencies = mergeManifestDependencies(
      Array.from(pluginDependencies.entries()).map(([pluginId, dependencies]) => ({
        id: pluginId,
        dependencies,
      })),
    );
    dependenciesDirty = false;
  }

  return { ...cachedMergedDependencies };
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

function rebuildTools() {
  const generatedTools = createToolsForCommands(rawCommands, async (pluginId, commandId, params) => {
    const instance = await ensureHost();
    const execute = instance.runPluginCommand(pluginId, commandId);
    await execute(params);
  });
  pluginTools = [...ensureBuiltinPluginTools(), ...generatedTools];
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
  pluginTools = [...ensureBuiltinPluginTools()];
  notifyCommandSubscribers();

  resetPluginStatusStore();

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
  cachedMergedDependencies = {};
  dependenciesDirty = true;
  if (hadDependencies) {
    notifyDependencySubscribers();
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
    markPluginReload(entry.id);
  });

  pluginMetadata.forEach((_, pluginId) => {
    if (seen.has(pluginId)) return;
    pluginMetadata.delete(pluginId);
    changed = true;
    markPluginRemoved(pluginId);
  });

  if (changed) {
    notifyCommandSubscribers();
  }
}

function handleManifestUpdate(pluginId: string, manifest: Manifest | null) {
  if (manifest?.settingsSchema) {
    pluginSchemas.set(pluginId, manifest.settingsSchema);
  } else {
    pluginSchemas.delete(pluginId);
  }

  notifySettingsSubscribers(pluginId, manifest?.settingsSchema);

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
    cachedMergedDependencies = {};
    dependenciesDirty = true;
    notifyDependencySubscribers();
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

function refreshCommands(instance: PluginHost) {
  const commands = instance.listCommands() as HostCommand[];
  rawCommands = commands.map((command) => ({ ...command }));
  rebuildTools();
  notifyCommandSubscribers();
}

function attachHostSubscriptions(instance: PluginHost, generation: number) {
  clearHostSubscriptions();

  const unsubscribePlugins = instance.subscribePlugins((entries) => {
    if (generation !== hostGeneration) return;
    syncPluginMetadata(entries);
    refreshCommands(instance);
  });

  const unsubscribeManifests = instance.subscribeManifests(({ pluginId, manifest }) => {
    if (generation !== hostGeneration) return;
    handleManifestUpdate(pluginId, manifest);
    refreshCommands(instance);
  });

  hostUnsubscribers = [unsubscribePlugins, unsubscribeManifests];
}

function createHostInstance(): PluginHost {
  return createPluginHost({
    root: pluginsRoot,
    watch: true,
    notify(level, message) {
      recordPluginNotification(level, message);
      const type = level === "error" ? "error" : level === "warn" ? "warning" : "info";
      toaster.create({ type, title: message, duration: 5000 });
    },
  });
}

async function disposeHost(instance: PluginHost | null) {
  if (!instance) return;
  try {
    await instance.stop();
  } catch (error) {
    console.warn("[plugin-host] Failed to dispose plugin host", error);
  }
}

async function initializeHostState(instance: PluginHost, generation: number) {
  const metadataList = instance.listPlugins();
  if (generation !== hostGeneration) return;

  syncPluginMetadata(metadataList);
  refreshCommands(instance);

  const manifestPromises = metadataList.map(async ({ id }) => {
    try {
      const manifest = await instance.readPluginManifest(id);
      if (generation !== hostGeneration) return;
      handleManifestUpdate(id, manifest);
    } catch (error) {
      console.warn(`[plugin-host] Failed to read manifest for ${id}`, error);
    }
  });

  await Promise.allSettled(manifestPromises);
}

async function ensureHost(): Promise<PluginHost> {
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

export async function verifyPluginUpdate(
  pluginId: string,
  options: PluginVerificationOptions = {},
): Promise<PluginVerificationResult> {
  const { waitForReload = true, reloadTimeoutMs = 15000, afterReloadAt, selftestCommandId = "selftest" } = options;

  const initialStatus = getPluginStatusSnapshot(pluginId);
  let reloadAt = initialStatus?.lastReloadAt;

  if (waitForReload) {
    try {
      const waitResult = await waitForPluginReloadInternal(pluginId, { timeoutMs: reloadTimeoutMs, afterReloadAt });
      reloadAt = waitResult.timestamp;
    } catch (error) {
      return {
        pluginId,
        ok: false,
        phase: "reload",
        reloadAt,
        commands: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  let instance: PluginHost;
  try {
    instance = await ensureHost();
  } catch (error) {
    return {
      pluginId,
      ok: false,
      phase: "exists",
      reloadAt,
      commands: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (!instance.doesPluginExist(pluginId)) {
    return {
      pluginId,
      ok: false,
      phase: "exists",
      reloadAt,
      commands: [],
      error: "Plugin not found",
    };
  }

  const commands = instance.listPluginCommands(pluginId);
  const commandIds = commands.map((command) => command.command.id);

  let manifest: Manifest | null;
  try {
    manifest = await instance.readPluginManifest(pluginId);
  } catch (error) {
    return {
      pluginId,
      ok: false,
      phase: "manifest",
      reloadAt,
      commands: commandIds,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (!manifest) {
    return {
      pluginId,
      ok: false,
      phase: "manifest",
      reloadAt,
      commands: commandIds,
      error: "Plugin manifest unavailable after reload",
    };
  }

  if (commandIds.length === 0) {
    return {
      pluginId,
      ok: false,
      phase: "commands",
      reloadAt,
      commands: commandIds,
      error: "No commands registered for the plugin",
    };
  }

  const finalReloadAt = reloadAt ?? getPluginStatusSnapshot(pluginId)?.lastReloadAt;
  const normalizedSelftest = selftestCommandId?.trim();

  if (normalizedSelftest && commandIds.includes(normalizedSelftest)) {
    try {
      const execute = instance.runPluginCommand(pluginId, normalizedSelftest);
      const result = await execute({});
      return {
        pluginId,
        ok: true,
        phase: "selftest",
        reloadAt: finalReloadAt,
        commands: commandIds,
        result,
      };
    } catch (error) {
      return {
        pluginId,
        ok: false,
        phase: "selftest",
        reloadAt: finalReloadAt,
        commands: commandIds,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    pluginId,
    ok: true,
    phase: "loaded",
    reloadAt: finalReloadAt,
    commands: commandIds,
  };
}

function ensureBuiltinPluginTools(): Tool[] {
  if (!builtinPluginTools) {
    builtinPluginTools = createPluginTools({
      getStatus: getPluginStatusSnapshot,
      listCommands: listPluginCommandIds,
      verify: verifyPluginUpdate,
    });
  }

  return builtinPluginTools!;
}

export function waitForPluginReload(pluginId: string, options?: PluginReloadWaitOptions) {
  return waitForPluginReloadInternal(pluginId, options);
}

export function getPluginStatus(pluginId: string): PluginStatusSnapshot | undefined {
  return getPluginStatusSnapshot(pluginId);
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

export async function ensurePluginHost(): Promise<PluginHost> {
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

export async function runPluginCommand(pluginId: string, commandId: string, params?: unknown) {
  const instance = await ensureHost();
  const execute = instance.runPluginCommand(pluginId, commandId);
  await execute(params);
}

export async function readPluginSettings<T = unknown>(pluginId: string): Promise<T> {
  const instance = await ensureHost();
  return instance.readPluginSettings<T>(pluginId);
}

export async function writePluginSettings<T = unknown>(pluginId: string, value: T): Promise<void> {
  const instance = await ensureHost();
  await instance.writePluginSettings(pluginId, value);
}

export function getPluginDisplayName(pluginId: string) {
  return pluginMetadata.get(pluginId)?.name || pluginId;
}

export function getPluginsRoot() {
  return pluginsRoot;
}
