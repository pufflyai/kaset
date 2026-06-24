import type { BaseMessage, ToolCall } from "../utils/messageTypes";
import { messageContentToString } from "../utils/messageTypes";

/**
 * WebLLM gates its native `tools` parameter to a hard-coded allowlist of
 * Hermes models, and even those reject a caller-provided system prompt. To run
 * tool calling on any instruction-following model (e.g. Gemma) we replicate the
 * mechanism ourselves: describe the tools in the system prompt, let the model
 * emit `<tool_call>` blocks, and parse them back into structured tool calls.
 */

const TOOL_CALL_PATTERN = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;

export function buildToolCallingSystemPrompt(toolDefs: unknown[]): string {
  return [
    "You can call tools to help answer the user. The available tools are described",
    "as JSON schemas inside the <tools></tools> block:",
    "<tools>",
    JSON.stringify(toolDefs),
    "</tools>",
    "",
    "When you want to call a tool, emit a block of exactly this form:",
    '<tool_call>{"name": "<tool_name>", "arguments": {<json arguments>}}</tool_call>',
    "Emit one <tool_call> block per call, and you may emit several to call multiple tools.",
    "Only use tool names from the list above and follow their JSON schemas.",
    "If no tool is needed, answer the user directly without any <tool_call> block.",
  ].join("\n");
}

/** Append the tool-calling instructions to the first system message (or prepend one). */
export function injectToolCallingPrompt(messages: BaseMessage[], toolDefs: unknown[]): BaseMessage[] {
  const prompt = buildToolCallingSystemPrompt(toolDefs);
  const systemIndex = messages.findIndex((message) => message.role === "system");

  if (systemIndex === -1) {
    return [{ role: "system", content: prompt }, ...messages];
  }

  const system = messages[systemIndex];
  const merged: BaseMessage = {
    ...system,
    content: `${messageContentToString(system.content)}\n\n${prompt}`,
  };

  const next = messages.slice();
  next[systemIndex] = merged;
  return next;
}

export interface ParsedToolCalls {
  /** The output text with all `<tool_call>` blocks removed. */
  content: string;
  toolCalls: ToolCall[];
}

/** Extract `<tool_call>` blocks from model output into structured tool calls. */
export function parseToolCalls(text: string, idPrefix: string): ParsedToolCalls {
  const toolCalls: ToolCall[] = [];
  let index = 0;

  for (const match of text.matchAll(TOOL_CALL_PATTERN)) {
    const raw = match[1].trim();

    try {
      const parsed = JSON.parse(raw);
      const name = parsed?.name;
      if (typeof name !== "string") continue;

      const args = parsed.arguments ?? parsed.parameters ?? {};

      toolCalls.push({
        id: `call_${idPrefix}_${index}`,
        type: "function",
        function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) },
      });

      index += 1;
    } catch {
      // Ignore malformed tool-call blocks; treat them as plain text.
    }
  }

  const content = toolCalls.length ? text.replace(TOOL_CALL_PATTERN, "").trim() : text;
  return { content, toolCalls };
}
