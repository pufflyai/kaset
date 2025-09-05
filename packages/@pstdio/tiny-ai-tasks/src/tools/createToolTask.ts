import { task } from "../runtime";
import { ToolCall } from "../utils/messageTypes";
import { toolNotFound, invalidToolCall } from "../utils/errors";
import type { Tool } from "./Tool";

export interface ToolResult<T = unknown> {
  messages: Array<{ role: "tool"; tool_call_id: string; content: string }>;
  error?: unknown;
  data?: T;
}

export function createToolTask(tools: Tool<any, any>[]) {
  return task("call_tool", async function* (call: ToolCall): AsyncGenerator<ToolResult, ToolResult, unknown> {
    const tool = tools.find((t) => t.definition.name === call.function.name);

    if (!tool) {
      const error = toolNotFound(call.function.name);
      const res: ToolResult = {
        messages: [
          {
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              success: false,
              error: { code: "TOOL_NOT_FOUND", tool: call.function.name },
            }),
          },
        ],
        error,
      };
      yield res;
      return res;
    }

    let params: any;
    try {
      params = JSON.parse(call.function.arguments || "{}");
    } catch {
      const error = invalidToolCall(call.function.name);
      const res: ToolResult = {
        messages: [
          {
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              success: false,
              error: { code: "INVALID_TOOL_CALL", tool: call.function.name },
            }),
          },
        ],
        error,
      };
      yield res;
      return res;
    }

    const schema: any = tool.definition?.parameters;
    const propKeys = schema?.type === "object" && schema?.properties ? Object.keys(schema.properties) : [];
    const singlePropKey = propKeys.length === 1 ? propKeys[0] : undefined;

    const declaredArgs = typeof tool.run === "function" ? tool.run.length : 1;
    const firstParam = tool.run
      .toString()
      .match(/^[^(]*\(([^)]*)\)/)?.[1]
      ?.trim();
    const isDestructured = firstParam?.startsWith("{");

    let callArg: any = params;
    if (
      singlePropKey &&
      declaredArgs <= 1 &&
      !isDestructured &&
      params &&
      typeof params === "object" &&
      singlePropKey in params
    ) {
      callArg = params[singlePropKey];
    }

    try {
      const result = await tool.run(callArg, { toolCall: call } as any);

      const isToolResult = result && typeof result === "object" && "messages" in (result as any);
      const res: ToolResult = isToolResult
        ? (result as ToolResult)
        : {
            data: result,
            messages: [
              {
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({ success: true, data: result }),
              },
            ],
          };

      yield res;
      return res;
    } catch (err) {
      const res: ToolResult = {
        messages: [
          {
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              success: false,
              error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
            }),
          },
        ],
        error: err,
      };
      yield res;
      return res;
    }
  });
}
