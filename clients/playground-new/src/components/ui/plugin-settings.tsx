import { usePluginHost } from "@/services/plugins/usePluginHost";
import { Button, Field, Flex, HStack, Text, Textarea, VStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
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
