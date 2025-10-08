import { basename, createScopedFs, joinUnderWorkspace, type ScopedFs } from "@pstdio/opfs-utils";
import { createSettingsAccessor } from "@pstdio/tiny-plugins/src/host/settings";
import type { WorkspaceFs, TinyUiOpsHandler, TinyUiOpsRequest } from "./types";

type SettingsValidator = Parameters<typeof createSettingsAccessor>[2];

const DATA_ROOT = "data";
const textDecoder = new TextDecoder();

export interface CreateIframeOpsOptions {
  pluginsRoot: string;
  pluginId: string;
  notify?(level: "info" | "warn" | "error", message: string): void;
  workspaceFs?: WorkspaceFs;
  settingsValidator?: SettingsValidator;
}

function normalizeSegment(value: string) {
  return value.replace(/^\/+/, "").replace(/\/+$/, "").trim();
}

function buildPluginRoot(pluginsRoot: string, pluginId: string) {
  const root = normalizeSegment(pluginsRoot);
  const id = normalizeSegment(pluginId);
  if (!id) throw new Error("createIframeOps requires a pluginId");
  return root ? `${root}/${id}` : id;
}

function stripDataPrefix(path: string) {
  return path.replace(/^data\/+/i, "");
}

function normalizeDataPath(path?: string) {
  const input = typeof path === "string" ? stripDataPrefix(path.replace(/^\/+/, "").trim()) : "";
  const joined = joinUnderWorkspace(DATA_ROOT, input);
  const trimmed = joined.replace(/\/+$/, "");
  return trimmed || DATA_ROOT;
}

function createDataScopedFs(fs: ScopedFs): ScopedFs {
  return {
    readFile(path: string) {
      return fs.readFile(normalizeDataPath(path));
    },
    writeFile(path: string, contents: Uint8Array | string) {
      return fs.writeFile(normalizeDataPath(path), contents);
    },
    deleteFile(path: string) {
      return fs.deleteFile(normalizeDataPath(path));
    },
    readdir(path: string = "") {
      return fs.readdir(normalizeDataPath(path));
    },
    moveFile(from: string, to: string) {
      return fs.moveFile(normalizeDataPath(from), normalizeDataPath(to));
    },
    exists(path: string) {
      return fs.exists(normalizeDataPath(path));
    },
    mkdirp(path: string) {
      return fs.mkdirp(normalizeDataPath(path));
    },
    readJSON<T = unknown>(path: string) {
      return fs.readJSON<T>(normalizeDataPath(path));
    },
    writeJSON(path: string, value: unknown, pretty?: boolean) {
      return fs.writeJSON(normalizeDataPath(path), value, pretty);
    },
  };
}

function ensureParams(value: unknown, method: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`${method} requires params object`);
  }
  return value as Record<string, unknown>;
}

function getStringParam(record: Record<string, unknown>, key: string, method: string, required = true): string | undefined {
  const raw = record[key];
  if (raw == null) {
    if (required) throw new Error(`${method} requires params.${key}`);
    return undefined;
  }
  if (typeof raw !== "string") {
    throw new Error(`${method} requires params.${key} to be a string`);
  }
  const trimmed = raw.trim();
  if (!trimmed && required) {
    throw new Error(`${method} requires params.${key} to be non-empty`);
  }
  return trimmed;
}

function ensureWorkspaceFs(fs: WorkspaceFs | undefined, method: string): WorkspaceFs {
  if (!fs) {
    throw new Error(`Tiny UI host workspace access not configured for ${method}`);
  }
  return fs;
}

function ensureNotify(notify?: (level: "info" | "warn" | "error", message: string) => void) {
  if (typeof notify === "function") return notify;
  return (level: "info" | "warn" | "error", message: string) => {
    const prefix = "[tiny-ui]";
    if (level === "error") {
      console.error(prefix, message);
    } else if (level === "warn") {
      console.warn(prefix, message);
    } else {
      console.info(prefix, message);
    }
  };
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function triggerDownload(bytes: Uint8Array, filename: string) {
  if (typeof document === "undefined") {
    throw new Error("fs.downloadFile requires a DOM environment");
  }

  const blob = new Blob([toBlobPart(bytes)]);
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "download";
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function normalizeLevel(level: string | undefined): "info" | "warn" | "error" {
  if (!level) return "info";
  const normalized = level.toLowerCase();
  if (normalized === "warn" || normalized === "warning") return "warn";
  if (normalized === "error" || normalized === "err") return "error";
  return "info";
}

export function createIframeOps(options: CreateIframeOpsOptions): TinyUiOpsHandler {
  const pluginRoot = buildPluginRoot(options.pluginsRoot, options.pluginId);
  const pluginFs = createScopedFs(pluginRoot);
  const dataFs = createDataScopedFs(pluginFs);
  const notify = ensureNotify(options.notify);
  const settings = createSettingsAccessor(dataFs, options.pluginId, options.settingsValidator);
  const workspaceFs = options.workspaceFs;

  return async function handleOps(request: TinyUiOpsRequest) {
    const method = request.method;
    switch (method) {
      case "fs.readFile": {
        const params = ensureParams(request.params, method);
        const path = getStringParam(params, "path", method);
        return dataFs.readFile(path!);
      }

      case "fs.writeFile": {
        const params = ensureParams(request.params, method);
        const path = getStringParam(params, "path", method)!;
        const data = params.data;
        if (!(data instanceof Uint8Array) && typeof data !== "string") {
          throw new Error("fs.writeFile requires params.data to be a string or Uint8Array");
        }
        await dataFs.writeFile(path, data);
        return { ok: true };
      }

      case "fs.ls": {
        const params = request.params && typeof request.params === "object" ? (request.params as Record<string, unknown>) : {};
        const dir = getStringParam(params, "dir", method, false);
        return dataFs.readdir(dir ?? "");
      }

      case "fs.deleteFile": {
        const params = ensureParams(request.params, method);
        const path = getStringParam(params, "path", method)!;
        await dataFs.deleteFile(path);
        return { ok: true };
      }

      case "fs.downloadFile": {
        const params = ensureParams(request.params, method);
        const path = getStringParam(params, "path", method)!;
        const bytes = await dataFs.readFile(path);
        const filename = getStringParam(params, "filename", method, false) ?? basename(path);
        triggerDownload(bytes, filename || "download");
        return { ok: true };
      }

      case "workspace.read": {
        const params = ensureParams(request.params, method);
        const path = getStringParam(params, "path", method)!;
        const fs = ensureWorkspaceFs(workspaceFs, method);
        const bytes = await fs.readFile(path);
        return textDecoder.decode(bytes);
      }

      case "workspace.readFile": {
        const params = ensureParams(request.params, method);
        const path = getStringParam(params, "path", method)!;
        const fs = ensureWorkspaceFs(workspaceFs, method);
        return fs.readFile(path);
      }

      case "settings.read": {
        return settings.read();
      }

      case "settings.write": {
        const params = ensureParams(request.params, method);
        if (!("value" in params)) {
          throw new Error("settings.write requires params.value");
        }
        await settings.write(params.value);
        return { ok: true };
      }

      case "commands.notify": {
        const params = ensureParams(request.params, method);
        const level = normalizeLevel(getStringParam(params, "level", method, false));
        const message = getStringParam(params, "message", method) ?? "";
        notify(level, message);
        return { ok: true };
      }

      default:
        throw new Error(`Unknown Tiny-UI ops method: ${method}`);
    }
  };
}
