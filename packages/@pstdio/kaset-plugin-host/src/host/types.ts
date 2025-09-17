import type { ls } from "@pstdio/opfs-utils";
import type { Manifest } from "../model/manifest";

type OpfsLs = typeof ls;

export interface Disposable {
  dispose(): void | Promise<void>;
}

export interface FSApi {
  ls: (...args: Parameters<OpfsLs>) => ReturnType<OpfsLs>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  moveFile(fromPath: string, toPath: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
}

export type Grep = (typeof import("@pstdio/opfs-utils"))["grep"];
export type Patch = (typeof import("@pstdio/opfs-utils"))["patch"];
export type ProcessSingleFileContent = (typeof import("@pstdio/opfs-utils"))["processSingleFileContent"];

export interface SettingsApi {
  read<T = unknown>(): Promise<T>;
  write<T = unknown>(value: T): Promise<void>;
}

export interface UIHostApi {
  notify?(level: "info" | "warn" | "error", message: string): void;
  invoke(commandId: string): Promise<void>;
  registerCommand(
    definition: { id: string; title: string; category?: string; when?: string },
    handler: () => Promise<void> | void,
  ): Disposable;
  unregisterCommand(commandId: string): void;
}

export interface Scheduler {
  registerCron(expr: string, callback: () => void | Promise<void>): Disposable;
  setTimeout(callback: () => void | Promise<void>, delayMs: number): Disposable;
  setInterval(callback: () => void | Promise<void>, intervalMs: number): Disposable;
}

export type EventListener = (payload: unknown) => void | Promise<void>;

export interface Events {
  on(name: string, listener: EventListener): Disposable;
  off(name: string, listener: EventListener): void;
  emit(name: string, payload?: unknown): void;
}

export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface PluginContext {
  id: string;
  manifest: Manifest;
  log: Logger;
  fs: FSApi;
  grep: Grep;
  patch: Patch;
  processSingleFileContent: ProcessSingleFileContent;
  settings: SettingsApi;
  ui: UIHostApi;
  scheduler: Scheduler;
  events: Events;
  net?: { fetch: (url: string, init?: RequestInit) => Promise<Response> };
  cancelToken: AbortSignal;
  disposables: Disposable[];
}

export type AppEventUnsubscribe = () => void;

export interface AppEvents {
  on(name: string, listener: (payload: unknown) => void): AppEventUnsubscribe | void;
}

export interface RegisteredEventEmitter {
  emit(name: string, payload?: unknown): void;
}

export interface SettingsValidationErrorDetail {
  message: string;
  path: string;
}

export class SettingsValidationError extends Error {
  details: SettingsValidationErrorDetail[];

  constructor(message: string, details: SettingsValidationErrorDetail[]) {
    super(message);
    this.name = "SettingsValidationError";
    this.details = details;
  }
}
