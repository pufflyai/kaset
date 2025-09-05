export type Role = "system" | "user" | "assistant" | "tool" | "developer";

export interface BaseMessage {
  role: Role;
  content: string | null;
}

export interface ToolCall {
  id: string;
  type?: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface AssistantMessage extends BaseMessage {
  role: "assistant";
  tool_calls?: ToolCall[];
  // Optional metadata for observability
  durationMs?: number;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}
