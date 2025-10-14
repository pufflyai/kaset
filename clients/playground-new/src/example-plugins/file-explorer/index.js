const CHANNEL_NAME = "file-explorer:open-folder";
const STATE_FILE = "data/state.json";

const normalizePathInput = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/\\/g, "/").replace(/\/+/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => part === "..")) {
    throw new Error("fileExplorer.openFolder does not allow traversing outside the workspace");
  }
  return parts.join("/");
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
    console.warn("[file-explorer] Failed to notify window via BroadcastChannel", error);
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

    await ctx.fs.writeJSON(STATE_FILE, {
      lastOpenedFolder: normalized,
      updatedAt: new Date().toISOString(),
    });

    const delivered = notifyChannel(normalized);
    if (!delivered) {
      ctx.commands?.notify?.(
        "warn",
        normalized ? `Open File Explorer manually to view ${normalized}` : "Open File Explorer manually",
      );
    }
  },
};

export default {
  async activate({ log }) {
    log.info("File Explorer plugin activated");
  },
};
