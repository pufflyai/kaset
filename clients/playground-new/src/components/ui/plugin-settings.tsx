import type { PluginCommand } from "@/services/plugins/plugin-host";
import { usePluginHost } from "@/services/plugins/usePluginHost";
import { Button, Field, Flex, HStack, Text, Textarea, VStack } from "@chakra-ui/react";
import { PlayIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toaster } from "./toaster";

interface PluginFormState {
  text: string;
  dirty: boolean;
  saving: boolean;
  error?: string;
}

interface PluginSettingsProps {
  isOpen: boolean;
}

interface PluginCommandGroup {
  pluginId: string;
  name: string;
  commands: PluginCommand[];
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

export function PluginSettings(props: PluginSettingsProps) {
  const { isOpen } = props;

  const {
    commands,
    settings: pluginSettings,
    readSettings,
    writeSettings,
    getDisplayName,
    runCommand,
    loading: hostLoading,
  } = usePluginHost();
  const [pluginForms, setPluginForms] = useState<Record<string, PluginFormState>>({});
  const [pluginLoading, setPluginLoading] = useState(false);

  const pluginCommandGroups = useMemo<PluginCommandGroup[]>(() => {
    if (!commands.length) return [];

    const groups = new Map<string, PluginCommandGroup>();

    commands.forEach((command) => {
      const existing = groups.get(command.pluginId);
      if (existing) {
        existing.commands.push(command);
        return;
      }

      groups.set(command.pluginId, {
        pluginId: command.pluginId,
        name: getDisplayName(command.pluginId),
        commands: [command],
      });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        commands: [...group.commands].sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [commands, getDisplayName]);

  const showCommandEmptyState = !hostLoading && pluginCommandGroups.length === 0;

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

        const forms: Record<string, PluginFormState> = {};
        results.forEach((result) => {
          const errorMessage =
            "error" in result && result.error
              ? result.error instanceof Error
                ? result.error.message
                : String(result.error)
              : undefined;

          const value = "value" in result ? result.value : undefined;
          forms[result.pluginId] = {
            text: errorMessage ? "{}" : serializeSettings(value),
            dirty: false,
            saving: false,
            error: errorMessage,
          };
        });

        setPluginForms(forms);
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
    setPluginForms((previous) => {
      const current = previous[pluginId] ?? { text: "{}", dirty: false, saving: false };
      return {
        ...previous,
        [pluginId]: {
          ...current,
          text: nextText,
          dirty: true,
          error: undefined,
        },
      };
    });
  };

  const handleRunPluginCommand = async (command: PluginCommand) => {
    try {
      await runCommand(command.pluginId, command.id);
    } catch (error) {
      toaster.create({
        type: "error",
        title: `Failed to run ${command.title || command.id}`,
        description: error instanceof Error ? error.message : String(error),
        duration: 7000,
      });
    }
  };

  const reloadPluginSettings = async (pluginId: string) => {
    setPluginForms((previous) => {
      const current = previous[pluginId] ?? { text: "{}", dirty: false, saving: false };
      return {
        ...previous,
        [pluginId]: { ...current, saving: true, error: undefined },
      };
    });

    try {
      const value = await readSettings(pluginId);
      setPluginForms((previous) => ({
        ...previous,
        [pluginId]: {
          text: serializeSettings(value),
          dirty: false,
          saving: false,
        },
      }));
    } catch (error) {
      setPluginForms((previous) => {
        const current = previous[pluginId] ?? { text: "{}", dirty: false, saving: false };
        return {
          ...previous,
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
      setPluginForms((previous) => ({
        ...previous,
        [pluginId]: {
          ...(previous[pluginId] ?? { text: raw, dirty: true, saving: false }),
          error: error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON",
        },
      }));
      return;
    }

    setPluginForms((previous) => ({
      ...previous,
      [pluginId]: {
        ...(previous[pluginId] ?? { text: serializeSettings(parsed), dirty: false, saving: false }),
        saving: true,
        error: undefined,
      },
    }));

    try {
      await writeSettings(pluginId, parsed);
      setPluginForms((previous) => ({
        ...previous,
        [pluginId]: {
          ...(previous[pluginId] ?? { text: serializeSettings(parsed), dirty: false, saving: false }),
          saving: false,
          dirty: false,
          error: undefined,
        },
      }));
      toaster.create({ type: "success", title: `Saved ${getDisplayName(pluginId)} settings` });
    } catch (error) {
      setPluginForms((previous) => ({
        ...previous,
        [pluginId]: {
          ...(previous[pluginId] ?? { text: raw, dirty: true, saving: false }),
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

  return (
    <Flex direction="column" gap="lg" width="100%">
      <Flex direction="column" gap="xs">
        <Text>Plugin commands</Text>
        <Text fontSize="sm" color="fg.muted">
          Run commands provided by installed plugins.
        </Text>
        {hostLoading && <Text fontSize="sm">Loading plugin commands…</Text>}
        {showCommandEmptyState && (
          <Text fontSize="sm" color="fg.muted">
            No plugin commands available.
          </Text>
        )}
        {!hostLoading && !showCommandEmptyState && (
          <VStack align="stretch" gap="sm">
            {pluginCommandGroups.map((group) => (
              <VStack key={group.pluginId} align="stretch" gap="xs">
                <Text fontSize="sm" fontWeight="medium" color="fg.muted">
                  {group.name}
                </Text>
                <VStack align="stretch" gap="xs">
                  {group.commands.map((command) => (
                    <Button
                      key={`${command.pluginId}:${command.id}`}
                      size="xs"
                      variant="ghost"
                      justifyContent="flex-start"
                      gap="2xs"
                      onClick={() => handleRunPluginCommand(command)}
                    >
                      <PlayIcon size={16} />
                      <Text fontSize="sm" fontWeight="medium">
                        {command.title || command.id}
                      </Text>
                    </Button>
                  ))}
                </VStack>
              </VStack>
            ))}
          </VStack>
        )}
      </Flex>

      <Flex direction="column" gap="xs">
        <Text>Plugin settings</Text>
        <Text fontSize="sm" color="fg.muted">
          Edit saved settings for installed plugins. Values must be valid JSON objects.
        </Text>
        {pluginSettings.length === 0 && (
          <Text fontSize="sm" color="fg.muted">
            No plugin settings available.
          </Text>
        )}
        {pluginSettings.length > 0 && pluginLoading && <Text fontSize="sm">Loading plugin settings…</Text>}
        {pluginSettings.length > 0 && !pluginLoading && (
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
                    onChange={(event) => handlePluginInputChange(entry.pluginId, event.target.value)}
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
    </Flex>
  );
}
