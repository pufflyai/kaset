import { readFile, writeFile } from "@pstdio/opfs-utils";
import { joinPath, trimLeadingSlash } from "../utils/path";
import type { Logger } from "./types";

const LOG_ROOT = "artifacts/logs";

const toLogPath = (pluginId: string) => trimLeadingSlash(joinPath(LOG_ROOT, `${pluginId}.ndjson`));

class PluginLogWriter {
  private queue = Promise.resolve();

  constructor(private readonly pluginId: string) {}

  append(level: "info" | "warn" | "error", args: unknown[]): void {
    this.queue = this.queue
      .then(async () => {
        const entry = {
          ts: new Date().toISOString(),
          level,
          data: args.length <= 1 ? args[0] : args,
        };
        const serialized = JSON.stringify(entry);
        const path = toLogPath(this.pluginId);
        let existing = "";
        try {
          existing = await readFile(path);
        } catch (error: any) {
          if (error?.name !== "NotFoundError") {
            throw error;
          }
        }
        const next = existing ? `${existing}${serialized}\n` : `${serialized}\n`;
        await writeFile(path, next);
      })
      .catch((error) => {
        console.error("[kaset-plugin-host] failed to append log", error);
      });
  }
}

export const createLogger = (pluginId: string): Logger => {
  const writer = new PluginLogWriter(pluginId);
  return {
    info: (...args) => {
      writer.append("info", args);
    },
    warn: (...args) => {
      writer.append("warn", args);
    },
    error: (...args) => {
      writer.append("error", args);
    },
  };
};
