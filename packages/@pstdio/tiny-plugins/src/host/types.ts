import type { ChangeRecord } from "@pstdio/opfs-utils";
import type { Manifest, PluginMetadata, RegisteredCommand } from "../model/manifest";

export interface HostOptions {
  root?: string;
  dataRoot?: string;
  watch?: boolean;
  timeouts?: {
    activate?: number;
    deactivate?: number;
    command?: number;
  };
  notify?: (level: "info" | "warn" | "error", message: string) => void;
}

export interface PluginHost {
  start(): Promise<void>;
  stop(): Promise<void>;
  isReady(): boolean;

  listPlugins(): PluginMetadata[];
  subscribePlugins(cb: (list: PluginMetadata[]) => void): () => void;

  doesPluginExist(pluginId: string): boolean;
  listPluginCommands(pluginId: string): RegisteredCommand[];
  runPluginCommand<T = unknown>(pluginId: string, cmdId: string): (params?: unknown) => Promise<T | void>;
  readPluginSettings<T = unknown>(pluginId: string): Promise<T>;
  writePluginSettings<T = unknown>(pluginId: string, value: T): Promise<void>;
  readPluginManifest(pluginId: string): Promise<Manifest | null>;

  listCommands(): Array<RegisteredCommand & { pluginId: string }>;

  subscribePluginManifest(pluginId: string, cb: (manifest: Manifest | null) => void): () => void;
  subscribeManifests(cb: (update: { pluginId: string; manifest: Manifest | null }) => void): () => void;

  subscribePluginFiles(
    pluginId: string,
    cb: (event: { pluginId: string; changes: ChangeRecord[] }) => void,
  ): () => void;
}
