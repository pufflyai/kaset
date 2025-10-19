import { useEffect, useState } from "react";
import type { Tool } from "@pstdio/tiny-ai-tasks";
import type { PluginCommand, PluginHostRuntime, PluginSettingsSchema } from "../runtime/pluginHostRuntime";

export interface UsePluginHostResult {
  commands: PluginCommand[];
  tools: Tool[];
  settings: Array<{ pluginId: string; schema: PluginSettingsSchema }>;
  loading: boolean;
  error: unknown;
  runCommand(pluginId: string, commandId: string, params?: unknown): Promise<void>;
  getDisplayName(pluginId: string): string;
  readSettings<T = unknown>(pluginId: string): Promise<T>;
  writeSettings<T = unknown>(pluginId: string, value: T): Promise<void>;
}

const sortSettings = (entries: Array<{ pluginId: string; schema: PluginSettingsSchema }>) =>
  [...entries].sort((a, b) => a.pluginId.localeCompare(b.pluginId));

export function usePluginHost(runtime: PluginHostRuntime): UsePluginHostResult {
  const [commands, setCommands] = useState<PluginCommand[]>(() => runtime.getPluginCommands());
  const [tools, setTools] = useState<Tool[]>(() => runtime.getPluginTools());
  const [settings, setSettings] = useState<Array<{ pluginId: string; schema: PluginSettingsSchema }>>(() =>
    sortSettings(runtime.getPluginSettingsEntries()),
  );
  const [loading, setLoading] = useState(() => !runtime.isReady());
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;

    const unsubscribeCommands = runtime.subscribeToPluginCommands((nextCommands) => {
      if (!mounted) return;
      setCommands(nextCommands);
      setTools(runtime.getPluginTools());
      setLoading(false);
      setError(null);
    });

    const unsubscribeSettings = runtime.subscribeToPluginSettings((pluginId, schema) => {
      if (!mounted) return;
      setSettings((previous) => {
        if (schema === undefined) {
          return previous.filter((entry) => entry.pluginId !== pluginId);
        }

        const map = new Map(previous.map((entry) => [entry.pluginId, entry.schema]));
        map.set(pluginId, schema);
        return sortSettings(
          Array.from(map.entries()).map(([id, schemaValue]) => ({ pluginId: id, schema: schemaValue })),
        );
      });
    });

    setLoading((value) => value || !runtime.isReady());

    runtime
      .ensureHost()
      .then(() => {
        if (!mounted) return;
        setCommands(runtime.getPluginCommands());
        setTools(runtime.getPluginTools());
        setSettings(sortSettings(runtime.getPluginSettingsEntries()));
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
  }, [runtime]);

  return {
    commands,
    tools,
    settings,
    loading,
    error,
    runCommand: (pluginId, commandId, params) => runtime.runCommand(pluginId, commandId, params),
    getDisplayName: (pluginId) => runtime.getPluginDisplayName(pluginId),
    readSettings: (pluginId) => runtime.readSettings(pluginId),
    writeSettings: (pluginId, value) => runtime.writeSettings(pluginId, value),
  };
}
