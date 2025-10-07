import type { PluginCommand } from "@/services/plugins/pluginHost";
import { usePluginHost } from "@/services/plugins/usePluginHost";
import { Box, Button, Drawer, Field, Flex, HStack, Portal, Text, Textarea, VStack } from "@chakra-ui/react";
import { Plug as PlugIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toaster } from "./toaster";
import { Tooltip } from "./tooltip";

interface PluginFormState {
  text: string;
  dirty: boolean;
  saving: boolean;
  error?: string;
}

function serializeSettings(value: unknown) {
  if (value === undefined || value === null) return "{}";
  if (typeof value === "string") return JSON.stringify(value);

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return JSON.stringify(value);
  }
}

export function PluginSettings() {
  const { commands, getDisplayName, loading } = usePluginHost();

  const pluginCommandGroups = useMemo(() => {
    if (!commands.length) return [] as Array<{ pluginId: string; name: string; commands: PluginCommand[] }>;

    const groups = new Map<string, { pluginId: string; name: string; commands: PluginCommand[] }>();

    commands.forEach((cmd) => {
      const key = cmd.pluginId;
      const existing = groups.get(key);
      if (existing) {
        existing.commands.push(cmd);
        return;
      }

      groups.set(key, { pluginId: key, name: getDisplayName(key), commands: [cmd] });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        commands: [...group.commands].sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [commands, getDisplayName]);

  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const handleDrawerChange = (event: { open: boolean }) => {
    setDrawerOpen(event.open);
  };

  const showEmptyState = !loading && pluginCommandGroups.length === 0;

  return (
    <Drawer.Root open={isDrawerOpen} onOpenChange={handleDrawerChange}>
      <Drawer.Trigger asChild>
        <Box>
          <Tooltip content={loading ? "Loading plugins" : "Plugin commands"}>
            <Button variant="ghost" gap="2xs" disabled={showEmptyState} aria-label="Plugin commands">
              <PlugIcon />
              <Text textStyle="label/S/regular">Plugins</Text>
            </Button>
          </Tooltip>
        </Box>
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content maxWidth="480px">
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Title>Plugins</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <VStack align="stretch" gap="lg">
                {loading && <Text fontSize="sm">Loading plugin commands…</Text>}
                {showEmptyState && <Text fontSize="sm">No plugin commands available.</Text>}

                <PluginSettingsPanel isOpen={isDrawerOpen} />
              </VStack>
            </Drawer.Body>
            <Drawer.Footer />
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}

interface PluginSettingsPanelProps {
  isOpen: boolean;
}

export function PluginSettingsPanel(props: PluginSettingsPanelProps) {
  const { isOpen } = props;
  const { settings: pluginSettings, readSettings, writeSettings, getDisplayName } = usePluginHost();
  const [pluginForms, setPluginForms] = useState<Record<string, PluginFormState>>({});
  const [pluginLoading, setPluginLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPluginForms({});
      setPluginLoading(false);
      return;
    }

    if (pluginSettings.length === 0) {
      setPluginForms({});
      setPluginLoading(false);
      return;
    }

    let cancelled = false;
    setPluginLoading(true);

    const load = async () => {
      try {
        const results = await Promise.all(
          pluginSettings.map(async (entry) => {
            try {
              const value = await readSettings(entry.pluginId);
              return { pluginId: entry.pluginId, value };
            } catch (error) {
              return { pluginId: entry.pluginId, error };
            }
          }),
        );

        if (cancelled) return;

        const next: Record<string, PluginFormState> = {};
        results.forEach((result) => {
          const errorMessage =
            "error" in result && result.error
              ? result.error instanceof Error
                ? result.error.message
                : String(result.error)
              : undefined;

          const value = "value" in result ? result.value : undefined;
          next[result.pluginId] = {
            text: errorMessage ? "{}" : serializeSettings(value),
            dirty: false,
            saving: false,
            error: errorMessage,
          };
        });

        setPluginForms(next);
      } catch (error) {
        if (cancelled) return;
        console.error("[plugin-host] Failed to load plugin settings", error);
        setPluginForms({});
      } finally {
        if (!cancelled) setPluginLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, pluginSettings, readSettings]);

  const handlePluginInputChange = (pluginId: string, nextText: string) => {
    setPluginForms((prev) => {
      const current = prev[pluginId] ?? { text: "{}", dirty: false, saving: false };
      return {
        ...prev,
        [pluginId]: {
          ...current,
          text: nextText,
          dirty: true,
          error: undefined,
        },
      };
    });
  };

  const reloadPluginSettings = async (pluginId: string) => {
    setPluginForms((prev) => {
      const current = prev[pluginId] ?? { text: "{}", dirty: false, saving: false };
      return {
        ...prev,
        [pluginId]: { ...current, saving: true, error: undefined },
      };
    });

    try {
      const value = await readSettings(pluginId);
      setPluginForms((prev) => ({
        ...prev,
        [pluginId]: {
          text: serializeSettings(value),
          dirty: false,
          saving: false,
        },
      }));
    } catch (error) {
      setPluginForms((prev) => {
        const current = prev[pluginId] ?? { text: "{}", dirty: false, saving: false };
        return {
          ...prev,
          [pluginId]: {
            ...current,
            saving: false,
            error: error instanceof Error ? error.message : String(error),
          },
        };
      });
    }
  };

  const handleSavePlugin = async (pluginId: string) => {
    const current = pluginForms[pluginId];
    const raw = current?.text ?? "{}";

    let parsed: unknown;
    try {
      parsed = raw.trim() ? JSON.parse(raw) : {};
    } catch (error) {
      setPluginForms((prev) => ({
        ...prev,
        [pluginId]: {
          ...(prev[pluginId] ?? { text: raw, dirty: true, saving: false }),
          error: error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON",
        },
      }));
      return;
    }

    setPluginForms((prev) => ({
      ...prev,
      [pluginId]: {
        ...(prev[pluginId] ?? { text: serializeSettings(parsed), dirty: false, saving: false }),
        saving: true,
        error: undefined,
      },
    }));

    try {
      await writeSettings(pluginId, parsed);
      setPluginForms((prev) => ({
        ...prev,
        [pluginId]: {
          ...(prev[pluginId] ?? { text: serializeSettings(parsed), dirty: false, saving: false }),
          saving: false,
          dirty: false,
          error: undefined,
        },
      }));
      toaster.create({ type: "success", title: `Saved ${getDisplayName(pluginId)} settings` });
    } catch (error) {
      setPluginForms((prev) => ({
        ...prev,
        [pluginId]: {
          ...(prev[pluginId] ?? { text: raw, dirty: true, saving: false }),
          saving: false,
          error: error instanceof Error ? error.message : String(error),
        },
      }));
      toaster.create({
        type: "error",
        title: `Failed to save ${getDisplayName(pluginId)} settings`,
        description: error instanceof Error ? error.message : String(error),
        duration: 7000,
      });
    }
  };

  if (pluginSettings.length === 0) return null;

  return (
    <Flex gap="xs" direction="column" width="100%">
      <Text>Plugin settings</Text>
      <Text fontSize="sm" color="fg.muted">
        Edit saved settings for installed plugins. Values must be valid JSON objects.
      </Text>
      {pluginLoading && <Text fontSize="sm">Loading plugin settings…</Text>}
      {!pluginLoading && (
        <VStack align="stretch" gap="md">
          {pluginSettings.map((entry) => {
            const form = pluginForms[entry.pluginId];
            return (
              <Field.Root key={entry.pluginId} gap="xs">
                <Field.Label>{getDisplayName(entry.pluginId)}</Field.Label>
                <Textarea
                  fontFamily="mono"
                  minHeight="140px"
                  value={form?.text ?? "{}"}
                  onChange={(e) => handlePluginInputChange(entry.pluginId, e.target.value)}
                />
                {form?.error && (
                  <Text fontSize="xs" color="foreground.feedback.alert">
                    {form.error}
                  </Text>
                )}
                <HStack justify="flex-end" gap="xs">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => reloadPluginSettings(entry.pluginId)}
                    disabled={form?.saving}
                  >
                    Reset
                  </Button>
                  <Button
                    size="xs"
                    variant="solid"
                    onClick={() => handleSavePlugin(entry.pluginId)}
                    disabled={!form || form.saving || !form.dirty}
                  >
                    {form?.saving ? "Saving…" : "Save"}
                  </Button>
                </HStack>
              </Field.Root>
            );
          })}
        </VStack>
      )}
    </Flex>
  );
}
