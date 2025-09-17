import type { CommandDefinition, JSONSchema } from "../model/manifest";

export interface RegisteredCommand extends CommandDefinition {
  pluginId: string;
  run: () => Promise<void>;
}

export interface UIAdapter {
  onCommandsChanged(commands: RegisteredCommand[]): void;
  notify?(level: "info" | "warn" | "error", message: string): void;
  onSettingsSchema?(pluginId: string, schema?: JSONSchema): void;
}

export const createConsoleUIAdapter = (): UIAdapter => ({
  onCommandsChanged(commands) {
    if (commands.length === 0) {
      return;
    }
    const titles = commands.map((command) => `${command.pluginId}:${command.id}`).join(", ");
    console.debug("[kaset-plugin-host] commands:", titles);
  },
  notify(level, message) {
    const method = level === "error" ? "error" : level === "warn" ? "warn" : "info";
    console[method]?.(`[plugin] ${message}`);
  },
});
