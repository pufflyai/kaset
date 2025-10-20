import type { ChangeRecord } from "@pstdio/opfs-utils";

export type JSONValue = unknown;
export type JSONRecord = Record<string, JSONValue>;

/** Strict enough to be reliable; still allows unknown extra props via additionalProperties in schema */
export interface Manifest {
  id: string;
  name: string;
  version: string; // semver (validated)
  api: string; // fixed host API version string (e.g. "v1")
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
  surfaces?: unknown;
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
export type HostApiMethod =
  | "fs.readFile"
  | "fs.writeFile"
  | "fs.deleteFile"
  | "fs.moveFile"
  | "fs.exists"
  | "fs.mkdirp"
  | "log.statusUpdate"
  | "log.info"
  | "log.warn"
  | "log.error"
  | "settings.read"
  | "settings.write";

export type HostApiParams = {
  "fs.readFile": { path: string };
  "fs.writeFile": { path: string; contents: Uint8Array | string };
  "fs.deleteFile": { path: string };
  "fs.moveFile": { from: string; to: string };
  "fs.exists": { path: string };
  "fs.mkdirp": { path: string };
  "log.statusUpdate": { status: string; detail?: unknown };
  "log.info": { message: string; detail?: unknown };
  "log.warn": { message: string; detail?: unknown };
  "log.error": { message: string; detail?: unknown };
  "settings.read": undefined;
  "settings.write": { value: unknown };
};

export type HostApiResult = {
  "fs.readFile": Uint8Array;
  "fs.writeFile": void;
  "fs.deleteFile": void;
  "fs.moveFile": void;
  "fs.exists": boolean;
  "fs.mkdirp": void;
  "log.statusUpdate": void;
  "log.info": void;
  "log.warn": void;
  "log.error": void;
  "settings.read": unknown;
  "settings.write": void;
};

export type HostApiHandlerMap = {
  [M in HostApiMethod]: (params: HostApiParams[M]) => Promise<HostApiResult[M]>;
};

export interface HostApi {
  call<M extends HostApiMethod>(
    method: M,
    ...args: HostApiParams[M] extends undefined ? [params?: HostApiParams[M]] : [params: HostApiParams[M]]
  ): Promise<HostApiResult[M]>;
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
  hostApiVersion?: string; // defaults to "v1"
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
