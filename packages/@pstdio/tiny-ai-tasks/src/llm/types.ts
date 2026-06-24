import type { Task } from "@pstdio/tiny-tasks";
import type { Tool } from "../tools/Tool";
import type { AssistantMessage, BaseMessage } from "../utils/messageTypes";

/**
 * A model is a streaming Task that turns a message history (optionally with
 * tools) into an `AssistantMessage`. Provider factories such as `openaiModel`
 * return this shape, and the agent consumes it as its `llm`.
 */
export type Model = Task<
  { messages: BaseMessage[]; tools?: Tool<any, any>[]; sessionId?: string } | BaseMessage[],
  AssistantMessage,
  AssistantMessage
>;
