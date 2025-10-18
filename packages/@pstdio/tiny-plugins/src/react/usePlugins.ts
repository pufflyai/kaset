import { useEffect, useMemo, useState } from "react";
import type { Tool } from "@pstdio/tiny-ai-tasks";
import { createToolsForCommands } from "../adapters/tiny-ai-tasks";
import type { CommandDefinition } from "../core/types";
import type { createHost } from "../core/host";

type Host = ReturnType<typeof createHost>;
type CommandList = Array<CommandDefinition & { pluginId: string }>;

type SettingsMap = Record<string, unknown>;

type UsePluginsState = {
  loading: boolean;
  error: Error | null;
  commands: CommandList;
  tools: Tool[];
  settings: SettingsMap;
};

export function usePlugins(host: Host): UsePluginsState {
  const [commands, setCommands] = useState<CommandList>(() => host.listCommands());
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setCommands(host.listCommands());

    (async () => {
      const metadata = host.getMetadata();
      const entries = await Promise.all(
        metadata.map(async (meta) => {
          try {
            const value = await host.readSettings(meta.id);
            return [meta.id, value] as const;
          } catch (err) {
            console.warn(`[tiny-plugins] failed to read settings for ${meta.id}: ${(err as Error).message}`);
            return [meta.id, {}] as const;
          }
        }),
      );
      if (disposed) return;
      setSettings((prev) => {
        const next: SettingsMap = { ...prev };
        for (const [id, value] of entries) {
          next[id] = value;
        }
        return next;
      });
      setLoading(false);
    })().catch((err) => {
      if (disposed) return;
      setError(err as Error);
      setLoading(false);
    });

    const offPluginChange = host.onPluginChange(() => {
      setCommands(host.listCommands());
    });
    const offSettings = host.onSettingsChange((pluginId, value) => {
      setSettings((prev) => ({ ...prev, [pluginId]: value }));
    });
    const offError = host.onError((err) => {
      setError(err);
    });

    return () => {
      disposed = true;
      offPluginChange?.();
      offSettings?.();
      offError?.();
    };
  }, [host]);

  const tools = useMemo(
    () =>
      createToolsForCommands(commands, (pluginId, commandId, params) => host.runCommand(pluginId, commandId, params)),
    [commands, host],
  );

  return { loading, error, commands, tools, settings };
}
