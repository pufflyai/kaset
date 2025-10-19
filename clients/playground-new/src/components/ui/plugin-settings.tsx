import { usePluginHost } from "@/services/plugins/host";
import { Box, Field, Flex, Text, VStack } from "@chakra-ui/react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { toaster } from "./toaster";
import { CodeEditor } from "./code-editor";

interface PluginFormState {
  text: string;
  dirty: boolean;
  error?: string;
}

interface PluginSettingsProps {
  isOpen: boolean;
}

export interface PluginSettingsHandle {
  save: () => Promise<boolean>;
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

export const PluginSettings = forwardRef<PluginSettingsHandle, PluginSettingsProps>((props, ref) => {
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
              return { pluginId: entry.pluginId, value } as const;
            } catch (error) {
              return { pluginId: entry.pluginId, error } as const;
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
      const current = previous[pluginId] ?? { text: "{}", dirty: false };
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

  const saveDirtyPlugins = useCallback(async (): Promise<boolean> => {
    if (pluginSettings.length === 0) return true;

    const entriesToSave = pluginSettings
      .map((entry) => ({ entry, form: pluginForms[entry.pluginId] }))
      .filter((item): item is { entry: (typeof pluginSettings)[number]; form: PluginFormState } =>
        Boolean(item.form?.dirty),
      );

    if (entriesToSave.length === 0) {
      return true;
    }

    let hasValidationError = false;
    const parsedValues = new Map<string, { value: unknown; text: string }>();
    const nextFormsAfterValidation: Record<string, PluginFormState> = { ...pluginForms };

    entriesToSave.forEach(({ entry, form }) => {
      const raw = form.text ?? "{}";

      try {
        const parsed = raw.trim() ? JSON.parse(raw) : {};
        parsedValues.set(entry.pluginId, { value: parsed, text: serializeSettings(parsed) });
        nextFormsAfterValidation[entry.pluginId] = {
          ...form,
          error: undefined,
        };
      } catch (error) {
        hasValidationError = true;
        nextFormsAfterValidation[entry.pluginId] = {
          ...form,
          error: error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON",
        };
      }
    });

    if (hasValidationError) {
      setPluginForms(nextFormsAfterValidation);
      toaster.create({
        type: "error",
        title: "Failed to save plugin settings",
        description: "Fix invalid JSON before saving.",
        duration: 7000,
      });
      return false;
    }

    setPluginForms(nextFormsAfterValidation);

    let hasSaveFailure = false;
    const nextFormsAfterSave: Record<string, PluginFormState> = { ...nextFormsAfterValidation };

    for (const [pluginId, { value, text }] of parsedValues.entries()) {
      try {
        await writeSettings(pluginId, value);
        const current = nextFormsAfterSave[pluginId] ?? { text, dirty: false };
        nextFormsAfterSave[pluginId] = {
          ...current,
          text,
          dirty: false,
          error: undefined,
        };
        toaster.create({ type: "success", title: `Saved ${getDisplayName(pluginId)} settings` });
      } catch (error) {
        hasSaveFailure = true;
        const message = error instanceof Error ? error.message : String(error);
        const current = nextFormsAfterSave[pluginId] ?? { text, dirty: true };
        nextFormsAfterSave[pluginId] = {
          ...current,
          error: message,
        };
        toaster.create({
          type: "error",
          title: `Failed to save ${getDisplayName(pluginId)} settings`,
          description: message,
          duration: 7000,
        });
      }
    }

    setPluginForms(nextFormsAfterSave);
    return !hasSaveFailure;
  }, [getDisplayName, pluginForms, pluginSettings, writeSettings]);

  useImperativeHandle(
    ref,
    () => ({
      save: saveDirtyPlugins,
    }),
    [saveDirtyPlugins],
  );

  return (
    <Flex direction="column" gap="lg" width="100%">
      <Flex direction="column" gap="xs">
        <Text>Plugin settings</Text>
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
                  <Field.Label color="foreground.secondary">{getDisplayName(entry.pluginId)}</Field.Label>
                  <Box
                    borderWidth="1px"
                    borderRadius="md"
                    overflow="hidden"
                    borderColor="border.primary"
                    height="240px"
                    width="100%"
                  >
                    <CodeEditor
                      language="json"
                      code={form?.text ?? "{}"}
                      isEditable
                      wrapLines
                      onChange={(value) => handlePluginInputChange(entry.pluginId, value)}
                    />
                  </Box>
                  {form?.error && (
                    <Text fontSize="xs" color="foreground.feedback.alert">
                      {form.error}
                    </Text>
                  )}
                </Field.Root>
              );
            })}
          </VStack>
        )}
      </Flex>
    </Flex>
  );
});

PluginSettings.displayName = "PluginSettings";
