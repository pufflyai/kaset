import type { Manifest } from "./manifest";
import type { PluginContext } from "../host/context";

export interface Plugin {
  activate(ctx: PluginContext): Promise<void> | void;
  deactivate?(): Promise<void> | void;
}

export interface PluginModule {
  default?: Plugin;
  commands?: Record<string, (ctx: PluginContext) => Promise<void> | void>;
  [key: string]: unknown;
}

export interface LoadedPluginMeta {
  manifest: Manifest;
  module: PluginModule;
  plugin: Plugin;
}
