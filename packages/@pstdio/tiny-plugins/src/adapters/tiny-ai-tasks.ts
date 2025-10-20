import type { Tool, ToolMessage, ToolResult } from "@pstdio/tiny-ai-tasks";
import type { CommandDefinition } from "../core/types";

function sanitizeToolName(pluginId: string, commandId: string) {
  return `plugin_${pluginId}_${commandId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function toSchema(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { type: "object", properties: {}, additionalProperties: false };
}

type PluginCommandToolPayload = {
  success: true;
  pluginId: string;
  commandId: string;
  title?: string;
  description?: string;
  parameters: unknown;
  result: unknown;
};

type PluginCommandToolResult = ToolResult<PluginCommandToolPayload>;

export function createToolsForCommands(
  commands: Array<CommandDefinition & { pluginId: string }>,
  runner: (pluginId: string, commandId: string, params?: unknown) => Promise<unknown | void>,
): Tool<unknown, PluginCommandToolResult>[] {
  return commands.map((command) => {
    const tool: Tool<unknown, PluginCommandToolResult> = {
      definition: {
        name: sanitizeToolName(command.pluginId, command.id),
        description: command.description?.trim() || command.title || `${command.pluginId}:${command.id}`,
        parameters: toSchema(command.parameters),
      },
      async run(params, { toolCall }) {
        const result = await runner(command.pluginId, command.id, params);

        const payload: PluginCommandToolPayload = {
          success: true,
          pluginId: command.pluginId,
          commandId: command.id,
          title: command.title,
          description: command.description,
          parameters: params,
          result,
        };

        const message: ToolMessage = {
          role: "tool",
          tool_call_id: toolCall?.id ?? "",
          content: JSON.stringify(payload),
        };

        return {
          data: payload,
          messages: [message],
        };
      },
    };

    return tool;
  });
}
