const CHANNEL_NAME = "file-explorer:open-folder";
const ROOT_FOLDER = "playground";

const normalizePathInput = (value) => {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalized = trimmed.replace(/\\/g, "/").replace(/\/+/g, "/");
  const parts = normalized.split("/").filter(Boolean);

  if (parts.some((part) => part === "..")) {
    throw new Error("fileExplorer.openFolder does not allow traversing outside the workspace");
  }

  const rootParts = ROOT_FOLDER.split("/").filter(Boolean);
  const hasRootPrefix = rootParts.length > 0 && rootParts.every((part, index) => parts[index] === part);

  const resolvedParts = hasRootPrefix ? parts : [...rootParts, ...parts];

  if (resolvedParts.length === 0) return rootParts.join("/");
  return resolvedParts.join("/");
};

const extractPath = (params) => {
  if (typeof params === "string") return params;
  if (params && typeof params === "object" && typeof params.path === "string") {
    return params.path;
  }
  return "";
};

const notifyChannel = (path) => {
  if (typeof BroadcastChannel === "undefined") return false;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: "open-folder", path });
    channel.close();
    return true;
  } catch (error) {
    ctx.api.call("log.warn", { message: "[file-explorer] Failed to notify window via BroadcastChannel" });
    return false;
  }
};

export const commands = {
  async "fileExplorer.openFolder"(ctx, params) {
    const input = extractPath(params);

    if (typeof input !== "string" || !input.trim()) {
      throw new Error("fileExplorer.openFolder requires params.path");
    }

    const normalized = normalizePathInput(input);

    const delivered = notifyChannel(normalized);

    if (!delivered) {
      const message = normalized ? `Open File Explorer manually to view ${normalized}` : "Open File Explorer manually";
      await ctx.api.call("log.warn", { message });
    }
  },
};

export default {
  async activate(ctx) {
    await ctx.api.call("log.info", { message: "File Explorer plugin activated" });
  },
};
