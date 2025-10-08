import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "./Tool";

type CallToolResult = {
  content?: Array<{ type?: string; text?: string; [key: string]: unknown }>;
  structuredContent?: unknown;
  isError?: boolean;
  message?: string;
  [key: string]: unknown;
};

type RemoteTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

function extractMessage(result: CallToolResult): string | undefined {
  if (typeof result.message === "string" && result.message.trim()) return result.message.trim();

  if (Array.isArray(result.content)) {
    const text = result.content
      .map((entry) => {
        if (!entry) return "";
        if (typeof entry.text === "string" && entry.text.trim()) return entry.text.trim();
        return "";
      })
      .filter(Boolean)
      .join("\n");

    if (text) return text;
  }

  return undefined;
}

function normalizeResult(result: CallToolResult) {
  const message = extractMessage(result);

  return {
    success: !(result.isError ?? false),
    message,
    structuredContent: result.structuredContent,
    content: result.content,
  };
}

export function createMcpTool(client: Client, tool: RemoteTool): Tool {
  const parameters = tool.inputSchema;

  return {
    definition: {
      name: tool.name,
      description: tool.description || undefined,
      parameters,
    },
    async run(callArguments, _config) {
      const result = await client.callTool({
        name: tool.name,
        arguments: callArguments as Record<string, unknown>,
      });

      return normalizeResult(result);
    },
  };
}
