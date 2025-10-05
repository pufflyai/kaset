import type { Tool } from "@pstdio/tiny-ai-tasks";
import type { RegisteredCommand } from "../../host/context";

function safeName(pluginId: string, commandId: string) {
  return `plugin_${pluginId}_${commandId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function createToolsForCommands(
  commands: RegisteredCommand[],
  runner: (pluginId: string, commandId: string, params?: unknown) => Promise<void>,
): Tool[] {
  return commands.map((cmd) => ({
    definition: {
      name: safeName(cmd.pluginId, cmd.id),
      description: cmd.description?.trim() || cmd.title || `${cmd.pluginId}:${cmd.id}`,
      parameters: cmd.parameters ?? { type: "object", properties: {}, additionalProperties: false },
    },
    async run(params, { toolCall }) {
      await runner(cmd.pluginId, cmd.id, params);

      const payload = {
        success: true as const,
        pluginId: cmd.pluginId,
        commandId: cmd.id,
        title: cmd.title,
        description: cmd.description,
        parameters: params,
      };

      return {
        data: payload,
        messages: [{ role: "tool", tool_call_id: toolCall?.id ?? "", content: JSON.stringify(payload) }],
      };
    },
  }));
}
