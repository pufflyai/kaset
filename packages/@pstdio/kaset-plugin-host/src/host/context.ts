import type { Manifest } from "../model/manifest";

export interface Disposable {
  dispose(): void | Promise<void>;
}

export interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface FSApi {
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
}

export interface SettingsApi {
  read<T = unknown>(): Promise<T>;
  write<T = unknown>(value: T): Promise<void>;
}

export type NotificationLevel = "info" | "warn" | "error";

export interface UIHostApi {
  notify?(level: NotificationLevel, message: string): void;
  invoke(commandId: string): Promise<void>;
}

export type EventListener = (payload?: unknown) => void | Promise<void>;

export interface EventsApi {
  on(event: string, listener: EventListener): Disposable;
  off(event: string, listener: EventListener): void;
  emit(event: string, payload?: unknown): void;
}

export interface PluginContext {
  id: string;
  manifest: Manifest;
  log: Logger;
  fs: FSApi;
  settings: SettingsApi;
  ui: UIHostApi;
  events: EventsApi;
  net?: { fetch: (url: string, init?: RequestInit) => Promise<Response> };
  cancelToken: AbortSignal;
  disposables: Array<Disposable | (() => void | Promise<void>)>;
}

export type CommandHandler = (ctx: PluginContext) => Promise<void> | void;

export interface RegisteredCommand {
  pluginId: string;
  id: string;
  title: string;
  category?: string;
  when?: string;
  run: () => Promise<void>;
}

export interface UIAdapter {
  onCommandsChanged(commands: RegisteredCommand[]): void;
  notify?(level: NotificationLevel, message: string): void;
  onSettingsSchema?(pluginId: string, schema?: Record<string, unknown>): void;
}
