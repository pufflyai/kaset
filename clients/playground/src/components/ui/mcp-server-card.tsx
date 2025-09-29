import { useMcpClient } from "@/services/mcp/useMcpService";
import type { McpClientStatus } from "@/services/mcp/useMcpService";
import type { McpServerConfig } from "@/state/types";
import { Button, Field, Flex, HStack, Input, Text } from "@chakra-ui/react";
import type { ChangeEvent } from "react";

const STATUS_LABELS: Record<McpClientStatus, { label: string; color: string }> = {
  idle: { label: "Idle", color: "fg.muted" },
  connecting: { label: "Connecting", color: "yellow.500" },
  ready: { label: "Ready", color: "green.500" },
  error: { label: "Error", color: "red.500" },
};

interface McpServerCardProps {
  server: McpServerConfig;
  enabled: boolean;
  tokenVisible: boolean;
  onToggleEnabled: (id: string) => void;
  onRemove: (id: string) => void;
  onChange: (id: string, patch: Partial<McpServerConfig>) => void;
  onToggleTokenVisibility: (id: string) => void;
}

export function McpServerCard(props: McpServerCardProps) {
  const { server, enabled, tokenVisible, onToggleEnabled, onRemove, onChange, onToggleTokenVisibility } = props;

  const trimmedUrl = server.url?.trim() ?? "";
  const connectionEnabled = enabled && Boolean(trimmedUrl);

  const { status, error } = useMcpClient({
    serverUrl: trimmedUrl || undefined,
    accessToken: server.accessToken,
    enabled: connectionEnabled,
  });

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(server.id, { name: event.target.value });
  };

  const handleUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(server.id, { url: event.target.value });
  };

  const handleTokenChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onChange(server.id, { accessToken: value ? value : undefined });
  };

  const { label: statusLabel, color: statusColor } = (() => {
    if (!enabled) {
      return { label: "Disabled", color: "fg.muted" };
    }

    if (!trimmedUrl) {
      return { label: "Enter a URL", color: "fg.muted" };
    }

    return STATUS_LABELS[status];
  })();

  const errorMessage = (() => {
    if (status !== "error" || !connectionEnabled || error == null) return undefined;
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error.trim()) return error.trim();
    return String(error);
  })();

  return (
    <Flex direction="column" gap="sm" borderRadius="md" borderWidth="1px" p="md">
      <Flex align="center" justify="space-between">
        <HStack gap="xs">
          <Text fontSize="xs" color={statusColor}>
            Status: {statusLabel}
          </Text>
          {errorMessage ? (
            <Text fontSize="xs" color="red.500">
              {errorMessage}
            </Text>
          ) : null}
        </HStack>
        <HStack gap="xs">
          <Button size="xs" variant={enabled ? "solid" : "outline"} onClick={() => onToggleEnabled(server.id)}>
            {enabled ? "Disable" : "Enable"}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onRemove(server.id)}>
            Remove
          </Button>
        </HStack>
      </Flex>
      <Field.Root>
        <Field.Label>Name</Field.Label>
        <Input placeholder="Example MCP server" value={server.name} onChange={handleNameChange} />
      </Field.Root>
      <Field.Root>
        <Field.Label>Server URL</Field.Label>
        <Input placeholder="https://example.com/mcp" value={server.url} onChange={handleUrlChange} />
      </Field.Root>
      <Field.Root>
        <Field.Label>Access token (optional)</Field.Label>
        <HStack>
          <Input
            type={tokenVisible ? "text" : "password"}
            placeholder="Bearer token"
            value={server.accessToken ?? ""}
            onChange={handleTokenChange}
          />
          <Button size="sm" variant="ghost" onClick={() => onToggleTokenVisibility(server.id)}>
            {tokenVisible ? "Hide" : "Show"}
          </Button>
        </HStack>
      </Field.Root>
    </Flex>
  );
}
