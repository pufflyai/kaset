import type { ChangeRecord } from "@pstdio/opfs-utils";

export type JSONValue = unknown;
export type JSONRecord = Record<string, JSONValue>;

/** Strict enough to be reliable; still allows unknown extra props via additionalProperties in schema */
export interface Manifest {
  id: string;
  name: string;
  version: string; // semver (validated)
  api: string; // semver range or single version (validated for compatibility)
  entry: string; // module file path within plugin root

  description?: string;
  dependencies?: Record<string, string>;
  commands?: Array<{
    id: string;
    title: string;
    description?: string;
    category?: string;
    when?: string;
    parameters?: unknown; // not enforced by core
    timeoutMs?: number;
  }>;
  settingsSchema?: unknown; // accepted but not enforced by core
  ui?: unknown;
  surfaces?: Record<string, unknown>;
}

export interface CommandDefinition {
  id: string;
  title: string;
  description?: string;
  category?: string;
  when?: string;
  parameters?: unknown;
  timeoutMs?: number;
}

export interface PluginMetadata {
  id: string;
  name?: string;
  version?: string;
}

export interface PluginModule {
  default?: {
    activate(ctx: PluginContext): Promise<void> | void;
    deactivate?(): Promise<void> | void;
  };
  commands?: Record<string, (ctx: PluginContext, params?: unknown) => Promise<unknown | void> | unknown>;
}

/** One flat, namespaced host API (the exact shape you asked for). */
export interface HostApi {
  // FS
  "fs.readFile"(params: { path: string }): Promise<Uint8Array>;
  "fs.writeFile"(params: { path: string; contents: Uint8Array | string }): Promise<void>;
  "fs.deleteFile"(params: { path: string }): Promise<void>;
  "fs.moveFile"(params: { from: string; to: string }): Promise<void>;
  "fs.exists"(params: { path: string }): Promise<boolean>;
  "fs.mkdirp"(params: { path: string }): Promise<void>;

  // Notifications
  "log.statusUpdate"(params: { status: string; detail?: unknown }): Promise<void>;
  "log.info"(params: { message: string; detail?: unknown }): Promise<void>;
  "log.warn"(params: { message: string; detail?: unknown }): Promise<void>;
  "log.error"(params: { message: string; detail?: unknown }): Promise<void>;

  // Settings
  "settings.read"<T = unknown>(params?: Record<string, never>): Promise<T>;
  "settings.write"<T = unknown>(params: { value: T }): Promise<void>;
}

/** Plugin receives only its identity, validated manifest, and the host API. */
export interface PluginContext {
  id: string;
  manifest: Manifest;
  api: HostApi;
}

export interface HostOptions {
  root?: string; // PLUGIN_ROOT (defaults to "plugins")
  dataRoot?: string; // PLUGIN_DATA_ROOT (defaults to "plugin_data")
  hostApiVersion?: string; // defaults to "1.0.0"
  watch?: boolean;
  notify?: (level: "info" | "warn" | "error", message: string) => void;
  defaultTimeoutMs?: number;
}

export type PluginChangePayload = {
  /** changed file paths (relative to plugin root). Can be empty on initial load */
  paths: string[];
  manifest: Manifest | null;
  /** full file list snapshot (relative) */
  files: string[];
  /** raw change records from the watcher (when available) */
  changes?: ChangeRecord[];
};

export type StatusUpdate = { pluginId?: string; status: string; detail?: unknown };
