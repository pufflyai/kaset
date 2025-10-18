export type Role = "system" | "user" | "assistant" | "tool" | "developer";

export interface MessageContentPart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface TextContentPart extends MessageContentPart {
  type: "text";
  text: string;
}

export type MessageContent = string | null | MessageContentPart[];

export interface BaseMessage {
  role: Role;
  content: MessageContent;
}

export interface UserMessage extends BaseMessage {
  role: "user";
  name?: string;
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
  name?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface ToolMessage extends BaseMessage {
  role: "tool";
  tool_call_id: string;
  content: string | TextContentPart[];
}

export const messageContentToString = (content: MessageContent | undefined | null): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const text = (part as any).text;
        return typeof text === "string" ? text : "";
      })
      .join("");
  }

  if (content == null) return "";
  return String(content);
};
