import { createPluginDataFs, createPluginFs } from "../fs";
import { createSettings } from "../settings";
import type { Emitter } from "../events";
import type { HostApi, HostApiHandlerMap, HostApiMethod, HostApiParams, HostApiResult } from "../types";
import type { Events } from "./internalTypes";

export function buildHostApi({
  root,
  dataRoot,
  pluginId,
  notify,
  emitter,
}: {
  root: string;
  dataRoot: string;
  pluginId: string;
  notify?: (level: "info" | "warn" | "error", message: string) => void;
  emitter: Emitter<Events>;
}): HostApi {
  const pfs = createPluginFs(root, pluginId);
  const settings = createSettings(createPluginDataFs(dataRoot, pluginId), (value) => {
    emitter.emit("settingsChange", { pluginId, settings: value });
  });

  const logPrefix = `[tiny-plugins:${pluginId}]`;

  const forwardLog = (level: "info" | "warn" | "error", message: string, detail?: unknown) => {
    notify?.(level, message);
    emitter.emit("status", { status: message, detail, pluginId });

    const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
    if (detail !== undefined) {
      consoleFn(`${logPrefix} ${message}`, detail);
    } else {
      consoleFn(`${logPrefix} ${message}`);
    }
  };

  const handlers: HostApiHandlerMap = {
    "fs.readFile": async ({ path }) => pfs.readFile(path),
    "fs.writeFile": async ({ path, contents }) => pfs.writeFile(path, contents),
    "fs.deleteFile": async ({ path }) => pfs.deleteFile(path),
    "fs.moveFile": async ({ from, to }) => pfs.moveFile(from, to),
    "fs.exists": async ({ path }) => pfs.exists(path),
    "fs.mkdirp": async ({ path }) => pfs.mkdirp(path),

    "log.statusUpdate": async ({ status, detail }) => {
      emitter.emit("status", { status, detail, pluginId });
    },
    "log.info": async ({ message, detail }) => {
      forwardLog("info", message, detail);
    },
    "log.warn": async ({ message, detail }) => {
      forwardLog("warn", message, detail);
    },
    "log.error": async ({ message, detail }) => {
      forwardLog("error", message, detail);
    },

    "settings.read": async () => settings.read(),
    "settings.write": async ({ value }) => settings.write(value),
  };

  const call = async <M extends HostApiMethod>(
    method: M,
    ...args: HostApiParams[M] extends undefined ? [params?: HostApiParams[M]] : [params: HostApiParams[M]]
  ): Promise<HostApiResult[M]> => {
    const handler = handlers[method];
    const params = (args.length > 0 ? args[0] : undefined) as HostApiParams[M];
    return handler(params);
  };

  return { call } satisfies HostApi;
}
