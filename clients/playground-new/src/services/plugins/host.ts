import { toaster } from "@/components/ui/toaster";
import { PLUGIN_DATA_ROOT, PLUGIN_ROOT } from "@/constant";
import {
  createPluginHostRuntime,
  usePluginHost as usePluginHostRuntimeHook,
  type PluginCommand,
  type PluginFilesEvent,
  type PluginHostRuntime,
  type PluginSettingsSchema,
  type PluginSurfacesSnapshot,
} from "@pstdio/tiny-plugins";

const runtime: PluginHostRuntime = createPluginHostRuntime({
  root: PLUGIN_ROOT,
  dataRoot: PLUGIN_DATA_ROOT,
  watch: true,
  notify(level, message) {
    const type = level === "error" ? "error" : level === "warn" ? "warning" : "info";
    toaster.create({ type, title: message, duration: 5000 });
  },
});

export const pluginHostRuntime = runtime;

export const ensurePluginHost = () => runtime.ensureHost();
export const isPluginHostReady = () => runtime.isReady();
export const getPluginsRoot = () => runtime.getPluginsRoot();
export const setPluginsRoot = (root: string) => runtime.setPluginsRoot(root);

export const getPluginCommands = (): PluginCommand[] => runtime.getPluginCommands();
export const getPluginTools = () => runtime.getPluginTools();

export const subscribeToPluginCommands = (listener: (commands: PluginCommand[]) => void) =>
  runtime.subscribeToPluginCommands(listener);

export const subscribeToPluginSettings = (listener: (pluginId: string, schema?: PluginSettingsSchema) => void) =>
  runtime.subscribeToPluginSettings(listener);

export const getPluginSettingsEntries = () => runtime.getPluginSettingsEntries();

export const subscribeToPluginSurfaces = (listener: (snapshot: PluginSurfacesSnapshot) => void) =>
  runtime.subscribeToPluginSurfaces(listener);

export const getPluginSurfacesSnapshot = () => runtime.getPluginSurfaces();

export const getMergedPluginDependencies = () => runtime.getMergedPluginDependencies();
export const subscribeToPluginDependencies = (listener: (dependencies: Record<string, string>) => void) =>
  runtime.subscribeToPluginDependencies(listener);

export const runPluginCommand = (pluginId: string, commandId: string, params?: unknown) =>
  runtime.runCommand(pluginId, commandId, params);

export const readPluginSettings = <T = unknown>(pluginId: string) => runtime.readSettings<T>(pluginId);
export const writePluginSettings = <T = unknown>(pluginId: string, value: T) =>
  runtime.writeSettings<T>(pluginId, value);

export const getPluginDisplayName = (pluginId: string) => runtime.getPluginDisplayName(pluginId);
export const getPluginManifest = (pluginId: string) => runtime.getPluginManifest(pluginId);

type PluginFilesListener = (event: PluginFilesEvent) => void;

export const subscribeToPluginFiles = (pluginId: string, listener: PluginFilesListener) =>
  runtime.subscribeToPluginFiles(pluginId, listener);

export function usePluginHost() {
  return usePluginHostRuntimeHook(runtime);
}

export type { PluginSurfacesSnapshot };
