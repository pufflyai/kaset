import type { Tool } from "@pstdio/tiny-ai-tasks";
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

export function createToolsForCommands(
  commands: Array<CommandDefinition & { pluginId: string }>,
  runner: (pluginId: string, commandId: string, params?: unknown) => Promise<unknown | void>,
): Tool[] {
  return commands.map((command) => ({
    definition: {
      name: sanitizeToolName(command.pluginId, command.id),
      description: command.description?.trim() || command.title || `${command.pluginId}:${command.id}`,
      parameters: toSchema(command.parameters),
    },
    async run(params, { toolCall }) {
      const result = await runner(command.pluginId, command.id, params);

      const payload = {
        success: true as const,
        pluginId: command.pluginId,
        commandId: command.id,
        title: command.title,
        description: command.description,
        parameters: params,
        result,
      };

      return {
        data: payload,
        messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
      };
    },
  }));
}
