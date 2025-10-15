import { ROOT } from "@/constant";
import { getWorkspaceSettings } from "@/state/actions/getWorkspaceSettings";
import { resetWorkspace } from "@/state/actions/resetWorkspace";
import { saveWorkspaceSettings } from "@/state/actions/saveWorkspaceSettings";
import type { McpServerConfig, ThemePreference } from "@/state/types";
import { applyThemePreference } from "@/theme/applyThemePreference";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  Field,
  Flex,
  HStack,
  Input,
  SimpleGrid,
  Text,
  VStack,
  chakra,
  useBreakpointValue,
  useDisclosure,
} from "@chakra-ui/react";
import { DEFAULT_APPROVAL_GATED_TOOLS } from "@pstdio/kas";
import { ls, readFile } from "@pstdio/opfs-utils";
import { shortUID } from "@pstdio/prompt-utils";
import { useEffect, useRef, useState } from "react";
import { McpServerCard } from "./mcp-server-card";
import { PluginSettings } from "./plugin-settings";
import type { PluginSettingsHandle } from "./plugin-settings";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";
import { resetPlayground } from "../../services/playground/reset";
import type { LucideIcon } from "lucide-react";
import { Bot, Palette, Puzzle, Server, ShieldCheck, TriangleAlert } from "lucide-react";

const TOOL_LABELS: Record<string, string> = {
  opfs_write_file: "Write file",
  opfs_delete_file: "Delete file",
  opfs_patch: "Apply patch",
  opfs_upload_files: "Upload files",
  opfs_move_file: "Move file",
};

type SettingsSectionId = "kas" | "display" | "permissions" | "mcp" | "plugins" | "danger";

const SETTINGS_SECTIONS: Array<{ id: SettingsSectionId; label: string; icon: LucideIcon }> = [
  { id: "kas", label: "Kas", icon: Bot },
  { id: "display", label: "Display", icon: Palette },
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
  { id: "mcp", label: "MCP", icon: Server },
  { id: "plugins", label: "Plugins", icon: Puzzle },
  { id: "danger", label: "Danger Zone", icon: TriangleAlert },
];

const SECTION_METADATA = new Map<SettingsSectionId, (typeof SETTINGS_SECTIONS)[number]>(
  SETTINGS_SECTIONS.map((section) => [section.id, section]),
);

const sectionContainerProps = {
  borderWidth: "1px",
  borderColor: "border.primary",
  borderRadius: "lg",
  padding: "md",
  bg: "background.primary",
};

interface SectionHeaderProps {
  sectionId: SettingsSectionId;
}

const SectionHeader = (props: SectionHeaderProps) => {
  const { sectionId } = props;
  const section = SECTION_METADATA.get(sectionId);
  if (!section) return null;

  const Icon = section.icon;

  return (
    <HStack gap="xs" mb="sm" align="center">
      <Box as="span" aria-hidden display="flex" alignItems="center">
        <Icon size={18} />
      </Box>
      <Text fontWeight="semibold">{section.label}</Text>
    </HStack>
  );
};

const MobileSectionSelect = chakra("select");
const DEFAULT_WALLPAPER = `${ROOT}/wallpaper/kaset.png`;

const toBlobPart = (bytes: Uint8Array) => {
  if (bytes.buffer instanceof ArrayBuffer) {
    const { buffer, byteOffset, byteLength } = bytes;
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }

  const clone = new Uint8Array(bytes);
  return clone.buffer;
};

const getWallpaperMimeType = (path: string) => {
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.gif$/i.test(path)) return "image/gif";
  if (/\.webp$/i.test(path)) return "image/webp";
  return "application/octet-stream";
};

export function SettingsModal(props: { isOpen: boolean; onClose: () => void }) {
  const { isOpen, onClose } = props;

  const [apiKey, setApiKey] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [model, setModel] = useState<string>("gpt-5");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [approvalTools, setApprovalTools] = useState<string[]>([...DEFAULT_APPROVAL_GATED_TOOLS]);
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>([]);
  const [activeMcpServerIds, setActiveMcpServerIds] = useState<string[]>([]);
  const [showServerTokens, setShowServerTokens] = useState<Record<string, boolean>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("kas");
  const [theme, setTheme] = useState<ThemePreference>("light");
  const [initialTheme, setInitialTheme] = useState<ThemePreference>("light");
  const [wallpapers, setWallpapers] = useState<string[]>([]);
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>("");
  const [wallpaperPreviews, setWallpaperPreviews] = useState<Record<string, string>>({});
  const pluginSettingsRef = useRef<PluginSettingsHandle>(null);
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;
  const { open: resetProjectOpen, onOpen: openResetProject, onClose: closeResetProject } = useDisclosure();

  useEffect(() => {
    if (!isOpen) return;

    const settings = getWorkspaceSettings();
    setApiKey(settings.apiKey ?? "");
    setBaseUrl(settings.baseUrl ?? "");
    setModel(settings.modelId || "gpt-5");
    setApprovalTools(settings.approvalGatedTools || [...DEFAULT_APPROVAL_GATED_TOOLS]);

    const nextTheme = settings.theme ?? "light";
    setTheme(nextTheme);
    setInitialTheme(nextTheme);

    setSelectedWallpaper(settings.wallpaper ?? DEFAULT_WALLPAPER);

    const storedServers = settings.mcpServers;
    const effectiveServers = storedServers ?? [];
    const hasServers = effectiveServers.length > 0;

    setMcpServers(hasServers ? effectiveServers.map((server) => ({ ...server })) : []);

    setActiveMcpServerIds(() => {
      if (!hasServers) return [];

      const storedActiveIds = settings.activeMcpServerIds;

      if (storedActiveIds) {
        const validStored = storedActiveIds.filter((id) => effectiveServers.some((server) => server.id === id));

        if (validStored.length > 0) return validStored;
        if (storedActiveIds.length === 0) return [];
      }

      return [effectiveServers[0].id];
    });

    setShowServerTokens(() => {
      const next: Record<string, boolean> = {};
      effectiveServers.forEach((server) => {
        next[server.id] = false;
      });
      return next;
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeSection !== "display") return;

    const loadWallpapers = async () => {
      try {
        const wallpaperPath = `${ROOT}/wallpaper`;
        const entries = await ls(wallpaperPath);

        const imageFiles = entries
          .filter((entry) => entry.kind === "file")
          .filter((entry) => /\.(png|jpe?g|gif|webp)$/i.test(entry.name))
          .map((entry) => `${wallpaperPath}/${entry.name}`);

        setWallpapers(imageFiles);
      } catch (error) {
        console.error("Failed to load wallpapers:", error);
        setWallpapers([]);
      }
    };

    loadWallpapers();
  }, [isOpen, activeSection]);

  useEffect(() => {
    if (!isOpen) return;
    if (wallpapers.length === 0) {
      setWallpaperPreviews({});
      return;
    }

    let cancelled = false;
    const urls: string[] = [];

    const loadPreviews = async () => {
      const entries = await Promise.all(
        wallpapers.map(async (wallpaper) => {
          try {
            const fileData = await readFile(wallpaper, { encoding: null });
            const blob = new Blob([toBlobPart(fileData)], { type: getWallpaperMimeType(wallpaper) });
            const objectUrl = URL.createObjectURL(blob);
            urls.push(objectUrl);
            return { wallpaper, url: objectUrl };
          } catch (error) {
            console.error(`Failed to load wallpaper preview for ${wallpaper}:`, error);
            return null;
          }
        }),
      );

      if (cancelled) {
        urls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      const next: Record<string, string> = {};
      entries.forEach((entry) => {
        if (entry) next[entry.wallpaper] = entry.url;
      });
      setWallpaperPreviews(next);
    };

    loadPreviews();

    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [isOpen, wallpapers]);

  useEffect(() => {
    if (!isOpen) return;

    applyThemePreference(theme);
  }, [isOpen, theme]);

  const handleSectionChange = (sectionId: SettingsSectionId) => {
    setActiveSection(sectionId);
  };

  const handleThemeSelect = (nextTheme: ThemePreference) => {
    if (nextTheme === theme) return;

    setTheme(nextTheme);
  };

  const handleClose = () => {
    setTheme(initialTheme);
    applyThemePreference(initialTheme);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setActiveSection("kas");
      setSavingSettings(false);
      closeResetProject();
    }
  }, [isOpen, closeResetProject]);

  const handleResetProject = async () => {
    try {
      await resetPlayground();
    } catch (error) {
      console.error("Failed to reset playground files", error);
    }

    resetWorkspace();
    handleClose();
  };

  const addMcpServer = () => {
    const id = shortUID();
    const next: McpServerConfig = { id, name: "", url: "" };

    setMcpServers((prev) => [...prev, next]);
    setShowServerTokens((prev) => ({ ...prev, [id]: false }));
    setActiveMcpServerIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const updateMcpServer = (id: string, patch: Partial<McpServerConfig>) => {
    setMcpServers((prev) => prev.map((server) => (server.id === id ? { ...server, ...patch } : server)));
  };

  const removeMcpServer = (id: string) => {
    setMcpServers((prev) => {
      const next = prev.filter((server) => server.id !== id);
      setActiveMcpServerIds((current) => {
        const filtered = current.filter((entry) => entry !== id && next.some((server) => server.id === entry));
        if (filtered.length > 0) return filtered;

        const fallback = next[0]?.id;
        return fallback ? [fallback] : [];
      });
      return next;
    });

    setShowServerTokens((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const toggleServerTokenVisibility = (id: string) => {
    setShowServerTokens((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleServerActive = (id: string) => {
    setActiveMcpServerIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((entry) => entry !== id);
      }

      return [...prev, id];
    });
  };

  const save = async () => {
    if (savingSettings) return;

    setSavingSettings(true);

    try {
      const pluginResult = await pluginSettingsRef.current?.save();
      if (pluginResult === false) {
        return;
      }

      const sanitizedServers = mcpServers
        .map((server) => {
          const name = server.name?.trim() ?? "";
          const url = server.url?.trim() ?? "";
          const token = server.accessToken?.trim() ?? "";

          return {
            ...server,
            name,
            url,
            accessToken: token ? token : undefined,
          };
        })
        .filter((server) => server.url.length > 0);

      const nextActiveIds = sanitizedServers.length
        ? activeMcpServerIds.filter((id) => sanitizedServers.some((server) => server.id === id))
        : [];

      saveWorkspaceSettings({
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        modelId: model || "gpt-5-mini",
        approvalGatedTools: [...approvalTools],
        mcpServers: sanitizedServers.map((server) => ({ ...server })),
        activeMcpServerIds: nextActiveIds,
        theme,
        wallpaper: selectedWallpaper || undefined,
      });

      setInitialTheme(theme);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <>
      <Dialog.Root
        size="lg"
        open={isOpen}
        onOpenChange={(e) => !e.open && handleClose()}
        closeOnInteractOutside={false}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Text textStyle="heading/M">Settings</Text>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap="md" align="stretch">
                <Flex direction={{ base: "column", md: "row" }} gap="md">
                  {!isMobile && (
                    <Flex direction="column" gap="xs" width="200px" flexShrink={0}>
                      {SETTINGS_SECTIONS.map((section) => {
                        const SectionIcon = section.icon;
                        return (
                          <Button
                            key={section.id}
                            variant={activeSection === section.id ? "solid" : "ghost"}
                            justifyContent="flex-start"
                            size="sm"
                            onClick={() => handleSectionChange(section.id)}
                            aria-current={activeSection === section.id ? "page" : undefined}
                          >
                            <Flex as="span" align="center" gap="xs">
                              <Box as="span" aria-hidden display="flex" alignItems="center">
                                <SectionIcon size={16} />
                              </Box>
                              <chakra.span>{section.label}</chakra.span>
                            </Flex>
                          </Button>
                        );
                      })}
                    </Flex>
                  )}
                  <Box flex="1">
                    {isMobile && (
                      <Box mb="md">
                        <Field.Root>
                          <Field.Label>Section</Field.Label>
                          <MobileSectionSelect
                            value={activeSection}
                            onChange={(event) => handleSectionChange(event.target.value as SettingsSectionId)}
                            paddingY="xs"
                            paddingX="sm"
                            borderRadius="md"
                            borderWidth="1px"
                            width="100%"
                            color="foreground.primary"
                            bg="background.primary"
                          >
                            {SETTINGS_SECTIONS.map((section) => (
                              <option key={section.id} value={section.id}>
                                {section.label}
                              </option>
                            ))}
                          </MobileSectionSelect>
                        </Field.Root>
                      </Box>
                    )}
                    <Box display={activeSection === "kas" ? "block" : "none"} {...sectionContainerProps}>
                      <SectionHeader sectionId="kas" />
                      <VStack align="stretch" gap="md">
                        <Alert.Root status="info">
                          <Alert.Indicator />
                          <Alert.Content>
                            <Alert.Title fontWeight="bold">Local Playground</Alert.Title>
                            <Alert.Description>
                              Everything you create and configure here stays on your device. No data is uploaded or
                              stored in the cloud.
                            </Alert.Description>
                          </Alert.Content>
                        </Alert.Root>
                        <Field.Root>
                          <Field.Label>Model</Field.Label>
                          <Input placeholder="gpt-5-mini" value={model} onChange={(e) => setModel(e.target.value)} />
                        </Field.Root>
                        <Field.Root>
                          <Field.Label>API Key</Field.Label>
                          <HStack>
                            <Input
                              type={showKey ? "text" : "password"}
                              placeholder="sk-..."
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                            />
                            <Button onClick={() => setShowKey((v) => !v)}>{showKey ? "Hide" : "Show"}</Button>
                          </HStack>
                        </Field.Root>
                        <Field.Root>
                          <Field.Label>Base URL (optional)</Field.Label>
                          <Input
                            placeholder="https://api.openai.com/v1"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                          />
                        </Field.Root>
                      </VStack>
                    </Box>
                    <Box display={activeSection === "display" ? "block" : "none"} {...sectionContainerProps}>
                      <SectionHeader sectionId="display" />
                      <VStack align="stretch" gap="md">
                        <Field.Root>
                          <Field.Label>Theme</Field.Label>
                          <HStack>
                            <Button
                              variant={theme === "light" ? "solid" : "ghost"}
                              size="sm"
                              onClick={() => handleThemeSelect("light")}
                              aria-pressed={theme === "light"}
                            >
                              Light
                            </Button>
                            <Button
                              variant={theme === "dark" ? "solid" : "ghost"}
                              size="sm"
                              onClick={() => handleThemeSelect("dark")}
                              aria-pressed={theme === "dark"}
                            >
                              Dark
                            </Button>
                          </HStack>
                        </Field.Root>
                        <Field.Root>
                          <Field.Label>Desktop Wallpaper</Field.Label>
                          <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap="sm">
                            {wallpapers.map((wallpaper) => {
                              const name = wallpaper.split("/").pop() ?? wallpaper;
                              const previewUrl = wallpaperPreviews[wallpaper];
                              const isSelected = selectedWallpaper === wallpaper;
                              return (
                                <Box
                                  key={wallpaper}
                                  as="button"
                                  onClick={() => setSelectedWallpaper(wallpaper)}
                                  borderWidth="1px"
                                  borderColor="border.primary"
                                  borderRadius="md"
                                  padding="sm"
                                  bg={isSelected ? "background.secondary" : "background.primary"}
                                  textAlign="center"
                                  display="flex"
                                  flexDirection="column"
                                  gap="xs"
                                  cursor="pointer"
                                  transition="background-color 0.2s ease, border-color 0.2s ease"
                                  _hover={{ bg: "background.secondary" }}
                                  _focusVisible={{
                                    outline: "none",
                                    boxShadow: "0 0 0 2px var(--chakra-colors-blue-500)",
                                  }}
                                >
                                  <Box
                                    borderRadius="sm"
                                    overflow="hidden"
                                    height="100px"
                                    bg="background.subtle"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                  >
                                    {previewUrl ? (
                                      <chakra.img
                                        src={previewUrl}
                                        alt={`${name} wallpaper preview`}
                                        width="100%"
                                        height="100%"
                                        objectFit="cover"
                                      />
                                    ) : (
                                      <Text fontSize="sm" color="fg.muted">
                                        Preview unavailable
                                      </Text>
                                    )}
                                  </Box>
                                  <Text fontWeight="medium">{name}</Text>
                                </Box>
                              );
                            })}
                          </SimpleGrid>
                        </Field.Root>
                      </VStack>
                    </Box>
                    <Box display={activeSection === "permissions" ? "block" : "none"} {...sectionContainerProps}>
                      <SectionHeader sectionId="permissions" />
                      <Flex gap="xs" direction="column" width="100%">
                        <Text>Approval-gated tools</Text>
                        <VStack align="stretch">
                          {DEFAULT_APPROVAL_GATED_TOOLS.map((tool) => (
                            <Checkbox.Root
                              key={tool}
                              checked={approvalTools.includes(tool)}
                              onCheckedChange={(e) => {
                                setApprovalTools((prev) =>
                                  e.checked ? [...prev, tool] : prev.filter((t) => t !== tool),
                                );
                              }}
                            >
                              <Checkbox.HiddenInput />
                              <Checkbox.Control />
                              <Checkbox.Label>{TOOL_LABELS[tool]}</Checkbox.Label>
                            </Checkbox.Root>
                          ))}
                        </VStack>
                      </Flex>
                    </Box>
                    <Box display={activeSection === "mcp" ? "block" : "none"} {...sectionContainerProps}>
                      <SectionHeader sectionId="mcp" />
                      <Flex gap="xs" direction="column" width="100%">
                        <Text>MCP servers</Text>
                        <Text fontSize="sm" color="fg.muted">
                          Configure remote MCP endpoints to surface their tools in the playground.
                        </Text>
                        <VStack align="stretch" gap="sm">
                          {mcpServers.length === 0 ? (
                            <Flex align="center" borderRadius="md" borderWidth="1px" justify="space-between" p="md">
                              <Text color="fg.muted">No MCP servers configured.</Text>
                            </Flex>
                          ) : (
                            mcpServers.map((server) => (
                              <McpServerCard
                                key={server.id}
                                server={server}
                                enabled={activeMcpServerIds.includes(server.id)}
                                tokenVisible={showServerTokens[server.id] ?? false}
                                onToggleEnabled={toggleServerActive}
                                onRemove={removeMcpServer}
                                onChange={updateMcpServer}
                                onToggleTokenVisibility={toggleServerTokenVisibility}
                              />
                            ))
                          )}
                        </VStack>
                        <Button alignSelf="flex-start" size="sm" variant="outline" onClick={addMcpServer}>
                          Add MCP server
                        </Button>
                      </Flex>
                    </Box>
                    <Box display={activeSection === "plugins" ? "block" : "none"} {...sectionContainerProps}>
                      <SectionHeader sectionId="plugins" />
                      <PluginSettings ref={pluginSettingsRef} isOpen={isOpen} />
                    </Box>
                    <Box display={activeSection === "danger" ? "block" : "none"} {...sectionContainerProps}>
                      <SectionHeader sectionId="danger" />
                      <VStack align="stretch" gap="md">
                        <Alert.Root status="error" variant="subtle">
                          <Alert.Indicator />
                          <Alert.Content>
                            <Alert.Title fontWeight="bold">Reset playground</Alert.Title>
                            <Alert.Description>
                              Remove all files under <chakra.code>{ROOT}</chakra.code> and restore the default
                              playground contents.
                            </Alert.Description>
                          </Alert.Content>
                        </Alert.Root>
                        <Button
                          alignSelf={{ base: "stretch", sm: "flex-start" }}
                          size="sm"
                          variant="solid"
                          colorPalette="red"
                          onClick={openResetProject}
                        >
                          <Flex as="span" align="center" gap="xs">
                            <Box as="span" aria-hidden display="flex" alignItems="center">
                              <TriangleAlert size={16} />
                            </Box>
                            <chakra.span>Reset playground</chakra.span>
                          </Flex>
                        </Button>
                      </VStack>
                    </Box>
                  </Box>
                </Flex>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer gap="sm">
              <Button onClick={save} variant="solid" loading={savingSettings} disabled={savingSettings}>
                Save
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
      <DeleteConfirmationModal
        open={resetProjectOpen}
        onClose={closeResetProject}
        onDelete={handleResetProject}
        headline="Reset playground"
        notificationText={`Remove all files under "${ROOT}" and restore default files?`}
        buttonText="Reset playground"
        closeOnInteractOutside={false}
      />
    </>
  );
}
