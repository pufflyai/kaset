import { createScopedFs, joinUnderWorkspace, ls, normalizeRelPath, normalizeSegments } from "@pstdio/opfs-utils";
import { createPluginDataFs, createPluginFs } from "../fs";
import { createSettings } from "../settings";
import type { Emitter } from "../events";
import type { FsScope, HostApi, HostApiHandlerMap, HostApiMethod, HostApiParams, HostApiResult } from "../types";
import { pluginDataPath, pluginRootPath } from "./utils";
import type { Events } from "./internalTypes";

export function buildHostApi({
  root,
  dataRoot,
  workspaceRoot,
  pluginId,
  notify,
  emitter,
}: {
  root: string;
  dataRoot: string;
  workspaceRoot: string;
  pluginId: string;
  notify?: (level: "info" | "warn" | "error", message: string) => void;
  emitter: Emitter<Events>;
}): HostApi {
  const pluginBase = normalizeSegments(pluginRootPath(root, pluginId)).join("/");
  const dataBase = normalizeSegments(pluginDataPath(dataRoot, pluginId)).join("/");
  const workspaceBase = normalizeSegments(workspaceRoot).join("/");

  const pfs = createPluginFs(root, pluginId);
  const dataFs = createPluginDataFs(dataRoot, pluginId);
  const workspaceFs = createScopedFs(workspaceBase);

  const settings = createSettings(dataFs, (value) => {
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

  const getScopeBase = (scope: FsScope | undefined) => {
    if (scope === "data") return dataBase;
    if (scope === "workspace") return workspaceBase;
    return pluginBase;
  };

  const getFsForScope = (scope: FsScope | undefined) => {
    if (scope === "data") return dataFs;
    if (scope === "workspace") return workspaceFs;
    return pfs;
  };

  const assertWritableScope = (scope: FsScope | undefined) => {
    if (scope === "workspace") {
      throw new Error("Workspace scope does not support write operations");
    }
  };

  const resolveAbsolutePath = (scope: FsScope | undefined, input?: string) => {
    const base = getScopeBase(scope);
    if (!input) return base;

    const trimmed = `${input}`.trim();
    if (!trimmed) return base;

    const normalizedInput = normalizeSegments(trimmed).join("/");
    if (!base) return normalizedInput;
    if (normalizedInput === base || normalizedInput.startsWith(`${base}/`)) {
      return normalizedInput;
    }

    if (scope === "workspace") {
      if (workspaceBase && (normalizedInput === workspaceBase || normalizedInput.startsWith(`${workspaceBase}/`))) {
        return normalizedInput;
      }
    }

    const relative = normalizeRelPath(trimmed);
    if (!relative) return base;

    const targetBase = scope === "workspace" ? workspaceBase : base;
    const joined = joinUnderWorkspace(targetBase, relative);
    return normalizeSegments(joined).join("/");
  };

  const toRelativePath = (scope: FsScope | undefined, absolute: string) => {
    const base = getScopeBase(scope);
    const normalizedAbsolute = normalizeSegments(absolute).join("/");
    if (!base) return normalizedAbsolute;
    if (normalizedAbsolute === base) return "";
    if (normalizedAbsolute.startsWith(`${base}/`)) {
      return normalizedAbsolute.slice(base.length + 1);
    }
    throw new Error(`Path '${absolute}' is outside of the ${scope ?? "plugin"} scope`);
  };

  const handlers: HostApiHandlerMap = {
    "fs.readFile": async ({ path, scope }) => {
      const absolute = resolveAbsolutePath(scope, path);
      const relative = toRelativePath(scope, absolute);
      return getFsForScope(scope).readFile(relative);
    },
    "fs.writeFile": async ({ path, contents, scope }) => {
      assertWritableScope(scope);
      const absolute = resolveAbsolutePath(scope, path);
      const relative = toRelativePath(scope, absolute);
      await getFsForScope(scope).writeFile(relative, contents);
    },
    "fs.deleteFile": async ({ path, scope }) => {
      assertWritableScope(scope);
      const absolute = resolveAbsolutePath(scope, path);
      const relative = toRelativePath(scope, absolute);
      await getFsForScope(scope).deleteFile(relative);
    },
    "fs.moveFile": async ({ from, to, scope }) => {
      assertWritableScope(scope);
      const absoluteFrom = resolveAbsolutePath(scope, from);
      const absoluteTo = resolveAbsolutePath(scope, to);
      const fs = getFsForScope(scope);
      await fs.moveFile(toRelativePath(scope, absoluteFrom), toRelativePath(scope, absoluteTo));
    },
    "fs.exists": async ({ path, scope }) => {
      const absolute = resolveAbsolutePath(scope, path);
      const relative = toRelativePath(scope, absolute);
      return getFsForScope(scope).exists(relative);
    },
    "fs.mkdirp": async ({ path, scope }) => {
      assertWritableScope(scope);
      const absolute = resolveAbsolutePath(scope, path);
      const relative = toRelativePath(scope, absolute);
      await getFsForScope(scope).mkdirp(relative);
    },
    "fs.ls": async ({ path, scope, options }) => {
      const absolute = resolveAbsolutePath(scope, path);
      return await ls(absolute, options ?? {});
    },
    "fs.getScopeRoot": async ({ scope }) => getScopeBase(scope),

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
