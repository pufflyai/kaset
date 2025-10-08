import type { Tool } from "@pstdio/tiny-ai-tasks";
import type { RegisteredCommand } from "../model/manifest";

function sanitizeToolName(pluginId: string, commandId: string) {
  return `plugin_${pluginId}_${commandId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function createToolsForCommands(
  commands: Array<RegisteredCommand & { pluginId: string }>,
  runner: (pluginId: string, commandId: string, params?: unknown) => Promise<void>,
): Tool[] {
  return commands.map((command) => ({
    definition: {
      name: sanitizeToolName(command.pluginId, command.id),
      description: command.description?.trim() || command.title || `${command.pluginId}:${command.id}`,
      parameters: command.parameters ?? { type: "object", properties: {}, additionalProperties: false },
    },
    async run(params, { toolCall }) {
      await runner(command.pluginId, command.id, params);

      const payload = {
        success: true as const,
        pluginId: command.pluginId,
        commandId: command.id,
        title: command.title,
        description: command.description,
        parameters: params,
      };

      return {
        data: payload,
        messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
      };
    },
  }));
}
