import type { BaseMessage, ToolCall } from "@pstdio/tiny-ai-tasks";
import type { Message, UIConversation } from "../../types";

export function uid(): string {
  return crypto.randomUUID();
}

export function getLastUserText(conversation: UIConversation): string | undefined {
  for (let i = conversation.length - 1; i >= 0; i--) {
    const m = conversation[i];
    if (m.role !== "user") continue;

    const text = m.parts
      .map((p) => ((p as any).type === "text" ? (p as any).text : ""))
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (text) return text;
  }

  return undefined;
}

export function isToolOnlyAssistantMessage(m: Message): boolean {
  return m.role === "assistant" && m.parts.length > 0 && m.parts.every((p) => (p as any).type === "tool-invocation");
}

export function coerceJSONString(value: any): string {
  try {
    if (typeof value === "string") {
      try {
        JSON.parse(value);
        return value;
      } catch {
        return JSON.stringify(value);
      }
    }

    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify(String(value));
  }
}

// Convert the UI conversation into a BaseMessage[] history including tool calls and results
export function toMessageHistory(conversation: UIConversation): BaseMessage[] {
  const history: BaseMessage[] = [];

  for (let i = 0; i < conversation.length; i++) {
    const m = conversation[i];

    if (m.role === "user") {
      const text = m.parts
        .map((p) => ((p as any).type === "text" ? (p as any).text : ""))
        .filter(Boolean)
        .join("\n\n")
        .trim();

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

        history.push({ role: "assistant", content: null, tool_calls } as any);

        for (const inv of invocations) {
          const state = inv?.state;

          if (state === "output-available") {
            const content = coerceJSONString({ success: true, data: inv.output });
            history.push({ role: "tool", tool_call_id: inv.toolCallId, content } as any);
          } else if (state === "output-error") {
            const content = coerceJSONString({ success: false, error: inv.errorText ?? "Tool error" });
            history.push({ role: "tool", tool_call_id: inv.toolCallId, content } as any);
          }
        }

        i = j - 1; // skip grouped tool messages
        continue;
      }

      const text = m.parts
        .map((p) => ((p as any).type === "text" ? (p as any).text : ""))
        .filter(Boolean)
        .join("\n\n")
        .trim();

      if (text) history.push({ role: "assistant", content: text });
    }
  }

  return history;
}
