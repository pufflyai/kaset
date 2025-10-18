declare module "@pstdio/tiny-ai-tasks" {
  export interface ToolDefinition {
    name: string;
    description?: string;
    parameters?: unknown;
  }

  export interface ToolConfig {
    toolCall?: { id?: string; function: { name: string; arguments: string } };
  }

  export interface Tool<TParams = unknown, TResult = unknown> {
    definition: ToolDefinition;
    run: (params: TParams, config: ToolConfig) => Promise<TResult>;
  }
}
