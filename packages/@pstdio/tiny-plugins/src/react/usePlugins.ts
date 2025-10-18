import { useEffect, useMemo, useState } from "react";
import type { Tool } from "@pstdio/tiny-ai-tasks";
import { createToolsForCommands } from "../adapters/tiny-ai-tasks";
import type { createHost } from "../core/host";
import type { CommandDefinition } from "../core/types";

type Host = ReturnType<typeof createHost>;

export interface UsePluginsResult {
  loading: boolean;
  error: Error | null;
  commands: Array<CommandDefinition & { pluginId: string }>;
  tools: Tool[];
  settings: Record<string, unknown>;
}

export function usePlugins(host: Host | null | undefined): UsePluginsResult {
  const [loading, setLoading] = useState<boolean>(Boolean(host));
  const [error, setError] = useState<Error | null>(null);
  const [commands, setCommands] = useState<Array<CommandDefinition & { pluginId: string }>>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!host) {
      setLoading(false);
      setCommands([]);
      setSettings({});
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const refreshCommands = () => {
      if (!active) return;
      try {
        const list = host.listCommands();
        setCommands(list);
        setLoading(false);
      } catch (err) {
        setError(err as Error);
      }
    };

    refreshCommands();

    const offPlugin = host.onPluginChange(() => {
      refreshCommands();
    });
    const offDeps = host.onDependencyChange(() => {
      refreshCommands();
    });
    const offSettings = host.onSettingsChange((pluginId, value) => {
      if (!active) return;
      setSettings((prev) => ({ ...prev, [pluginId]: value }));
    });
    const offStatus = host.onStatus(() => {
      if (!active) return;
      setLoading(false);
    });
    const offError = host.onError((err) => {
      if (!active) return;
      setError(err);
    });

    return () => {
      active = false;
      offPlugin();
      offDeps();
      offSettings();
      offStatus();
      offError();
    };
  }, [host]);

  const tools = useMemo<Tool[]>(() => {
    if (!host) return [];
    return createToolsForCommands(commands, (pluginId, commandId, params) =>
      host.runCommand(pluginId, commandId, params),
    );
  }, [host, commands]);

  return { loading, error, commands, tools, settings };
}
