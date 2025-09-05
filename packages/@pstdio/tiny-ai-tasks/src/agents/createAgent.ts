import type { Task } from "@pstdio/tiny-tasks";
import { task } from "../runtime";
import type { Tool } from "../tools/Tool";
import { createToolTask } from "../tools/createToolTask";
import type { AssistantMessage, BaseMessage } from "../utils/messageTypes";

export interface CallToolResult {
  messages: BaseMessage[];
  error?: unknown;
  data?: unknown;
}

export type MessageHistory = BaseMessage[];

export interface AgentOptions {
  /** Prepended to the initial history on each run */
  template?: MessageHistory;

  /** LLM/router that plans the next AssistantMessage and (optionally) tool calls */
  llm: Task<{ messages: MessageHistory; tools?: Tool<any, any>[] }, AssistantMessage>;

  /** Executable tools that the router can choose to call */
  tools?: Tool<any, any>[];

  /** Max dialogue turns (assistant → tools → assistant …) */
  maxTurns?: number;
}

export function createAgent({ template = [], llm, tools = [], maxTurns = 5 }: AgentOptions) {
  const callTool = createToolTask(tools);

  return task<MessageHistory, MessageHistory, MessageHistory>(
    "agent",
    async function* (initial: MessageHistory): AsyncGenerator<MessageHistory, MessageHistory> {
      let history: MessageHistory = [...template, ...initial];

      for (let turn = 0; turn < maxTurns; turn++) {
        let assistant: AssistantMessage | undefined;

        for await (const [msg, snap] of llm({ messages: history, tools })) {
          assistant = msg as AssistantMessage;

          if (snap) {
            // Only stream newly generated assistant content, never the initial history
            yield [msg as AssistantMessage];
          }
        }

        if (!assistant) return history;

        // Commit the assistant message to history
        history = [...history, assistant];
        yield [assistant];

        const calls = assistant.tool_calls ?? [];

        if (calls.length === 0) {
          // No tool calls — we're done for this turn loop
          return history;
        }

        // Execute tool calls in-order and append resulting messages
        for (const tc of calls) {
          let result: CallToolResult | undefined;

          for await (const [res] of callTool(tc)) {
            result = res as CallToolResult;
          }

          if (result?.messages?.length) {
            history = [...history, ...result.messages];
            yield [...result.messages];
          }
        }
      }

      return history;
    },
  );
}
