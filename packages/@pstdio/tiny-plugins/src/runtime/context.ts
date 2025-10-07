import type { ScopedFs } from "./fs-opfs";
import { createLogger } from "./logging";
import { createNet } from "./net";
import type { Manifest } from "../model/manifest";
import type { PluginContext } from "../model/plugin";

export interface PluginContextOptions {
  pluginId: string;
  manifest: Manifest;
  fs: ScopedFs;
  notify(level: "info" | "warn" | "error", message: string): void;
  settings: {
    read<T = unknown>(): Promise<T>;
    write<T = unknown>(value: T): Promise<void>;
  };
}

export function createPluginContext(options: PluginContextOptions): PluginContext {
  const { pluginId, manifest, fs, notify, settings } = options;

  const logger = createLogger(pluginId);
  const net = createNet();

  return {
    id: pluginId,
    manifest,
    log: logger,
    commands: {
      notify(level, message) {
        notify(level, message);
      },
    },
    fs,
    net,
    settings,
  } satisfies PluginContext;
}
