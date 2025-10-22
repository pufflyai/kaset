import type { Connection } from "rimless";
import type {
  HostOptions,
  Manifest,
  PluginChangePayload,
  PluginContext,
  PluginMetadata,
  PluginModule,
  StatusUpdate,
} from "../types";
import type { Emitter } from "../events";
import type { CommandRegistry } from "../commands";

export type Events = {
  pluginChange: { pluginId: string; payload: PluginChangePayload };
  dependencyChange: { deps: Record<string, string> };
  settingsChange: { pluginId: string; settings: unknown };
  status: StatusUpdate;
  error: Error;
  pluginsChange: { plugins: PluginMetadata[] };
};

export type WorkerRemoteSchema = {
  init(payload: { pluginId: string; manifest: Manifest; moduleUrl: string }): Promise<{ commandIds: string[] }>;
  runCommand(payload: { commandId: string; params?: unknown }): Promise<unknown>;
  shutdown(): Promise<void>;
};

export type WorkerConnection = Connection & { remote: WorkerRemoteSchema };

export interface WorkerBridge {
  init(manifest: Manifest, moduleUrl: string): Promise<{ commandIds: string[] }>;
  runCommand(commandId: string, params?: unknown): Promise<unknown>;
  shutdown(): Promise<void>;
  close(): void;
}

export type NotifyFn = NonNullable<HostOptions["notify"]>;

export type CleanupFn = () => void | Promise<void>;

export type HostState = {
  manifest: Manifest | null;
  moduleUrl?: string;
  module?: PluginModule;
  plugin?: PluginModule["default"];
  watcherCleanup?: CleanupFn;
  ctx?: PluginContext;
  worker?: WorkerBridge;
};

export interface HostRuntime {
  root: string;
  dataRoot: string;
  workspaceRoot: string;
  watch: boolean;
  notify?: NotifyFn;
  hostApiVersion: string;
  workerEnabled: boolean;

  emitter: Emitter<Events>;
  commands: CommandRegistry;
  states: Map<string, HostState>;
}

export interface LifecycleHooks {
  emitStatus: (status: string, pluginId?: string, detail?: unknown) => void;
  emitError: (err: Error) => void;
  emitPluginsChange: () => void;
  emitDependenciesChanged: () => void;
}
