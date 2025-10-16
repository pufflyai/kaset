import type { Task } from "@pstdio/tiny-tasks";
import { task } from "../runtime";
import type { Tool } from "../tools/Tool";
import { createToolTask } from "../tools/createToolTask";
import type { AssistantMessage, BaseMessage, ToolMessage } from "../utils/messageTypes";

export interface CallToolResult {
  messages: ToolMessage[];
  error?: unknown;
  data?: unknown;
}

export type MessageHistory = BaseMessage[];

type AgentInput = {
  history: MessageHistory;
  sessionId?: string;
};

export interface AgentOptions {
  /** Prepended to the initial history on each run */
  template?: MessageHistory;

  /** LLM/router that plans the next AssistantMessage and (optionally) tool calls */
  llm: Task<
    { messages: MessageHistory; tools?: Tool<any, any>[]; sessionId?: string } | MessageHistory,
    AssistantMessage
  >;

  /** Executable tools that the router can choose to call */
  tools?: Tool<any, any>[];

  /** Max dialogue turns (assistant → tools → assistant …) */
  maxTurns?: number;
}

export function createAgent({ template = [], llm, tools = [], maxTurns = 5 }: AgentOptions) {
  const callTool = createToolTask(tools);

  const agentTask = task<AgentInput, MessageHistory, MessageHistory>(
    "agent",
    async function* ({
      history: initialHistory,
      sessionId,
    }: AgentInput): AsyncGenerator<MessageHistory, MessageHistory> {
      let history: MessageHistory = [...template, ...initialHistory];

      for (let turn = 0; turn < maxTurns; turn++) {
        let assistant: AssistantMessage | undefined;

        for await (const [msg, snap] of llm({ messages: history, tools, sessionId })) {
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

  type AgentTaskRunOptions = Parameters<typeof agentTask>[1] & { sessionId?: string };
  type AgentTask = Task<MessageHistory, MessageHistory, MessageHistory> & {
    (initial: MessageHistory, opts?: AgentTaskRunOptions): ReturnType<typeof agentTask>;
    invoke(initial: MessageHistory, opts?: AgentTaskRunOptions): ReturnType<typeof agentTask.invoke>;
    resume(resumeVal: unknown, opts?: AgentTaskRunOptions): ReturnType<typeof agentTask.resume>;
  };

  const run = (initial: MessageHistory, opts?: AgentTaskRunOptions): ReturnType<typeof agentTask> => {
    const { sessionId, ...rest } = opts ?? {};
    return agentTask({ history: initial, sessionId }, rest as Parameters<typeof agentTask>[1]);
  };

  run.invoke = (initial: MessageHistory, opts?: AgentTaskRunOptions): ReturnType<typeof agentTask.invoke> => {
    const { sessionId, ...rest } = opts ?? {};
    return agentTask.invoke({ history: initial, sessionId }, rest as Parameters<typeof agentTask>[1]);
  };

  run.resume = (resumeVal: unknown, opts?: AgentTaskRunOptions): ReturnType<typeof agentTask.resume> => {
    return agentTask.resume(resumeVal, opts as Parameters<typeof agentTask.resume>[1]);
  };

  return run as AgentTask;
}
