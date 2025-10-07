import type { ValidateFunction } from "ajv";
import { parse, satisfies, validRange } from "semver";
import { createPluginContext } from "../runtime/context";
import { createScopedFs } from "../runtime/fs-opfs";
import type { Manifest, RegisteredCommand } from "../model/manifest";
import type { Plugin, PluginModule } from "../model/plugin";
import { CommandRegistry, type RegisterCommandOptions } from "./commands";
import { apiIncompatible, importFailed, manifestParseError, manifestUiInvalid } from "./errors";
import { createSettingsAccessor, type SettingsAccessor } from "./settings";
import { runWithTimeout } from "./timers";
import type { JSONSchema } from "../model/manifest";

export interface Timeouts {
  activate: number;
  deactivate: number;
  command: number;
}

export interface LoadedPlugin {
  id: string;
  manifest: Manifest;
  module: PluginModule;
  plugin: Plugin;
  objectUrl: string;
  abort: AbortController;
  commands: RegisteredCommand[];
  fsRoot: string;
  contextSettings: SettingsAccessor;
  settingsValidator?: ValidateFunction;
}

type AjvLike = { compile(schema: unknown): ValidateFunction };

export interface LoadPluginOptions {
  pluginId: string;
  pluginsRoot: string;
  registry: CommandRegistry;
  manifestValidator: ValidateFunction;
  uiValidator: ValidateFunction;
  ajv: AjvLike;
  timeouts: Timeouts;
  hostApiVersion: string;
  notify(level: "info" | "warn" | "error", message: string): void;
  warn(message: string): void;
}

const MANIFEST_FILE = "manifest.json";

function joinRoot(root: string, pluginId: string) {
  return [root, pluginId].filter(Boolean).join("/");
}

function toText(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

function isApiCompatible(pluginApi: string, hostApi: string): boolean {
  const range = pluginApi.trim();
  if (validRange(range, { loose: true })) {
    return satisfies(hostApi, range, { loose: true });
  }

  const parsedPlugin = parse(range, { loose: true });
  const parsedHost = parse(hostApi, { loose: true });
  if (!parsedPlugin || !parsedHost) return false;
  return parsedPlugin.major === parsedHost.major;
}

function compileSettingsSchema(
  ajv: AjvLike,
  schema: JSONSchema | undefined,
  warn: (message: string) => void,
): ValidateFunction | undefined {
  if (!schema) return undefined;
  try {
    return ajv.compile(schema) as ValidateFunction;
  } catch (error) {
    warn(`Failed to compile settings schema: ${(error as Error).message}`);
    return undefined;
  }
}

export async function loadPlugin(options: LoadPluginOptions): Promise<LoadedPlugin> {
  const {
    pluginId,
    pluginsRoot,
    registry,
    manifestValidator,
    uiValidator,
    ajv,
    timeouts,
    hostApiVersion,
    notify,
    warn,
  } = options;

  const pluginRoot = joinRoot(pluginsRoot, pluginId);
  const fs = createScopedFs(pluginRoot);
  const manifestPath = `${pluginRoot}/${MANIFEST_FILE}`;

  let manifestText: string;
  try {
    const bytes = await fs.readFile(MANIFEST_FILE);
    manifestText = toText(bytes);
  } catch (error) {
    throw manifestParseError(manifestPath, (error as Error).message);
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(manifestText) as Manifest;
  } catch (error) {
    throw manifestParseError(manifestPath, (error as Error).message);
  }

  if (!manifestValidator(manifest)) {
    throw manifestParseError(manifestPath, "Manifest schema validation failed", manifestValidator.errors);
  }

  if (manifest.id !== pluginId) {
    throw manifestParseError(manifestPath, `Manifest id "${manifest.id}" does not match directory name "${pluginId}"`);
  }

  if (!isApiCompatible(manifest.api, hostApiVersion)) {
    throw apiIncompatible(pluginId, manifest.api, hostApiVersion);
  }

  if (manifest.ui) {
    const validUI = uiValidator(manifest.ui);
    if (!validUI) {
      throw manifestUiInvalid(pluginId, uiValidator.errors);
    }

    const desktopEntry = manifest.ui.desktop?.entry;
    if (desktopEntry) {
      const entryExists = await fs.exists(desktopEntry);
      if (!entryExists) {
        throw manifestUiInvalid(pluginId, [{ message: `UI entry not found: ${desktopEntry}` }]);
      }
    }

    const defaultSize = manifest.ui.desktop?.defaultSize;
    const minSize = manifest.ui.desktop?.minSize;
    if (defaultSize && minSize) {
      const fits =
        Number.isFinite(defaultSize.width) &&
        Number.isFinite(defaultSize.height) &&
        Number.isFinite(minSize.width) &&
        Number.isFinite(minSize.height) &&
        minSize.width <= defaultSize.width &&
        minSize.height <= defaultSize.height;

      if (!fits) {
        throw manifestUiInvalid(pluginId, [{ message: "desktop size constraints are invalid" }]);
      }
    }
  }

  const entryBytes = await fs.readFile(manifest.entry);
  const entryCode = toText(entryBytes);
  const blob = new Blob([entryCode], { type: "text/javascript" });
  const objectUrl = URL.createObjectURL(blob);

  let module: PluginModule;
  try {
    module = (await import(/* @vite-ignore */ objectUrl)) as PluginModule;
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw importFailed(pluginId, manifest.entry, error);
  }

  const plugin: Plugin = module?.default ?? (module as unknown as Plugin);
  if (!plugin || typeof plugin.activate !== "function") {
    URL.revokeObjectURL(objectUrl);
    throw importFailed(pluginId, manifest.entry, new Error("Plugin default export must implement activate"));
  }

  const abort = new AbortController();
  const settingsValidator = compileSettingsSchema(ajv, manifest.settingsSchema, warn);
  const settings = createSettingsAccessor(fs, pluginId, settingsValidator);

  const context = createPluginContext({
    pluginId,
    manifest,
    fs,
    notify,
    settings,
  });

  try {
    await runWithTimeout(() => plugin.activate(context), timeouts.activate, abort.signal);
  } catch (error) {
    abort.abort();
    URL.revokeObjectURL(objectUrl);
    throw error;
  }

  const commandOptions: RegisterCommandOptions = {
    pluginId,
    definitions: manifest.commands,
    handlers: module.commands,
    context,
    abortSignal: abort.signal,
    defaultTimeout: timeouts.command,
    ajv,
    warn,
  };

  const commands = registry.register(commandOptions);

  return {
    id: pluginId,
    manifest,
    module,
    plugin,
    objectUrl,
    abort,
    commands,
    fsRoot: pluginRoot,
    contextSettings: settings,
    settingsValidator,
  } satisfies LoadedPlugin;
}

export async function unloadPlugin(plugin: LoadedPlugin, registry: CommandRegistry, timeouts: Timeouts) {
  registry.unregister(plugin.id);
  plugin.abort.abort();

  try {
    if (typeof plugin.plugin.deactivate === "function") {
      await runWithTimeout(() => plugin.plugin.deactivate?.(), timeouts.deactivate);
    }
  } catch (error) {
    console.warn(`[tiny-plugins] Plugin ${plugin.id} deactivate failed`, error);
  }

  URL.revokeObjectURL(plugin.objectUrl);
}
