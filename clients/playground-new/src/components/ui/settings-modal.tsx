import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { McpServerConfig } from "@/state/types";
import {
  Alert,
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  Field,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { DEFAULT_APPROVAL_GATED_TOOLS } from "@pstdio/kas";
import { shortUID } from "@pstdio/prompt-utils";
import { useEffect, useState } from "react";
import { McpServerCard } from "./mcp-server-card";

const TOOL_LABELS: Record<string, string> = {
  opfs_write_file: "Write file",
  opfs_delete_file: "Delete file",
  opfs_patch: "Apply patch",
  opfs_upload_files: "Upload files",
  opfs_move_file: "Move file",
};

export function SettingsModal(props: { isOpen: boolean; onClose: () => void }) {
  const { isOpen, onClose } = props;

  const [apiKey, setApiKey] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [model, setModel] = useState<string>("gpt-5-mini");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [approvalTools, setApprovalTools] = useState<string[]>([...DEFAULT_APPROVAL_GATED_TOOLS]);
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>([]);
  const [activeMcpServerIds, setActiveMcpServerIds] = useState<string[]>([]);
  const [showServerTokens, setShowServerTokens] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;

    const snapshot = useWorkspaceStore.getState();
    setApiKey(snapshot.settings.apiKey ?? "");
    setBaseUrl(snapshot.settings.baseUrl ?? "");
    setModel(snapshot.settings.modelId || "gpt-5-mini");
    setApprovalTools(snapshot.settings.approvalGatedTools || [...DEFAULT_APPROVAL_GATED_TOOLS]);

    const storedServers = snapshot.settings.mcpServers;
    const effectiveServers = storedServers ?? [];
    const hasServers = effectiveServers.length > 0;

    setMcpServers(hasServers ? effectiveServers.map((server) => ({ ...server })) : []);

    setActiveMcpServerIds(() => {
      if (!hasServers) return [];

      const storedActiveIds = snapshot.settings.activeMcpServerIds;

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

  const save = () => {
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

    useWorkspaceStore.setState(
      (state) => {
        state.settings.apiKey = apiKey || undefined;
        state.settings.baseUrl = baseUrl || undefined;
        state.settings.modelId = model || "gpt-5-mini";
        state.settings.approvalGatedTools = [...approvalTools];
        state.settings.mcpServers = sanitizedServers.map((server) => ({ ...server }));
        state.settings.activeMcpServerIds = nextActiveIds.length > 0 ? [...nextActiveIds] : [];

        if ((state as Record<string, unknown>).selectedMcpServerId) {
          delete (state as Record<string, unknown>).selectedMcpServerId;
        }
      },
      false,
      "settings/save-llm-config",
    );

    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} closeOnInteractOutside={false}>
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
            <VStack gap="md">
              <Alert.Root status="info">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title fontWeight="bold">Local Playground</Alert.Title>
                  <Alert.Description>
                    Everything you create and configure here stays on your device. No data is uploaded or stored in the
                    cloud.
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
              <Flex gap="xs" direction="column" width="100%">
                <Text>Approval-gated tools</Text>
                <VStack align="stretch">
                  {DEFAULT_APPROVAL_GATED_TOOLS.map((tool) => (
                    <Checkbox.Root
                      key={tool}
                      checked={approvalTools.includes(tool)}
                      onCheckedChange={(e) => {
                        setApprovalTools((prev) => (e.checked ? [...prev, tool] : prev.filter((t) => t !== tool)));
                      }}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label>{TOOL_LABELS[tool]}</Checkbox.Label>
                    </Checkbox.Root>
                  ))}
                </VStack>
              </Flex>
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
            </VStack>
          </Dialog.Body>
          <Dialog.Footer gap="sm">
            <Button onClick={save} variant="solid">
              Save
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
