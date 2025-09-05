import type { Tool } from "./Tool";

export interface OpenAITool {
  type: "function";
  function: Tool["definition"];
}

/**
 * Convert internal Tool objects to the format expected by OpenAI.
 */
export function toOpenAITools(tools: Tool[]): OpenAITool[] {
  return tools.map((t) => ({ type: "function", function: t.definition }));
}
