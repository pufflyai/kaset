import { describe, expect, it, vi } from "vitest";
import { createToolsForCommands } from "./tiny-ai-tasks";

describe("createToolsForCommands", () => {
  it("creates tool definitions with sanitized names and schema defaults", () => {
    const runner = vi.fn();
    const [toolWithDescription, toolWithFallback] = createToolsForCommands(
      [
        {
          pluginId: "demo-plugin",
          id: "command-1",
          title: "First Command",
          description: "  Provides first command  ",
          parameters: { type: "object", properties: { query: { type: "string" } } },
        },
        {
          pluginId: "demo-plugin",
          id: "bad/command",
          title: "Second Command",
          parameters: null,
        },
      ],
      runner,
    );

    expect(toolWithDescription.definition).toEqual({
      name: "plugin_demo-plugin_command-1",
      description: "Provides first command",
      parameters: { type: "object", properties: { query: { type: "string" } } },
    });

    expect(toolWithFallback.definition).toEqual({
      name: "plugin_demo-plugin_bad_command",
      description: "Second Command",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    });
  });

  it("runs commands through the provided runner and returns a tool response", async () => {
    const runner = vi.fn(async () => ({ status: "ok" }));
    const [tool] = createToolsForCommands(
      [
        {
          pluginId: "plugin-one",
          id: "execute",
          title: "Execute",
          description: "Run the command",
        },
      ],
      runner,
    );

    const params = { text: "hello" };
    const result = await tool.run(params, { toolCall: { id: "call-123" } } as any);

    expect(runner).toHaveBeenCalledWith("plugin-one", "execute", params);
    expect(result.data).toEqual({
      success: true,
      pluginId: "plugin-one",
      commandId: "execute",
      title: "Execute",
      description: "Run the command",
      parameters: params,
      result: { status: "ok" },
    });
    expect(result.messages).toEqual([
      {
        role: "tool",
        tool_call_id: "call-123",
        content: JSON.stringify(result.data),
      },
    ]);
  });
});
