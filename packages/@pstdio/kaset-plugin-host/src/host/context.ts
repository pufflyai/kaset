import {
  deleteFile,
  grep,
  ls,
  moveFile,
  patch,
  processSingleFileContent,
  readFile,
  writeFile,
} from "@pstdio/opfs-utils";
import type { Manifest } from "../model/manifest";
import { trimLeadingSlash } from "../utils/path";
import { createEventHub } from "./events";
import { createLogger } from "./logger";
import type { PermissionChecker } from "./permissions";
import { SchedulerController } from "./scheduler";
import type { SettingsManager } from "./settings";
import type { Disposable, Events, Logger, PluginContext, Scheduler, SettingsApi, UIHostApi } from "./types";

type LsOptions = Parameters<typeof ls>[1];

const normalizeFsPath = (path: string) => {
  const cleaned = path.replace(/\\/g, "/").trim();
  if (!cleaned) return "/";
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
};

const toStoragePath = (path: string) => trimLeadingSlash(normalizeFsPath(path));

export interface UIBridge {
  notify(level: "info" | "warn" | "error", message: string): void;
  invoke(pluginId: string, commandId: string): Promise<void>;
  registerCommand(
    pluginId: string,
    definition: { id: string; title: string; category?: string; when?: string },
    handler: () => Promise<void> | void,
  ): Disposable;
  unregisterCommand(pluginId: string, commandId: string): void;
}

export interface PluginRuntime {
  context: PluginContext;
  events: Events;
  emit: Events["emit"];
  disposeEvents: () => void;
  scheduler: SchedulerController;
  logger: Logger;
}

export const createPluginRuntime = (
  manifest: Manifest,
  permissionChecker: PermissionChecker,
  settingsManager: SettingsManager,
  uiBridge: UIBridge,
  abortSignal: AbortSignal,
  netFetch?: (url: string, init?: RequestInit) => Promise<Response>,
): PluginRuntime => {
  const logger = createLogger(manifest.id);
  const scheduler = new SchedulerController(logger);
  const eventHub = createEventHub(logger);

  const expandForDirectoryCheck = (path: string) => {
    const absolute = normalizeFsPath(path);
    if (absolute === "/") return "/**";
    return absolute.endsWith("/") ? `${absolute}**` : `${absolute}/**`;
  };

  const fsApi = {
    async ls(path: string, options?: LsOptions) {
      const absolute = normalizeFsPath(path);
      permissionChecker.assertRead(expandForDirectoryCheck(absolute));
      return ls(toStoragePath(absolute), options);
    },
    async readFile(path: string) {
      const absolute = normalizeFsPath(path);
      permissionChecker.assertRead(absolute);
      return readFile(toStoragePath(absolute));
    },
    async writeFile(path: string, contents: string) {
      const absolute = normalizeFsPath(path);
      permissionChecker.assertWrite(absolute);
      await writeFile(toStoragePath(absolute), contents);
    },
    async moveFile(fromPath: string, toPath: string) {
      const fromAbsolute = normalizeFsPath(fromPath);
      const toAbsolute = normalizeFsPath(toPath);
      permissionChecker.assertWrite(fromAbsolute);
      permissionChecker.assertWrite(toAbsolute);
      await moveFile(toStoragePath(fromAbsolute), toStoragePath(toAbsolute));
    },
    async deleteFile(path: string) {
      const absolute = normalizeFsPath(path);
      permissionChecker.assertWrite(absolute);
      await deleteFile(toStoragePath(absolute));
    },
  } satisfies PluginContext["fs"];

  const settings: SettingsApi = {
    read: async <T>() => settingsManager.read<T>(manifest.id),
    write: async <T>(value: T) => settingsManager.write(manifest.id, value),
  };

  const ui: UIHostApi = {
    notify: (level, message) => uiBridge.notify(level, message),
    invoke: async (commandId: string) => uiBridge.invoke(manifest.id, commandId),
    registerCommand: (definition, handler) => uiBridge.registerCommand(manifest.id, definition, handler),
    unregisterCommand: (commandId: string) => uiBridge.unregisterCommand(manifest.id, commandId),
  };

  const net =
    netFetch && manifest.permissions?.net?.length
      ? {
          fetch: async (url: string, init?: RequestInit) => {
            permissionChecker.assertNet(url);
            return netFetch(url, init);
          },
        }
      : undefined;

  const context: PluginContext = {
    id: manifest.id,
    manifest,
    log: logger,
    fs: fsApi,
    grep,
    patch,
    processSingleFileContent,
    settings,
    ui,
    scheduler: scheduler as Scheduler,
    events: eventHub.api,
    net,
    cancelToken: abortSignal,
    disposables: [],
  };

  return {
    context,
    events: eventHub.api,
    emit: eventHub.emit,
    disposeEvents: eventHub.dispose,
    scheduler,
    logger,
  };
};
