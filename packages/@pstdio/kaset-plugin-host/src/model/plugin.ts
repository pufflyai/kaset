import type { Manifest } from "./manifest";
import type { CommandHandler, PluginContext } from "../host/context";

export interface Plugin {
  activate(ctx: PluginContext): Promise<void> | void;
  deactivate?(): Promise<void> | void;
}

export interface PluginModule {
  default?: Plugin;
  commands?: Record<string, CommandHandler>;
  [key: string]: unknown;
}

export interface LoadedPluginMeta {
  manifest: Manifest;
  module: PluginModule;
  plugin: Plugin;
}
