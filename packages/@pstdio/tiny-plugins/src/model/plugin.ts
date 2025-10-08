import type { Manifest } from "./manifest";

export interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface PluginContext {
  id: string;
  manifest: Manifest;
  log: Logger;
  commands: {
    notify(level: "info" | "warn" | "error", message: string): void;
  };
  fs: {
    readFile(path: string): Promise<Uint8Array>;
    writeFile(path: string, contents: Uint8Array | string): Promise<void>;
    deleteFile(path: string): Promise<void>;
    moveFile(from: string, to: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdirp(path: string): Promise<void>;
    readJSON<T = unknown>(path: string): Promise<T>;
    writeJSON(path: string, value: unknown, pretty?: boolean): Promise<void>;
  };
  net: {
    fetch(url: string, init?: RequestInit): Promise<Response>;
  };
  settings: {
    read<T = unknown>(): Promise<T>;
    write<T = unknown>(value: T): Promise<void>;
  };
}

export type CommandHandler = (ctx: PluginContext, params?: unknown) => Promise<unknown | void> | unknown;

export interface Plugin {
  activate(ctx: PluginContext): Promise<void> | void;
  deactivate?(): Promise<void> | void;
}

export interface PluginModule {
  default?: Plugin;
  commands?: Record<string, CommandHandler>;
}
