import type { PluginContext } from "../host/types";

export interface PluginModule {
  default: Plugin;
  commands?: Record<string, PluginCommand>;
}

export type PluginCommand = (ctx: PluginContext) => void | Promise<void>;

export interface Plugin {
  activate(ctx: PluginContext): Promise<void> | void;
  deactivate?(): Promise<void> | void;
}
