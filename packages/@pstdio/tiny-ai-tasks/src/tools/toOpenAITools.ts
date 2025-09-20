import type { Tool } from "./Tool";

export interface OpenAITool {
  type: "function";
  function: Tool["definition"];
}

function ensureObjectParameters(parameters: unknown): Record<string, unknown> {
  const schema = parameters as { type?: string; properties?: Record<string, unknown> };

  if (schema && typeof schema === "object" && (schema.type === "object" || schema.properties)) {
    return parameters as Record<string, unknown>;
  }

  return {
    type: "object",
    properties: {
      input: parameters ?? { type: "null" },
    },
    additionalProperties: false,
  };
}

/**
 * Convert internal Tool objects to the format expected by OpenAI.
 */
export function toOpenAITools(tools: Tool[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      ...tool.definition,
      parameters: ensureObjectParameters((tool.definition as { parameters?: unknown }).parameters),
    },
  }));
}
