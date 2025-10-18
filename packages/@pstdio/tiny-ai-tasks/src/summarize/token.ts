import type { BaseMessage } from "../utils/messageTypes";
import { messageContentToString } from "../utils/messageTypes";

export interface TokenCounter {
  count(messages: BaseMessage[]): number;
}

/**
 * Deterministic, dependency-free token estimator.
 * Rough rule-of-thumb: ~4 chars per token + small per-message overhead.
 * Includes assistant.tool_calls payload (stringified) if present.
 */
export function roughCounter(): TokenCounter {
  const AVG_CHARS_PER_TOKEN = 4;
  const PER_MESSAGE_OVERHEAD = 4;

  return {
    count(messages: BaseMessage[]): number {
      let total = 0;

      for (const m of messages as any[]) {
        const roleLen = m.role?.length ?? 0;
        const contentLen = messageContentToString(m.content ?? "").length;

        total += PER_MESSAGE_OVERHEAD;
        total += Math.ceil((roleLen + contentLen) / AVG_CHARS_PER_TOKEN);

        if (m.tool_calls) {
          const tc = JSON.stringify(m.tool_calls);
          total += Math.ceil(tc.length / AVG_CHARS_PER_TOKEN);
        }

        if (m.meta?.summary) total += 1;
      }

      return total;
    },
  };
}
