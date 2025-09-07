import type { MessageHistory } from "../agents/createAgent";

/**
 * Merge streamed message chunks into a stable conversation history.
 *
 * Behavior:
 * - Appends non-assistant messages as new entries (e.g., tool messages).
 * - For assistant messages, replaces the last assistant message in the current
 *   history (if present) to collapse streaming snapshots into a single entry.
 * - Returns a new array; does not mutate the provided history.
 */
export function mergeStreamingMessages(
  history: MessageHistory,
  newMessages: MessageHistory | undefined | null,
): MessageHistory {
  if (!newMessages || newMessages.length === 0) return history;

  let out = history.slice();

  for (const m of newMessages) {
    const last = out[out.length - 1];

    if (m.role === "assistant" && last?.role === "assistant") {
      // Collapse streaming assistant snapshots into a single message.
      out = out.slice(0, -1);
      out.push(m);
      continue;
    }

    out.push(m);
  }

  return out;
}
