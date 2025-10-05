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
  subscribeToPluginCommands,
  subscribeToPluginSettings,
  type PluginCommand,
  writePluginSettings,
} from "./plugin-host";

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
    let mounted = true;

    const unsubscribeCommands = subscribeToPluginCommands((nextCommands) => {
      if (!mounted) return;
      setCommands(nextCommands);
      setTools(getPluginTools());
      setLoading(false);
      setError(null);
    });

    const unsubscribeSettings = subscribeToPluginSettings((pluginId, schema) => {
      if (!mounted) return;
      setSettings((previous) => {
        const entries = new Map(previous.map((entry) => [entry.pluginId, entry.schema]));

        if (schema) {
          entries.set(pluginId, schema);
        } else {
          entries.delete(pluginId);
        }

        const next = Array.from(entries.entries()).map(([id, schemaValue]) => ({ pluginId: id, schema: schemaValue }));
        return sortSettings(next);
      });
    });

    setLoading((value) => value || !isPluginHostReady());

    ensurePluginHost()
      .then(() => {
        if (!mounted) return;
        setCommands(getPluginCommands());
        setTools(getPluginTools());
        setSettings(sortSettings(getPluginSettingsEntries()));
        setLoading(false);
        setError(null);
      })
      .catch((ensureError) => {
        if (!mounted) return;
        setError(ensureError);
        setLoading(false);
      });

    return () => {
      mounted = false;
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
