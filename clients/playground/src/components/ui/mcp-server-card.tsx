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
  index: number;
  isActive: boolean;
  tokenVisible: boolean;
  status: McpClientStatus;
  error?: unknown;
  onSetActive: (id: string) => void;
  onRemove: (id: string) => void;
  onChange: (id: string, patch: Partial<McpServerConfig>) => void;
  onToggleTokenVisibility: (id: string) => void;
}

export function McpServerCard(props: McpServerCardProps) {
  const {
    server,
    index,
    isActive,
    tokenVisible,
    status,
    error,
    onSetActive,
    onRemove,
    onChange,
    onToggleTokenVisibility,
  } = props;

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

  const { label: statusLabel, color: statusColor } = STATUS_LABELS[status];

  const errorMessage = (() => {
    if (status !== "error" || error == null) return undefined;
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error.trim()) return error.trim();
    return String(error);
  })();

  return (
    <Flex direction="column" gap="sm" borderRadius="md" borderWidth="1px" p="md">
      <Flex align="center" justify="space-between">
        <HStack gap="xs">
          <Text fontWeight="medium">Server {index + 1}</Text>
          {isActive ? (
            <Text fontSize="xs" color="fg.muted">
              Active
            </Text>
          ) : null}
        </HStack>
        <HStack gap="xs">
          <Button size="xs" variant={isActive ? "solid" : "outline"} onClick={() => onSetActive(server.id)}>
            {isActive ? "Active" : "Set active"}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onRemove(server.id)}>
            Remove
          </Button>
        </HStack>
      </Flex>
      <Text fontSize="xs" color={statusColor}>
        Status: {statusLabel}
      </Text>
      {errorMessage ? (
        <Text fontSize="xs" color="red.500">
          {errorMessage}
        </Text>
      ) : null}
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
