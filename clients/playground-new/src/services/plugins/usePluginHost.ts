import { PLUGIN_ROOT } from "@/constant";
import type { JSONSchema } from "@pstdio/kaset-plugin-host";
import type { Tool } from "@pstdio/tiny-ai-tasks";
import { useEffect, useState } from "react";
import {
  ensurePluginHost,
  getPluginCommands,
  getPluginDisplayName,
  getPluginSettingsEntries,
  getPluginTools,
  isPluginHostReady,
  readPluginSettings,
  runPluginCommand,
  setPluginsRoot,
  subscribeToPluginCommands,
  subscribeToPluginSettings,
  writePluginSettings,
  type PluginCommand,
} from "./pluginHost";

export interface UsePluginHostResult {
  commands: PluginCommand[];
  tools: Tool[];
  loading: boolean;
  error: unknown;
  runCommand(pluginId: string, commandId: string): Promise<void>;
  getDisplayName(pluginId: string): string;
  settings: Array<{ pluginId: string; schema: JSONSchema }>;
  readSettings<T = unknown>(pluginId: string): Promise<T>;
  writeSettings<T = unknown>(pluginId: string, value: T): Promise<void>;
}

const sortSettings = (entries: Array<{ pluginId: string; schema: JSONSchema }>) =>
  [...entries].sort((a, b) => a.pluginId.localeCompare(b.pluginId));

export function usePluginHost(): UsePluginHostResult {
  const [commands, setCommands] = useState<PluginCommand[]>(() => getPluginCommands());
  const [tools, setTools] = useState<Tool[]>(() => getPluginTools());
  const [settings, setSettings] = useState<Array<{ pluginId: string; schema: JSONSchema }>>(() =>
    sortSettings(getPluginSettingsEntries()),
  );
  const [loading, setLoading] = useState(!isPluginHostReady());
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        await setPluginsRoot(PLUGIN_ROOT);
        if (cancelled) return;
        await ensurePluginHost();
      } catch (err) {
        if (cancelled) return;
        if ((err as Error)?.message !== "Plugin root changed during initialization") {
          console.error("[plugin-host] initialization failed", err);
          setError(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    const unsubscribeCommands = subscribeToPluginCommands((next) => {
      if (cancelled) return;
      setCommands(next);
      setTools(getPluginTools());
    });

    const unsubscribeSettings = subscribeToPluginSettings((pluginId, schema) => {
      if (cancelled) return;
      setSettings((prev) => {
        const next = prev.filter((entry) => entry.pluginId !== pluginId);
        if (schema) next.push({ pluginId, schema });
        return sortSettings(next);
      });
    });

    return () => {
      cancelled = true;
      unsubscribeCommands();
      unsubscribeSettings();
    };
  }, []);

  return {
    commands,
    tools,
    settings,
    loading,
    error,
    runCommand: runPluginCommand,
    getDisplayName: getPluginDisplayName,
    readSettings: readPluginSettings,
    writeSettings: writePluginSettings,
  };
}
