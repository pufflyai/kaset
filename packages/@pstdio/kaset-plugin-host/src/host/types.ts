import type { JSONSchema } from "../model/manifest";
import type { RegisteredCommand, UIAdapter } from "./context";

export interface HostConfig {
  pluginsRoot?: string;
  watchPlugins?: boolean;
  ui?: UIAdapter;
  netFetch?: (url: string, init?: RequestInit) => Promise<Response>;
  timeouts?: {
    command?: number;
    activate?: number;
    deactivate?: number;
  };
}

export interface PluginHost {
  loadAll(): Promise<void>;
  unloadAll(): Promise<void>;
  reloadPlugin(id: string): Promise<void>;
  invokeCommand(pluginId: string, commandId: string, params?: unknown): Promise<void>;
  listCommands(): RegisteredCommand[];
  emit(name: string, payload?: unknown): void;
  getSettingsSchema(pluginId: string): JSONSchema | undefined;
  readSettings<T = unknown>(pluginId: string): Promise<T>;
  writeSettings<T = unknown>(pluginId: string, value: T): Promise<void>;
}
