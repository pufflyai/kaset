export interface ToolDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface ToolConfig {
  /** Original tool call returned by the LLM. */
  toolCall?: { id?: string; function: { name: string; arguments: string } };
}

export interface Tool<TParams = unknown, TResult = unknown> {
  definition: ToolDefinition;
  run: (params: TParams, config: ToolConfig) => Promise<TResult>;
}

export function Tool<TParams, TResult>(
  run: (params: TParams, config: ToolConfig) => Promise<TResult>,
  definition: ToolDefinition,
): Tool<TParams, TResult> {
  return { definition, run };
}
