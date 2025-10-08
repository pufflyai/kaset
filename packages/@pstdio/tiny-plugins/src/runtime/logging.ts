import type { Logger } from "../model/plugin";

export function createLogger(pluginId: string): Logger {
  const prefix = `[tiny-plugin:${pluginId}]`;

  return {
    info: (...args) => console.info(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}
