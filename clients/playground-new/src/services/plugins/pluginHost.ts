import { toaster } from "@/components/ui/toaster";
import { ROOT } from "@/constant";
import {
  createPluginHost,
  type HostConfig,
  type JSONSchema,
  type PluginHost,
  type RegisteredCommand,
} from "@pstdio/kaset-plugin-host";
import { deleteFile, getDirectoryHandle, readFile, writeFile } from "@pstdio/opfs-utils";
import type { Tool } from "@pstdio/tiny-ai-tasks";

const DEFAULT_PLUGINS_ROOT = `${ROOT}/plugins`;

type PluginMetadata = {
  id: string;
  name?: string;
  version?: string;
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

function notifyCommandSubscribers() {
  const snapshot = decoratedCommands.map((cmd) => ({ ...cmd }));
  commandSubscribers.forEach((listener) => listener(snapshot));
}

function notifySettingsSubscribers(pluginId: string, schema?: JSONSchema) {
  settingsSubscribers.forEach((listener) => listener(pluginId, schema));
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

async function loadManifestMetadata(pluginId: string) {
  if (pluginMetadata.has(pluginId)) return;

  try {
    const manifestRaw = await readFile(`${pluginsRoot}/${pluginId}/manifest.json`);
    const manifest = JSON.parse(manifestRaw) as Partial<PluginMetadata> & { name?: string; version?: string };
    pluginMetadata.set(pluginId, {
      id: manifest.id ?? pluginId,
      name: manifest.name,
      version: manifest.version,
    });
  } catch (error) {
    // Cache fallback metadata to avoid repeated reads.
    pluginMetadata.set(pluginId, { id: pluginId });
    console.warn(`[plugin-host] Failed to read manifest for ${pluginId}`, error);
  }

  rebuildDecoratedCommands();
  notifyCommandSubscribers();
}

function handleCommandsChanged(next: RegisteredCommand[]) {
  rawCommands = next;
  rebuildTools();
  rebuildDecoratedCommands();
  notifyCommandSubscribers();

  const pluginIds = new Set(next.map((cmd) => cmd.pluginId));
  pluginIds.forEach((id) => {
    void loadManifestMetadata(id);
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
          void loadManifestMetadata(pluginId);
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
  return () => commandSubscribers.delete(listener);
}

export function subscribeToPluginSettings(listener: SettingsListener) {
  settingsSubscribers.add(listener);
  pluginSchemas.forEach((schema, pluginId) => listener(pluginId, schema));
  return () => settingsSubscribers.delete(listener);
}

export function getPluginSettingsEntries() {
  return Array.from(pluginSchemas.entries()).map(([pluginId, schema]) => ({ pluginId, schema }));
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
