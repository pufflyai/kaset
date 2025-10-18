import type { AssistantMessage, BaseMessage, ToolCall, ToolMessage } from "@pstdio/tiny-ai-tasks";
import { UIMessage, UIConversation } from "./types";

function extractMessageText(parts: UIMessage["parts"]) {
  return parts
    .map((part) => {
      const type = (part as any).type;
      if (type !== "text" && type !== "reasoning") return "";

      const text = (part as any).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function getLastUserText(conversation: UIConversation) {
  for (let i = conversation.length - 1; i >= 0; i--) {
    const m = conversation[i];
    if (m.role !== "user") continue;

    const textSegments = m.parts
      .filter((part) => (part as any).type === "text")
      .map((part) => {
        const text = (part as any).text;
        return typeof text === "string" ? text.trim() : "";
      })
      .filter(Boolean);

    const text = textSegments.join("\n\n");

    if (text) return text;
  }

  return undefined;
}

export function isToolOnlyAssistantMessage(m: UIMessage) {
  return m.role === "assistant" && m.parts.length > 0 && m.parts.every((p) => (p as any).type === "tool-invocation");
}

export function coerceJSONString(value: any) {
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(value);
    }
  }

  let result: string | undefined;

  try {
    result = JSON.stringify(value ?? {});
  } catch {
    result = undefined;
  }

  if (result !== undefined) return result;

  return JSON.stringify(String(value));
}

// Convert a UI Conversation into a BaseMessage[] including tool calls and results
export function toBaseMessages(conversation: UIConversation): BaseMessage[] {
  const history: BaseMessage[] = [];

  for (let i = 0; i < conversation.length; i++) {
    const m = conversation[i];

    if (m.meta?.hidden) continue;

    if (m.role === "developer") continue;

    if (m.role === "system") {
      const text = extractMessageText(m.parts);

      if (text) history.push({ role: "system", content: text });

      continue;
    }

    if (m.role === "user") {
      const text = extractMessageText(m.parts);

      if (text) history.push({ role: "user", content: text });

      continue;
    }

    if (m.role === "assistant") {
      // Group contiguous tool-only assistant messages into a single assistant tool_calls + tool results
      if (isToolOnlyAssistantMessage(m)) {
        const invocations: any[] = [];
        let j = i;

        while (j < conversation.length && isToolOnlyAssistantMessage(conversation[j])) {
          const parts = conversation[j].parts as any[];
          for (const p of parts) invocations.push((p as any).toolInvocation);
          j += 1;
        }

        const tool_calls: ToolCall[] = invocations.map((inv) => {
          const toolName = (inv?.type || "tool").replace(/^tool-/, "");
          const args = coerceJSONString(inv?.input ?? {});

          return {
            id: inv.toolCallId,
            type: "function",
            function: { name: toolName, arguments: args },
          } satisfies ToolCall;
        });

        const assistantToolCallMessage: AssistantMessage = { role: "assistant", content: null, tool_calls };
        history.push(assistantToolCallMessage);

        for (const inv of invocations) {
          const state = inv?.state;

          if (state === "output-available") {
            const content = coerceJSONString({ success: true, data: inv.output });
            const message: ToolMessage = { role: "tool", tool_call_id: inv.toolCallId, content };
            history.push(message);
          } else if (state === "output-error") {
            const content = coerceJSONString({ success: false, error: inv.errorText ?? "Tool error" });
            const message: ToolMessage = { role: "tool", tool_call_id: inv.toolCallId, content };
            history.push(message);
          }
        }

        i = j - 1; // skip grouped tool messages

        continue;
      }

      const text = extractMessageText(m.parts);

      if (text) history.push({ role: "assistant", content: text });
    }
  }

  return history;
}
